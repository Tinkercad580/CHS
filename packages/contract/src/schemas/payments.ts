import { z } from "zod";
import { Id, IsoDate, IsoDateTime, ListQuery, Paise } from "./common";

export const PAYMENT_STATUSES = ["CREATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REVERSED"] as const;
export const PAYMENT_MODES = ["ONLINE", "UPI", "CASH", "CHEQUE", "NEFT", "RTGS", "IMPS", "OTHER"] as const;

export const Receipt = z.object({
  id: Id,
  number: z.string(),
  amountPaise: Paise,
  date: IsoDate,
  status: z.enum(["ISSUED", "CANCELLED"]),
  cancelReason: z.string().nullable(),
});

export const Payment = z.object({
  id: Id,
  unitId: Id,
  unitLabel: z.string(),
  amountPaise: Paise,
  mode: z.enum(PAYMENT_MODES),
  status: z.enum(PAYMENT_STATUSES),
  gateway: z.string().nullable(),
  instrumentNo: z.string().nullable(),
  bankName: z.string().nullable(),
  remarks: z.string().nullable(),
  failureReason: z.string().nullable(),
  paidAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  receipt: Receipt.nullable(),
  allocations: z.array(z.object({ billId: Id.nullable(), billNumber: z.string().nullable(), bucket: z.enum(["INTEREST", "PRINCIPAL", "ADVANCE"]), amountPaise: Paise })),
});
export type Payment = z.infer<typeof Payment>;

export const PaymentListQuery = ListQuery.extend({
  unitId: Id.optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});

/** Pay online. Omit the amount to pay everything due. */
export const StartPaymentBody = z.object({ unitId: Id, amountPaise: Paise.min(100).optional() });

/**
 * What the app needs to open the gateway's checkout. The dummy gateway's
 * checkout is a sheet in the app that calls `completeDummyCheckout`; a real
 * gateway returns its own order id and key here instead.
 */
export const Checkout = z.object({
  payment: Payment,
  gateway: z.literal("dummy"),
  orderId: z.string(),
  amountPaise: Paise,
  description: z.string(),
});

export const DummyCheckoutBody = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["success", "failure"]),
  method: z.enum(["UPI", "CARD", "NETBANKING"]).default("UPI"),
});

export const RecordPaymentBody = z
  .object({
    unitId: Id,
    amountPaise: Paise.min(1),
    mode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "IMPS", "UPI", "OTHER"]),
    date: IsoDate,
    instrumentNo: z.string().trim().max(40).nullable().optional(),
    instrumentDate: IsoDate.nullable().optional(),
    bankName: z.string().trim().max(100).nullable().optional(),
    remarks: z.string().trim().max(300).nullable().optional(),
  })
  .refine((b) => b.mode === "CASH" || !!b.instrumentNo, { path: ["instrumentNo"], error: "Enter the cheque or transaction reference" });

export const ChequeActionBody = z.object({ action: z.enum(["clear", "bounce"]), reason: z.string().trim().max(300).optional() });
export const CancelReceiptBody = z.object({ reason: z.string().trim().min(5).max(300) });

/** Gateway webhook, as the dummy gateway sends it (HMAC-SHA256 of the body in `x-gateway-signature`). */
export const GatewayWebhookBody = z.object({
  eventId: z.string().min(1).max(120),
  type: z.enum(["payment.captured", "payment.failed"]),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  amountPaise: Paise,
  reason: z.string().optional(),
});
