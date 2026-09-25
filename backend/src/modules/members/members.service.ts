import { isPermission, schemas, type Permission } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { fromIsoDate, toIsoDate, todayIst } from "../../core/dates";
import { Prisma, prisma, transaction, type Tx } from "../../core/db";
import { AppError, forbidden, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { fromWire } from "../../core/money";
import { contains, paginate } from "../../core/pagination";
import { readSettings } from "../society/society.service";
import {
  approvalDto,
  approvalInclude,
  familyDto,
  label,
  membershipDto,
  membershipInclude,
  nomineeDto,
  occupancyDto,
  personDto,
  petDto,
  tenancyDto,
  tenancyInclude,
  unitRef,
  vehicleDto,
  vehicleInclude,
} from "./members.mappers";

type S = typeof schemas.members;

// ─── Who may act for a unit ─────────────────────────────────────────────────

const isManager = (scope: SocietyScope) => scope.permissions.has("members.manage");

/** Units the caller acts for as a resident: their access unit, plus any they own or rent. */
export async function actingUnitIds(db: Tx, scope: SocietyScope, userId: string): Promise<Set<string>> {
  const ids = new Set<string>(scope.unitId ? [scope.unitId] : []);
  const persons = await db.person.findMany({
    where: { societyId: scope.societyId, userId, deletedAt: null },
    select: {
      memberships: { where: { cessationDate: null }, select: { unitId: true } },
      tenancies: { where: { endedOn: null }, select: { unitId: true } },
    },
  });
  for (const p of persons) {
    p.memberships.forEach((m) => ids.add(m.unitId));
    p.tenancies.forEach((t) => ids.add(t.unitId));
  }
  return ids;
}

async function isOwnerOf(db: Tx, scope: SocietyScope, userId: string, unitId: string): Promise<boolean> {
  const n = await db.membership.count({
    where: { societyId: scope.societyId, unitId, cessationDate: null, kind: { in: ["PRIMARY", "CO_OWNER"] }, person: { userId } },
  });
  return n > 0;
}

/** "manager" acts directly; "resident" goes through the approvals queue. */
async function roleForUnit(db: Tx, scope: SocietyScope, userId: string, unitId: string): Promise<"manager" | "resident"> {
  await unit(db, scope.societyId, unitId);
  if (isManager(scope)) return "manager";
  if ((await actingUnitIds(db, scope, userId)).has(unitId)) return "resident";
  throw forbidden("You can only manage your own unit.");
}

async function unit(db: Tx, societyId: string, unitId: string) {
  const u = await db.unit.findFirst({ where: { id: unitId, societyId }, include: { building: { select: { name: true } } } });
  if (!u) throw notFound("Unit");
  return u;
}

function changed(scope: SocietyScope, unitId: string | null) {
  events.emit({ name: "members.changed", to: { admins: scope.societyId, ...(unitId ? { unit: unitId } : {}) }, payload: { unitId } });
}

/** Find a society's record of a person by mobile, or create one; link it to their login if they have one. */
async function upsertPerson(db: Tx, societyId: string, input: z.output<S["PersonInput"]>) {
  const user = input.mobile ? await db.user.findUnique({ where: { mobile: input.mobile }, select: { id: true } }) : null;
  if (input.mobile) {
    const existing = await db.person.findFirst({ where: { societyId, mobile: input.mobile, deletedAt: null } });
    if (existing) {
      return db.person.update({
        where: { id: existing.id },
        data: { name: input.name, email: input.email ?? existing.email, userId: existing.userId ?? user?.id ?? null },
      });
    }
  }
  return db.person.create({
    data: { societyId, name: input.name, mobile: input.mobile ?? null, email: input.email ?? null, userId: user?.id ?? null },
  });
}

// ─── Member register ────────────────────────────────────────────────────────

export async function listMembers(societyId: string, q: z.output<S["MemberListQuery"]>) {
  const where: Prisma.MembershipWhereInput = {
    societyId,
    ...(q.includeCeased ? {} : { cessationDate: null }),
    ...(q.buildingId ? { unit: { buildingId: q.buildingId } } : {}),
    ...(q.q ? { OR: [{ person: { name: contains(q.q) } }, { person: { mobile: { contains: q.q } } }, { unit: { number: contains(q.q) } }] } : {}),
  };
  return paginate(
    q.limit,
    q.cursor,
    (p) =>
      prisma.membership.findMany({
        where,
        include: membershipInclude,
        orderBy: [{ unit: { building: { name: "asc" } } }, { unit: { number: "asc" } }, { kind: "asc" }, { id: "asc" }],
        ...p,
      }),
    membershipDto,
  );
}

export async function addMembership(scope: SocietyScope, unitId: string, body: z.output<S["AddMembershipBody"]>) {
  return transaction(prisma, async (tx) => {
    await unit(tx, scope.societyId, unitId);
    if (body.kind === "PRIMARY") {
      // MASTER_SPEC C3: exactly one primary owner per unit at a time.
      const current = await tx.membership.findFirst({ where: { unitId, kind: "PRIMARY", cessationDate: null } });
      if (current) throw new AppError("BUSINESS_RULE_VIOLATION", "This unit already has a primary owner. Record their cessation first.");
    }
    const person = await upsertPerson(tx, scope.societyId, body.person);
    const dup = await tx.membership.findFirst({ where: { unitId, personId: person.id, cessationDate: null } });
    if (dup) throw new AppError("CONFLICT", `${person.name} is already a member for this unit.`);
    const row = await tx.membership.create({
      data: {
        societyId: scope.societyId,
        unitId,
        personId: person.id,
        kind: body.kind,
        shareCertificateNo: body.shareCertificateNo ?? null,
        sharesHeld: body.sharesHeld ?? null,
        admissionDate: fromIsoDate(body.admissionDate),
      },
      include: membershipInclude,
    });
    await audit(tx, { action: "membership.create", entity: "membership", entityId: row.id, after: membershipDto(row) });
    changed(scope, unitId);
    return membershipDto(row);
  });
}

export async function ceaseMembership(scope: SocietyScope, id: string, body: z.output<S["CeaseMembershipBody"]>) {
  return transaction(prisma, async (tx) => {
    const before = await tx.membership.findFirst({ where: { id, societyId: scope.societyId }, include: membershipInclude });
    if (!before) throw notFound("Membership");
    if (before.cessationDate) throw new AppError("CONFLICT", "This membership has already ended.");
    const on = fromIsoDate(body.cessationDate);
    if (on < before.admissionDate) throw new AppError("VALIDATION_FAILED", "Cessation can't be before admission.");
    const row = await tx.membership.update({
      where: { id },
      data: { cessationDate: on, cessationReason: body.reason },
      include: membershipInclude,
    });
    await audit(tx, { action: "membership.cease", entity: "membership", entityId: id, before: membershipDto(before), after: membershipDto(row) });
    changed(scope, row.unitId);
    return membershipDto(row);
  });
}

export async function setNominees(scope: SocietyScope, userId: string, membershipId: string, body: z.output<S["SetNomineesBody"]>) {
  return transaction(prisma, async (tx) => {
    const m = await tx.membership.findFirst({ where: { id: membershipId, societyId: scope.societyId, cessationDate: null }, include: { person: true } });
    if (!m) throw notFound("Membership");
    if (!isManager(scope) && m.person.userId !== userId) throw forbidden("Only the member or the society office can change nominees.");
    const before = await tx.nominee.findMany({ where: { membershipId } });
    await tx.nominee.deleteMany({ where: { membershipId } });
    await tx.nominee.createMany({ data: body.nominees.map((n) => ({ ...n, societyId: scope.societyId, membershipId })) });
    const after = await tx.nominee.findMany({ where: { membershipId }, orderBy: { shareBps: "desc" } });
    await audit(tx, { action: "nominees.set", entity: "membership", entityId: membershipId, before: before.map(nomineeDto), after: after.map(nomineeDto) });
    changed(scope, m.unitId);
    return after.map(nomineeDto);
  });
}

// ─── Occupancy ──────────────────────────────────────────────────────────────

type OccupancyActor = { societyId: string; societyUserId: string | null };

async function recordOccupancy(tx: Tx, scope: OccupancyActor, unitId: string, status: z.output<S["SetOccupancyBody"]>["status"], from: Date, note: string | null) {
  const current = await tx.occupancy.findFirst({ where: { unitId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
  if (current && current.effectiveFrom > from) {
    throw new AppError("VALIDATION_FAILED", `The current occupancy starts ${toIsoDate(current.effectiveFrom)}; a change must start on or after it.`);
  }
  if (current && current.status === status) return current;
  if (current) {
    if (current.effectiveFrom.getTime() === from.getTime()) await tx.occupancy.delete({ where: { id: current.id } });
    else await tx.occupancy.update({ where: { id: current.id }, data: { effectiveTo: from } });
  }
  return tx.occupancy.create({ data: { societyId: scope.societyId, unitId, status, effectiveFrom: from, note, createdById: scope.societyUserId } });
}

export async function setOccupancy(scope: SocietyScope, unitId: string, body: z.output<S["SetOccupancyBody"]>) {
  return transaction(prisma, async (tx) => {
    await unit(tx, scope.societyId, unitId);
    const before = await tx.occupancy.findFirst({ where: { unitId, effectiveTo: null } });
    const row = await recordOccupancy(tx, scope, unitId, body.status, fromIsoDate(body.effectiveFrom), body.note ?? null);
    await audit(tx, { action: "occupancy.set", entity: "unit", entityId: unitId, before: before && occupancyDto(before), after: occupancyDto(row) });
    changed(scope, unitId);
    return occupancyDto(row);
  });
}

// ─── Tenancy ────────────────────────────────────────────────────────────────

/** Give someone a login from a template without the admin-grant check — used for system-provisioned tenants. */
async function provisionFromTemplate(tx: Tx, societyId: string, input: { name: string; mobile: string; unitId: string; templateCode: string; by: string }) {
  const t = await tx.permissionTemplate.findUnique({ where: { societyId_code: { societyId, code: input.templateCode } } });
  if (!t) throw new AppError("PRECONDITION_FAILED", `Permission template ${input.templateCode} is missing.`);
  const user = (await tx.user.findUnique({ where: { mobile: input.mobile } })) ?? (await tx.user.create({ data: { mobile: input.mobile, name: input.name } }));
  const permissions = (t.permissions as string[]).filter(isPermission) as Permission[];
  const existing = await tx.societyUser.findUnique({ where: { societyId_userId: { societyId, userId: user.id } } });
  if (existing && !existing.deletedAt && !existing.suspendedAt) return user;
  const data = { role: t.role, userType: t.userType, permissions, unitId: input.unitId, createdById: input.by, suspendedAt: null, suspendedReason: null, deletedAt: null };
  if (existing) await tx.societyUser.update({ where: { id: existing.id }, data });
  else await tx.societyUser.create({ data: { ...data, societyId, userId: user.id } });
  return user;
}

async function createTenancyDirect(tx: Tx, scope: SocietyScope, unitId: string, body: z.output<S["CreateTenancyBody"]>) {
  const start = fromIsoDate(body.startDate);
  const open = await tx.tenancy.findFirst({ where: { unitId, endedOn: null } });
  if (open && open.endDate >= start) throw new AppError("BUSINESS_RULE_VIOLATION", "This unit already has an active tenancy. End it first.");
  // A lapsed tenancy the expiry job hasn't closed yet is closed on its end date.
  if (open) await tx.tenancy.update({ where: { id: open.id }, data: { endedOn: open.endDate } });
  if (body.createLogin && !body.tenant.mobile) {
    throw new AppError("VALIDATION_FAILED", "A tenant login needs a mobile number.", [{ path: ["tenant", "mobile"], message: "Required for a login" }]);
  }
  const person = await upsertPerson(tx, scope.societyId, body.tenant);
  const row = await tx.tenancy.create({
    data: {
      societyId: scope.societyId,
      unitId,
      tenantPersonId: person.id,
      startDate: fromIsoDate(body.startDate),
      endDate: fromIsoDate(body.endDate),
      monthlyRentPaise: fromWire(body.monthlyRentPaise ?? null),
      depositPaise: fromWire(body.depositPaise ?? null),
      policeIntimationRef: body.policeIntimationRef ?? null,
      allowedOccupants: body.allowedOccupants ?? null,
      billPayer: body.billPayer,
    },
    include: tenancyInclude,
  });
  // Occupancy drives the non-occupancy charge; a tenancy makes the unit TENANTED from its start.
  await recordOccupancy(tx, scope, unitId, "TENANTED", row.startDate, "Tenancy recorded");
  if (body.createLogin && body.tenant.mobile) {
    const user = await provisionFromTemplate(tx, scope.societyId, {
      name: body.tenant.name,
      mobile: body.tenant.mobile,
      unitId,
      templateCode: "TENANT",
      by: scope.societyUserId,
    });
    if (!person.userId) await tx.person.update({ where: { id: person.id }, data: { userId: user.id } });
    events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: user.id } });
  }
  await audit(tx, { action: "tenancy.create", entity: "tenancy", entityId: row.id, after: tenancyDto(row) });
  return row;
}

export async function createTenancy(scope: SocietyScope, userId: string, unitId: string, body: z.output<S["CreateTenancyBody"]>) {
  return transaction(prisma, async (tx) => {
    const role = await roleForUnit(tx, scope, userId, unitId);
    if (role === "resident") {
      if (!(await isOwnerOf(tx, scope, userId, unitId))) throw forbidden("Only the unit's owner can add a tenant.");
      return { approvalId: await requestApproval(tx, scope, userId, unitId, "TENANT_ADD", body, `Tenant ${body.tenant.name}, ${body.startDate} to ${body.endDate}`) };
    }
    const row = await createTenancyDirect(tx, scope, unitId, body);
    changed(scope, unitId);
    return tenancyDto(row);
  });
}

export async function updateTenancy(scope: SocietyScope, id: string, body: z.output<S["UpdateTenancyBody"]>) {
  return transaction(prisma, async (tx) => {
    const before = await tx.tenancy.findFirst({ where: { id, societyId: scope.societyId }, include: tenancyInclude });
    if (!before) throw notFound("Tenancy");
    if (before.endedOn) throw new AppError("CONFLICT", "This tenancy has ended.");
    const endDate = body.endDate ? fromIsoDate(body.endDate) : undefined;
    if (endDate && endDate <= before.startDate) throw new AppError("VALIDATION_FAILED", "End date must be after the start date.");
    const row = await tx.tenancy.update({
      where: { id },
      data: {
        ...(endDate ? { endDate, expiryReminderSent: false } : {}),
        ...(body.monthlyRentPaise !== undefined ? { monthlyRentPaise: fromWire(body.monthlyRentPaise) } : {}),
        ...(body.depositPaise !== undefined ? { depositPaise: fromWire(body.depositPaise) } : {}),
        ...(body.policeIntimationRef !== undefined ? { policeIntimationRef: body.policeIntimationRef } : {}),
        ...(body.allowedOccupants !== undefined ? { allowedOccupants: body.allowedOccupants } : {}),
        ...(body.billPayer !== undefined ? { billPayer: body.billPayer } : {}),
      },
      include: tenancyInclude,
    });
    await audit(tx, { action: "tenancy.update", entity: "tenancy", entityId: id, before: tenancyDto(before), after: tenancyDto(row) });
    changed(scope, row.unitId);
    return tenancyDto(row);
  });
}

/** End a tenancy: the unit falls vacant and the tenant's access to it is suspended. */
export async function endTenancyInTx(tx: Tx, scope: OccupancyActor, id: string, endedOn: Date, reason: string) {
  const before = await tx.tenancy.findFirst({ where: { id, societyId: scope.societyId }, include: tenancyInclude });
  if (!before) throw notFound("Tenancy");
  if (before.endedOn) throw new AppError("CONFLICT", "This tenancy has already ended.");
  if (endedOn < before.startDate) throw new AppError("VALIDATION_FAILED", "A tenancy can't end before it starts.");
  const row = await tx.tenancy.update({ where: { id }, data: { endedOn }, include: tenancyInclude });
  await recordOccupancy(tx, scope, before.unitId, "VACANT", endedOn, reason);
  if (before.tenant.userId) {
    const access = await tx.societyUser.findMany({
      where: { societyId: scope.societyId, userId: before.tenant.userId, userType: "TENANT", unitId: before.unitId, suspendedAt: null, deletedAt: null },
    });
    for (const a of access) {
      await tx.societyUser.update({ where: { id: a.id }, data: { suspendedAt: new Date(), suspendedReason: reason } });
      events.emit({ name: "account.suspended", to: { user: a.userId }, payload: { societyId: scope.societyId, reason } });
    }
  }
  await audit(tx, { action: "tenancy.end", entity: "tenancy", entityId: id, before: tenancyDto(before), after: tenancyDto(row), societyId: scope.societyId });
  events.emit({ name: "members.changed", to: { admins: scope.societyId, unit: before.unitId }, payload: { unitId: before.unitId } });
  events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: before.tenant.userId } });
  return row;
}

