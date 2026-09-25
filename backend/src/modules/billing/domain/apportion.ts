/**
 * Apportionment — MASTER_SPEC B2, Rule 106C-12(3). Pure: plain data in,
 * bill lines out. No database, no clock, no statutory literals — every legal
 * number arrives in `statutory`, resolved as of the billing period.
 */
import { schemas, type ApportionmentMethod, type ChargeCategory } from "@chs/contract";
import { add, applyBps, divRound, formatInr, formatRate, max, prorate, rateTimes, scaleDecimal, ZERO, type Paise } from "../../../core/money";

export interface UnitFacts {
  unitId: string;
  label: string;
  type: string;
  floor: number;
  buildingId: string;
  carpetAreaSqft: string | null;
  waterInlets: number;
  liftServed: boolean;
  occupancy: string | null;
  parkingSlots: number;
  hasPrimaryMember: boolean;
}

export interface BuildingFacts {
  id: string;
  name: string;
  liftPresent: boolean;
  constructionCostPaise: Paise | null;
  /** Sum of carpet areas in the building, sq ft ×100 (2 dp), for cost-share apportionment. */
  totalCarpetArea100: bigint;
  unitCount: number;
}

export interface HeadSpec {
  id: string;
  code: string;
  name: string;
  category: ChargeCategory;
  method: ApportionmentMethod;
  gstApplicable: boolean;
  baseHeadId: string | null;
  filters: { unitTypes?: string[]; buildingIds?: string[]; occupancy?: string[]; floorMin?: number; floorMax?: number };
  sortOrder: number;
  rate: { id: string; rate: string; rateByType: Record<string, number> | null } | null;
}

export interface Statutory {
  nonOccupancyPercent: number;
  educationFundMinPaise: Paise;
  sinkingFundMinPercent: number;
  repairFundMinPercent: number;
}

export interface Line {
  headId: string | null;
  code: string;
  label: string;
  kind: "CHARGE" | "INTEREST" | "GST" | "ROUNDING" | "ADHOC";
  method: string | null;
  rate: string | null;
  rateId: string | null;
  input: string | null;
  basis: string;
  ruleRef: string | null;
  amountPaise: Paise;
  gstApplicable: boolean;
  sortOrder: number;
}

export interface Problem {
  code: string;
  message: string;
}

const { ALLOWED_METHODS, RATE_UNITS } = schemas.billing;
const RULE = "MCS Rules 2026, 106C-12";

/** Does the head apply to this unit at all? */
export function applies(head: HeadSpec, unit: UnitFacts): boolean {
  const f = head.filters;
  if (f.unitTypes?.length && !f.unitTypes.includes(unit.type)) return false;
  if (f.buildingIds?.length && !f.buildingIds.includes(unit.buildingId)) return false;
  if (f.occupancy?.length && !(unit.occupancy && f.occupancy.includes(unit.occupancy))) return false;
  if (f.floorMin !== undefined && unit.floor < f.floorMin) return false;
  if (f.floorMax !== undefined && unit.floor > f.floorMax) return false;
  return true;
}

const monthsText = (m: number) => (m === 1 ? "" : ` × ${m} months`);
const areaText = (a: string) => `${Number(a).toLocaleString("en-IN", { maximumFractionDigits: 2 })} sq ft`;

/** Percent (e.g. 0.25) → basis points (25), exactly. */
export function percentToBps(p: number): number {
  return Number(scaleDecimal(p.toString(), 2));
}

/**
 * Compute every charge line for one unit. Heads are processed base-first so a
 * percentage-of-head line can see the line it is a percentage of.
 */
