# Payments and receipts

**Spec:** MASTER_SPEC C5. **Code:** [modules/payments/](../../backend/src/modules/payments):
`payments.service.ts` and `allocation.ts`. **Endpoints:** `payments.*`.

## One confirmation path

Every channel ends in the same function, `succeed()`. It runs in a
transaction with the payment row locked, so a duplicate webhook or a double
click can't issue a second receipt:

1. The payment becomes SUCCESS, with `paidAt` and the gateway payment id.
2. A **receipt** is issued, with a gapless number per financial year in the
   society's `receiptNumberFormat` (for example `SVCHS/R/2026-27/000241`).
3. A **ledger credit** is posted.
4. The money is **allocated** to bills.
5. The action is audited. After commit, the unit's residents and the payer are
   notified (PAYMENT: amount and receipt number), and realtime refreshes dues,
   bills, the ledger and the dashboard.

## Allocation

[allocation.ts](../../backend/src/modules/payments/allocation.ts) follows the society's
`allocationOrder`, which defaults to **interest → arrears → current**:
- **INTEREST:** unpaid interest on every open bill, oldest first.
- **ARREARS:** principal on every open bill except the latest, oldest first.
- **CURRENT:** principal on the latest bill.

Anything left over becomes an **advance**, an allocation with no bill. Advances
are applied automatically to the next bills published, oldest advance first.
Allocations are never edited; reversals add negative rows, and a bill's paid
columns always equal the sum of its allocations.

## Channels

| Channel | Endpoint | Behaviour |
|---|---|---|
| Online (resident) | `payments.start { unitId, amountPaise? }` | Only for a unit the caller acts for. With no amount, it charges everything due. Creates a CREATED payment and a gateway order, and returns the checkout details. Idempotent. |
| Dummy checkout | `payments.completeDummyCheckout { orderId, outcome, method }` | Only when `PAYMENT_GATEWAY=dummy`, and only by the payer. Builds the same event a real gateway would send, and goes through the webhook path. |
| Gateway webhook | `POST /webhooks/payments/:gateway` | Public. Must carry `x-gateway-signature`, an HMAC-SHA256 of the raw body with `PAYMENT_WEBHOOK_SECRET`. Idempotent by event id (stored in `gateway_events`; a replay is ignored). The amount must match the order. `payment.captured` → success; `payment.failed` → FAILED with a reason. |
| Cash, NEFT, RTGS, IMPS, UPI, other (desk) | `payments.record` (`payments.record` permission) | Succeeds immediately on the given date, which can't be in the future. Needs a reference for everything except cash. Idempotent. |
| Cheque (desk) | `payments.record` with mode CHEQUE → `payments.chequeAction { action: clear\|bounce }` | PENDING until cleared, with no receipt and no allocation yet (C5: provisional until cleared). Clearing runs the confirmation path; bouncing marks it FAILED with a reason. |

The resident app cancels a checkout it closes or lets expire
(`payments.cancelCheckout`, payer only, CREATED → CANCELLED). Anything left
CREATED for 30 minutes is cancelled by `payments.expire-checkouts`. A late
gateway success for a cancelled checkout is refused, not applied.

## Cancelling a receipt

`payments.cancelReceipt { reason }` (desk) applies to a successful payment only:
- reverses every allocation, so bills become unpaid again;
- marks the receipt CANCELLED;
- posts a ledger REVERSAL debit, and the payment becomes REVERSED;
- is audited and notified.

Nothing is deleted.

## Reading

| Endpoint | Returns |
|---|---|
| `payments.mine` | The resident's payments for their units, excluding abandoned checkouts |
| `payments.get` | One payment with its receipt and net allocations per bill. Residents see only their own units'. |
| `payments.list` | The collections desk. Filters: unit, status, mode, date range (on `paidAt`), and search by receipt number, reference or unit label. |

## Adding a real gateway

1. Add the gateway's name to `PAYMENT_GATEWAY`, then create the order and
   return its checkout fields in `start()`. The `Checkout` schema grows a
   variant per gateway.
2. Verify its webhook signature in `webhook()`, and map its payload to
   `GatewayWebhookBody` (event id, type, order id, payment id, amount).
3. Leave `handleGatewayEvent()` and `succeed()` untouched. Idempotency,
   receipts, allocation and notification come with them.
4. Add a reconciliation job that polls pending orders (MASTER_SPEC C5 `poll-pending-payments`).
