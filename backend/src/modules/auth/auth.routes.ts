import { api } from "@chs/contract";
import type { Request } from "express";
import { assertNotReused, assertPasswordPolicy, hashPassword, verifyPassword } from "../../core/auth/password";
import { revokeAllSessions, revokeSession, rotateSession, type DeviceInfo } from "../../core/auth/sessions";
import { encrypt, decrypt, newTotpSecret, verifyTotp } from "../../core/crypto";
import { prisma, transaction } from "../../core/db";
import { AppError } from "../../core/errors";
import { events } from "../../core/events";
import { handle } from "../../core/http/bind";
import { toIso } from "../../core/dates";
import * as auth from "./auth.service";
import { loadMe } from "./me";

function device(req: Request, body: { client?: string; deviceId?: string; deviceName?: string }): DeviceInfo {
  return {
    client: body.client ?? "web",
    deviceId: body.deviceId ?? null,
    deviceName: body.deviceName ?? null,
    ip: req.ip ?? null,
    userAgent: req.header("user-agent") ?? null,
  };
}

async function assertAdminAnywhere(userId: string): Promise<void> {
  const admin = await prisma.societyUser.findFirst({ where: { userId, role: "ADMIN", deletedAt: null } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } });
  if (!admin && !user?.isPlatformAdmin) throw new AppError("FORBIDDEN", "Two-factor sign-in is available to administrators.");
}

export const authBindings = [
  handle(api.auth.lookup, ({ body }) => auth.lookup(body.mobile)),

  handle(api.auth.activate, ({ body }, { req }) => auth.activate(body, device(req, body))),

  handle(api.auth.login, ({ body }, { req }) => auth.login(body, device(req, body))),

  handle(api.auth.verifyTwoFactor, ({ body }, { req }) => auth.verifyTwoFactor(body, device(req, body))),

  handle(api.auth.refresh, ({ body }, { req }) =>
    rotateSession(body.refreshToken, { ip: req.ip ?? null, userAgent: req.header("user-agent") ?? null }),
  ),

  handle(api.auth.logout, async (_input, { actor }) => {
    if (!actor.restricted) await revokeSession(prisma, actor.sessionId, "LOGOUT");
    return { ok: true as const };
  }),

  handle(api.auth.forcedChange, ({ body }, { actor, req }) => auth.forcedChange(actor.userId, body, device(req, body))),

  // ─── /me ──────────────────────────────────────────────────────────────────

  handle(api.me.get, (_i, { actor }) => loadMe(prisma, actor.userId)),

  handle(api.me.update, async ({ body }, { actor }) => {
    await prisma.user.update({
      where: { id: actor.userId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
      },
    });
    events.emit({ name: "me.changed", to: { user: actor.userId }, payload: {}, exceptSession: actor.sessionId });
    return loadMe(prisma, actor.userId);
  }),

  handle(api.me.changePassword, async ({ body }, { actor, req }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw new AppError("INVALID_CREDENTIALS", "Your current password is incorrect.");
    }
    assertPasswordPolicy(body.newPassword, { mobile: user.mobile });
    await assertNotReused(prisma, user.id, body.newPassword, user.passwordHash);
    const hash = await hashPassword(body.newPassword);
    await transaction(prisma, async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash, passwordChangedAt: new Date() } });
      await tx.passwordHistory.create({ data: { userId: user.id, passwordHash: hash } });
      // MASTER_SPEC A2.1(5): every other session is signed out; this one stays.
      await revokeAllSessions(tx, user.id, "PASSWORD_CHANGED", actor.sessionId);
      await tx.authEvent.create({
        data: { userId: user.id, type: "PASSWORD_CHANGED", ip: req.ip ?? null, userAgent: req.header("user-agent") ?? null },
      });
    });
    return { ok: true as const };
  }),

  handle(api.me.sessions, async (_i, { actor }) => {
    const sessions = await prisma.session.findMany({
      where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } },
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
      current: s.id === actor.sessionId,
    }));
  }),

  handle(api.me.revokeSession, async ({ params }, { actor }) => {
    const s = await prisma.session.findFirst({ where: { id: params.sessionId, userId: actor.userId } });
    if (!s) throw new AppError("NOT_FOUND", "Session not found.");
    await revokeSession(prisma, s.id, "USER_REVOKED");
    await prisma.authEvent.create({ data: { userId: actor.userId, type: "SESSION_REVOKED", detail: s.deviceName ?? s.client } });
    return { ok: true as const };
  }),

  handle(api.me.logoutAll, async (_i, { actor }) => {
    await revokeAllSessions(prisma, actor.userId, "USER_LOGOUT_ALL");
    await prisma.authEvent.create({ data: { userId: actor.userId, type: "ALL_SESSIONS_REVOKED" } });
    return { ok: true as const };
  }),

  handle(api.me.twoFactorSetup, async (_i, { actor }) => {
    await assertAdminAnywhere(actor.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (user.totpEnabledAt) throw new AppError("CONFLICT", "Two-factor sign-in is already on.");
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpPendingSecret: encrypt(secret) } });
    const label = encodeURIComponent(`CHS:${user.mobile}`);
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=CHS&algorithm=SHA1&digits=6&period=30` };
  }),

  handle(api.me.twoFactorEnable, async ({ body }, { actor }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!user.totpPendingSecret) throw new AppError("PRECONDITION_FAILED", "Start two-factor setup first.");
    if (!verifyTotp(decrypt(user.totpPendingSecret), body.code)) throw new AppError("TWO_FACTOR_INVALID", "That code is incorrect or has expired.");
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date() },
    });
    await prisma.authEvent.create({ data: { userId: user.id, type: "TWO_FACTOR_ENABLED" } });
    return { ok: true as const };
  }),

  handle(api.me.twoFactorDisable, async ({ body }, { actor }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!user.totpSecret) throw new AppError("PRECONDITION_FAILED", "Two-factor sign-in is not on.");
    if (!verifyTotp(decrypt(user.totpSecret), body.code)) throw new AppError("TWO_FACTOR_INVALID", "That code is incorrect or has expired.");
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null } });
    await prisma.authEvent.create({ data: { userId: user.id, type: "TWO_FACTOR_DISABLED" } });
    return { ok: true as const };
  }),
];