export async function endTenancy(scope: SocietyScope, userId: string, id: string, body: z.output<S["EndTenancyBody"]>) {
  return transaction(prisma, async (tx) => {
    const t = await tx.tenancy.findFirst({ where: { id, societyId: scope.societyId } });
    if (!t) throw notFound("Tenancy");
    if (!isManager(scope) && !(await isOwnerOf(tx, scope, userId, t.unitId))) throw forbidden("Only the unit's owner or the society office can end a tenancy.");
    return tenancyDto(await endTenancyInTx(tx, scope, id, fromIsoDate(body.endedOn), "Tenancy ended"));
  });
}

// ─── Household: family, vehicles, pets ──────────────────────────────────────

async function requestApproval(tx: Tx, scope: SocietyScope, userId: string, unitId: string | null, kind: z.output<S["Approval"]>["kind"], payload: unknown, summary: string) {
  const row = await tx.memberApproval.create({
    data: {
      societyId: scope.societyId,
      unitId,
      kind,
      payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      summary: summary.slice(0, 200),
      requestedById: userId,
    },
  });
  await audit(tx, { action: "approval.request", entity: "member_approval", entityId: row.id, after: { kind, summary } });
  events.emit({ name: "approvals.changed", to: { admins: scope.societyId, user: userId }, payload: { approvalId: row.id, status: "PENDING" } });
  return row.id;
}

