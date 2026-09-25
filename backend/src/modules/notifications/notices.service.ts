import { schemas, type Audience, type NoticeRecord } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { toIso } from "../../core/dates";
import { Prisma, prisma, transaction, type Tx } from "../../core/db";
import { AppError, forbidden, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { contains, paginate } from "../../core/pagination";
import { notify } from "./notify";

type Input = z.output<typeof schemas.notifications.NoticeInput>;
type NoticeRow = Prisma.NoticeGetPayload<object>;

function dto(n: NoticeRow, extra: { mine?: { read: boolean; acknowledged: boolean } | null; stats?: NoticeRecord["stats"]; supersededById?: string | null } = {}): NoticeRecord {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category as NoticeRecord["category"],
    audience: n.audience as Audience,
    ackRequired: n.ackRequired,
    pinned: n.pinned,
    channels: n.channels as NoticeRecord["channels"],
    status: n.status,
    emergencyReason: n.emergencyReason,
    expiresAt: toIso(n.expiresAt),
    publishedAt: toIso(n.publishedAt),
    supersedesId: n.supersedesId,
    supersededById: extra.supersededById ?? null,
    createdAt: toIso(n.createdAt),
    mine: extra.mine ?? null,
    stats: extra.stats ?? null,
  };
}

async function stats(noticeIds: string[]) {
  if (!noticeIds.length) return new Map<string, NonNullable<NoticeRecord["stats"]>>();
  const rows = await prisma.$queryRaw<{ notice_id: string; recipients: bigint; read: bigint; acknowledged: bigint }[]>`
    SELECT notice_id, count(*) AS recipients, count(read_at) AS read, count(acknowledged_at) AS acknowledged
    FROM notice_recipients WHERE notice_id = ANY(${noticeIds}::uuid[]) GROUP BY notice_id`;
  return new Map(rows.map((r) => [r.notice_id, { recipients: Number(r.recipients), read: Number(r.read), acknowledged: Number(r.acknowledged) }]));
}

async function supersededBy(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await prisma.notice.findMany({ where: { supersedesId: { in: ids }, status: "PUBLISHED" }, select: { id: true, supersedesId: true } });
  return new Map(rows.map((r) => [r.supersedesId!, r.id]));
}

function validate(input: Partial<Input>) {
  if (input.category === "EMERGENCY" && !input.emergencyReason) {
    throw new AppError("VALIDATION_FAILED", "An emergency notice bypasses quiet hours — say why.", [{ path: ["emergencyReason"], message: "Required for an emergency" }]);
  }
  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now()) {
    throw new AppError("VALIDATION_FAILED", "The expiry must be in the future.", [{ path: ["expiresAt"], message: "In the past" }]);
  }
}

export async function list(societyId: string, q: z.output<typeof schemas.notifications.NoticeListQuery>) {
  const where: Prisma.NoticeWhereInput = {
    societyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.q ? { title: contains(q.q) } : {}),
  };
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) => prisma.notice.findMany({ where, orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }, { id: "desc" }], ...p }),
    (n) => n,
    () => prisma.notice.count({ where }),
  );
  const [s, sup] = await Promise.all([stats(page.items.map((n) => n.id)), supersededBy(page.items.map((n) => n.id))]);
  return { ...page, items: page.items.map((n) => dto(n, { stats: s.get(n.id) ?? { recipients: 0, read: 0, acknowledged: 0 }, supersededById: sup.get(n.id) })) };
}

/** A recipient's feed: pinned first, then newest; expired ones drop off. */
export async function feed(scope: SocietyScope, userId: string, q: z.output<typeof schemas.notifications.NoticeListQuery>) {
  const now = new Date();
  const where: Prisma.NoticeRecipientWhereInput = {
    userId,
    notice: {
      societyId: scope.societyId,
      status: { in: ["PUBLISHED", "SUPERSEDED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { title: contains(q.q) } : {}),
    },
  };
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) =>
      prisma.noticeRecipient.findMany({
        where,
        include: { notice: true },
        orderBy: [{ notice: { pinned: "desc" } }, { notice: { publishedAt: "desc" } }, { id: "desc" }],
        ...p,
      }),
    (r) => r,
    () => prisma.noticeRecipient.count({ where }),
  );
  const sup = await supersededBy(page.items.map((r) => r.noticeId));
  return {
    ...page,
    items: page.items.map((r) => dto(r.notice, { mine: { read: !!r.readAt, acknowledged: !!r.acknowledgedAt }, supersededById: sup.get(r.noticeId) })),
  };
}

