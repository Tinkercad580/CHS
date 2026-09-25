import {
  isAdminPermission,
  isPermission,
  schemas,
  USER_TYPES,
  type Permission,
  type Role,
  type SocietyUser as SocietyUserDto,
  type UserType,
} from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import { hashPassword } from "../../core/auth/password";
import { revokeAllSessions } from "../../core/auth/sessions";
import type { SocietyScope } from "../../core/context";
import { generateTempPassword } from "../../core/crypto";
import { toIso } from "../../core/dates";
import { prisma, transaction, type Tx, Prisma } from "../../core/db";
import { AppError, forbidden, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { sendMessage, type Channel } from "../../core/messaging";
import { contains, paginate } from "../../core/pagination";
import { parseTable } from "../../core/tabular";
import { unitLabel } from "../auth/me";

const include = {
  user: true,
  unit: { select: { number: true, building: { select: { name: true } } } },
} satisfies Prisma.SocietyUserInclude;

type Row = Prisma.SocietyUserGetPayload<{ include: typeof include }>;

export function toDto(row: Row): SocietyUserDto {
  const locked = !!row.user.lockedUntil && row.user.lockedUntil > new Date();
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    mobile: row.user.mobile,
    email: row.user.email,
    role: row.role,
    userType: row.userType,
    permissions: row.permissions as Permission[],
    unitId: row.unitId,
    unitLabel: unitLabel(row.unit),
    status: row.suspendedAt ? "SUSPENDED" : locked ? "LOCKED" : row.user.passwordHash ? "ACTIVE" : "INVITED",
    lockedUntil: locked ? toIso(row.user.lockedUntil) : null,
    suspendedReason: row.suspendedReason,
    lastLoginAt: toIso(row.user.lastLoginAt),
    twoFactorEnabled: !!row.user.totpEnabledAt,
    notes: row.notes,
    createdAt: toIso(row.createdAt),
  };
}

async function load(db: Tx, societyId: string, id: string): Promise<Row> {
  const row = await db.societyUser.findFirst({ where: { id, societyId, deletedAt: null }, include });
  if (!row) throw notFound("User");
  return row;
}

export async function getUser(societyId: string, id: string) {
  return toDto(await load(prisma, societyId, id));
}

export async function listUsers(societyId: string, q: z.output<typeof schemas.users.UserListQuery>) {
  const now = new Date();
  const statusWhere: Prisma.SocietyUserWhereInput =
    q.status === "SUSPENDED"
      ? { suspendedAt: { not: null } }
      : q.status === "LOCKED"
        ? { suspendedAt: null, user: { lockedUntil: { gt: now } } }
        : q.status === "INVITED"
          ? { suspendedAt: null, user: { passwordHash: null } }
          : q.status === "ACTIVE"
            ? { suspendedAt: null, user: { passwordHash: { not: null }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] } }
            : {};
  const where: Prisma.SocietyUserWhereInput = {
    societyId,
    deletedAt: null,
    ...(q.role ? { role: q.role } : {}),
    ...(q.userType ? { userType: q.userType } : {}),
    ...(q.unitId ? { unitId: q.unitId } : {}),
    ...statusWhere,
    ...(q.q ? { OR: [{ user: { name: contains(q.q) } }, { user: { mobile: { contains: q.q } } }] } : {}),
  };
  return paginate(
    q.limit,
    q.cursor,
    (page) => prisma.societyUser.findMany({ where, include, orderBy: [{ user: { name: "asc" } }, { id: "asc" }], ...page }),
    toDto,
    () => prisma.societyUser.count({ where }),
  );
}

// ─── Permission rules ───────────────────────────────────────────────────────

async function resolvePermissions(
  db: Tx,
  societyId: string,
  input: { templateCode?: string | undefined; permissions?: Permission[] | undefined },
): Promise<{ permissions: Permission[]; template?: { role: Role; userType: UserType } }> {
  if (input.permissions) return { permissions: [...new Set(input.permissions)] };
  if (!input.templateCode) return { permissions: [] };
  const t = await db.permissionTemplate.findUnique({ where: { societyId_code: { societyId, code: input.templateCode } } });
  if (!t) throw new AppError("VALIDATION_FAILED", `No permission template "${input.templateCode}".`);
  return { permissions: (t.permissions as string[]).filter(isPermission), template: { role: t.role, userType: t.userType } };
}

