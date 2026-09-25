import { z } from "zod";
import { Email, Id, IsoDate, IsoDateTime, ListQuery, Mobile, Paise } from "./common";

export const MEMBERSHIP_KINDS = ["PRIMARY", "CO_OWNER", "ASSOCIATE"] as const;
export const OCCUPANCY_STATUSES = [
  "SELF_OCCUPIED",
  "FAMILY_OCCUPIED",
  "TENANTED",
  "VACANT",
  "LOCKED",
  "UNDER_RENOVATION",
] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export const Person = z.object({
  id: Id,
  name: z.string(),
  mobile: z.string().nullable(),
  email: z.string().nullable(),
  userId: Id.nullable(),
});

export const PersonInput = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: Mobile.nullable().optional(),
  email: Email.nullable().optional(),
});

export const Membership = z.object({
  id: Id,
  unitId: Id,
  unitLabel: z.string(),
  person: Person,
  kind: z.enum(MEMBERSHIP_KINDS),
  shareCertificateNo: z.string().nullable(),
  sharesHeld: z.number().int().nullable(),
  admissionDate: IsoDate,
  cessationDate: IsoDate.nullable(),
});

export const MemberListQuery = ListQuery.extend({
  buildingId: Id.optional(),
  includeCeased: z.coerce.boolean().default(false),
});

export const AddMembershipBody = z.object({
  person: PersonInput,
  kind: z.enum(MEMBERSHIP_KINDS),
  shareCertificateNo: z.string().trim().max(40).nullable().optional(),
  sharesHeld: z.number().int().min(0).max(100_000).nullable().optional(),
  admissionDate: IsoDate,
});
export const CeaseMembershipBody = z.object({ cessationDate: IsoDate, reason: z.string().trim().min(3).max(300) });

export const Occupancy = z.object({
  id: Id,
  status: z.enum(OCCUPANCY_STATUSES),
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable(),
  note: z.string().nullable(),
});
export const SetOccupancyBody = z.object({
  status: z.enum(OCCUPANCY_STATUSES),
  effectiveFrom: IsoDate,
  note: z.string().trim().max(300).nullable().optional(),
});

export const BILL_PAYERS = ["OWNER", "TENANT"] as const;

export const Tenancy = z.object({
  id: Id,
  unitId: Id,
  tenant: Person,
  startDate: IsoDate,
  endDate: IsoDate,
  endedOn: IsoDate.nullable(),
  monthlyRentPaise: Paise.nullable(),
  depositPaise: Paise.nullable(),
  policeIntimationRef: z.string().nullable(),
  allowedOccupants: z.number().int().nullable(),
  billPayer: z.enum(BILL_PAYERS),
  active: z.boolean(),
});
export const CreateTenancyBody = z
  .object({
    tenant: PersonInput,
    startDate: IsoDate,
    endDate: IsoDate,
    monthlyRentPaise: Paise.min(0).nullable().optional(),
    depositPaise: Paise.min(0).nullable().optional(),
    policeIntimationRef: z.string().trim().max(60).nullable().optional(),
    allowedOccupants: z.number().int().min(1).max(30).nullable().optional(),
    billPayer: z.enum(BILL_PAYERS).default("OWNER"),
    /** Also give the tenant an app login with the TENANT template. */
    createLogin: z.boolean().default(false),
  })
  .refine((b) => b.endDate > b.startDate, { path: ["endDate"], error: "End date must be after the start date" });
export const UpdateTenancyBody = z.object({
  endDate: IsoDate.optional(),
  monthlyRentPaise: Paise.min(0).nullable().optional(),
  depositPaise: Paise.min(0).nullable().optional(),
  policeIntimationRef: z.string().trim().max(60).nullable().optional(),
  allowedOccupants: z.number().int().min(1).max(30).nullable().optional(),
  billPayer: z.enum(BILL_PAYERS).optional(),
});
export const EndTenancyBody = z.object({ endedOn: IsoDate });

export const FamilyMember = z.object({
  id: Id,
  name: z.string(),
  relation: z.string(),
  mobile: z.string().nullable(),
  dateOfBirth: IsoDate.nullable(),
});
export const FamilyMemberInput = z.object({
  name: z.string().trim().min(2).max(100),
  relation: z.string().trim().min(2).max(40),
  mobile: Mobile.nullable().optional(),
  dateOfBirth: IsoDate.nullable().optional(),
});

