import { schemas, type Unit as UnitDto } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { toIso, toIsoDate } from "../../core/dates";
import { isUniqueViolation, Prisma, prisma, transaction, type Tx } from "../../core/db";
import { AppError, conflict, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { fromWire, toWire } from "../../core/money";
import { contains, paginate } from "../../core/pagination";
import { parseTable } from "../../core/tabular";

// ─── Buildings ──────────────────────────────────────────────────────────────

type BuildingRow = Prisma.BuildingGetPayload<{ include: { _count: { select: { units: true } } } }>;

function buildingDto(b: BuildingRow) {
  return {
    id: b.id,
    name: b.name,
    wing: b.wing,
    floorCount: b.floorCount,
    liftPresent: b.liftPresent,
    constructionYear: b.constructionYear,
    constructionCostPaise: toWire(b.constructionCostPaise),
    unitCount: b._count.units,
  };
}

const bCount = { _count: { select: { units: true } } } as const;

export async function buildings(societyId: string) {
  const rows = await prisma.building.findMany({ where: { societyId, deletedAt: null }, include: bCount, orderBy: { name: "asc" } });
  return rows.map(buildingDto);
}

export async function createBuilding(scope: SocietyScope, body: z.output<typeof schemas.structure.CreateBuildingBody>) {
  try {
    const row = await prisma.building.create({
      data: {
        societyId: scope.societyId,
        name: body.name,
        wing: body.wing ?? null,
        floorCount: body.floorCount,
        liftPresent: body.liftPresent,
        constructionYear: body.constructionYear ?? null,
        constructionCostPaise: fromWire(body.constructionCostPaise ?? null),
      },
      include: bCount,
    });
    await audit(prisma, { action: "building.create", entity: "building", entityId: row.id, after: buildingDto(row) });
    events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: null } });
    return buildingDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`A building called "${body.name}" already exists.`);
    throw err;
  }
}

export async function updateBuilding(scope: SocietyScope, id: string, body: z.output<typeof schemas.structure.UpdateBuildingBody>) {
  return transaction(prisma, async (tx) => {
    const before = await tx.building.findFirst({ where: { id, societyId: scope.societyId, deletedAt: null }, include: bCount });
    if (!before) throw notFound("Building");
    const { constructionCostPaise, ...rest } = body;
    const row = await tx.building.update({
      where: { id },
      data: { ...rest, ...(constructionCostPaise !== undefined ? { constructionCostPaise: fromWire(constructionCostPaise) } : {}) },
      include: bCount,
    });
    // Lift charges follow the building (MASTER_SPEC B3.3): adding or removing
    // the lift updates which of its units are lift-served.
    if (body.liftPresent !== undefined && body.liftPresent !== before.liftPresent) {
      await tx.unit.updateMany({ where: { buildingId: id }, data: { liftServed: body.liftPresent } });
    }
    await audit(tx, { action: "building.update", entity: "building", entityId: id, before: buildingDto(before), after: buildingDto(row) });
    events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: null } });
    return buildingDto(row);
  });
}

// ─── Units ──────────────────────────────────────────────────────────────────

const unitInclude = {
  building: { select: { name: true } },
  occupancies: { where: { effectiveTo: null }, take: 1, orderBy: { effectiveFrom: "desc" } },
  tenancies: { where: { endedOn: null }, take: 1, include: { tenant: { select: { name: true } } } },
  memberships: { where: { cessationDate: null, kind: "PRIMARY" }, take: 1, include: { person: { select: { name: true } } } },
} satisfies Prisma.UnitInclude;

type UnitRow = Prisma.UnitGetPayload<{ include: typeof unitInclude }>;

export function unitDto(u: UnitRow): UnitDto {
  return {
    id: u.id,
    buildingId: u.buildingId,
    buildingName: u.building.name,
    number: u.number,
    label: `${u.building.name}-${u.number}`,
    floor: u.floor,
    type: u.type,
    status: u.status,
    carpetAreaSqft: u.carpetAreaSqft === null ? null : Number(u.carpetAreaSqft),
    builtUpAreaSqft: u.builtUpAreaSqft === null ? null : Number(u.builtUpAreaSqft),
    waterInlets: u.waterInlets,
    liftServed: u.liftServed,
    shareCertificateNo: u.shareCertificateNo,
    occupancy: u.occupancies[0]?.status ?? null,
    occupancySince: toIsoDate(u.occupancies[0]?.effectiveFrom ?? null),
    tenantName: u.tenancies[0]?.tenant.name ?? null,
    primaryOwnerName: u.memberships[0]?.person.name ?? null,
    updatedAt: toIso(u.updatedAt),
  };
}