/**
 * - A USER can't hold admin permissions; that's what the ADMIN role is for.
 * - You can only grant what you hold yourself, so users.manage can't be used
 *   as a stepping stone to every other permission.
 */
function assertGrantable(scope: SocietyScope, role: Role, permissions: Permission[]): void {
  if (role === "USER") {
    const admin = permissions.filter(isAdminPermission);
    if (admin.length) throw new AppError("VALIDATION_FAILED", `Only administrators can hold ${admin.join(", ")}.`, { permissions: admin });
  }
  const missing = permissions.filter((p) => !scope.permissions.has(p));
  if (missing.length) throw forbidden(`You can't grant permissions you don't hold: ${missing.join(", ")}.`);
}

/** Never leave a society with nobody able to manage users. */
async function assertNotLastManager(db: Tx, societyId: string, excludingId: string): Promise<void> {
  const others = await db.societyUser.count({
    where: { societyId, id: { not: excludingId }, deletedAt: null, suspendedAt: null, role: "ADMIN", permissions: { has: "users.manage" } },
  });
  if (others === 0) throw new AppError("BUSINESS_RULE_VIOLATION", "This is the society's last administrator who can manage users.");
}

async function assertUnit(db: Tx, societyId: string, unitId: string | null | undefined): Promise<void> {
  if (!unitId) return;
  const unit = await db.unit.findFirst({ where: { id: unitId, societyId }, select: { id: true } });
  if (!unit) throw new AppError("VALIDATION_FAILED", "That unit isn't in this society.", [{ path: ["unitId"], message: "Unknown unit" }]);
}

// ─── Commands ───────────────────────────────────────────────────────────────

export async function createUser(scope: SocietyScope, body: z.output<typeof schemas.users.CreateUserBody>, db: Tx = prisma) {
  return transaction(db, async (tx) => {
    const { permissions, template } = await resolvePermissions(tx, scope.societyId, body);
    const role = body.permissions ? body.role : (template?.role ?? body.role);
    assertGrantable(scope, role, permissions);
    await assertUnit(tx, scope.societyId, body.unitId);

    // One mobile, one account (MASTER_SPEC C1). An existing person keeps their
    // own name and email; the society only adds its access record.
    const user =
      (await tx.user.findUnique({ where: { mobile: body.mobile } })) ??
      (await tx.user.create({ data: { mobile: body.mobile, name: body.name, email: body.email ?? null } }));

    const existing = await tx.societyUser.findUnique({ where: { societyId_userId: { societyId: scope.societyId, userId: user.id } } });
    if (existing && !existing.deletedAt) throw new AppError("MOBILE_ALREADY_EXISTS", "This mobile number is already a user of this society.");

    const data = {
      role,
      userType: body.userType,
      permissions,
      unitId: body.unitId ?? null,
      notes: body.notes ?? null,
      createdById: scope.societyUserId,
      suspendedAt: null,
      suspendedReason: null,
      deletedAt: null,
    };
    const row = existing
      ? await tx.societyUser.update({ where: { id: existing.id }, data, include })
      : await tx.societyUser.create({ data: { ...data, societyId: scope.societyId, userId: user.id }, include });

    await audit(tx, { action: "user.create", entity: "society_user", entityId: row.id, after: toDto(row) });
    events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: user.id } });
    return toDto(row);
  });
}

export async function updateUser(scope: SocietyScope, actorUserId: string, id: string, body: z.output<typeof schemas.users.UpdateUserBody>) {
  return transaction(prisma, async (tx) => {
    const before = await load(tx, scope.societyId, id);
    const changesAccess = body.role !== undefined || body.permissions !== undefined || body.templateCode !== undefined;
    if (changesAccess && before.userId === actorUserId) throw forbidden("You can't change your own role or permissions.");

    let role = body.role ?? before.role;
    let permissions = before.permissions as Permission[];
    if (body.permissions || body.templateCode) {
      const resolved = await resolvePermissions(tx, scope.societyId, body);
      permissions = resolved.permissions;
      if (!body.role && resolved.template) role = resolved.template.role;
    }
    if (changesAccess) {
      // Only newly added permissions need to be grantable; keeping existing ones is fine.
      const added = permissions.filter((p) => !(before.permissions as string[]).includes(p));
      assertGrantable(scope, role, added);
      if (role === "USER") assertGrantable(scope, role, permissions.filter(isAdminPermission));
      const losesManage = (before.permissions as string[]).includes("users.manage") && (!permissions.includes("users.manage") || role !== "ADMIN");
      if (losesManage) await assertNotLastManager(tx, scope.societyId, before.id);
    }
    await assertUnit(tx, scope.societyId, body.unitId);

    if (body.name !== undefined || body.email !== undefined) {
      await tx.user.update({
        where: { id: before.userId },
        data: { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.email !== undefined ? { email: body.email } : {}) },
      });
    }
    const row = await tx.societyUser.update({
      where: { id: before.id },
      data: {
        role,
        permissions,
        ...(body.userType !== undefined ? { userType: body.userType } : {}),
        ...(body.unitId !== undefined ? { unitId: body.unitId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include,
    });
    await audit(tx, { action: "user.update", entity: "society_user", entityId: row.id, before: toDto(before), after: toDto(row) });
    events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: row.userId } });
    events.emit({ name: "me.changed", to: { user: row.userId }, payload: {} });
    return toDto(row);
  });
}

