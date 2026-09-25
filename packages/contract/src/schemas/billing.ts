import { z } from "zod";
import { Id, IsoDate, IsoDateTime, ListQuery, Paise, ResolutionRef } from "./common";

export const CHARGE_CATEGORIES = [
  "SERVICE", "PROPERTY_TAX", "WATER", "LIFT", "PARKING", "NON_OCCUPANCY", "INSURANCE", "LEASE_RENT", "LOAN",
  "SINKING_FUND", "REPAIR_FUND", "MAJOR_REPAIR_FUND", "EDUCATION_FUND", "ELECTION_FUND", "WELFARE_FUND", "OTHER_FUND",
  "AMENITY", "COMMON_AREA", "COMMERCIAL_SURCHARGE", "GB_APPROVED_OTHER", "OTHER",
] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];

export const APPORTIONMENT_METHODS = [
  "EQUAL_PER_UNIT", "PER_CARPET_AREA", "PER_WATER_INLET", "BUILDING_SCOPED_EQUAL", "PER_PARKING_SLOT",
  "PERCENT_OF_HEAD", "PERCENT_OF_CONSTRUCTION_COST", "PER_MEMBER_FIXED_OR_MIN", "FIXED_PER_UNIT_TYPE", "MANUAL",
] as const;
export type ApportionmentMethod = (typeof APPORTIONMENT_METHODS)[number];

/**
 * Rule 106C-12(3): which apportionment each charge may use. The server
 * refuses any other pairing; clients use this to offer only valid choices.
 */
export const ALLOWED_METHODS: Record<ChargeCategory, readonly ApportionmentMethod[]> = {
  SERVICE: ["EQUAL_PER_UNIT"],
  PROPERTY_TAX: ["MANUAL", "PER_CARPET_AREA"],
  WATER: ["PER_WATER_INLET"],
  LIFT: ["BUILDING_SCOPED_EQUAL"],
  PARKING: ["PER_PARKING_SLOT"],
  NON_OCCUPANCY: ["PERCENT_OF_HEAD"],
  INSURANCE: ["PER_CARPET_AREA"],
  LEASE_RENT: ["PER_CARPET_AREA"],
  LOAN: ["MANUAL"],
  SINKING_FUND: ["PERCENT_OF_CONSTRUCTION_COST"],
  REPAIR_FUND: ["PERCENT_OF_CONSTRUCTION_COST"],
  MAJOR_REPAIR_FUND: ["PER_CARPET_AREA"],
  EDUCATION_FUND: ["PER_MEMBER_FIXED_OR_MIN"],
  ELECTION_FUND: ["EQUAL_PER_UNIT"],
  WELFARE_FUND: ["MANUAL"],
  OTHER_FUND: ["EQUAL_PER_UNIT"],
  AMENITY: ["MANUAL"],
  COMMON_AREA: ["EQUAL_PER_UNIT"],
  COMMERCIAL_SURCHARGE: ["FIXED_PER_UNIT_TYPE"],
  GB_APPROVED_OTHER: APPORTIONMENT_METHODS,
  OTHER: ["MANUAL"],
};

/** What the `rate` number means for each method — shown next to the rate field. */
export const RATE_UNITS: Record<ApportionmentMethod, string> = {
  EQUAL_PER_UNIT: "paise per unit per month",
  PER_CARPET_AREA: "paise per sq ft per month",
  PER_WATER_INLET: "paise per inlet per month",
  BUILDING_SCOPED_EQUAL: "paise per lift-served unit per month",
  PER_PARKING_SLOT: "paise per allotted slot per month",
  PERCENT_OF_HEAD: "basis points of the base head",
  PERCENT_OF_CONSTRUCTION_COST: "basis points per year of the building's construction cost",
  PER_MEMBER_FIXED_OR_MIN: "paise per member per year",
  FIXED_PER_UNIT_TYPE: "paise per month, by unit type",
  MANUAL: "set per unit",
};