export async function loadUnit(db: Tx, societyId: string, id: string) {
  const u = await db.unit.findFirst({ where: { id, societyId }, include: unitInclude });
  if (!u) throw notFound("Unit");
  return u;
}

function labelMatch(q: string): Prisma.UnitWhereInput[] {
  const m = /^(.+?)[-\s/]+(\w*)$/.exec(q.trim());
  if (!m) return [];
  return [{ building: { name: { equals: m[1]!, mode: "insensitive" } }, number: { startsWith: m[2]!, mode: "insensitive" } }];
}

export async function units(societyId: string, q: z.output<typeof schemas.structure.UnitListQuery>) {
  const where: Prisma.UnitWhereInput = {
    societyId,
    ...(q.buildingId ? { buildingId: q.buildingId } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.occupancy ? { occupancies: { some: { effectiveTo: null, status: q.occupancy } } } : {}),
    ...(q.q
      ? {
          OR: [
            // "A-12" → building A, number starting 12: how people actually type a flat.
            ...labelMatch(q.q),
            { number: contains(q.q) },
            { building: { name: contains(q.q) } },
            { memberships: { some: { cessationDate: null, person: { name: contains(q.q) } } } },
          ],
        }
      : {}),
  };
  return paginate(
    q.limit,
    q.cursor,
    (p) =>
      prisma.unit.findMany({
        where,
        include: unitInclude,
        orderBy: [{ building: { name: "asc" } }, { floor: "asc" }, { number: "asc" }, { id: "asc" }],
        ...p,
      }),
    unitDto,
    () => prisma.unit.count({ where }),
  );
}

async function building(db: Tx, societyId: string, id: string) {
  const b = await db.building.findFirst({ where: { id, societyId, deletedAt: null } });
  if (!b) throw new AppError("VALIDATION_FAILED", "That building isn't in this society.", [{ path: ["buildingId"], message: "Unknown building" }]);
  return b;
}

export async function createUnit(scope: SocietyScope, body: z.output<typeof schemas.structure.CreateUnitBody>) {
  const b = await building(prisma, scope.societyId, body.buildingId);
  try {
    const row = await prisma.unit.create({
      data: {
        societyId: scope.societyId,
        buildingId: b.id,
        number: body.number,
        floor: body.floor,
        type: body.type,
        carpetAreaSqft: body.carpetAreaSqft ?? null,
        builtUpAreaSqft: body.builtUpAreaSqft ?? null,
        waterInlets: body.waterInlets,
        liftServed: body.liftServed ?? b.liftPresent,
        shareCertificateNo: body.shareCertificateNo ?? null,
      },
      include: unitInclude,
    });
    await audit(prisma, { action: "unit.create", entity: "unit", entityId: row.id, after: unitDto(row) });
    events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: row.id } });
    return unitDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`Unit ${b.name}-${body.number} already exists.`);
    throw err;
  }
}