export async function issueTempPassword(scope: SocietyScope, actor: { userId: string; name: string }, id: string) {
  const target = await load(prisma, scope.societyId, id);
  if (target.userId === actor.userId) throw forbidden("Use Change password for your own account.");
  if (target.user.isPlatformAdmin) throw forbidden("Platform administrators reset their password through the platform team.");
  // An admin of this society must not be able to take over someone's admin
  // account in another society by resetting the shared login.
  const elsewhere = await prisma.societyUser.findMany({
    where: { userId: target.userId, role: "ADMIN", deletedAt: null, societyId: { not: scope.societyId } },
    select: { societyId: true },
  });
  if (elsewhere.length) {
    const actorAdminOf = await prisma.societyUser.count({
      where: { userId: actor.userId, role: "ADMIN", deletedAt: null, societyId: { in: elsewhere.map((e) => e.societyId) } },
    });
    if (actorAdminOf < elsewhere.length) {
      throw forbidden("This person administers another society. Their password can be reset by the platform team.");
    }
  }

  const plain = generateTempPassword(10);
  const hash = await hashPassword(plain);
  const expiresAt = new Date(Date.now() + 24 * 3_600_000);
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { name: true } });

  await transaction(prisma, async (tx) => {
    await tx.tempPassword.updateMany({ where: { userId: target.userId, usedAt: null, supersededAt: null }, data: { supersededAt: new Date() } });
    await tx.tempPassword.create({ data: { userId: target.userId, passwordHash: hash, issuedById: actor.userId, societyId: scope.societyId, expiresAt } });
    await tx.authEvent.create({
      data: { userId: target.userId, societyId: scope.societyId, actorId: actor.userId, type: "TEMP_PASSWORD_ISSUED", detail: `by ${actor.name}` },
    });
    await audit(tx, { action: "user.temp_password", entity: "society_user", entityId: target.id, after: { expiresAt } });
  });

  const body = `${society.name}: your temporary password is ${plain}. It works once and expires in 24 hours; you will set a new password when you sign in. If you did not ask for this, contact your society office.`;
  const deliveredVia: Channel[] = ["sms"];
  await sendMessage({ channel: "sms", to: target.user.mobile, template: "temp_password", body, societyId: scope.societyId, userId: target.userId });
  if (target.user.email) {
    deliveredVia.push("email");
    await sendMessage({ channel: "email", to: target.user.email, template: "temp_password", body, societyId: scope.societyId, userId: target.userId });
  }
  events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: target.userId } });
  return {
    tempPassword: plain,
    expiresAt: expiresAt.toISOString(),
    deliveredVia,
    whatsappShareUrl: `https://wa.me/91${target.user.mobile}?text=${encodeURIComponent(body)}`,
  };
}

export async function unlock(scope: SocietyScope, actorUserId: string, id: string) {
  const target = await load(prisma, scope.societyId, id);
  await prisma.user.update({ where: { id: target.userId }, data: { lockedUntil: null, failedAttempts: 0 } });
  await prisma.authEvent.create({ data: { userId: target.userId, societyId: scope.societyId, actorId: actorUserId, type: "UNLOCKED" } });
  await audit(prisma, { action: "user.unlock", entity: "society_user", entityId: id });
  events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: target.userId } });
  return getUser(scope.societyId, id);
}

