import { schemas } from "@chs/contract";
import { afterCommit } from "../../core/context";
import { prisma, Prisma } from "../../core/db";
import { events } from "../../core/events";
import { logger } from "../../core/logger";
import { renderHtml, sendMail, type MailAttachment } from "../../core/mail";
import { sendPush } from "../../core/push";
import { defineJob } from "../../core/queue";
import { readSettings } from "../society/society.service";

/**
 * One way to tell people something — MASTER_SPEC C11.
 *
 * Every notification lands in the recipient's in-app inbox. On top of that it
 * goes out as push to their resident/gate app phones and as email, each
 * subject to their per-category preference (emergencies and account security
 * can't be switched off). Delivery runs as retried jobs, recorded per channel
 * in notification_deliveries. Push waits out the society's quiet hours unless
 * the notification is urgent.
 */

type Category = (typeof schemas.notifications.NOTIFICATION_CATEGORIES)[number];
const MANDATORY = new Set<Category>(schemas.notifications.MANDATORY_CATEGORIES);

/** Defaults when a person has never touched their preferences. Reports are email-only. */
export function defaultPreference(category: Category): { push: boolean; email: boolean } {
  if (category === "REPORT") return { push: false, email: true };
  return { push: true, email: true };
}

export interface NotifyInput {
  societyId: string | null;
  userIds: string[];
  category: Category;
  title: string;
  body: string;
  /** String values only (FCM's rule). `route` is the screen a tap opens. */
  data?: Record<string, string>;
  channels?: ("push" | "email")[];
  /** Bypasses quiet hours and uses the emergency push channel. */
  urgent?: boolean;
  email?: { subject?: string; text?: string; actionLabel?: string; actionUrl?: string };
}

const pushJob = defineJob<{ deliveryId: string }>("notify.push", deliverPush, { attempts: 5 });
const emailJob = defineJob<{ deliveryId: string }>("notify.email", deliverEmail, { attempts: 6 });

/** Queue a notification to go out once the current request commits. */
export function notifyLater(input: NotifyInput): void {
  afterCommit(async () => {
    try {
      await notify(input);
    } catch (err) {
      logger.error({ err, category: input.category }, "notify failed");
    }
  });
}

/** Create inbox rows and delivery jobs now. Returns notification id per user. */
export async function notify(input: NotifyInput): Promise<Map<string, string>> {
  const userIds = [...new Set(input.userIds)];
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  const channels = new Set(input.channels ?? ["push", "email"]);
  const mandatory = MANDATORY.has(input.category);

  const [users, prefs, devices, society] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
    prisma.notificationPreference.findMany({ where: { userId: { in: userIds }, category: input.category } }),
    prisma.deviceToken.findMany({ where: { userId: { in: userIds }, app: { in: ["resident", "gate"] } }, select: { userId: true } }),
    input.societyId ? prisma.society.findUnique({ where: { id: input.societyId }, select: { settings: true } }) : null,
  ]);
  const prefBy = new Map(prefs.map((p) => [p.userId, p]));
  const hasDevice = new Set(devices.map((d) => d.userId));
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const pushDelayMs = input.urgent || !society ? 0 : quietHoursDelay(readSettings(society.settings));

  const created = await prisma.notification.createManyAndReturn({
    data: userIds.map((userId) => ({
      userId,
      societyId: input.societyId,
      category: input.category,
      title: input.title.slice(0, 160),
      body: input.body.slice(0, 1000),
      // Email overrides ride along under `_email*` keys and are stripped before push.
      data: { ...input.data, ...emailKeys(input.email) } as Prisma.InputJsonValue,
    })),
    select: { id: true, userId: true },
  });

  const pushRows: { notificationId: string; channel: "PUSH" }[] = [];
  const emailRows: { notificationId: string; channel: "EMAIL"; target: string }[] = [];
  for (const n of created) {
    out.set(n.userId, n.id);
    const pref = prefBy.get(n.userId) ?? defaultPreference(input.category);
    if (channels.has("push") && hasDevice.has(n.userId) && (mandatory || pref.push)) pushRows.push({ notificationId: n.id, channel: "PUSH" });
    const email = emailOf.get(n.userId);
    if (channels.has("email") && email && (mandatory || pref.email)) emailRows.push({ notificationId: n.id, channel: "EMAIL", target: email });
  }
  // One insert per channel, then one job per delivery: a notice to 500 flats is two statements, not a thousand.
  const [pushes, emails] = await Promise.all([
    pushRows.length ? prisma.notificationDelivery.createManyAndReturn({ data: pushRows, select: { id: true } }) : [],
    emailRows.length ? prisma.notificationDelivery.createManyAndReturn({ data: emailRows, select: { id: true } }) : [],
  ]);
  for (const d of pushes) await pushJob.enqueue({ deliveryId: d.id }, { delayMs: pushDelayMs });
  for (const d of emails) await emailJob.enqueue({ deliveryId: d.id });
  for (const n of created) events.emit({ name: "notifications.changed", to: { user: n.userId }, payload: { unread: null } });
  return out;
}

