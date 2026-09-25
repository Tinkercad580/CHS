import { z } from "zod";
import { ALL_PERMISSIONS, ROLES, USER_TYPES } from "../permissions";
import { Email, Id, IsoDateTime, ListQuery, Mobile } from "./common";

export const ACCOUNT_STATUSES = ["INVITED", "ACTIVE", "LOCKED", "SUSPENDED"] as const;
export const AccountStatus = z.enum(ACCOUNT_STATUSES);

export const SocietyUser = z.object({
  id: Id,
  userId: Id,
  name: z.string(),
  mobile: z.string(),
  email: z.string().nullable(),
  role: z.enum(ROLES),
  userType: z.enum(USER_TYPES),
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
  unitId: Id.nullable(),
  unitLabel: z.string().nullable(),
  status: AccountStatus,
  lockedUntil: IsoDateTime.nullable(),
  suspendedReason: z.string().nullable(),
  lastLoginAt: IsoDateTime.nullable(),
  twoFactorEnabled: z.boolean(),
  notes: z.string().nullable(),
  createdAt: IsoDateTime,
});
export type SocietyUser = z.infer<typeof SocietyUser>;

export const UserListQuery = ListQuery.extend({
  status: AccountStatus.optional(),
  role: z.enum(ROLES).optional(),
  userType: z.enum(USER_TYPES).optional(),
  unitId: Id.optional(),
});

const Permissions = z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length);

export const CreateUserBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    mobile: Mobile,
    email: Email.nullable().optional(),
    unitId: Id.nullable().optional(),
    role: z.enum(ROLES).default("USER"),
    userType: z.enum(USER_TYPES),
    /** Either a template code or an explicit list. An explicit list wins. */
    templateCode: z.string().trim().max(40).optional(),
    permissions: Permissions.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((b) => b.templateCode || b.permissions, {
    path: ["permissions"],
    error: "Choose a permission template or list the permissions",
  });

export const UpdateUserBody = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: Email.nullable().optional(),
  unitId: Id.nullable().optional(),
  role: z.enum(ROLES).optional(),
  userType: z.enum(USER_TYPES).optional(),
  templateCode: z.string().trim().max(40).optional(),
  permissions: Permissions.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const TempPasswordIssued = z.object({
  tempPassword: z.string(),
  expiresAt: IsoDateTime,
  /** Where the system sent it. Admins copy it or share it on WhatsApp regardless. */
  deliveredVia: z.array(z.enum(["sms", "whatsapp", "email"])),
  whatsappShareUrl: z.string(),
});

export const SuspendBody = z.object({ reason: z.string().trim().min(3).max(300) });

export const PermissionTemplate = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  userType: z.enum(USER_TYPES),
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
});

export const UpsertPermissionTemplateBody = z.object({
  name: z.string().trim().min(2).max(60),
  role: z.enum(ROLES),
  userType: z.enum(USER_TYPES),
  permissions: Permissions,
});

export const ImportBody = z.object({
  format: z.enum(["csv", "xlsx"]),
  /** Base64 of the uploaded file. 5 MB cap after decoding. */
  contentBase64: z.string().min(1).max(7_000_000),
  dryRun: z.boolean().default(true),
});

export const ImportReport = z.object({
  dryRun: z.boolean(),
  total: z.number().int(),
  valid: z.number().int(),
  created: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), field: z.string().nullable(), message: z.string() })),
});