export async function suspend(scope: SocietyScope, actorUserId: string, id: string, reason: string) {
  return transaction(prisma, async (tx) => {
    const target = await load(tx, scope.societyId, id);
    if (target.userId === actorUserId) throw forbidden("You can't suspend yourself.");
    if (target.suspendedAt) throw new AppError("CONFLICT", "This user is already suspended.");
    if ((target.permissions as string[]).includes("users.manage") && target.role === "ADMIN") await assertNotLastManager(tx, scope.societyId, target.id);

    const row = await tx.societyUser.update({ where: { id }, data: { suspendedAt: new Date(), suspendedReason: reason }, include });
    // If this was their only society, nothing is left to be signed in to.
    const otherAccess = await tx.societyUser.count({ where: { userId: target.userId, deletedAt: null, suspendedAt: null } });
    if (otherAccess === 0 && !target.user.isPlatformAdmin) await revokeAllSessions(tx, target.userId, "SUSPENDED");
    await tx.authEvent.create({ data: { userId: target.userId, societyId: scope.societyId, actorId: actorUserId, type: "SUSPENDED", detail: reason } });
    await audit(tx, { action: "user.suspend", entity: "society_user", entityId: id, before: toDto(target), after: toDto(row) });
    events.emit({ name: "account.suspended", to: { user: target.userId }, payload: { societyId: scope.societyId, reason } });
    events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: target.userId } });
    return toDto(row);
  });
}

export async function reactivate(scope: SocietyScope, actorUserId: string, id: string) {
  const target = await load(prisma, scope.societyId, id);
  if (!target.suspendedAt) throw new AppError("CONFLICT", "This user isn't suspended.");
  const row = await prisma.societyUser.update({ where: { id }, data: { suspendedAt: null, suspendedReason: null }, include });
  await prisma.authEvent.create({ data: { userId: target.userId, societyId: scope.societyId, actorId: actorUserId, type: "REACTIVATED" } });
  await audit(prisma, { action: "user.reactivate", entity: "society_user", entityId: id, before: toDto(target), after: toDto(row) });
  events.emit({ name: "users.changed", to: { admins: scope.societyId }, payload: { userId: target.userId } });
  events.emit({ name: "me.changed", to: { user: target.userId }, payload: {} });
  return toDto(row);
}

export async function forceLogout(scope: SocietyScope, actorUserId: string, id: string) {
  const target = await load(prisma, scope.societyId, id);
  await revokeAllSessions(prisma, target.userId, "ADMIN_LOGOUT_ALL");
  await prisma.authEvent.create({ data: { userId: target.userId, societyId: scope.societyId, actorId: actorUserId, type: "ALL_SESSIONS_REVOKED" } });
  await audit(prisma, { action: "user.logout_all", entity: "society_user", entityId: id });
  return { ok: true as const };
}

export async function userSessions(scope: SocietyScope, id: string) {
  const target = await load(prisma, scope.societyId, id);
  const sessions = await prisma.session.findMany({
    where: { userId: target.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    client: s.client,
    deviceName: s.deviceName,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: toIso(s.createdAt),
    lastUsedAt: toIso(s.lastUsedAt),
    current: false,
  }));
}