export async function bulkCreateUnits(scope: SocietyScope, body: z.output<typeof schemas.structure.BulkCreateUnitsBody>) {
  if (body.toFloor < body.fromFloor) throw new AppError("VALIDATION_FAILED", "The last floor must not be below the first.");
  if (!body.numberPattern.includes("{n}")) throw new AppError("VALIDATION_FAILED", "The number pattern must include {n}.");
  const total = (body.toFloor - body.fromFloor + 1) * body.unitsPerFloor;
  if (total > 2_000) throw new AppError("VALIDATION_FAILED", "Create at most 2,000 units at once.");
  const b = await building(prisma, scope.societyId, body.buildingId);

  const wanted: { number: string; floor: number }[] = [];
  for (let floor = body.fromFloor; floor <= body.toFloor; floor++) {
    for (let n = 1; n <= body.unitsPerFloor; n++) {
      const number = body.numberPattern
        .replaceAll("{floor}", floor === 0 ? "G" : String(floor))
        .replaceAll("{n}", String(n).padStart(2, "0"));
      wanted.push({ number, floor });
    }
  }
  const existing = new Set(
    (await prisma.unit.findMany({ where: { buildingId: b.id, number: { in: wanted.map((w) => w.number) } }, select: { number: true } })).map((u) => u.number),
  );
  const fresh = wanted.filter((w) => !existing.has(w.number));
  await prisma.unit.createMany({
    data: fresh.map((w) => ({
      societyId: scope.societyId,
      buildingId: b.id,
      number: w.number,
      floor: w.floor,
      type: body.type,
      carpetAreaSqft: body.carpetAreaSqft ?? null,
      waterInlets: body.waterInlets,
      liftServed: b.liftPresent,
    })),
    skipDuplicates: true,
  });
  await audit(prisma, { action: "unit.bulk_create", entity: "building", entityId: b.id, after: { created: fresh.length, pattern: body.numberPattern } });
  events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: null } });
  return { created: fresh.length, skipped: [...existing] };
}

export async function updateUnit(scope: SocietyScope, id: string, body: z.output<typeof schemas.structure.UpdateUnitBody>) {
  return transaction(prisma, async (tx) => {
    const before = await loadUnit(tx, scope.societyId, id);
    if (body.number && body.number !== before.number && before.firstBilledAt) {
      throw new AppError("UNIT_IN_USE", "A unit that has been billed can't be renumbered.");
    }
    try {
      await tx.unit.update({
        where: { id },
        data: {
          ...(body.number !== undefined ? { number: body.number } : {}),
          ...(body.floor !== undefined ? { floor: body.floor } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.carpetAreaSqft !== undefined ? { carpetAreaSqft: body.carpetAreaSqft } : {}),
          ...(body.builtUpAreaSqft !== undefined ? { builtUpAreaSqft: body.builtUpAreaSqft } : {}),
          ...(body.waterInlets !== undefined ? { waterInlets: body.waterInlets } : {}),
          ...(body.liftServed !== undefined ? { liftServed: body.liftServed } : {}),
          ...(body.shareCertificateNo !== undefined ? { shareCertificateNo: body.shareCertificateNo } : {}),
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict(`Unit ${before.building.name}-${body.number} already exists.`);
      throw err;
    }
    const after = await loadUnit(tx, scope.societyId, id);
    await audit(tx, { action: "unit.update", entity: "unit", entityId: id, before: unitDto(before), after: unitDto(after) });
    events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: id } });
    return unitDto(after);
  });
}

