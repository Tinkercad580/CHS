import { schemas, type ChargeHead as HeadDto } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { fromIsoDate, toIsoDate, todayIst } from "../../core/dates";
import { isUniqueViolation, Prisma, prisma, transaction } from "../../core/db";
import { AppError, conflict, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { fromWire, toWire } from "../../core/money";
import { configNumber } from "../../core/statutory";
import { apportion, percentToBps } from "./domain/apportion";
import { loadFacts, rateAsOf, statutoryAsOf } from "./engine";

const { ALLOWED_METHODS } = schemas.billing;
type HeadRow = Prisma.ChargeHeadGetPayload<{ include: { rates: true } }>;
type RateRow = HeadRow["rates"][number];

function rateDto(r: RateRow) {
  return {
    id: r.id,
    rate: r.rate.toString(),
    rateByType: (r.rateByType as Record<string, number> | null) ?? null,
    effectiveFrom: toIsoDate(r.effectiveFrom),
    effectiveTo: toIsoDate(r.effectiveTo),
    resolution: (r.resolution as { meetingRef: string; resolvedOn: string } | null) ?? null,
    note: r.note,
  };
}

export function headDto(h: HeadRow, asOf = todayIst()): HeadDto {
  const rates = [...h.rates].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  const current = rates.find((r) => r.effectiveFrom <= asOf && (!r.effectiveTo || r.effectiveTo > asOf)) ?? null;
  return {
    id: h.id,
    code: h.code,
    name: h.name,
    nameMr: h.nameMr,
    category: h.category,
    method: h.method,
    gstApplicable: h.gstApplicable,
    baseHeadId: h.baseHeadId,
    filters: h.filters as HeadDto["filters"],
    sortOrder: h.sortOrder,
    active: h.active,
    currentRate: current ? rateDto(current) : null,
    rates: rates.map(rateDto),
  };
}

const withRates = { rates: true } as const;

export async function listHeads(societyId: string) {
  const rows = await prisma.chargeHead.findMany({ where: { societyId }, include: withRates, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  return rows.map((h) => headDto(h));
}

async function loadHead(societyId: string, id: string) {
  const h = await prisma.chargeHead.findFirst({ where: { id, societyId }, include: withRates });
  if (!h) throw notFound("Charge head");
  return h;
}

/** Rule 106C-12: category decides the method; some categories need their base or a resolution. */
async function validateHead(societyId: string, body: { category: HeadDto["category"]; method: HeadDto["method"]; baseHeadId?: string | null; resolution?: unknown }) {
  if (!ALLOWED_METHODS[body.category].includes(body.method)) {
    throw new AppError("BUSINESS_RULE_VIOLATION", `${body.category.replaceAll("_", " ").toLowerCase()} must be apportioned by ${ALLOWED_METHODS[body.category].join(" or ")} (Rule 106C-12(3)).`, {
      allowed: ALLOWED_METHODS[body.category],
    });
  }
  if (body.method === "PERCENT_OF_HEAD") {
    if (!body.baseHeadId) throw new AppError("VALIDATION_FAILED", "Choose the head this is a percentage of.", [{ path: ["baseHeadId"], message: "Required" }]);
    const base = await prisma.chargeHead.findFirst({ where: { id: body.baseHeadId, societyId } });
    if (!base) throw new AppError("VALIDATION_FAILED", "Unknown base head.");
    if (base.method === "PERCENT_OF_HEAD") throw new AppError("BUSINESS_RULE_VIOLATION", "A percentage can't be of another percentage head.");
    // B3.2: non-occupancy is computed on the service-charges line only, not on total maintenance.
    if (body.category === "NON_OCCUPANCY" && base.category !== "SERVICE") {
      throw new AppError("BUSINESS_RULE_VIOLATION", "Non-occupancy charges are a percentage of service charges only (Rule 106C-12).");
    }
  }
  if (body.category === "GB_APPROVED_OTHER" && !body.resolution) {
    throw new AppError("RESOLUTION_REQUIRED", "Other charges need the general body resolution that approved them.");
  }
}

export async function createHead(scope: SocietyScope, body: z.output<typeof schemas.billing.CreateChargeHeadBody>) {
  await validateHead(scope.societyId, body);
  try {
    const h = await prisma.chargeHead.create({
      data: {
        societyId: scope.societyId,
        code: body.code,
        name: body.name,
        nameMr: body.nameMr ?? null,
        category: body.category,
        method: body.method,
        gstApplicable: body.gstApplicable,
        baseHeadId: body.baseHeadId ?? null,
        filters: body.filters as Prisma.InputJsonValue,
        sortOrder: body.sortOrder,
        resolution: body.resolution ? (body.resolution as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: withRates,
    });
    await audit(prisma, { action: "charge_head.create", entity: "charge_head", entityId: h.id, after: headDto(h) });
    events.emit({ name: "billing.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
    return headDto(h);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`A head with code ${body.code} already exists.`);
    throw err;
  }
}

export async function updateHead(scope: SocietyScope, id: string, body: z.output<typeof schemas.billing.UpdateChargeHeadBody>) {
  const before = await loadHead(scope.societyId, id);
  const h = await prisma.chargeHead.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.nameMr !== undefined ? { nameMr: body.nameMr } : {}),
      ...(body.gstApplicable !== undefined ? { gstApplicable: body.gstApplicable } : {}),
      ...(body.filters !== undefined ? { filters: body.filters as Prisma.InputJsonValue } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
    include: withRates,
  });
  await audit(prisma, { action: "charge_head.update", entity: "charge_head", entityId: id, before: headDto(before), after: headDto(h) });
  events.emit({ name: "billing.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
  return headDto(h);
}

/**
 * A new rate from a date. Rates never reach back into a billed period
 * (MASTER_SPEC C4): the date must be after the last published run's period.
 * Statutory bounds are checked as of that date.
 */
export async function setRate(scope: SocietyScope, userId: string, id: string, body: z.output<typeof schemas.billing.SetRateBody>) {
  const head = await loadHead(scope.societyId, id);
  const from = fromIsoDate(body.effectiveFrom);
  const lastPublished = await prisma.billRun.findFirst({ where: { societyId: scope.societyId, status: "PUBLISHED" }, orderBy: { periodEnd: "desc" } });
  if (lastPublished && from <= lastPublished.periodEnd) {
    throw new AppError("BUSINESS_RULE_VIOLATION", `Bills up to ${toIsoDate(lastPublished.periodEnd)} are published; a new rate can start from ${toIsoDate(new Date(lastPublished.periodEnd.getTime() + 86_400_000))}.`);
  }
  const bps = head.method === "PERCENT_OF_HEAD" || head.method === "PERCENT_OF_CONSTRUCTION_COST" ? Number(body.rate) : null;
  if (bps !== null && !Number.isInteger(bps)) throw new AppError("VALIDATION_FAILED", "Percentage rates are whole basis points (25 = 0.25%).");
  if (head.category === "NON_OCCUPANCY" && bps !== null) {
    const cap = await configNumber(prisma, "non_occupancy_percent", scope.societyId, from);
    if (bps > percentToBps(cap)) throw new AppError("BUSINESS_RULE_VIOLATION", `Non-occupancy charges can't exceed ${cap}% of service charges.`);
  }
  if ((head.category === "SINKING_FUND" || head.category === "REPAIR_FUND") && bps !== null) {
    const key = head.category === "SINKING_FUND" ? "sinking_fund_min_percent" : "repair_fund_min_percent";
    const minimum = await configNumber(prisma, key, scope.societyId, from);
    if (bps < percentToBps(minimum)) throw new AppError("FUND_BELOW_MINIMUM", `The ${head.name} rate can't be below ${minimum}% a year of construction cost.`);
    // A fund rate is fixed by the general body (B2).
    if (!body.resolution) throw new AppError("RESOLUTION_REQUIRED", "Fund rates are set by the general body — add the resolution.");
  }
  if (head.method === "FIXED_PER_UNIT_TYPE" && !body.rateByType) {
    throw new AppError("VALIDATION_FAILED", "Give the monthly amount for each unit type.", [{ path: ["rateByType"], message: "Required" }]);
  }
  await transaction(prisma, async (tx) => {
    await tx.chargeRate.updateMany({ where: { headId: id, effectiveTo: null, effectiveFrom: { lt: from } }, data: { effectiveTo: from } });
    const clash = await tx.chargeRate.findFirst({ where: { headId: id, effectiveFrom: { gte: from } } });
    if (clash) throw new AppError("CONFLICT", `A rate already starts on or after ${body.effectiveFrom}.`);
    const r = await tx.chargeRate.create({
      data: {
        societyId: scope.societyId,
        headId: id,
        rate: new Prisma.Decimal(body.rate),
        rateByType: body.rateByType ? (body.rateByType as Prisma.InputJsonValue) : Prisma.JsonNull,
        effectiveFrom: from,
        resolution: body.resolution ? (body.resolution as Prisma.InputJsonValue) : Prisma.JsonNull,
        note: body.note ?? null,
        createdById: userId,
      },
    });
    await audit(tx, { action: "charge_rate.set", entity: "charge_head", entityId: id, after: { rate: body.rate, effectiveFrom: body.effectiveFrom, rateId: r.id } });
  });
  events.emit({ name: "billing.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
  return headDto(await loadHead(scope.societyId, id));
}

/** Who would be billed how much for this head, for one month, as of a date. */
export async function simulate(scope: SocietyScope, id: string, asOfIso?: string) {
  const asOf = asOfIso ? fromIsoDate(asOfIso) : todayIst();
  const head = await loadHead(scope.societyId, id);
  const heads = await prisma.chargeHead.findMany({ where: { societyId: scope.societyId, active: true }, include: withRates });
  const facts = await loadFacts(scope.societyId, asOf);
  const statutory = await statutoryAsOf(scope.societyId, asOf);
  const specs = heads.map((h) => ({ ...h, filters: h.filters as never, rate: rateAsOf(h.rates, asOf) }));
  // Include the base head so a percentage head has something to be a percentage of.
  const relevant = specs.filter((h) => h.id === id || h.id === head.baseHeadId);
  const rows = [];
  for (const u of facts.units) {
    const { lines } = apportion({ unit: u, building: facts.buildings.get(u.buildingId)!, heads: relevant, manual: facts.manual.get(u.unitId) ?? new Map(), months: 1, statutory });
    const line = lines.find((l) => l.headId === id);
    if (line) rows.push({ unitId: u.unitId, unitLabel: u.label, amountPaise: toWire(line.amountPaise)!, basis: line.basis });
  }
  return { headId: id, asOf: toIsoDate(asOf), totalPaise: rows.reduce((s, r) => s + r.amountPaise, 0), units: rows.length, rows };
}

export async function unitCharges(societyId: string, q: { headId?: string | undefined; unitId?: string | undefined }) {
  const rows = await prisma.unitCharge.findMany({ where: { societyId, ...(q.headId ? { headId: q.headId } : {}), ...(q.unitId ? { unitId: q.unitId } : {}) }, orderBy: { effectiveFrom: "desc" } });
  const [units, heads] = await Promise.all([
    prisma.unit.findMany({ where: { id: { in: rows.map((r) => r.unitId) } }, select: { id: true, number: true, building: { select: { name: true } } } }),
    prisma.chargeHead.findMany({ where: { id: { in: rows.map((r) => r.headId) } }, select: { id: true, name: true } }),
  ]);
  const label = new Map(units.map((u) => [u.id, `${u.building.name}-${u.number}`]));
  const name = new Map(heads.map((h) => [h.id, h.name]));
  return rows.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    unitLabel: label.get(r.unitId) ?? "",
    headId: r.headId,
    headName: name.get(r.headId) ?? "",
    amountPaise: toWire(r.amountPaise)!,
    effectiveFrom: toIsoDate(r.effectiveFrom),
    effectiveTo: toIsoDate(r.effectiveTo),
    note: r.note,
  }));
}

export async function createUnitCharge(scope: SocietyScope, body: z.output<typeof schemas.billing.CreateUnitChargeBody>) {
  const head = await loadHead(scope.societyId, body.headId);
  if (head.method !== "MANUAL") throw new AppError("BUSINESS_RULE_VIOLATION", `${head.name} is computed by ${head.method}; only manual heads take per-unit amounts.`);
  const unit = await prisma.unit.findFirst({ where: { id: body.unitId, societyId: scope.societyId } });
  if (!unit) throw notFound("Unit");
  const from = fromIsoDate(body.effectiveFrom);
  await prisma.unitCharge.updateMany({ where: { unitId: body.unitId, headId: body.headId, effectiveTo: null, effectiveFrom: { lt: from } }, data: { effectiveTo: from } });
  const row = await prisma.unitCharge.create({
    data: {
      societyId: scope.societyId,
      unitId: body.unitId,
      headId: body.headId,
      amountPaise: fromWire(body.amountPaise)!,
      effectiveFrom: from,
      effectiveTo: fromIsoDate(body.effectiveTo ?? null),
      note: body.note ?? null,
    },
  });
  await audit(prisma, { action: "unit_charge.create", entity: "unit_charge", entityId: row.id, after: { ...body } });
  return (await unitCharges(scope.societyId, { unitId: body.unitId, headId: body.headId })).find((r) => r.id === row.id)!;
}
