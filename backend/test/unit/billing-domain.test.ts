import { describe, expect, it } from "vitest";
import { apportion, type BuildingFacts, type HeadSpec, type UnitFacts } from "../../src/modules/billing/domain/apportion";
import { interestForBill } from "../../src/modules/billing/domain/interest";
import { rateTimes, roundToRupee, simpleInterest } from "../../src/core/money";
import { quietHoursDelay } from "../../src/modules/notifications/notify";

/**
 * MASTER_SPEC E4 compliance item 2 — one test per apportionment method,
 * including the family-occupied non-occupancy case and the lift-less building.
 * Pure functions, so these run without a database.
 */

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const statutory = { nonOccupancyPercent: 10, educationFundMinPaise: 1000n, sinkingFundMinPercent: 0.25, repairFundMinPercent: 0.75 };

const unit = (over: Partial<UnitFacts> = {}): UnitFacts => ({
  unitId: "u1", label: "A-1204", type: "RESIDENTIAL", floor: 12, buildingId: "b1", carpetAreaSqft: "1180", waterInlets: 3,
  liftServed: true, occupancy: "SELF_OCCUPIED", parkingSlots: 1, hasPrimaryMember: true, ...over,
});
const building = (over: Partial<BuildingFacts> = {}): BuildingFacts => ({
  id: "b1", name: "A", liftPresent: true, constructionCostPaise: 6_00_00_000_00n, totalCarpetArea100: 118_000n * 100n, unitCount: 100, ...over,
});
let seq = 0;
const head = (category: HeadSpec["category"], method: HeadSpec["method"], rate: string, over: Partial<HeadSpec> = {}): HeadSpec => ({
  id: `h${++seq}`, code: `H${seq}`, name: category, category, method, gstApplicable: false, baseHeadId: null, filters: {}, sortOrder: seq,
  rate: { id: `r${seq}`, rate, rateByType: null }, ...over,
});
const run = (h: HeadSpec[], u = unit(), b = building(), months = 1) => apportion({ unit: u, building: b, heads: h, manual: new Map(), months, statutory });

