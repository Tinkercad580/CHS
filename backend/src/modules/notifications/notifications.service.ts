import { schemas } from "@chs/contract";
import type { z } from "zod";
import { toIso } from "../../core/dates";
import { prisma } from "../../core/db";
import { events } from "../../core/events";
import { paginate } from "../../core/pagination";
import { defaultPreference, publicData } from "./notify";

const { NOTIFICATION_CATEGORIES, MANDATORY_CATEGORIES } = schemas.notifications;

/** A token names one install. Registering it again — after someone else signs in on the same phone — moves it to them. */
export async function registerDevice(userId: string, body: z.output<typeof schemas.notifications.RegisterDeviceBody>) {
  await prisma.deviceToken.upsert({
    where: { token: body.token },
    create: { userId, token: body.token, app: body.app, platform: body.platform, deviceName: body.deviceName ?? null },
    update: { userId, app: body.app, platform: body.platform, deviceName: body.deviceName ?? null, lastSeenAt: new Date() },
  });
  return { ok: true as const };
}

export async function unregisterDevice(userId: string, token: string) {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
  return { ok: true as const };
}

export async function inbox(userId: string, q: z.output<typeof schemas.notifications.NotificationListQuery>) {
  const where = { userId, ...(q.unread ? { readAt: null } : {}), ...(q.societyId ? { societyId: q.societyId } : {}) };
  return paginate(
    q.limit,
    q.cursor,
    (p) => prisma.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...p }),
    (n) => ({ id: n.id, societyId: n.societyId, category: n.category, title: n.title, body: n.body, data: publicData(n.data), read: !!n.readAt, createdAt: toIso(n.createdAt) }),
    () => prisma.notification.count({ where }),
  );
}

export async function unreadCount(userId: string) {
  return { unread: await prisma.notification.count({ where: { userId, readAt: null } }) };
}

export async function markRead(userId: string, id: string) {
  const r = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (r.count) events.emit({ name: "notifications.changed", to: { user: userId }, payload: { unread: null } });
  return { ok: true as const };
}

export async function markAllRead(userId: string, societyId?: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null, ...(societyId ? { societyId } : {}) }, data: { readAt: new Date() } });
  events.emit({ name: "notifications.changed", to: { user: userId }, payload: { unread: 0 } });
  return { ok: true as const };
}

export async function preferences(userId: string) {
  const [user, rows, devices] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
    prisma.notificationPreference.findMany({ where: { userId } }),
    prisma.deviceToken.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  const by = new Map(rows.map((r) => [r.category, r]));
  return {
    hasEmail: !!user.email,
    preferences: NOTIFICATION_CATEGORIES.map((category) => {
      const mandatory = MANDATORY_CATEGORIES.includes(category);
      const p = by.get(category) ?? defaultPreference(category);
      return { category, push: mandatory || p.push, email: mandatory || p.email, mandatory };
    }),
    devices: devices.map((d) => ({ id: d.id, app: d.app, platform: d.platform, deviceName: d.deviceName, lastSeenAt: toIso(d.lastSeenAt) })),
  };
}

export async function updatePreferences(userId: string, body: z.output<typeof schemas.notifications.UpdatePreferencesBody>) {
  for (const p of body.preferences) {
    // Emergency and account notices can't be turned off; storing "off" would only mislead.
    if (MANDATORY_CATEGORIES.includes(p.category)) continue;
    await prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category: p.category } },
      create: { userId, category: p.category, push: p.push, email: p.email },
      update: { push: p.push, email: p.email },
    });
  }
  return preferences(userId);
}
