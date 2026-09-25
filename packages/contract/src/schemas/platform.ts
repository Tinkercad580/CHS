import { z } from "zod";
import { Id, IsoDateTime, ListQuery, Mobile } from "./common";
import { SOCIETY_TYPES } from "./society";

export const AuditLog = z.object({
  id: Id,
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  actorName: z.string().nullable(),
  permission: z.string().nullable(),
  ip: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: IsoDateTime,
});
export const AuditListQuery = ListQuery.extend({
  entity: z.string().max(60).optional(),
  entityId: z.string().max(60).optional(),
  actorId: Id.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const CreateSocietyBody = z.object({
  name: z.string().trim().min(3).max(150),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, { error: "2–12 letters or digits" }),
  type: z.enum(SOCIETY_TYPES),
  city: z.string().trim().max(80).nullable().optional(),
  firstAdmin: z.object({ name: z.string().trim().min(2).max(100), mobile: Mobile }),
});

export const PlatformSociety = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  status: z.string(),
  city: z.string().nullable(),
  unitCount: z.number().int(),
  userCount: z.number().int(),
  createdAt: IsoDateTime,
});

export const Health = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.record(z.string(), z.enum(["ok", "down", "disabled"])),
});
