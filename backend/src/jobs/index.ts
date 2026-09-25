import { addDays, todayIst } from "../core/dates";
import { prisma, transaction } from "../core/db";
import { logger } from "../core/logger";
import { sendMessage } from "../core/messaging";
import { defineJob, repeat } from "../core/queue";
import { endTenancyInTx } from "../modules/members/members.service";
import { readSettings } from "../modules/society/society.service";

/**
 * Scheduled work. Every job is idempotent — safe to run twice, safe to run
 * late — because queues retry and schedules drift.
 */

/** MASTER_SPEC C3: remind at T-30 (society-configurable); suspend tenant access on expiry unless extended. */
const tenancyExpiry = defineJob("members.tenancy-expiry", async () => {
  const today = todayIst();
  const societies = await prisma.society.findMany({ where: { status: { not: "SUSPENDED" } }, select: { id: true, name: true, settings: true } });
  for (const s of societies) {
    const settings = readSettings(s.settings);
    const soon = await prisma.tenancy.findMany({
      where: { societyId: s.id, endedOn: null, expiryReminderSent: false, endDate: { gte: today, lte: addDays(today, settings.tenantExpiryReminderDays) } },
      include: { tenant: true, unit: { include: { building: true, memberships: { where: { cessationDate: null, kind: "PRIMARY" }, include: { person: true } } } } },
    });
    for (const t of soon) {
      const unit = `${t.unit.building.name}-${t.unit.number}`;
      const when = t.endDate.toISOString().slice(0, 10);
      const owner = t.unit.memberships[0]?.person;
      const recipients = [owner?.mobile, t.tenant.mobile].filter((m): m is string => !!m);
      for (const to of recipients) {
        await sendMessage({ channel: "sms", to, template: "tenancy_expiry", societyId: s.id, body: `${s.name}: the tenancy for ${unit} ends on ${when}. Renew it with the society office to keep access.` });
      }
      await prisma.tenancy.update({ where: { id: t.id }, data: { expiryReminderSent: true } });
    }

    if (!settings.autoSuspendTenantOnExpiry) continue;
    const expired = await prisma.tenancy.findMany({ where: { societyId: s.id, endedOn: null, endDate: { lt: today } }, select: { id: true, endDate: true } });
    for (const t of expired) {
      try {
        await transaction(prisma, (tx) => endTenancyInTx(tx, { societyId: s.id, societyUserId: null }, t.id, t.endDate, "Tenancy expired"));
      } catch (err) {
        logger.warn({ err, tenancyId: t.id }, "tenancy expiry: could not end tenancy");
      }
    }
  }
});

/** Housekeeping: expired sessions, spent idempotency keys, old login attempts. */
const cleanup = defineJob("system.cleanup", async () => {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: addDays(now, -7) } } });
  await prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: addDays(now, -1) } } });
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: addDays(now, -30) } } });
  await prisma.tempPassword.deleteMany({ where: { expiresAt: { lt: addDays(now, -30) } } });
});

export async function scheduleJobs(): Promise<void> {
  await repeat(tenancyExpiry.name, 6 * 3_600_000);
  await repeat(cleanup.name, 3_600_000);
}
