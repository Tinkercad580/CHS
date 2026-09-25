import type { ApportionmentMethod, Audience, BillRecord, ChargeCategory, NoticeRecord, PaymentRecord } from "@chs/contract";
import type { PillKind } from "./types";
import { enumLabel } from "./apiFormat";

/** Wire codes for billing, payments and notices, in the words the committee uses. */

export const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  SERVICE: "Service charges",
  PROPERTY_TAX: "Property tax",
  WATER: "Water charges",
  LIFT: "Lift maintenance",
  PARKING: "Parking",
  NON_OCCUPANCY: "Non-occupancy charges",
  INSURANCE: "Insurance",
  LEASE_RENT: "Lease rent",
  LOAN: "Loan instalment",
  SINKING_FUND: "Sinking fund",
  REPAIR_FUND: "Repair & maintenance fund",
  MAJOR_REPAIR_FUND: "Major repair fund",
  EDUCATION_FUND: "Education & training fund",
  ELECTION_FUND: "Election fund",
  WELFARE_FUND: "Welfare fund",
  OTHER_FUND: "Other fund",
  AMENITY: "Amenity charges",
  COMMON_AREA: "Common area charges",
  COMMERCIAL_SURCHARGE: "Commercial surcharge",
  GB_APPROVED_OTHER: "Other (general body approved)",
  OTHER: "Other",
};

export const METHOD_LABEL: Record<ApportionmentMethod, string> = {
  EQUAL_PER_UNIT: "Equal per unit",
  PER_CARPET_AREA: "By carpet area",
  PER_WATER_INLET: "Per water inlet",
  BUILDING_SCOPED_EQUAL: "Equal per unit in lift buildings",
  PER_PARKING_SLOT: "Per parking slot",
  PERCENT_OF_HEAD: "Percentage of another head",
  PERCENT_OF_CONSTRUCTION_COST: "Percentage of construction cost",
  PER_MEMBER_FIXED_OR_MIN: "Per member (or statutory minimum)",
  FIXED_PER_UNIT_TYPE: "Fixed by unit type",
  MANUAL: "Set per unit",
};

/** Heads whose rate the general body fixes: the form asks for the resolution. */
export function needsResolution(category: ChargeCategory): boolean {
  return category === "SINKING_FUND" || category === "REPAIR_FUND" || category === "GB_APPROVED_OTHER";
}

/** Fund heads — any category ending in _FUND — say so in the list. */
export function isFund(category: ChargeCategory): boolean {
  return category.endsWith("_FUND");
}

type BillState = BillRecord["paymentState"];

export const BILL_STATE: Record<BillState, { label: string; kind: PillKind }> = {
  DRAFT: { label: "Draft", kind: "mute" },
  UNPAID: { label: "Unpaid", kind: "warn" },
  PARTLY_PAID: { label: "Part paid", kind: "info" },
  PAID: { label: "Paid", kind: "ok" },
  OVERDUE: { label: "Overdue", kind: "bad" },
  CANCELLED: { label: "Cancelled", kind: "mute" },
};

export const RUN_STATE: Record<"DRAFT" | "PUBLISHED" | "DISCARDED", { label: string; kind: PillKind }> = {
  DRAFT: { label: "Draft", kind: "warn" },
  PUBLISHED: { label: "Published", kind: "ok" },
  DISCARDED: { label: "Discarded", kind: "mute" },
};

export const MODE_LABEL: Record<PaymentRecord["mode"], string> = {
  ONLINE: "Online",
  UPI: "UPI",
  CASH: "Cash",
  CHEQUE: "Cheque",
  NEFT: "NEFT",
  RTGS: "RTGS",
  IMPS: "IMPS",
  OTHER: "Other",
};

/** The design's payment pills: a cheque not yet through is "In clearing", a reversed receipt "Cancelled". */
export function paymentPill(p: Pick<PaymentRecord, "status" | "mode" | "receipt">): { label: string; kind: PillKind } {
  switch (p.status) {
    case "SUCCESS":
      return { label: "Cleared", kind: "ok" };
    case "PENDING":
      return p.mode === "CHEQUE" ? { label: "In clearing", kind: "warn" } : { label: "Pending", kind: "warn" };
    case "FAILED":
      return { label: p.mode === "CHEQUE" ? "Bounced" : "Failed", kind: "bad" };
    case "REVERSED":
    case "CANCELLED":
      return { label: "Cancelled", kind: "mute" };
    default:
      return { label: "Started", kind: "mute" };
  }
}

export const BUCKET_LABEL: Record<PaymentRecord["allocations"][number]["bucket"], string> = {
  INTEREST: "Interest",
  PRINCIPAL: "Charges",
  ADVANCE: "Advance",
};

export const NOTICE_CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "General",
  MAINTENANCE_SHUTDOWN: "Maintenance shutdown",
  WATER: "Water",
  MEETING: "Meeting",
  EMERGENCY: "Emergency",
  CIRCULAR: "Circular",
  FINANCIAL: "Financial",
  FACILITY: "Facility",
};

/** "All residents", "Buildings A, C", "12 units". Building names come from the buildings list when it is loaded. */
export function audienceLabel(a: Audience, buildingName?: (id: string) => string | undefined): string {
  switch (a.kind) {
    case "ALL":
      return "Everyone";
    case "OWNERS":
      return "All owners";
    case "TENANTS":
      return "All tenants";
    case "RESIDENTS":
      return "All residents";
    case "STAFF":
      return "Staff";
    case "ADMINS":
      return "Committee & admins";
    case "BUILDINGS": {
      const names = a.buildingIds.map((id) => buildingName?.(id)).filter((n): n is string => Boolean(n));
      if (names.length === a.buildingIds.length) return `Building${names.length === 1 ? "" : "s"} ${names.join(", ")}`;
      return `${a.buildingIds.length} building${a.buildingIds.length === 1 ? "" : "s"}`;
    }
    case "UNITS":
      return `${a.unitIds.length} unit${a.unitIds.length === 1 ? "" : "s"}`;
  }
}

export function channelsLabel(channels: readonly string[]): string {
  return channels.length ? channels.map((c) => (c === "push" ? "Push" : c === "email" ? "Email" : enumLabel(c))).join(" · ") : "In-app only";
}

/** A delivery status from the notice report: "SENT" -> "Sent", missing -> "—". */
export function deliveryLabel(s: string | null): string {
  if (!s || s === "—") return "—";
  return enumLabel(s);
}

/** A notice's state pill: drafts, corrections and expiry first, then whether acknowledgements are still owed. */
export function noticePill(n: NoticeRecord): { label: string; kind: PillKind } {
  if (n.status === "DRAFT") return { label: "Draft", kind: "mute" };
  if (n.status === "SUPERSEDED") return { label: "Superseded", kind: "mute" };
  if (n.expiresAt && Date.parse(n.expiresAt) < Date.now()) return { label: "Expired", kind: "mute" };
  if (n.ackRequired && n.stats && n.stats.acknowledged < n.stats.recipients) return { label: "Ack pending", kind: "warn" };
  if (n.category === "EMERGENCY") return { label: "Emergency", kind: "bad" };
  return { label: "Published", kind: "ok" };
}

/** "3 / 5" with the share, or a dash before anyone could have read it. */
export function ratio(n: number, of: number): string {
  if (!of) return "—";
  return `${n} / ${of}`;
}
