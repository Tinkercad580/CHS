import { z } from "zod";
import { Id, IsoDate, IsoDateTime, ListQuery, Paise } from "./common";

export const Building = z.object({
  id: Id,
  name: z.string(),
  wing: z.string().nullable(),
  floorCount: z.number().int(),
  liftPresent: z.boolean(),
  constructionYear: z.number().int().nullable(),
  /** Required before sinking / repair fund heads can be enabled (MASTER_SPEC B3.4). */
  constructionCostPaise: Paise.nullable(),
  unitCount: z.number().int(),
});
export type Building = z.infer<typeof Building>;

export const CreateBuildingBody = z.object({
  name: z.string().trim().min(1).max(60),
  wing: z.string().trim().max(20).nullable().optional(),
  floorCount: z.number().int().min(0).max(200),
  liftPresent: z.boolean(),
  constructionYear: z.number().int().min(1900).max(2100).nullable().optional(),
  constructionCostPaise: Paise.min(0).nullable().optional(),
});
export const UpdateBuildingBody = CreateBuildingBody.partial();

export const UNIT_TYPES = ["RESIDENTIAL", "COMMERCIAL", "SHOP", "OFFICE", "PARKING_ONLY"] as const;
export const UNIT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const Unit = z.object({
  id: Id,
  buildingId: Id,
  buildingName: z.string(),
  number: z.string(),
  label: z.string(),
  floor: z.number().int(),
  type: z.enum(UNIT_TYPES),
  status: z.enum(UNIT_STATUSES),
  carpetAreaSqft: z.number().nullable(),
  builtUpAreaSqft: z.number().nullable(),
  waterInlets: z.number().int(),
  liftServed: z.boolean(),
  shareCertificateNo: z.string().nullable(),
  occupancy: z.string().nullable(),
  occupancySince: IsoDate.nullable(),
  tenantName: z.string().nullable(),
  primaryOwnerName: z.string().nullable(),
  updatedAt: IsoDateTime,
});
export type Unit = z.infer<typeof Unit>;

export const UnitListQuery = ListQuery.extend({
  buildingId: Id.optional(),
  type: z.enum(UNIT_TYPES).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  occupancy: z.enum(["SELF_OCCUPIED", "FAMILY_OCCUPIED", "TENANTED", "VACANT", "LOCKED", "UNDER_RENOVATION"]).optional(),
});

const Area = z.number().positive().max(1_000_000);

export const CreateUnitBody = z.object({
  buildingId: Id,
  number: z.string().trim().min(1).max(20),
  floor: z.number().int().min(-5).max(200),
  type: z.enum(UNIT_TYPES).default("RESIDENTIAL"),
  carpetAreaSqft: Area.nullable().optional(),
  builtUpAreaSqft: Area.nullable().optional(),
  waterInlets: z.number().int().min(0).max(50).default(1),
  liftServed: z.boolean().optional(),
  shareCertificateNo: z.string().trim().max(40).nullable().optional(),
});
export const UpdateUnitBody = CreateUnitBody.omit({ buildingId: true })
  .partial()
  .extend({ status: z.enum(UNIT_STATUSES).optional() });

/** Lay out a building in one call: floors × units-per-floor, numbered by pattern. */
export const BulkCreateUnitsBody = z.object({
  buildingId: Id,
  fromFloor: z.number().int().min(-5).max(200),
  toFloor: z.number().int().min(-5).max(200),
  unitsPerFloor: z.number().int().min(1).max(50),
  /** `{floor}` and `{n}` (1-based, zero-padded to 2) — "{floor}{n}" gives 101, 102… */
  numberPattern: z.string().trim().min(3).max(30).default("{floor}{n}"),
  type: z.enum(UNIT_TYPES).default("RESIDENTIAL"),
  carpetAreaSqft: Area.nullable().optional(),
  waterInlets: z.number().int().min(0).max(50).default(1),
});
export const BulkCreateUnitsResult = z.object({ created: z.number().int(), skipped: z.array(z.string()) });

export const PARKING_TYPES = ["CAR_COVERED", "CAR_OPEN", "CAR_STILT", "TWO_WHEELER", "VISITOR"] as const;

export const ParkingSlot = z.object({
  id: Id,
  code: z.string(),
  type: z.enum(PARKING_TYPES),
  buildingId: Id.nullable(),
  unitId: Id.nullable(),
  unitLabel: z.string().nullable(),
  active: z.boolean(),
});

export const CreateParkingSlotBody = z.object({
  code: z.string().trim().min(1).max(20),
  type: z.enum(PARKING_TYPES),
  buildingId: Id.nullable().optional(),
});
export const AllotParkingBody = z.object({ unitId: Id.nullable() });
