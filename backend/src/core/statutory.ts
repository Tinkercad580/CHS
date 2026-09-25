import type { Tx } from "./db";
import { toIsoDate, todayIst } from "./dates";
import { AppError } from "./errors";

/**
 * Effective-dated statutory parameters — MASTER_SPEC B4.
 *
 * Business code never writes a legal number; it asks for a key as of a date.
 * Billing asks as of the billing period, so recomputing an old bill uses the
 * values that applied then.
 *
 * `societyOverride` says whether a society may set its own value, and within
 * what bound: a statutory cap is law and can't be raised by a society; a
 * notice period can be made longer by its bye-laws but not shorter.
 */

export interface KeySpec {
  unit: string;
  kind: "number" | "text";
  societyOverride: "never" | "min" | "max" | "any";
  requiresResolution: boolean;
}

export const STATUTORY_KEYS: Record<string, KeySpec> = {
  interest_cap_percent: { unit: "% p.a. simple", kind: "number", societyOverride: "never", requiresResolution: false },
  non_occupancy_percent: { unit: "% of service charges", kind: "number", societyOverride: "max", requiresResolution: true },
  non_occupancy_base: { unit: "charge head", kind: "text", societyOverride: "never", requiresResolution: false },
  sinking_fund_min_percent: { unit: "% p.a. of construction cost", kind: "number", societyOverride: "min", requiresResolution: true },
  repair_fund_min_percent: { unit: "% p.a. of construction cost", kind: "number", societyOverride: "min", requiresResolution: true },
  education_fund_min_amount_paise: { unit: "paise per member", kind: "number", societyOverride: "min", requiresResolution: false },
  gst_rate_percent: { unit: "%", kind: "number", societyOverride: "never", requiresResolution: false },
  gst_member_threshold_paise: { unit: "paise per member per month", kind: "number", societyOverride: "never", requiresResolution: false },
  gst_turnover_threshold_paise: { unit: "paise per year", kind: "number", societyOverride: "never", requiresResolution: false },
  transfer_premium_cap_paise: { unit: "paise", kind: "number", societyOverride: "max", requiresResolution: true },
  agm_notice_days: { unit: "clear days", kind: "number", societyOverride: "min", requiresResolution: false },
  sgm_notice_days: { unit: "clear days", kind: "number", societyOverride: "min", requiresResolution: false },
  agm_deadline_rule: { unit: "rule", kind: "text", societyOverride: "never", requiresResolution: false },
  audit_deadline_rule: { unit: "rule", kind: "text", societyOverride: "never", requiresResolution: false },
  quorum_rule: { unit: "rule", kind: "text", societyOverride: "never", requiresResolution: false },
  structural_audit_intervals: { unit: "rule", kind: "text", societyOverride: "never", requiresResolution: false },
  fire_audit_frequency: { unit: "rule", kind: "text", societyOverride: "never", requiresResolution: false },
  visitor_data_retention_days: { unit: "days", kind: "number", societyOverride: "max", requiresResolution: false },
};

type Row = Awaited<ReturnType<Tx["statutoryConfig"]["findFirst"]>>;

async function rowAsOf(db: Tx, key: string, societyId: string | null, asOf: Date): Promise<Row> {
  return db.statutoryConfig.findFirst({
    where: {
      key,
      societyId,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** The value in force for a society on a date: its own row if it has one, else the platform default. */
export async function resolveConfig(db: Tx, key: string, societyId: string | null, asOf: Date = todayIst()) {
  const own = societyId ? await rowAsOf(db, key, societyId, asOf) : null;
  const row = own ?? (await rowAsOf(db, key, null, asOf));
  if (!row) throw new AppError("PRECONDITION_FAILED", `Statutory parameter "${key}" has no value for ${toIsoDate(asOf)}.`);
  return row;
}

export async function configNumber(db: Tx, key: string, societyId: string | null, asOf?: Date): Promise<number> {
  const row = await resolveConfig(db, key, societyId, asOf);
  const n = Number(row.value);
  if (!Number.isFinite(n)) throw new Error(`Statutory parameter ${key} is not numeric: ${row.value}`);
  return n;
}

/** Check a proposed society override against the platform value it overrides. */
export async function assertOverrideAllowed(db: Tx, key: string, value: string, asOf: Date): Promise<void> {
  const spec = STATUTORY_KEYS[key];
  if (!spec) throw new AppError("VALIDATION_FAILED", `Unknown statutory parameter "${key}".`);
  if (spec.societyOverride === "never") {
    throw new AppError("BUSINESS_RULE_VIOLATION", `"${key}" is fixed by law and can't be changed by a society.`);
  }
  if (spec.kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new AppError("VALIDATION_FAILED", `"${key}" must be a non-negative number.`);
    const platform = Number((await resolveConfig(db, key, null, asOf)).value);
    if (spec.societyOverride === "min" && n < platform) {
      throw new AppError("FUND_BELOW_MINIMUM", `"${key}" can't be below the statutory ${platform} ${spec.unit}.`);
    }
    if (spec.societyOverride === "max" && n > platform) {
      throw new AppError("BUSINESS_RULE_VIOLATION", `"${key}" can't exceed the statutory ${platform} ${spec.unit}.`);
    }
  }
}