export const HeadFilters = z.object({
  unitTypes: z.array(z.enum(["RESIDENTIAL", "COMMERCIAL", "SHOP", "OFFICE", "PARKING_ONLY"])).optional(),
  buildingIds: z.array(Id).optional(),
  occupancy: z.array(z.enum(["SELF_OCCUPIED", "FAMILY_OCCUPIED", "TENANTED", "VACANT", "LOCKED", "UNDER_RENOVATION"])).optional(),
  floorMin: z.number().int().optional(),
  floorMax: z.number().int().optional(),
});

export const ChargeRate = z.object({
  id: Id,
  rate: z.string(),
  rateByType: z.record(z.string(), z.number().int()).nullable(),
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable(),
  resolution: ResolutionRef.nullable(),
  note: z.string().nullable(),
});

export const ChargeHead = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  nameMr: z.string().nullable(),
  category: z.enum(CHARGE_CATEGORIES),
  method: z.enum(APPORTIONMENT_METHODS),
  gstApplicable: z.boolean(),
  baseHeadId: Id.nullable(),
  filters: HeadFilters,
  sortOrder: z.number().int(),
  active: z.boolean(),
  currentRate: ChargeRate.nullable(),
  rates: z.array(ChargeRate),
});
export type ChargeHead = z.infer<typeof ChargeHead>;

export const CreateChargeHeadBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/),
  name: z.string().trim().min(2).max(80),
  nameMr: z.string().trim().max(80).nullable().optional(),
  category: z.enum(CHARGE_CATEGORIES),
  method: z.enum(APPORTIONMENT_METHODS),
  gstApplicable: z.boolean().default(false),
  baseHeadId: Id.nullable().optional(),
  filters: HeadFilters.default({}),
  sortOrder: z.number().int().min(0).max(1000).default(100),
  resolution: ResolutionRef.nullable().optional(),
});
export const UpdateChargeHeadBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nameMr: z.string().trim().max(80).nullable().optional(),
  gstApplicable: z.boolean().optional(),
  filters: HeadFilters.optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

const DecimalString = z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/, { error: "A non-negative number with up to 4 decimals" });