export const VEHICLE_TYPES = ["CAR", "TWO_WHEELER", "OTHER"] as const;
export const Vehicle = z.object({
  id: Id,
  unitId: Id,
  unitLabel: z.string(),
  plate: z.string(),
  type: z.enum(VEHICLE_TYPES),
  make: z.string().nullable(),
  colour: z.string().nullable(),
  ownerName: z.string().nullable(),
  parkingSlotCode: z.string().nullable(),
  stickerNo: z.string().nullable(),
});
export const VehicleInput = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$|^\d{2}BH\d{4}[A-Z]{1,2}$/, { error: "Not a valid registration number" })),
  type: z.enum(VEHICLE_TYPES),
  make: z.string().trim().max(60).nullable().optional(),
  colour: z.string().trim().max(30).nullable().optional(),
  ownerName: z.string().trim().max(100).nullable().optional(),
  parkingSlotId: Id.nullable().optional(),
  stickerNo: z.string().trim().max(30).nullable().optional(),
});
export const VehicleSearchQuery = ListQuery.extend({ plate: z.string().trim().min(2).max(15).optional() });

export const Pet = z.object({
  id: Id,
  name: z.string(),
  species: z.string(),
  breed: z.string().nullable(),
  vaccinatedUntil: IsoDate.nullable(),
});
export const PetInput = z.object({
  name: z.string().trim().min(1).max(60),
  species: z.string().trim().min(2).max(30),
  breed: z.string().trim().max(60).nullable().optional(),
  vaccinatedUntil: IsoDate.nullable().optional(),
});

export const Nominee = z.object({
  id: Id,
  name: z.string(),
  relation: z.string(),
  /** Basis points of the member's interest, 10000 = 100%. */
  shareBps: z.number().int().min(1).max(10000),
});
export const SetNomineesBody = z
  .object({
    nominees: z
      .array(z.object({ name: z.string().trim().min(2).max(100), relation: z.string().trim().min(2).max(40), shareBps: z.number().int().min(1).max(10000) }))
      .max(10),
  })
  .refine((b) => b.nominees.length === 0 || b.nominees.reduce((s, n) => s + n.shareBps, 0) === 10000, {
    path: ["nominees"],
    error: "Nominee shares must add up to 100%",
  });

export const APPROVAL_KINDS = ["FAMILY_ADD", "VEHICLE_ADD", "PET_ADD", "TENANT_ADD", "PROFILE_CHANGE", "DATA_CORRECTION"] as const;
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const Approval = z.object({
  id: Id,
  kind: z.enum(APPROVAL_KINDS),
  status: z.enum(APPROVAL_STATUSES),
  unitId: Id.nullable(),
  unitLabel: z.string().nullable(),
  requestedByName: z.string(),
  payload: z.record(z.string(), z.unknown()),
  summary: z.string(),
  decidedByName: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: IsoDateTime,
  decidedAt: IsoDateTime.nullable(),
});
export const ApprovalListQuery = ListQuery.extend({ status: z.enum(APPROVAL_STATUSES).default("PENDING") });
export const DecideApprovalBody = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).nullable().optional(),
});
export const DataCorrectionBody = z.object({ message: z.string().trim().min(5).max(1000) });

/** Everything about one unit on one screen — MASTER_SPEC Phase 3 exit criterion. */
export const UnitOverview = z.object({
  unit: z.object({
    id: Id,
    label: z.string(),
    buildingName: z.string(),
    floor: z.number().int(),
    type: z.string(),
    carpetAreaSqft: z.number().nullable(),
    waterInlets: z.number().int(),
    liftServed: z.boolean(),
    shareCertificateNo: z.string().nullable(),
  }),
  currentMembers: z.array(Membership),
  pastMembers: z.array(Membership),
  occupancy: Occupancy.nullable(),
  occupancyHistory: z.array(Occupancy),
  activeTenancy: Tenancy.nullable(),
  pastTenancies: z.array(Tenancy),
  family: z.array(FamilyMember),
  vehicles: z.array(Vehicle),
  pets: z.array(Pet),
  parkingSlots: z.array(z.object({ id: Id, code: z.string(), type: z.string() })),
  nominees: z.array(Nominee),
  appUsers: z.array(z.object({ id: Id, name: z.string(), userType: z.string(), status: z.string() })),
});

export const DirectoryEntry = z.object({
  unitLabel: z.string(),
  name: z.string(),
  mobile: z.string().nullable(),
  userType: z.string(),
});
export const DirectoryPreference = z.object({ listed: z.boolean(), showMobile: z.boolean() });