async function assertSlotForUnit(tx: Tx, societyId: string, unitId: string, slotId: string | null | undefined) {
  if (!slotId) return;
  const slot = await tx.parkingSlot.findFirst({ where: { id: slotId, societyId } });
  if (!slot) throw new AppError("VALIDATION_FAILED", "Unknown parking slot.");
  if (slot.unitId !== unitId) throw new AppError("BUSINESS_RULE_VIOLATION", `Slot ${slot.code} isn't allotted to this unit.`);
}

async function createFamily(tx: Tx, societyId: string, unitId: string, body: z.output<S["FamilyMemberInput"]>) {
  return tx.familyMember.create({
    data: { societyId, unitId, name: body.name, relation: body.relation, mobile: body.mobile ?? null, dateOfBirth: fromIsoDate(body.dateOfBirth ?? null) },
  });
}

async function createVehicle(tx: Tx, societyId: string, unitId: string, body: z.output<S["VehicleInput"]>) {
  await assertSlotForUnit(tx, societyId, unitId, body.parkingSlotId);
  const dup = await tx.vehicle.findFirst({ where: { societyId, plate: body.plate, deletedAt: null } });
  if (dup) throw new AppError("CONFLICT", `${body.plate} is already registered in this society.`);
  return tx.vehicle.create({
    data: {
      societyId,
      unitId,
      plate: body.plate,
      type: body.type,
      make: body.make ?? null,
      colour: body.colour ?? null,
      ownerName: body.ownerName ?? null,
      parkingSlotId: body.parkingSlotId ?? null,
      stickerNo: body.stickerNo ?? null,
    },
    include: vehicleInclude,
  });
}