/** Columns: building, number, floor, and optionally type, carpet_area, built_up_area, water_inlets, share_certificate. */
export async function importUnits(scope: SocietyScope, actorUserId: string, input: z.output<typeof schemas.users.ImportBody>) {
  const table = await parseTable(input.format, input.contentBase64);
  for (const col of ["building", "number", "floor"]) {
    if (!table.headers.includes(col)) throw new AppError("VALIDATION_FAILED", `The file needs a "${col}" column.`);
  }
  const blds = await prisma.building.findMany({ where: { societyId: scope.societyId, deletedAt: null } });
  const byName = new Map(blds.map((b) => [b.name.toUpperCase(), b]));
  const existing = await prisma.unit.findMany({ where: { societyId: scope.societyId }, select: { buildingId: true, number: true } });
  const taken = new Set(existing.map((u) => `${u.buildingId}:${u.number.toUpperCase()}`));

  const errors: { row: number; field: string | null; message: string }[] = [];
  const rows: Prisma.UnitCreateManyInput[] = [];
  for (const { line, values } of table.rows) {
    const b = byName.get((values.building ?? "").toUpperCase());
    if (!b) {
      errors.push({ row: line, field: "building", message: `No building called "${values.building}". Add it first.` });
      continue;
    }
    const parsed = schemas.structure.CreateUnitBody.safeParse({
      buildingId: b.id,
      number: values.number,
      floor: Number(values.floor),
      type: values.type ? values.type.toUpperCase().replace(/[\s-]+/g, "_") : undefined,
      carpetAreaSqft: values.carpet_area ? Number(values.carpet_area) : null,
      builtUpAreaSqft: values.built_up_area ? Number(values.built_up_area) : null,
      waterInlets: values.water_inlets ? Number(values.water_inlets) : undefined,
      shareCertificateNo: values.share_certificate || null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      errors.push({ row: line, field: String(issue.path[0] ?? "") || null, message: issue.message });
      continue;
    }
    const key = `${b.id}:${parsed.data.number.toUpperCase()}`;
    if (taken.has(key)) {
      errors.push({ row: line, field: "number", message: `${b.name}-${parsed.data.number} already exists.` });
      continue;
    }
    taken.add(key);
    rows.push({
      societyId: scope.societyId,
      buildingId: b.id,
      number: parsed.data.number,
      floor: parsed.data.floor,
      type: parsed.data.type,
      carpetAreaSqft: parsed.data.carpetAreaSqft ?? null,
      builtUpAreaSqft: parsed.data.builtUpAreaSqft ?? null,
      waterInlets: parsed.data.waterInlets,
      liftServed: b.liftPresent,
      shareCertificateNo: parsed.data.shareCertificateNo ?? null,
    });
  }
  let created = 0;
  if (!input.dryRun && errors.length === 0 && rows.length) {
    created = (await prisma.unit.createMany({ data: rows })).count;
    await audit(prisma, { action: "unit.import", entity: "society", entityId: scope.societyId, after: { created } });
    events.emit({ name: "structure.changed", to: { society: scope.societyId }, payload: { unitId: null } });
  }
  await prisma.importJob.create({
    data: { societyId: scope.societyId, kind: "units", dryRun: input.dryRun, total: table.rows.length, created, errors, actorId: actorUserId },
  });
  return { dryRun: input.dryRun, total: table.rows.length, valid: rows.length, created, errors };
}

// ─── Parking ────────────────────────────────────────────────────────────────

const slotInclude = { unit: { select: { number: true, building: { select: { name: true } } } } } as const;
type SlotRow = Prisma.ParkingSlotGetPayload<{ include: typeof slotInclude }>;

function slotDto(s: SlotRow) {
  return {
    id: s.id,
    code: s.code,
    type: s.type,
    buildingId: s.buildingId,
    unitId: s.unitId,
    unitLabel: s.unit ? `${s.unit.building.name}-${s.unit.number}` : null,
    active: s.active,
  };
}

export async function parking(societyId: string) {
  return (await prisma.parkingSlot.findMany({ where: { societyId }, include: slotInclude, orderBy: { code: "asc" } })).map(slotDto);
}

export async function createParkingSlot(scope: SocietyScope, body: z.output<typeof schemas.structure.CreateParkingSlotBody>) {
  if (body.buildingId) await building(prisma, scope.societyId, body.buildingId);
  try {
    const row = await prisma.parkingSlot.create({
      data: { societyId: scope.societyId, code: body.code, type: body.type, buildingId: body.buildingId ?? null },
      include: slotInclude,
    });
    await audit(prisma, { action: "parking.create", entity: "parking_slot", entityId: row.id, after: slotDto(row) });
    events.emit({ name: "structure.changed", to: { admins: scope.societyId }, payload: { unitId: null } });
    return slotDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`Slot ${body.code} already exists.`);
    throw err;
  }
}

export async function allotParkingSlot(scope: SocietyScope, id: string, unitId: string | null) {
  return transaction(prisma, async (tx) => {
    const before = await tx.parkingSlot.findFirst({ where: { id, societyId: scope.societyId }, include: slotInclude });
    if (!before) throw notFound("Parking slot");
    if (unitId) await loadUnit(tx, scope.societyId, unitId);
    if (!unitId) await tx.vehicle.updateMany({ where: { parkingSlotId: id }, data: { parkingSlotId: null } });
    const row = await tx.parkingSlot.update({
      where: { id },
      data: { unitId, allottedAt: unitId ? new Date() : null },
      include: slotInclude,
    });
    await audit(tx, { action: unitId ? "parking.allot" : "parking.free", entity: "parking_slot", entityId: id, before: slotDto(before), after: slotDto(row) });
    events.emit({ name: "structure.changed", to: { admins: scope.societyId }, payload: { unitId } });
    if (unitId) events.emit({ name: "members.changed", to: { unit: unitId }, payload: { unitId } });
    return slotDto(row);
  });
}
