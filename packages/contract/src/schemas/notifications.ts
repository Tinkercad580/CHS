import { z } from "zod";
import { Id, IsoDateTime, ListQuery } from "./common";

export const NOTIFICATION_CATEGORIES = ["BILLING", "PAYMENT", "NOTICE", "EMERGENCY", "APPROVAL", "ACCOUNT", "REPORT", "GENERAL"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Categories a person can't switch off: statutory notices, emergencies, account security (MASTER_SPEC C11). */
export const MANDATORY_CATEGORIES: readonly NotificationCategory[] = ["EMERGENCY", "ACCOUNT"];

export const RegisterDeviceBody = z.object({
  token: z.string().min(20).max(4096),
  app: z.enum(["resident", "gate"]),
  platform: z.enum(["android", "ios"]),
  deviceName: z.string().trim().max(100).optional(),
});
export const UnregisterDeviceBody = z.object({ token: z.string().min(20).max(4096) });

export const Notification = z.object({
  id: Id,
  societyId: Id.nullable(),
  category: z.enum(NOTIFICATION_CATEGORIES),
  title: z.string(),
  body: z.string(),
  /** `route` is the screen a tap opens; other keys depend on the category. */
  data: z.record(z.string(), z.string()),
  read: z.boolean(),
  createdAt: IsoDateTime,
});
export type Notification = z.infer<typeof Notification>;

export const NotificationListQuery = ListQuery.extend({
  unread: z.coerce.boolean().optional(),
  societyId: Id.optional(),
});

export const UnreadCount = z.object({ unread: z.number().int() });

export const NotificationPreference = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  push: z.boolean(),
  email: z.boolean(),
  mandatory: z.boolean(),
});
export const NotificationPreferences = z.object({
  preferences: z.array(NotificationPreference),
  /** False when the person has no email: the apps prompt them to add one to receive reports and updates. */
  hasEmail: z.boolean(),
  devices: z.array(z.object({ id: Id, app: z.string(), platform: z.string(), deviceName: z.string().nullable(), lastSeenAt: IsoDateTime })),
});
export const UpdatePreferencesBody = z.object({
  preferences: z.array(z.object({ category: z.enum(NOTIFICATION_CATEGORIES), push: z.boolean(), email: z.boolean() })).min(1),
});

export const TestNotificationResult = z.object({
  push: z.enum(["sent", "no_devices", "disabled"]),
  email: z.enum(["sent", "no_email", "disabled"]),
});

// ─── Notices ────────────────────────────────────────────────────────────────

export const NOTICE_CATEGORIES = ["GENERAL", "MAINTENANCE_SHUTDOWN", "WATER", "MEETING", "EMERGENCY", "CIRCULAR", "FINANCIAL", "FACILITY"] as const;

export const Audience = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ALL") }),
  z.object({ kind: z.literal("OWNERS") }),
  z.object({ kind: z.literal("TENANTS") }),
  z.object({ kind: z.literal("RESIDENTS") }),
  z.object({ kind: z.literal("STAFF") }),
  z.object({ kind: z.literal("ADMINS") }),
  z.object({ kind: z.literal("BUILDINGS"), buildingIds: z.array(Id).min(1).max(50) }),
  z.object({ kind: z.literal("UNITS"), unitIds: z.array(Id).min(1).max(2000) }),
]);
export type Audience = z.infer<typeof Audience>;

export const NOTICE_CHANNELS = ["push", "email"] as const;

export const NoticeInput = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(20_000),
  category: z.enum(NOTICE_CATEGORIES),
  audience: Audience,
  ackRequired: z.boolean().default(false),
  pinned: z.boolean().default(false),
  channels: z.array(z.enum(NOTICE_CHANNELS)).max(2).default(["push"]),
  expiresAt: IsoDateTime.nullable().optional(),
  /** Required for EMERGENCY: it bypasses quiet hours, and the reason is logged. */
  emergencyReason: z.string().trim().min(5).max(300).nullable().optional(),
  /** Publishing this corrects an earlier notice, which becomes SUPERSEDED. */
  supersedesId: Id.nullable().optional(),
});

export const Notice = z.object({
  id: Id,
  title: z.string(),
  body: z.string(),
  category: z.enum(NOTICE_CATEGORIES),
  audience: Audience,
  ackRequired: z.boolean(),
  pinned: z.boolean(),
  channels: z.array(z.enum(NOTICE_CHANNELS)),
  status: z.enum(["DRAFT", "PUBLISHED", "SUPERSEDED"]),
  emergencyReason: z.string().nullable(),
  expiresAt: IsoDateTime.nullable(),
  publishedAt: IsoDateTime.nullable(),
  supersedesId: Id.nullable(),
  supersededById: Id.nullable(),
  createdAt: IsoDateTime,
  /** For the caller, when they are a recipient. */
  mine: z.object({ read: z.boolean(), acknowledged: z.boolean() }).nullable(),
  stats: z.object({ recipients: z.number().int(), read: z.number().int(), acknowledged: z.number().int() }).nullable(),
});
export type Notice = z.infer<typeof Notice>;

export const NoticeListQuery = ListQuery.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "SUPERSEDED"]).optional(),
  category: z.enum(NOTICE_CATEGORIES).optional(),
});

export const NoticeReport = z.object({
  notice: Notice,
  recipients: z.array(
    z.object({
      name: z.string(),
      unitLabel: z.string().nullable(),
      pushStatus: z.string().nullable(),
      emailStatus: z.string().nullable(),
      readAt: IsoDateTime.nullable(),
      acknowledgedAt: IsoDateTime.nullable(),
    }),
  ),
});