async function createPet(tx: Tx, societyId: string, unitId: string, body: z.output<S["PetInput"]>) {
  return tx.pet.create({
    data: { societyId, unitId, name: body.name, species: body.species, breed: body.breed ?? null, vaccinatedUntil: fromIsoDate(body.vaccinatedUntil ?? null) },
  });
}

export async function addFamily(scope: SocietyScope, userId: string, unitId: string, body: z.output<S["FamilyMemberInput"]>) {
  return transaction(prisma, async (tx) => {
    if ((await roleForUnit(tx, scope, userId, unitId)) === "resident") {
      return { approvalId: await requestApproval(tx, scope, userId, unitId, "FAMILY_ADD", body, `Family: ${body.name} (${body.relation})`) };
    }
    const row = await createFamily(tx, scope.societyId, unitId, body);
    await audit(tx, { action: "family.create", entity: "family_member", entityId: row.id, after: familyDto(row) });
    changed(scope, unitId);
    return familyDto(row);
  });
}

export async function addVehicle(scope: SocietyScope, userId: string, unitId: string, body: z.output<S["VehicleInput"]>) {
  return transaction(prisma, async (tx) => {
    if ((await roleForUnit(tx, scope, userId, unitId)) === "resident") {
      await assertSlotForUnit(tx, scope.societyId, unitId, body.parkingSlotId);
      return { approvalId: await requestApproval(tx, scope, userId, unitId, "VEHICLE_ADD", body, `Vehicle ${body.plate}`) };
    }
    const row = await createVehicle(tx, scope.societyId, unitId, body);
    await audit(tx, { action: "vehicle.create", entity: "vehicle", entityId: row.id, after: vehicleDto(row) });
    changed(scope, unitId);
    return vehicleDto(row);
  });
}