export async function authEvents(scope: SocietyScope, id: string, q: { limit: number; cursor?: string | undefined }) {
  const target = await load(prisma, scope.societyId, id);
  const actorNames = new Map<string, string>();
  const page = await paginate(
    q.limit,
    q.cursor,
    (p) => prisma.authEvent.findMany({ where: { userId: target.userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...p }),
    (e) => e,
  );
  const ids = [...new Set(page.items.map((e) => e.actorId).filter((x): x is string => !!x))];
  if (ids.length) for (const u of await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) actorNames.set(u.id, u.name);
  return {
    nextCursor: page.nextCursor,
    total: null,
    items: page.items.map((e) => ({
      id: e.id,
      type: e.type,
      ip: e.ip,
      userAgent: e.userAgent,
      actorName: e.actorId ? (actorNames.get(e.actorId) ?? null) : null,
      detail: e.detail,
      createdAt: toIso(e.createdAt),
    })),
  };
}

// ─── Bulk import (name, mobile, unit, user_type) ────────────────────────────

export async function importUsers(scope: SocietyScope, actorUserId: string, input: z.output<typeof schemas.users.ImportBody>) {
  const table = await parseTable(input.format, input.contentBase64);
  for (const col of ["name", "mobile", "user_type"]) {
    if (!table.headers.includes(col)) throw new AppError("VALIDATION_FAILED", `The file needs a "${col}" column.`);
  }
  const units = await prisma.unit.findMany({ where: { societyId: scope.societyId }, select: { id: true, number: true, building: { select: { name: true } } } });
  const unitByLabel = new Map(units.map((u) => [`${u.building.name}-${u.number}`.toUpperCase(), u.id]));
  const templates = await prisma.permissionTemplate.findMany({ where: { societyId: scope.societyId, role: "USER" } });
  const templateByType = new Map(templates.map((t) => [t.userType as string, t.code]));

  const errors: { row: number; field: string | null; message: string }[] = [];
  const valid: { line: number; body: z.output<typeof schemas.users.CreateUserBody> }[] = [];
  const seen = new Set<string>();
  for (const { line, values } of table.rows) {
    const userType = values.user_type?.toUpperCase().replace(/[\s-]+/g, "_");
    const candidate = {
      name: values.name,
      mobile: values.mobile,
      email: values.email || null,
      userType,
      role: "USER",
      templateCode: userType ? templateByType.get(userType) : undefined,
      unitId: values.unit ? (unitByLabel.get(values.unit.toUpperCase()) ?? "__unknown__") : null,
    };
    if (candidate.unitId === "__unknown__") {
      errors.push({ row: line, field: "unit", message: `Unit "${values.unit}" doesn't exist (use the Building-Number form, e.g. A-1204).` });
      continue;
    }
    if (userType && !(USER_TYPES as readonly string[]).includes(userType)) {
      errors.push({ row: line, field: "user_type", message: `Unknown user type "${values.user_type}".` });
      continue;
    }
    const parsed = schemas.users.CreateUserBody.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      errors.push({ row: line, field: String(issue.path[0] ?? "") || null, message: issue.message });
      continue;
    }
    if (seen.has(parsed.data.mobile)) {
      errors.push({ row: line, field: "mobile", message: "This mobile appears earlier in the file." });
      continue;
    }
    seen.add(parsed.data.mobile);
    valid.push({ line, body: parsed.data });
  }
  const existing = await prisma.societyUser.findMany({
    where: { societyId: scope.societyId, deletedAt: null, user: { mobile: { in: valid.map((v) => v.body.mobile) } } },
    select: { user: { select: { mobile: true } } },
  });
  const existingMobiles = new Set(existing.map((e) => e.user.mobile));
  const toCreate = valid.filter((v) => {
    if (!existingMobiles.has(v.body.mobile)) return true;
    errors.push({ row: v.line, field: "mobile", message: `${v.body.mobile} is already a user of this society.` });
    return false;
  });
  errors.sort((a, b) => a.row - b.row);

  let created = 0;
  // All or nothing: a partial import leaves the admin reconciling which rows landed.
  if (!input.dryRun && errors.length === 0) {
    await transaction(prisma, async (tx) => {
      for (const { body } of toCreate) {
        await createUser(scope, body, tx);
        created++;
      }
    });
  }
  await prisma.importJob.create({
    data: { societyId: scope.societyId, kind: "users", dryRun: input.dryRun, total: table.rows.length, created, errors, actorId: actorUserId },
  });
  return { dryRun: input.dryRun, total: table.rows.length, valid: toCreate.length, created, errors };
}

export async function templates(societyId: string) {
  const rows = await prisma.permissionTemplate.findMany({ where: { societyId }, orderBy: [{ role: "desc" }, { name: "asc" }] });
  return rows.map((t) => ({ ...t, permissions: (t.permissions as string[]).filter(isPermission) }));
}

export async function upsertTemplate(scope: SocietyScope, code: string, body: z.output<typeof schemas.users.UpsertPermissionTemplateBody>) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,40}$/.test(normalized)) throw new AppError("VALIDATION_FAILED", "Template code is 2–40 letters, digits or underscores.");
  assertGrantable(scope, body.role, body.permissions);
  const row = await prisma.permissionTemplate.upsert({
    where: { societyId_code: { societyId: scope.societyId, code: normalized } },
    create: { societyId: scope.societyId, code: normalized, ...body },
    update: body,
  });
  await audit(prisma, { action: "permission_template.upsert", entity: "permission_template", entityId: row.id, after: row });
  return { ...row, permissions: (row.permissions as string[]).filter(isPermission) };
}
