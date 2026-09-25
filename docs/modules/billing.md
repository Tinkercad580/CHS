# Billing

**Spec:** MASTER_SPEC B2, B3, C4. **Code:**
- [modules/billing/](../../backend/src/modules/billing):
  - `domain/apportion.ts`, `domain/interest.ts`: pure rules;
  - `engine.ts`: facts plus computation;
  - `heads.service.ts`, `bills.service.ts`.

**Endpoints:** `billing.*`.

> Every statutory number the engine uses comes from `statutory_config` and is
> still marked **unverified**. See [../compliance/RULES_REGISTER.md](../compliance/RULES_REGISTER.md)
> before billing a real society.

## Charge heads and rates

A **charge head** is one line on the bill:
- code and name (plus Marathi);
- a Rule 106C-12 **category**;
- an **apportionment method**;
- GST applicability;
- filters (unit types, buildings, occupancy, floor range);
- sort order;
- for percentage heads, the base head.

The **category fixes the allowed method** (`schemas.billing.ALLOWED_METHODS`),
and the server refuses any other pairing:

| Category | Method | `rate` means |
|---|---|---|
| SERVICE, ELECTION_FUND, OTHER_FUND, COMMON_AREA | EQUAL_PER_UNIT | paise per unit per month |
| WATER | PER_WATER_INLET | paise per inlet per month |
| LIFT | BUILDING_SCOPED_EQUAL | paise per flat, only in buildings with a lift (ground floor included) |
| PARKING | PER_PARKING_SLOT | paise per allotted slot per month |
| INSURANCE, LEASE_RENT, MAJOR_REPAIR_FUND | PER_CARPET_AREA | paise per sq ft per month (up to 4 decimals) |
| PROPERTY_TAX | MANUAL or PER_CARPET_AREA | per-unit amounts, or per sq ft |
| NON_OCCUPANCY | PERCENT_OF_HEAD | basis points of the **service charges** head; only for TENANTED units; capped by statute (10%) |
| SINKING_FUND, REPAIR_FUND | PERCENT_OF_CONSTRUCTION_COST | basis points a year of the building's construction cost, shared by carpet area (equally if any area is missing). Minimums 0.25% / 0.75%, with a resolution required. |
| EDUCATION_FUND | PER_MEMBER_FIXED_OR_MIN | paise per member per year, or the statutory minimum if higher |
| COMMERCIAL_SURCHARGE | FIXED_PER_UNIT_TYPE | `rateByType`: paise per month by unit type |
| LOAN, WELFARE_FUND, AMENITY, OTHER | MANUAL | per-unit monthly amounts in `unit_charges` |
| GB_APPROVED_OTHER | any | needs a general body resolution |

**Rates** (`billing.setRate`) are effective-dated:
- the previous rate is closed on the new one's date;
- a rate **can't start inside an already-published period**;
- fund, non-occupancy and cap rules are checked as of the rate's date.

`billing.simulate` shows who would pay what for a head as of a date.

## How a bill is computed

`computeRun()` in [engine.ts](../../backend/src/modules/billing/engine.ts) runs for the period's
start date. Everything is resolved **as of that date**, never "now":
- unit facts (area, inlets, lift, occupancy, slots, primary member, payer);
- building facts (lift, construction cost, total area);
- rates, manual charges, and statutory values.

For each active unit:

1. **Charge lines.** Heads are applied base-first, so a percentage head sees
   its base. Every line records its method, rate, rate id, input and a
   **basis** in plain words ("1,180 sq ft × ₹3.20", "10% of Service charges
   (₹1,800.00)"). Months are multiplied in for quarterly and half-yearly cycles.
2. **Interest** (B3.1):
   - simple interest on overdue **principal** only, never on earlier interest;
   - integrated day by day over what was actually outstanding in the window since the previous run;
   - a payment on the 10th stops interest on the amount it cleared from the 10th;
   - the rate is the society's, capped at the statutory maximum as of the period;
   - interest starts after the due date plus grace days.
3. **GST** (B3.6), only when the society is GST-registered **and**:
   - the unit's monthly charges exceed the member threshold;
   - the society's annualised billing exceeds the turnover threshold.

   It's charged on the whole taxable amount of the GST-applicable heads.
4. **Rounding** to the nearest rupee (configurable), as its own line.

**Exceptions** are collected, and never silently billed:
- no rate, or no carpet area where the method needs one;
- no construction cost, or a fund below its minimum;
- non-occupancy above the cap, or a method not allowed for the category;
- no primary owner;
- GST below the turnover threshold.

The run's **snapshot** records the config, statutory values and rates used,
so a published run explains itself. Recomputing an old period after rates
change reproduces it to the paisa. That's compliance test item 3.

## Bill runs

```
billing.createRun { period: "YYYY-MM" }  → DRAFT run + draft bills + preview
billing.recomputeRun                      → recalculate a draft (after changing rates, units, occupancy)
billing.publishRun                        → PUBLISHED (idempotent)
billing.discardRun                        → DISCARDED (drafts only)
```

**Rules:**
- One live run per period.
- Periods are billed in order.
- There must be billing config and at least one active head.
- The due date comes from the config's due day, and must not be before the bill date.

**Preview** (`billing.run`):
- totals by head and by building;
- units whose bill moved more than 10% against the last published run;
- the exceptions list.

**Publish**, all in one transaction with the run row locked:
1. Number the bills gaplessly per financial year, in unit-label order, using `billNumberFormat`.
2. Post a ledger debit for each bill.
3. Mark the units as billed; after that they can't be renumbered.
4. Apply each unit's advance balance to its new bill.
5. After commit, notify every resident of each unit (BILLING, push and email) with the amount, due date and head-wise breakup.

Draft bills are invisible to residents.

## Bills and corrections

- **`billing.bills`** lists bills with filters: unit, period, status, and state
  (UNPAID / PAID / OVERDUE, computed in the database), plus search by bill
  number, title, payer or unit label.
- **`billing.bill`** returns one bill with its lines. Residents can only open
  bills for their own units.
- **Published bills are immutable** in the database. There are two ways to correct one:
  - `billing.cancelBill { reason }` cancels an unpaid bill with a ledger
    reversal; reissue it with a supplementary bill or the next run;
  - `billing.creditNote { amountPaise, reason, billId? }` issues a numbered
    credit note that reduces principal on the named bill, or on the oldest
    first. It can't exceed what's outstanding.
- **`billing.adhocBills`** creates supplementary bills (a repair contribution, a
  penalty, a NOC fee) for any set of units. They're published at once, with
  their own numbers, and residents are notified.

## Ledger and dues

- **`billing.ledger`** is the unit statement: bill debits, payment and
  credit-note credits, and reversals, with a running balance and the unit's
  advance. The ledger is append-only in the database.
- **`billing.myDues`** is the resident's dues card for each of their units:
  - current (the latest bill's principal), arrears (older bills), interest, and the total due;
  - advance, next due date, days left;
  - `overdueSince` (the due date of the oldest overdue bill);
  - the open bills.
- **`billing.myBills`** is the resident's bill history.

## Manual charges

`billing.createUnitCharge` sets a monthly amount for one unit on a MANUAL head,
effective-dated: for example an AUTHORITY_FIXED property tax, or a second
parking slot.