export async function addPet(scope: SocietyScope, userId: string, unitId: string, body: z.output<S["PetInput"]>) {
  return transaction(prisma, async (tx) => {
    if ((await roleForUnit(tx, scope, userId, unitId)) === "resident") {
      return { approvalId: await requestApproval(tx, scope, userId, unitId, "PET_ADD", body, `Pet: ${body.name} (${body.species})`) };
    }
    const row = await createPet(tx, scope.societyId, unitId, body);
    await audit(tx, { action: "pet.create", entity: "pet", entityId: row.id, after: petDto(row) });
    changed(scope, unitId);
    return petDto(row);
  });
}

/** Removal is direct for residents too — taking something off your own record needs no approval. Soft delete keeps history. */
async function softRemove(
  scope: SocietyScope,
  userId: string,
  kind: "familyMember" | "vehicle" | "pet",
  id: string,
) {
  return transaction(prisma, async (tx) => {
    const delegate = tx[kind] as unknown as {
      findFirst(a: object): Promise<{ id: string; unitId: string } | null>;
      update(a: object): Promise<unknown>;
    };
    const row = await delegate.findFirst({ where: { id, societyId: scope.societyId, deletedAt: null } });
    if (!row) throw notFound(kind === "familyMember" ? "Family member" : kind === "vehicle" ? "Vehicle" : "Pet");
    await roleForUnit(tx, scope, userId, row.unitId);
    await delegate.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, { action: `${kind}.remove`, entity: kind, entityId: id, before: row });
    changed(scope, row.unitId);
    return { ok: true as const };
  });
}