export async function get(scope: SocietyScope, userId: string, id: string) {
  const n = await prisma.notice.findFirst({ where: { id, societyId: scope.societyId } });
  if (!n) throw notFound("Notice");
  const manager = scope.permissions.has("notices.publish");
  const mine = await prisma.noticeRecipient.findUnique({ where: { noticeId_userId: { noticeId: id, userId } } });
  if (!manager && !mine) throw notFound("Notice");
  const [s, sup] = await Promise.all([manager ? stats([id]) : null, supersededBy([id])]);
  return dto(n, { mine: mine ? { read: !!mine.readAt, acknowledged: !!mine.acknowledgedAt } : null, stats: s?.get(id) ?? null, supersededById: sup.get(id) });
}

export async function create(scope: SocietyScope, userId: string, input: Input) {
  validate(input);
  if (input.supersedesId) {
    const old = await prisma.notice.findFirst({ where: { id: input.supersedesId, societyId: scope.societyId, status: "PUBLISHED" } });
    if (!old) throw new AppError("VALIDATION_FAILED", "Only a published notice can be corrected.");
  }
  await assertAudience(prisma, scope.societyId, input.audience);
  const n = await prisma.notice.create({
    data: {
      societyId: scope.societyId,
      title: input.title,
      body: input.body,
      category: input.category,
      audience: input.audience as Prisma.InputJsonValue,
      ackRequired: input.ackRequired,
      pinned: input.pinned,
      channels: input.channels,
      emergencyReason: input.emergencyReason ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      supersedesId: input.supersedesId ?? null,
      createdById: userId,
    },
  });
  await audit(prisma, { action: "notice.create", entity: "notice", entityId: n.id, after: dto(n) });
  events.emit({ name: "notices.changed", to: { admins: scope.societyId }, payload: { noticeId: n.id } });
  return dto(n, { stats: { recipients: 0, read: 0, acknowledged: 0 } });
}

export async function update(scope: SocietyScope, id: string, input: Partial<Input>) {
  const before = await prisma.notice.findFirst({ where: { id, societyId: scope.societyId } });
  if (!before) throw notFound("Notice");
  if (before.status !== "DRAFT") throw new AppError("BUSINESS_RULE_VIOLATION", "A published notice can't be edited. Publish a correction instead.");
  validate({
    category: (input.category ?? before.category) as Input["category"],
    emergencyReason: input.emergencyReason !== undefined ? input.emergencyReason : before.emergencyReason,
    expiresAt: input.expiresAt !== undefined ? input.expiresAt : toIso(before.expiresAt),
  });
  if (input.audience) await assertAudience(prisma, scope.societyId, input.audience);
  const n = await prisma.notice.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.audience !== undefined ? { audience: input.audience as Prisma.InputJsonValue } : {}),
      ...(input.ackRequired !== undefined ? { ackRequired: input.ackRequired } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.channels !== undefined ? { channels: input.channels } : {}),
      ...(input.emergencyReason !== undefined ? { emergencyReason: input.emergencyReason } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    },
  });
  await audit(prisma, { action: "notice.update", entity: "notice", entityId: id, before: dto(before), after: dto(n) });
  return dto(n, { stats: { recipients: 0, read: 0, acknowledged: 0 } });
}

export async function discard(scope: SocietyScope, id: string) {
  const n = await prisma.notice.findFirst({ where: { id, societyId: scope.societyId } });
  if (!n) throw notFound("Notice");
  if (n.status !== "DRAFT") throw new AppError("BUSINESS_RULE_VIOLATION", "Published notices are kept as a record and can't be deleted.");
  await prisma.notice.delete({ where: { id } });
  await audit(prisma, { action: "notice.discard", entity: "notice", entityId: id, before: dto(n) });
  return { ok: true as const };
}

async function assertAudience(db: Tx, societyId: string, a: Audience) {
  if (a.kind === "BUILDINGS") {
    const n = await db.building.count({ where: { societyId, id: { in: a.buildingIds } } });
    if (n !== new Set(a.buildingIds).size) throw new AppError("VALIDATION_FAILED", "Some buildings aren't in this society.");
  }
  if (a.kind === "UNITS") {
    const n = await db.unit.count({ where: { societyId, id: { in: a.unitIds } } });
    if (n !== new Set(a.unitIds).size) throw new AppError("VALIDATION_FAILED", "Some units aren't in this society.");
  }
}

