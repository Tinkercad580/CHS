import { Prisma } from "../../core/db";
import { toIso, toIsoDate } from "../../core/dates";
import { toWire } from "../../core/money";

export const unitRef = { number: true, building: { select: { name: true } } } as const;
export const label = (u: { number: string; building: { name: string } }) => `${u.building.name}-${u.number}`;

type PersonRow = Prisma.PersonGetPayload<object>;
export function personDto(p: PersonRow) {
  return { id: p.id, name: p.name, mobile: p.mobile, email: p.email, userId: p.userId };
}

export const membershipInclude = { person: true, unit: { select: unitRef } } as const;
type MembershipRow = Prisma.MembershipGetPayload<{ include: typeof membershipInclude }>;
export function membershipDto(m: MembershipRow) {
  return {
    id: m.id,
    unitId: m.unitId,
    unitLabel: label(m.unit),
    person: personDto(m.person),
    kind: m.kind,
    shareCertificateNo: m.shareCertificateNo,
    sharesHeld: m.sharesHeld,
    admissionDate: toIsoDate(m.admissionDate),
    cessationDate: toIsoDate(m.cessationDate),
  };
}

export function occupancyDto(o: Prisma.OccupancyGetPayload<object>) {
  return { id: o.id, status: o.status, effectiveFrom: toIsoDate(o.effectiveFrom), effectiveTo: toIsoDate(o.effectiveTo), note: o.note };
}

export const tenancyInclude = { tenant: true } as const;
type TenancyRow = Prisma.TenancyGetPayload<{ include: typeof tenancyInclude }>;
export function tenancyDto(t: TenancyRow, today = new Date()) {
  return {
    id: t.id,
    unitId: t.unitId,
    tenant: personDto(t.tenant),
    startDate: toIsoDate(t.startDate),
    endDate: toIsoDate(t.endDate),
    endedOn: toIsoDate(t.endedOn),
    monthlyRentPaise: toWire(t.monthlyRentPaise),
    depositPaise: toWire(t.depositPaise),
    policeIntimationRef: t.policeIntimationRef,
    allowedOccupants: t.allowedOccupants,
    billPayer: t.billPayer,
    active: !t.endedOn && t.endDate >= new Date(today.toISOString().slice(0, 10)),
  };
}

export function familyDto(f: Prisma.FamilyMemberGetPayload<object>) {
  return { id: f.id, name: f.name, relation: f.relation, mobile: f.mobile, dateOfBirth: toIsoDate(f.dateOfBirth) };
}

export const vehicleInclude = { unit: { select: unitRef }, parkingSlot: { select: { code: true } } } as const;
type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;
export function vehicleDto(v: VehicleRow) {
  return {
    id: v.id,
    unitId: v.unitId,
    unitLabel: label(v.unit),
    plate: v.plate,
    type: v.type,
    make: v.make,
    colour: v.colour,
    ownerName: v.ownerName,
    parkingSlotCode: v.parkingSlot?.code ?? null,
    stickerNo: v.stickerNo,
  };
}

export function petDto(p: Prisma.PetGetPayload<object>) {
  return { id: p.id, name: p.name, species: p.species, breed: p.breed, vaccinatedUntil: toIsoDate(p.vaccinatedUntil) };
}

export function nomineeDto(n: Prisma.NomineeGetPayload<object>) {
  return { id: n.id, name: n.name, relation: n.relation, shareBps: n.shareBps };
}

export const approvalInclude = { unit: { select: unitRef } } as const;
type ApprovalRow = Prisma.MemberApprovalGetPayload<{ include: typeof approvalInclude }>;
export function approvalDto(a: ApprovalRow, names: Map<string, string>) {
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    unitId: a.unitId,
    unitLabel: a.unit ? label(a.unit) : null,
    requestedByName: names.get(a.requestedById) ?? "Unknown",
    payload: (a.payload ?? {}) as Record<string, unknown>,
    summary: a.summary,
    decidedByName: a.decidedById ? (names.get(a.decidedById) ?? null) : null,
    decisionNote: a.decisionNote,
    createdAt: toIso(a.createdAt),
    decidedAt: toIso(a.decidedAt),
  };
}