export const removeFamily = (scope: SocietyScope, userId: string, id: string) => softRemove(scope, userId, "familyMember", id);
export const removeVehicle = (scope: SocietyScope, userId: string, id: string) => softRemove(scope, userId, "vehicle", id);
export const removePet = (scope: SocietyScope, userId: string, id: string) => softRemove(scope, userId, "pet", id);

/** The gate's plate lookup. Returns unit and vehicle only — never a phone number (MASTER_SPEC C9). */
export async function vehicles(societyId: string, q: z.output<S["VehicleSearchQuery"]>) {
  const plate = q.plate?.toUpperCase().replace(/[\s-]/g, "");
  const where: Prisma.VehicleWhereInput = {
    societyId,
    deletedAt: null,
    ...(plate ? { plate: { contains: plate } } : {}),
    ...(q.q ? { OR: [{ plate: contains(q.q.toUpperCase()) }, { ownerName: contains(q.q) }, { unit: { number: contains(q.q) } }] } : {}),
  };
  return paginate(q.limit, q.cursor, (p) => prisma.vehicle.findMany({ where, include: vehicleInclude, orderBy: [{ plate: "asc" }, { id: "asc" }], ...p }), vehicleDto);
}

// ─── Approvals ──────────────────────────────────────────────────────────────

async function nameMap(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const users = unique.length ? await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }) : [];
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function approvals(societyId: string, q: z.output<S["ApprovalListQuery"]>) {
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) => prisma.memberApproval.findMany({ where: { societyId, status: q.status }, include: approvalInclude, orderBy: [{ createdAt: "asc" }, { id: "asc" }], ...p }),
    (a) => a,
    () => prisma.memberApproval.count({ where: { societyId, status: q.status } }),
  );
  const names = await nameMap(page.items.flatMap((a) => [a.requestedById, a.decidedById]));
  return { nextCursor: page.nextCursor, total: page.total, items: page.items.map((a) => approvalDto(a, names)) };
}

