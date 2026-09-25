import { z } from "zod";
import { ALL_PERMISSIONS, ROLES, USER_TYPES } from "../permissions";
import { Email, Id, IsoDateTime, Language, Mobile } from "./common";

/**
 * Password policy — MASTER_SPEC A2.2. The server re-checks everything here and
 * additionally rejects the mobile number, common passwords and the last three.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const NewPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `At least ${PASSWORD_MIN_LENGTH} characters` })
  .max(128)
  .regex(/[A-Za-z]/, { error: "Include at least one letter" })
  .regex(/\d/, { error: "Include at least one number" });

export const Device = z.object({
  deviceId: z.string().trim().min(8).max(100).optional(),
  deviceName: z.string().trim().max(100).optional(),
  client: z.enum(["web", "resident", "gate", "admin"]).default("web"),
});

export const LookupBody = z.object({ mobile: Mobile });
export const LookupResult = z.object({
  next: z.enum(["CREATE_PASSWORD", "ENTER_PASSWORD", "NOT_REGISTERED", "LOCKED"]),
  lockedUntil: IsoDateTime.nullable().optional(),
});

export const ActivateBody = Device.extend({
  mobile: Mobile,
  password: NewPassword,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { error: "Accept the terms to continue" }),
}).refine((b) => b.password === b.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

export const LoginBody = Device.extend({ mobile: Mobile, password: z.string().min(1).max(128) });

export const Membership = z.object({
  societyId: Id,
  societyName: z.string(),
  societyCode: z.string(),
  city: z.string().nullable(),
  unitCount: z.number().int(),
  role: z.enum(ROLES),
  userType: z.enum(USER_TYPES),
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
  unitId: Id.nullable(),
  unitLabel: z.string().nullable(),
});
export type Membership = z.infer<typeof Membership>;

export const Me = z.object({
  id: Id,
  name: z.string(),
  mobile: z.string(),
  email: z.string().nullable(),
  language: Language,
  isPlatformAdmin: z.boolean(),
  twoFactorEnabled: z.boolean(),
  mustChangePassword: z.boolean(),
  memberships: z.array(Membership),
});
export type Me = z.infer<typeof Me>;

export const TokenPair = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: IsoDateTime,
  refreshToken: z.string(),
  refreshTokenExpiresAt: IsoDateTime,
});
export type TokenPair = z.infer<typeof TokenPair>;

/**
 * Login has three outcomes. `SIGNED_IN` is a full session. `PASSWORD_CHANGE`
 * carries a restricted token good only for the forced change — MASTER_SPEC
 * A2.1(4): a temporary password must be replaced before any screen.
 * `TWO_FACTOR` carries a short-lived challenge for the TOTP step.
 */
export const LoginResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("SIGNED_IN"), tokens: TokenPair, me: Me }),
  z.object({ status: z.literal("PASSWORD_CHANGE"), restrictedToken: z.string(), expiresAt: IsoDateTime }),
  z.object({ status: z.literal("TWO_FACTOR"), challengeToken: z.string(), expiresAt: IsoDateTime }),
]);
export type LoginResult = z.infer<typeof LoginResult>;

export const TwoFactorVerifyBody = Device.extend({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code" }),
});

export const RefreshBody = z.object({ refreshToken: z.string().min(1) });
export const LogoutBody = z.object({ refreshToken: z.string().min(1).optional() });

export const ForcedChangeBody = Device.extend({
  newPassword: NewPassword,
  confirmPassword: z.string(),
}).refine((b) => b.newPassword === b.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

export const ChangePasswordBody = z
  .object({ currentPassword: z.string().min(1), newPassword: NewPassword, confirmPassword: z.string() })
  .refine((b) => b.newPassword === b.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

export const UpdateMeBody = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: Email.nullable().optional(),
  language: Language.optional(),
});

export const Session = z.object({
  id: Id,
  client: z.string(),
  deviceName: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: IsoDateTime,
  lastUsedAt: IsoDateTime,
  current: z.boolean(),
});
export type Session = z.infer<typeof Session>;

export const TwoFactorSetup = z.object({ secret: z.string(), otpauthUrl: z.string() });
export const TwoFactorCodeBody = z.object({ code: z.string().regex(/^\d{6}$/) });

export const AUTH_EVENT_TYPES = [
  "ACTIVATED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOCKED",
  "UNLOCKED",
  "PASSWORD_CHANGED",
  "TEMP_PASSWORD_ISSUED",
  "SESSION_REVOKED",
  "ALL_SESSIONS_REVOKED",
  "REFRESH_REUSE_DETECTED",
  "TWO_FACTOR_ENABLED",
  "TWO_FACTOR_DISABLED",
  "SUSPENDED",
  "REACTIVATED",
] as const;

export const AuthEvent = z.object({
  id: Id,
  type: z.enum(AUTH_EVENT_TYPES),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  actorName: z.string().nullable(),
  detail: z.string().nullable(),
  createdAt: IsoDateTime,
});