export function apportion(input: {
  unit: UnitFacts;
  building: BuildingFacts;
  heads: HeadSpec[];
  manual: Map<string, Paise>; // headId → monthly amount for this unit
  months: number;
  statutory: Statutory;
}): { lines: Line[]; problems: Problem[] } {
  const { unit, building, months, statutory } = input;
  const lines: Line[] = [];
  const problems: Problem[] = [];
  const byHead = new Map<string, Line>();
  const ordered = [...input.heads].sort((a, b) => Number(a.method === "PERCENT_OF_HEAD") - Number(b.method === "PERCENT_OF_HEAD") || a.sortOrder - b.sortOrder);

  for (const head of ordered) {
    if (!applies(head, unit)) continue;
    if (!ALLOWED_METHODS[head.category].includes(head.method)) {
      problems.push({ code: "METHOD_NOT_ALLOWED", message: `${head.name}: ${head.method} isn't permitted for ${head.category}` });
      continue;
    }
    const line = (amount: Paise, basis: string, inputValue: string | null = null): Line => ({
      headId: head.id,
      code: head.code,
      label: head.name,
      kind: "CHARGE",
      method: head.method,
      rate: head.rate?.rate ?? null,
      rateId: head.rate?.id ?? null,
      input: inputValue,
      basis,
      ruleRef: RULE,
      amountPaise: amount,
      gstApplicable: head.gstApplicable,
      sortOrder: head.sortOrder,
    });

    if (head.method === "MANUAL") {
      const monthly = input.manual.get(head.id);
      if (monthly === undefined) continue;
      const amount = prorate(monthly, BigInt(months), 1n);
      if (amount > ZERO) lines.push(line(amount, `Set for this unit${monthsText(months)}`));
      continue;
    }
    if (!head.rate) {
      problems.push({ code: "NO_RATE", message: `${head.name} has no rate for this period` });
      continue;
    }
    const r = head.rate.rate;
    let result: Line | null = null;

    switch (head.method) {
      case "EQUAL_PER_UNIT":
        result = line(rateTimes(r, 1, months), `${formatRate(r)} per unit${monthsText(months)}`);
        break;
      case "PER_CARPET_AREA":
        if (!unit.carpetAreaSqft) {
          problems.push({ code: "NO_CARPET_AREA", message: `${head.name}: ${unit.label} has no carpet area` });
          break;
        }
        result = line(rateTimes(r, unit.carpetAreaSqft, months), `${areaText(unit.carpetAreaSqft)} × ${formatRate(r)}${monthsText(months)}`, unit.carpetAreaSqft);
        break;
      case "PER_WATER_INLET":
        if (unit.waterInlets > 0) result = line(rateTimes(r, unit.waterInlets, months), `${unit.waterInlets} inlet${unit.waterInlets === 1 ? "" : "s"} × ${formatRate(r)}${monthsText(months)}`, String(unit.waterInlets));
        break;
      case "BUILDING_SCOPED_EQUAL":
        // B3.3: only buildings that have the lift; ground floor included (the rule divides by building, not floor).
        if (building.liftPresent && unit.liftServed) result = line(rateTimes(r, 1, months), `${formatRate(r)} per flat in ${building.name} (lift building)${monthsText(months)}`);
        break;
      case "PER_PARKING_SLOT":
        if (unit.parkingSlots > 0) result = line(rateTimes(r, unit.parkingSlots, months), `${unit.parkingSlots} slot${unit.parkingSlots === 1 ? "" : "s"} × ${formatRate(r)}${monthsText(months)}`, String(unit.parkingSlots));
        break;
      case "PERCENT_OF_HEAD": {
        const base = head.baseHeadId ? byHead.get(head.baseHeadId) : undefined;
        const bps = Number(scaleDecimal(r, 0));
        if (head.category === "NON_OCCUPANCY") {
          // B3.2: only while TENANTED — never for a flat the member's family occupies.
          if (unit.occupancy !== "TENANTED") break;
          const capBps = percentToBps(statutory.nonOccupancyPercent);
          if (bps > capBps) {
            problems.push({ code: "NON_OCCUPANCY_ABOVE_CAP", message: `${head.name}: ${bps / 100}% exceeds the ${statutory.nonOccupancyPercent}% cap` });
            break;
          }
        }
        if (!base) break;
        result = line(applyBps(base.amountPaise, bps), `${bps / 100}% of ${base.label} (${formatInr(base.amountPaise)})`, String(base.amountPaise));
        break;
      }
      case "PERCENT_OF_CONSTRUCTION_COST": {
        if (building.constructionCostPaise === null) {
          problems.push({ code: "NO_CONSTRUCTION_COST", message: `${head.name}: ${building.name} has no construction cost` });
          break;
        }
        const bps = Number(scaleDecimal(r, 0));
        const minPercent = head.category === "SINKING_FUND" ? statutory.sinkingFundMinPercent : head.category === "REPAIR_FUND" ? statutory.repairFundMinPercent : 0;
        if (bps < percentToBps(minPercent)) {
          problems.push({ code: "FUND_BELOW_MINIMUM", message: `${head.name}: ${bps / 100}% is below the statutory ${minPercent}%` });
          break;
        }
        // The building's annual contribution, shared by carpet area (equally when areas are missing).
        const area = unit.carpetAreaSqft ? scaleDecimal(unit.carpetAreaSqft, 2) : null;
        const shareNum = area && building.totalCarpetArea100 > 0n ? area : 1n;
        const shareDen = area && building.totalCarpetArea100 > 0n ? building.totalCarpetArea100 : BigInt(Math.max(1, building.unitCount));
        const amount = divRound(building.constructionCostPaise * BigInt(bps) * BigInt(months) * shareNum, 10_000n * 12n * shareDen);
        result = line(amount, `${bps / 100}% a year of ${building.name}'s construction cost, ${area ? "by carpet area" : "equally"}${monthsText(months)}`);
        break;
      }
      case "PER_MEMBER_FIXED_OR_MIN": {
        if (!unit.hasPrimaryMember) break;
        const annual = max(scaleDecimal(r, 4) / 10_000n, statutory.educationFundMinPaise);
        result = line(prorate(annual, BigInt(months), 12n), `${formatInr(annual)} a year per member (or the statutory minimum), ${months}/12`);
        break;
      }
      case "FIXED_PER_UNIT_TYPE": {
        const monthly = head.rate.rateByType?.[unit.type];
        if (monthly) result = line(prorate(BigInt(monthly), BigInt(months), 1n), `${unit.type.toLowerCase()} unit, ${formatInr(BigInt(monthly))} a month${monthsText(months)}`);
        break;
      }
    }
    if (result && result.amountPaise > ZERO) {
      lines.push(result);
      byHead.set(head.id, result);
    }
  }
  return { lines: lines.sort((a, b) => a.sortOrder - b.sortOrder), problems };
}

export function total(lines: Line[]): Paise {
  return add(...lines.map((l) => l.amountPaise));
}

export { RATE_UNITS };