/**
 * Who a notice reaches: every active login in the society matching the
 * audience. Unit-based audiences include anyone whose access unit is there or
 * who owns or rents it. Returned with a unit label for the delivery report.
 */
export async function resolveAudience(db: Tx, societyId: string, a: Audience, category?: string): Promise<{ userId: string; unitLabel: string | null }[]> {
  const isFinancial = category === "FINANCIAL";
  const users = await db.societyUser.findMany({
    where: { societyId, deletedAt: null, suspendedAt: null },
    select: { userId: true, role: true, userType: true, unitId: true, unit: { select: { buildingId: true, number: true, building: { select: { name: true } } } } },
  });
  const persons = await db.person.findMany({
    where: { societyId, deletedAt: null, userId: { not: null } },
    select: {
      userId: true,
      memberships: { where: { cessationDate: null }, select: { unitId: true, unit: { select: { buildingId: true } } } },
      tenancies: { where: { endedOn: null }, select: { unitId: true, unit: { select: { buildingId: true } } } },
    },
  });
  const unitsOf = new Map<string, { unitIds: Set<string>; buildingIds: Set<string>; owner: boolean; tenant: boolean }>();
  for (const p of persons) {
    const e = unitsOf.get(p.userId!) ?? { unitIds: new Set(), buildingIds: new Set(), owner: false, tenant: false };
    for (const m of p.memberships) {
      e.unitIds.add(m.unitId);
      e.buildingIds.add(m.unit.buildingId);
      e.owner = true;
    }
    for (const t of p.tenancies) {
      e.unitIds.add(t.unitId);
      e.buildingIds.add(t.unit.buildingId);
      e.tenant = true;
    }
    unitsOf.set(p.userId!, e);
  }
  const buildings = a.kind === "BUILDINGS" ? new Set(a.buildingIds) : null;
  const unitSet = a.kind === "UNITS" ? new Set(a.unitIds) : null;
  const out: { userId: string; unitLabel: string | null }[] = [];
  for (const u of users) {
    const e = unitsOf.get(u.userId);
    const unitIds = new Set([...(e?.unitIds ?? []), ...(u.unitId ? [u.unitId] : [])]);
    const buildingIds = new Set([...(e?.buildingIds ?? []), ...(u.unit ? [u.unit.buildingId] : [])]);
    const staff = u.userType === "GUARD" || u.userType === "STAFF";
    // Guards never see society finances (MASTER_SPEC C9), whatever the audience says.
    if (u.userType === "GUARD" && isFinancial) continue;
    const owner = e?.owner || u.userType === "OWNER" || u.userType === "CO_OWNER";
    const tenant = e?.tenant || u.userType === "TENANT";
    const resident = unitIds.size > 0 && !staff;
    const match =
      a.kind === "ALL" ||
      (a.kind === "OWNERS" && owner) ||
      (a.kind === "TENANTS" && tenant) ||
      (a.kind === "RESIDENTS" && resident) ||
      (a.kind === "STAFF" && staff) ||
      (a.kind === "ADMINS" && u.role === "ADMIN") ||
      (buildings !== null && [...buildingIds].some((b) => buildings.has(b))) ||
      (unitSet !== null && [...unitIds].some((x) => unitSet.has(x)));
    if (match) out.push({ userId: u.userId, unitLabel: u.unit ? `${u.unit.building.name}-${u.unit.number}` : null });
  }
  return out;
}