export const SetRateBody = z.object({
  rate: DecimalString,
  rateByType: z.record(z.string(), z.number().int().min(0)).nullable().optional(),
  effectiveFrom: IsoDate,
  resolution: ResolutionRef.nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

export const UnitCharge = z.object({
  id: Id,
  unitId: Id,
  unitLabel: z.string(),
  headId: Id,
  headName: z.string(),
  amountPaise: Paise,
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable(),
  note: z.string().nullable(),
});
export const CreateUnitChargeBody = z.object({
  unitId: Id,
  headId: Id,
  amountPaise: Paise.min(0),
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

export const SimulationRow = z.object({ unitId: Id, unitLabel: z.string(), amountPaise: Paise, basis: z.string() });
export const Simulation = z.object({ headId: Id, asOf: IsoDate, totalPaise: Paise, units: z.number().int(), rows: z.array(SimulationRow) });

// ─── Bills ──────────────────────────────────────────────────────────────────

export const BillLine = z.object({
  code: z.string(),
  label: z.string(),
  kind: z.enum(["CHARGE", "INTEREST", "GST", "ROUNDING", "ADHOC"]),
  method: z.string().nullable(),
  rate: z.string().nullable(),
  basis: z.string(),
  ruleRef: z.string().nullable(),
  amountPaise: Paise,
});

export const BILL_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;

export const Bill = z.object({
  id: Id,
  unitId: Id,
  unitLabel: z.string(),
  kind: z.enum(["REGULAR", "SUPPLEMENTARY"]),
  status: z.enum(BILL_STATUSES),
  /** Derived for display: PUBLISHED bills are unpaid, partly paid, paid or overdue. */
  paymentState: z.enum(["DRAFT", "UNPAID", "PARTLY_PAID", "PAID", "OVERDUE", "CANCELLED"]),
  number: z.string().nullable(),
  fy: z.string(),
  period: z.string(),
  title: z.string(),
  billDate: IsoDate,
  dueDate: IsoDate,
  principalPaise: Paise,
  interestPaise: Paise,
  gstPaise: Paise,
  totalPaise: Paise,
  paidPaise: Paise,
  balancePaise: Paise,
  arrearsPaise: Paise,
  payerName: z.string().nullable(),
  publishedAt: IsoDateTime.nullable(),
  cancelReason: z.string().nullable(),
  lines: z.array(BillLine),
});
export type Bill = z.infer<typeof Bill>;

export const BillListQuery = ListQuery.extend({
  unitId: Id.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(BILL_STATUSES).optional(),
  state: z.enum(["UNPAID", "PAID", "OVERDUE"]).optional(),
});

export const CancelBillBody = z.object({ reason: z.string().trim().min(5).max(300) });

export const AdhocBillBody = z.object({
  unitIds: z.array(Id).min(1).max(2000),
  title: z.string().trim().min(3).max(120),
  dueDate: IsoDate,
  lines: z.array(z.object({ label: z.string().trim().min(2).max(120), amountPaise: Paise.min(1), headId: Id.nullable().optional() })).min(1).max(20),
});

export const BillRunSummary = z.object({
  id: Id,
  period: z.string(),
  periodStart: IsoDate,
  periodEnd: IsoDate,
  billDate: IsoDate,
  dueDate: IsoDate,
  status: z.enum(["DRAFT", "PUBLISHED", "DISCARDED"]),
  billCount: z.number().int(),
  totalPaise: Paise,
  publishedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});

export const BillRunPreview = BillRunSummary.extend({
  byHead: z.array(z.object({ code: z.string(), label: z.string(), totalPaise: Paise, units: z.number().int() })),
  byBuilding: z.array(z.object({ buildingName: z.string(), totalPaise: Paise, bills: z.number().int() })),
  /** Units whose bill moved more than 10% against the last published run. */
  variances: z.array(z.object({ unitId: Id, unitLabel: z.string(), previousPaise: Paise, currentPaise: Paise, changeBps: z.number().int() })),
  exceptions: z.array(z.object({ unitId: Id.nullable(), unitLabel: z.string().nullable(), code: z.string(), message: z.string() })),
});

export const CreateBillRunBody = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Period is YYYY-MM" }),
  billDate: IsoDate.optional(),
  dueDate: IsoDate.optional(),
});

export const LedgerEntry = z.object({
  id: Id,
  date: IsoDate,
  kind: z.string(),
  narration: z.string(),
  debitPaise: Paise,
  creditPaise: Paise,
  balancePaise: Paise,
  refType: z.string(),
  refId: Id,
});
export const Ledger = z.object({
  unitId: Id,
  unitLabel: z.string(),
  entries: z.array(LedgerEntry),
  balancePaise: Paise,
  advancePaise: Paise,
});

export const CreditNoteBody = z.object({ amountPaise: Paise.min(1), reason: z.string().trim().min(5).max(300), billId: Id.nullable().optional() });
export const CreditNote = z.object({ id: Id, number: z.string(), unitId: Id, amountPaise: Paise, reason: z.string(), createdAt: IsoDateTime });

/** The resident's dues card — MASTER_SPEC C4. */
export const Dues = z.object({
  unitId: Id,
  unitLabel: z.string(),
  currentPaise: Paise,
  arrearsPaise: Paise,
  interestPaise: Paise,
  totalDuePaise: Paise,
  advancePaise: Paise,
  nextDueDate: IsoDate.nullable(),
  /** Due date of the oldest unpaid bill that is past due — null when nothing is overdue. */
  overdueSince: IsoDate.nullable(),
  daysLeft: z.number().int().nullable(),
  openBills: z.array(Bill),
});