describe("apportionment methods (Rule 106C-12)", () => {
  it("service charges: equal per flat, whatever the area", () => {
    const h = [head("SERVICE", "EQUAL_PER_UNIT", "180000")];
    expect(run(h).lines[0]!.amountPaise).toBe(180000n);
    expect(run(h, unit({ carpetAreaSqft: "450" })).lines[0]!.amountPaise).toBe(180000n);
  });

  it("per carpet area, with the basis spelled out", () => {
    const { lines } = run([head("INSURANCE", "PER_CARPET_AREA", "320")]);
    expect(lines[0]!.amountPaise).toBe(377600n); // 1,180 × ₹3.20
    expect(lines[0]!.basis).toBe("1,180 sq ft × ₹3.20");
  });

  it("water by inlet", () => {
    expect(run([head("WATER", "PER_WATER_INLET", "14000")]).lines[0]!.amountPaise).toBe(42000n);
  });

  it("lift charges only in a building that has a lift — ground floor included (B3.3)", () => {
    const h = [head("LIFT", "BUILDING_SCOPED_EQUAL", "35000")];
    expect(run(h, unit({ floor: 0 })).lines[0]!.amountPaise).toBe(35000n);
    expect(run(h, unit({ liftServed: false }), building({ liftPresent: false })).lines).toHaveLength(0);
  });

  it("parking per allotted slot; none allotted, nothing billed", () => {
    const h = [head("PARKING", "PER_PARKING_SLOT", "30000")];
    expect(run(h, unit({ parkingSlots: 2 })).lines[0]!.amountPaise).toBe(60000n);
    expect(run(h, unit({ parkingSlots: 0 })).lines).toHaveLength(0);
  });

  it("non-occupancy: 10% of service charges, only when TENANTED (B3.2)", () => {
    const svc = head("SERVICE", "EQUAL_PER_UNIT", "180000");
    const noc = head("NON_OCCUPANCY", "PERCENT_OF_HEAD", "1000", { baseHeadId: svc.id });
    expect(run([svc, noc], unit({ occupancy: "TENANTED" })).lines.find((l) => l.headId === noc.id)!.amountPaise).toBe(18000n);
  });

  it("non-occupancy is never charged on a family-occupied flat, even when the member lives elsewhere (B3.2)", () => {
    const svc = head("SERVICE", "EQUAL_PER_UNIT", "180000");
    const noc = head("NON_OCCUPANCY", "PERCENT_OF_HEAD", "1000", { baseHeadId: svc.id });
    for (const occupancy of ["FAMILY_OCCUPIED", "SELF_OCCUPIED", "VACANT", "LOCKED"]) {
      expect(run([svc, noc], unit({ occupancy })).lines.find((l) => l.headId === noc.id)).toBeUndefined();
    }
  });

  it("non-occupancy above the statutory cap is refused, not billed", () => {
    const svc = head("SERVICE", "EQUAL_PER_UNIT", "180000");
    const noc = head("NON_OCCUPANCY", "PERCENT_OF_HEAD", "1500", { baseHeadId: svc.id });
    const r = run([svc, noc], unit({ occupancy: "TENANTED" }));
    expect(r.lines.find((l) => l.headId === noc.id)).toBeUndefined();
    expect(r.problems.map((p) => p.code)).toContain("NON_OCCUPANCY_ABOVE_CAP");
  });

  it("sinking fund: share of construction cost by carpet area; below 0.25% refused (B3.4)", () => {
    // ₹6 crore × 0.25% ÷ 12 × (1,180 ÷ 118,000)
    expect(run([head("SINKING_FUND", "PERCENT_OF_CONSTRUCTION_COST", "25")]).lines[0]!.amountPaise).toBe(12500n);
    const low = run([head("SINKING_FUND", "PERCENT_OF_CONSTRUCTION_COST", "20")]);
    expect(low.lines).toHaveLength(0);
    expect(low.problems[0]!.code).toBe("FUND_BELOW_MINIMUM");
  });

  it("repair fund below 0.75% refused; no construction cost, no charge and an exception", () => {
    expect(run([head("REPAIR_FUND", "PERCENT_OF_CONSTRUCTION_COST", "50")]).problems[0]!.code).toBe("FUND_BELOW_MINIMUM");
    expect(run([head("REPAIR_FUND", "PERCENT_OF_CONSTRUCTION_COST", "75")], unit(), building({ constructionCostPaise: null })).problems[0]!.code).toBe("NO_CONSTRUCTION_COST");
  });

  it("education fund: the higher of the rate and the statutory minimum", () => {
    expect(run([head("EDUCATION_FUND", "PER_MEMBER_FIXED_OR_MIN", "600")], unit(), building(), 12).lines[0]!.amountPaise).toBe(1000n);
    expect(run([head("EDUCATION_FUND", "PER_MEMBER_FIXED_OR_MIN", "2400")], unit(), building(), 12).lines[0]!.amountPaise).toBe(2400n);
  });

  it("commercial surcharge by unit type", () => {
    const h = head("COMMERCIAL_SURCHARGE", "FIXED_PER_UNIT_TYPE", "0", { rate: { id: "r", rate: "0", rateByType: { SHOP: 150000 } } });
    expect(run([h], unit({ type: "SHOP" })).lines[0]!.amountPaise).toBe(150000n);
    expect(run([h]).lines).toHaveLength(0);
  });

  it("refuses a method the category doesn't allow", () => {
    const r = run([head("SERVICE", "PER_CARPET_AREA", "320")]);
    expect(r.lines).toHaveLength(0);
    expect(r.problems[0]!.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("filters: a head for shops doesn't reach flats", () => {
    expect(run([head("OTHER_FUND", "EQUAL_PER_UNIT", "5000", { filters: { unitTypes: ["SHOP"] } })]).lines).toHaveLength(0);
  });

  it("quarterly bills are three months of every monthly rate", () => {
    expect(run([head("SERVICE", "EQUAL_PER_UNIT", "180000")], unit(), building(), 3).lines[0]!.amountPaise).toBe(540000n);
  });
});

describe("interest (B3.1)", () => {
  const bill = { billId: "b", number: "1", principalPaise: 365_000n, interestFrom: d("2026-08-16"), payments: [] as { date: Date; amountPaise: bigint }[] };

  it("is simple: 12% a year on ₹3,650 for 30 days is ₹36", () => {
    expect(interestForBill(bill, d("2026-08-01"), d("2026-09-15"), 1200).amount).toBe(3600n);
  });

  it("stops on the part a payment cleared, from the day it was paid", () => {
    const paid = { ...bill, payments: [{ date: d("2026-08-31"), amountPaise: 182_500n }] };
    // 15 days on ₹3,650 + 15 days on ₹1,825
    expect(interestForBill(paid, d("2026-08-01"), d("2026-09-15"), 1200).amount).toBe(1800n + 900n);
  });

  it("accrues nothing before the due date and nothing when fully paid", () => {
    expect(interestForBill(bill, d("2026-08-01"), d("2026-08-16"), 1200).amount).toBe(0n);
    expect(interestForBill({ ...bill, payments: [{ date: d("2026-08-10"), amountPaise: 365_000n }] }, d("2026-08-01"), d("2026-09-15"), 1200).amount).toBe(0n);
  });

  it("never compounds: simpleInterest is linear in days", () => {
    expect(simpleInterest(100_000n, 1200, 365)).toBe(12_000n);
    expect(simpleInterest(100_000n, 1200, 730)).toBe(24_000n); // compound would be 25,440
  });
});

describe("money helpers", () => {
  it("rate × quantity rounds once, half away from zero", () => {
    expect(rateTimes("3.3333", "1", 1)).toBe(3n);
    expect(rateTimes("320", "1180.5", 1)).toBe(377760n);
  });
  it("rounds to the rupee three ways", () => {
    expect(roundToRupee(363_864n, "NEAREST_RUPEE")).toBe(363_900n);
    expect(roundToRupee(363_849n, "NEAREST_RUPEE")).toBe(363_800n);
    expect(roundToRupee(363_801n, "UP_RUPEE")).toBe(363_900n);
    expect(roundToRupee(363_801n, "NONE")).toBe(363_801n);
  });
});

describe("quiet hours", () => {
  const s = { quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  it("holds a push sent at 23:30 IST until 07:00", () => {
    const at = new Date("2026-09-25T18:00:00.000Z"); // 23:30 IST
    expect(quietHoursDelay(s, at)).toBe(7.5 * 3_600_000);
  });
  it("sends at once in the day", () => {
    expect(quietHoursDelay(s, new Date("2026-09-25T06:30:00.000Z"))).toBe(0); // 12:00 IST
  });
});