export async function decideApproval(scope: SocietyScope, userId: string, id: string, body: z.output<S["DecideApprovalBody"]>) {
  const decided = await transaction(prisma, async (tx) => {
    // Lock the row so two admins deciding at once can't both apply it.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM member_approvals WHERE id = ${id}::uuid AND society_id = ${scope.societyId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Request");
    const a = await tx.memberApproval.findUniqueOrThrow({ where: { id } });
    if (a.status !== "PENDING") throw new AppError("CONFLICT", "This request has already been decided.");

    if (body.decision === "APPROVED" && a.unitId) {
      const p = a.payload as Record<string, unknown>;
      switch (a.kind) {
        case "FAMILY_ADD":
          await createFamily(tx, scope.societyId, a.unitId, schemas.members.FamilyMemberInput.parse(p));
          break;
        case "VEHICLE_ADD":
          await createVehicle(tx, scope.societyId, a.unitId, schemas.members.VehicleInput.parse(p));
          break;
        case "PET_ADD":
          await createPet(tx, scope.societyId, a.unitId, schemas.members.PetInput.parse(p));
          break;
        case "TENANT_ADD":
          await createTenancyDirect(tx, scope, a.unitId, schemas.members.CreateTenancyBody.parse(p));
          break;
        default:
          // Corrections and profile changes are acted on by the admin by hand; approving records that it was done.
          break;
      }
    }
    const row = await tx.memberApproval.update({
      where: { id },
      data: { status: body.decision, decidedById: userId, decisionNote: body.note ?? null, decidedAt: new Date() },
      include: approvalInclude,
    });
    await audit(tx, { action: `approval.${body.decision.toLowerCase()}`, entity: "member_approval", entityId: id, before: { status: "PENDING" }, after: { status: body.decision, note: body.note } });
    events.emit({ name: "approvals.changed", to: { admins: scope.societyId, user: a.requestedById }, payload: { approvalId: id, status: body.decision } });
    if (a.unitId) changed(scope, a.unitId);
    return row;
  });
  const names = await nameMap([decided.requestedById, decided.decidedById]);
  return approvalDto(decided, names);
}

export async function reportCorrection(scope: SocietyScope, userId: string, message: string) {
  return transaction(prisma, async (tx) => ({
    approvalId: await requestApproval(tx, scope, userId, scope.unitId, "DATA_CORRECTION", { message }, message),
  }));
}

// ─── Unit 360 ───────────────────────────────────────────────────────────────

export async function buildOverview(db: Tx, societyId: string, unitId: string) {
  const today = todayIst();
  const u = await db.unit.findFirst({
    where: { id: unitId, societyId },
    include: {
      building: { select: { name: true } },
      memberships: { include: membershipInclude, orderBy: [{ cessationDate: { sort: "desc", nulls: "first" } }, { admissionDate: "desc" }] },
      occupancies: { orderBy: { effectiveFrom: "desc" } },
      tenancies: { include: tenancyInclude, orderBy: { startDate: "desc" } },
      family: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      vehicles: { where: { deletedAt: null }, include: vehicleInclude, orderBy: { createdAt: "asc" } },
      pets: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      parkingSlots: { where: { active: true }, select: { id: true, code: true, type: true } },
      societyUsers: { where: { deletedAt: null }, include: { user: { select: { name: true, passwordHash: true, lockedUntil: true } } } },
    },
  });
  if (!u) throw notFound("Unit");
  const current = u.memberships.filter((m) => !m.cessationDate);
  const primary = current.find((m) => m.kind === "PRIMARY");
  const nominees = primary ? await db.nominee.findMany({ where: { membershipId: primary.id }, orderBy: { shareBps: "desc" } }) : [];
  const occ = u.occupancies.find((o) => o.effectiveFrom <= today && (!o.effectiveTo || o.effectiveTo > today)) ?? u.occupancies[0] ?? null;
  const tenancies = u.tenancies.map((t) => tenancyDto(t, today));
  const active = tenancies.find((t) => t.active) ?? null;
  return {
    unit: {
      id: u.id,
      label: label(u),
      buildingName: u.building.name,
      floor: u.floor,
      type: u.type,
      carpetAreaSqft: u.carpetAreaSqft === null ? null : Number(u.carpetAreaSqft),
      waterInlets: u.waterInlets,
      liftServed: u.liftServed,
      shareCertificateNo: u.shareCertificateNo,
    },
    currentMembers: current.map(membershipDto),
    pastMembers: u.memberships.filter((m) => m.cessationDate).map(membershipDto),
    occupancy: occ ? occupancyDto(occ) : null,
    occupancyHistory: u.occupancies.map(occupancyDto),
    activeTenancy: active,
    pastTenancies: tenancies.filter((t) => t !== active),
    family: u.family.map(familyDto),
    vehicles: u.vehicles.map(vehicleDto),
    pets: u.pets.map(petDto),
    parkingSlots: u.parkingSlots,
    nominees: nominees.map(nomineeDto),
    appUsers: u.societyUsers.map((su) => ({
      id: su.id,
      name: su.user.name,
      userType: su.userType,
      status: su.suspendedAt ? "SUSPENDED" : su.user.lockedUntil && su.user.lockedUntil > new Date() ? "LOCKED" : su.user.passwordHash ? "ACTIVE" : "INVITED",
    })),
  };
}