function emailKeys(e: NotifyInput["email"]): Record<string, string> {
  if (!e) return {};
  const out: Record<string, string> = {};
  if (e.subject) out._emailSubject = e.subject;
  if (e.text) out._emailText = e.text.slice(0, 4000);
  if (e.actionLabel) out._emailActionLabel = e.actionLabel;
  if (e.actionUrl) out._emailActionUrl = e.actionUrl;
  return out;
}

/** The notification's data as the apps see it — without the email-only keys. */
export function publicData(data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) if (!k.startsWith("_") && typeof v === "string") out[k] = v;
  return out;
}

/** Milliseconds until quiet hours end, or 0 outside them. Times are the society's, in IST. */
export function quietHoursDelay(settings: { quietHoursStart: string; quietHoursEnd: string }, now = new Date()): number {
  const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  const ist = new Date(now.getTime() + 330 * 60_000);
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const start = toMin(settings.quietHoursStart);
  const end = toMin(settings.quietHoursEnd);
  const inQuiet = start > end ? minute >= start || minute < end : minute >= start && minute < end;
  if (!inQuiet) return 0;
  const untilEnd = (end - minute + 1440) % 1440;
  return untilEnd * 60_000 - ist.getUTCSeconds() * 1000;
}

async function deliverPush({ deliveryId }: { deliveryId: string }): Promise<void> {
  const d = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, include: { notification: true } });
  if (!d || d.status === "SENT" || d.status === "SKIPPED") return;
  const n = d.notification;
  const tokens = await prisma.deviceToken.findMany({ where: { userId: n.userId, app: { in: ["resident", "gate"] } }, orderBy: { lastSeenAt: "desc" }, take: 10 });
  if (!tokens.length) {
    await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", error: "No registered device" } });
    return;
  }
  const unread = await prisma.notification.count({ where: { userId: n.userId, readAt: null } });
  const data: Record<string, string> = {
    ...publicData(n.data),
    notificationId: n.id,
    category: n.category,
    societyId: n.societyId ?? "",
    unread: String(unread),
  };
  const results = await sendPush({
    tokens: tokens.map((t) => t.token),
    title: n.title,
    body: n.body,
    data,
    urgent: n.category === "EMERGENCY",
    badge: unread,
    collapseKey: data.billId ?? data.noticeId ?? undefined,
  });
  const dead = tokens.filter((t) => results.find((r) => r.token === t.token)?.unregistered).map((t) => t.id);
  if (dead.length) await prisma.deviceToken.deleteMany({ where: { id: { in: dead } } });
  const ok = results.filter((r) => r.ok);
  if (ok.length) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        attempts: { increment: 1 },
        providerRef: ok[0]!.ref?.slice(0, 200) ?? null,
        error: ok.length < results.length ? `Delivered to ${ok.length} of ${results.length} devices` : null,
      },
    });
    return;
  }
  const error = results[0]?.error ?? "No device accepted the message";
  const retry = results.some((r) => r.transient);
  await prisma.notificationDelivery.update({
    where: { id: d.id },
    data: { status: retry ? "FAILED" : "SKIPPED", attempts: { increment: 1 }, error: error.slice(0, 500) },
  });
  // Dead or rejected tokens are final; quota, outages and network errors are retried with backoff.
  if (retry) throw new Error(error);
}

async function deliverEmail({ deliveryId }: { deliveryId: string }): Promise<void> {
  const d = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, include: { notification: true } });
  if (!d || d.status === "SENT" || !d.target) return;
  const n = d.notification;
  const society = n.societyId ? await prisma.society.findUnique({ where: { id: n.societyId }, select: { name: true } }) : null;
  const raw = n.data as Record<string, string>;
  const extra = { subject: raw._emailSubject, text: raw._emailText, actionLabel: raw._emailActionLabel, actionUrl: raw._emailActionUrl };
  const actionUrl = extra.actionUrl;
  const text = extra.text ?? n.body;
  try {
    const { messageId } = await sendMail({
      to: d.target,
      subject: extra.subject ?? (society ? `${society.name}: ${n.title}` : n.title),
      text,
      html: renderHtml(n.title, text, { society: society?.name, actionLabel: actionUrl ? (extra.actionLabel ?? "Open") : undefined, actionUrl }),
    });
    await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, providerRef: messageId.slice(0, 200), error: null } });
  } catch (err) {
    await prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: "FAILED", attempts: { increment: 1 }, error: String((err as Error).message).slice(0, 500) } });
    throw err;
  }
}

/** Email with attachments (reports). Not an inbox item; recorded in outbound_messages. */
export async function sendReportEmail(input: { to: string; userId: string; societyId: string; subject: string; text: string; attachments: MailAttachment[] }) {
  const society = await prisma.society.findUnique({ where: { id: input.societyId }, select: { name: true } });
  const row = await prisma.outboundMessage.create({
    data: { societyId: input.societyId, userId: input.userId, channel: "email", to: input.to, template: "report", body: input.text },
  });
  try {
    const { messageId } = await sendMail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: renderHtml(input.subject, input.text, { society: society?.name }),
      attachments: input.attachments,
    });
    await prisma.outboundMessage.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), providerRef: messageId.slice(0, 100), attempts: 1 } });
  } catch (err) {
    await prisma.outboundMessage.update({ where: { id: row.id }, data: { status: "FAILED", attempts: 1, error: String((err as Error).message).slice(0, 500) } });
    throw err;
  }
}