export async function publish(scope: SocietyScope, userId: string, id: string) {
  const result = await transaction(prisma, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM notices WHERE id = ${id}::uuid AND society_id = ${scope.societyId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Notice");
    const n = await tx.notice.findUniqueOrThrow({ where: { id } });
    if (n.status !== "DRAFT") throw new AppError("CONFLICT", "This notice has already been published.");
    const recipients = await resolveAudience(tx, scope.societyId, n.audience as Audience, n.category);
    if (!recipients.length) throw new AppError("BUSINESS_RULE_VIOLATION", "Nobody matches this audience — no one would receive it.");
    const published = await tx.notice.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: userId } });
    await tx.noticeRecipient.createMany({ data: recipients.map((r) => ({ noticeId: id, userId: r.userId, unitLabel: r.unitLabel })) });
    if (n.supersedesId) await tx.notice.updateMany({ where: { id: n.supersedesId, status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
    await audit(tx, {
      action: n.category === "EMERGENCY" ? "notice.publish_emergency" : "notice.publish",
      entity: "notice",
      entityId: id,
      after: { recipients: recipients.length, emergencyReason: n.emergencyReason },
    });
    return { notice: published, recipients };
  });

  // Delivery happens after the commit: the recipient list is the record even if a provider is down.
  const { notice, recipients } = result;
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { name: true } });
  const ids = await notify({
    societyId: scope.societyId,
    userIds: recipients.map((r) => r.userId),
    category: notice.category === "EMERGENCY" ? "EMERGENCY" : "NOTICE",
    title: notice.title,
    body: notice.body.length > 180 ? `${notice.body.slice(0, 177)}…` : notice.body,
    data: { route: `/notices/${notice.id}`, noticeId: notice.id, noticeCategory: notice.category },
    channels: notice.channels as ("push" | "email")[],
    urgent: notice.category === "EMERGENCY",
    email: { subject: `${society.name}: ${notice.title}`, text: notice.body },
  });
  for (const [uid, nid] of ids) await prisma.noticeRecipient.updateMany({ where: { noticeId: notice.id, userId: uid }, data: { notificationId: nid } });
  events.emit({ name: "notices.changed", to: { society: scope.societyId }, payload: { noticeId: notice.id } });
  return get(scope, userId, notice.id);
}

export async function markRead(scope: SocietyScope, userId: string, id: string) {
  const r = await prisma.noticeRecipient.updateMany({ where: { noticeId: id, userId, readAt: null, notice: { societyId: scope.societyId } }, data: { readAt: new Date() } });
  if (r.count) {
    const rec = await prisma.noticeRecipient.findUnique({ where: { noticeId_userId: { noticeId: id, userId } } });
    if (rec?.notificationId) await prisma.notification.updateMany({ where: { id: rec.notificationId, readAt: null }, data: { readAt: new Date() } });
    events.emit({ name: "notices.changed", to: { admins: scope.societyId, user: userId }, payload: { noticeId: id } });
    events.emit({ name: "notifications.changed", to: { user: userId }, payload: { unread: null } });
  }
  return { ok: true as const };
}

export async function acknowledge(scope: SocietyScope, userId: string, id: string) {
  const rec = await prisma.noticeRecipient.findFirst({ where: { noticeId: id, userId, notice: { societyId: scope.societyId } }, include: { notice: true } });
  if (!rec) throw notFound("Notice");
  if (!rec.notice.ackRequired) throw new AppError("BUSINESS_RULE_VIOLATION", "This notice doesn't ask for an acknowledgement.");
  if (!rec.acknowledgedAt) {
    const now = new Date();
    await prisma.noticeRecipient.update({ where: { id: rec.id }, data: { acknowledgedAt: now, readAt: rec.readAt ?? now } });
    await audit(prisma, { action: "notice.acknowledge", entity: "notice", entityId: id });
    events.emit({ name: "notices.changed", to: { admins: scope.societyId, user: userId }, payload: { noticeId: id } });
  }
  return get(scope, userId, id);
}

export async function report(scope: SocietyScope, userId: string, id: string) {
  if (!scope.permissions.has("notices.publish")) throw forbidden();
  const notice = await get(scope, userId, id);
  const rows = await prisma.noticeRecipient.findMany({ where: { noticeId: id }, orderBy: [{ unitLabel: "asc" }] });
  const [users, deliveries] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } }),
    prisma.notificationDelivery.findMany({ where: { notificationId: { in: rows.map((r) => r.notificationId).filter((x): x is string => !!x) } } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const status = (nid: string | null, ch: "PUSH" | "EMAIL") => (nid ? (deliveries.find((d) => d.notificationId === nid && d.channel === ch)?.status ?? null) : null);
  return {
    notice,
    recipients: rows.map((r) => ({
      name: name.get(r.userId) ?? "Unknown",
      unitLabel: r.unitLabel,
      pushStatus: status(r.notificationId, "PUSH"),
      emailStatus: status(r.notificationId, "EMAIL"),
      readAt: toIso(r.readAt),
      acknowledgedAt: toIso(r.acknowledgedAt),
    })),
  };
}