export async function unitOverview(scope: SocietyScope, userId: string, unitId: string) {
  if (!isManager(scope) && !(await actingUnitIds(prisma, scope, userId)).has(unitId)) throw forbidden("You can only see your own unit.");
  return buildOverview(prisma, scope.societyId, unitId);
}

export async function myHome(scope: SocietyScope, userId: string) {
  const ids = [...(await actingUnitIds(prisma, scope, userId))];
  const units = await Promise.all(ids.map((id) => buildOverview(prisma, scope.societyId, id)));
  const pending = await prisma.memberApproval.findMany({
    where: { societyId: scope.societyId, requestedById: userId, status: "PENDING" },
    include: approvalInclude,
    orderBy: { createdAt: "desc" },
  });
  // Decided in the last 14 days, so a resident sees a refusal and the office's note instead of a request that silently vanished.
  const decided = await prisma.memberApproval.findMany({
    where: { societyId: scope.societyId, requestedById: userId, status: { not: "PENDING" }, decidedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
    include: approvalInclude,
    orderBy: { decidedAt: "desc" },
    take: 20,
  });
  const names = await nameMap([...pending, ...decided].flatMap((p) => [p.requestedById, p.decidedById]));
  return {
    units: units.sort((a, b) => a.unit.label.localeCompare(b.unit.label)),
    pendingApprovals: pending.map((a) => approvalDto(a, names)),
    recentDecisions: decided.map((a) => approvalDto(a, names)),
  };
}

// ─── Directory ──────────────────────────────────────────────────────────────

export async function directory(scope: SocietyScope, q: { limit: number; cursor?: string | undefined; q?: string | undefined }) {
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { settings: true } });
  if (!readSettings(society.settings).directoryEnabled) throw new AppError("FORBIDDEN", "The society has turned the directory off.");
  const where: Prisma.PersonWhereInput = {
    societyId: scope.societyId,
    deletedAt: null,
    directoryListed: true,
    OR: [{ memberships: { some: { cessationDate: null } } }, { tenancies: { some: { endedOn: null } } }],
    ...(q.q ? { name: contains(q.q) } : {}),
  };
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) =>
      prisma.person.findMany({
        where,
        include: {
          memberships: { where: { cessationDate: null }, take: 1, include: { unit: { select: unitRef } } },
          tenancies: { where: { endedOn: null }, take: 1, include: { unit: { select: unitRef } } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        ...p,
      }),
    (p) => {
      const m = p.memberships[0];
      const t = p.tenancies[0];
      return {
        unitLabel: m ? label(m.unit) : t ? label(t.unit) : "",
        name: p.name,
        mobile: p.directoryShowMobile ? p.mobile : null,
        userType: m ? (m.kind === "PRIMARY" ? "OWNER" : m.kind) : "TENANT",
      };
    },
  );
  return page;
}

export async function setDirectoryPreference(scope: SocietyScope, userId: string, body: z.output<S["DirectoryPreference"]>) {
  const res = await prisma.person.updateMany({
    where: { societyId: scope.societyId, userId, deletedAt: null },
    data: { directoryListed: body.listed, directoryShowMobile: body.showMobile },
  });
  if (res.count === 0) throw new AppError("PRECONDITION_FAILED", "You aren't recorded as a member or tenant of this society yet.");
  return body;
}

export { personDto };
