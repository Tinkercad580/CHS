import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { randomToken, sha256 } from "../crypto";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { events } from "../events";
import { signAccessToken } from "./tokens";

export interface DeviceInfo {
  client: string;
  deviceId?: string | null;
  deviceName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

/** Open a new session (a new refresh-token family) for a device. */
export async function openSession(db: Tx, user: { id: string; tokenVersion: number }, device: DeviceInfo): Promise<IssuedTokens> {
  const refreshToken = randomToken(32);
  const expiresAt = refreshExpiry();
  const session = await db.session.create({
    data: {
      userId: user.id,
      familyId: randomUUID(),
      refreshTokenHash: sha256(refreshToken),
      client: device.client,
      deviceId: device.deviceId ?? null,
      deviceName: device.deviceName ?? null,
      ip: device.ip ?? null,
      userAgent: device.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });
  const access = await signAccessToken({ sub: user.id, sid: session.id, ver: user.tokenVersion });
  return {
    sessionId: session.id,
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
}

/**
 * Rotate a refresh token. The presented token must be the session's current
 * one. Presenting the one before it means it was copied and used by someone
 * else first — the whole session is revoked (OAuth 2.0 BCP reuse detection).
 */
export async function rotateSession(refreshToken: string, device: { ip?: string | null; userAgent?: string | null }) {
  const hash = sha256(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });

  if (!session) {
    const reused = await prisma.session.findFirst({ where: { previousHash: hash, revokedAt: null } });
    if (reused) {
      await revokeSession(prisma, reused.id, "REFRESH_REUSE");
      await prisma.authEvent.create({
        data: { userId: reused.userId, type: "REFRESH_REUSE_DETECTED", ip: device.ip ?? null, userAgent: device.userAgent ?? null },
      });
    }
    throw new AppError("REFRESH_TOKEN_INVALID", "Your session has ended. Sign in again.");
  }
  if (session.revokedAt || session.expiresAt < new Date()) {
    throw new AppError("REFRESH_TOKEN_INVALID", "Your session has ended. Sign in again.");
  }

  const next = randomToken(32);
  const expiresAt = refreshExpiry();
  // Conditional update: if two refreshes race with the same token, only one wins.
  const updated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
    data: {
      refreshTokenHash: sha256(next),
      previousHash: hash,
      lastUsedAt: new Date(),
      expiresAt,
      ip: device.ip ?? session.ip,
      userAgent: device.userAgent?.slice(0, 300) ?? session.userAgent,
    },
  });
  if (updated.count !== 1) throw new AppError("REFRESH_TOKEN_INVALID", "Your session has ended. Sign in again.");

  const access = await signAccessToken({ sub: session.userId, sid: session.id, ver: session.user.tokenVersion });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken: next,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
}

export async function revokeSession(db: Tx, sessionId: string, reason: string): Promise<void> {
  const s = await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  if (s.count) {
    const row = await db.session.findUnique({ where: { id: sessionId }, select: { userId: true } });
    if (row) events.emit({ name: "session.revoked", to: { user: row.userId }, payload: { sessionId, reason } });
  }
}

/**
 * Revoke every session a user has, optionally keeping one. Bumping the token
 * version also kills outstanding access tokens immediately rather than at
 * their 15-minute expiry.
 */
export async function revokeAllSessions(db: Tx, userId: string, reason: string, keepSessionId?: string): Promise<number> {
  const res = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  if (!keepSessionId) await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  events.emit({ name: "session.revoked", to: { user: userId }, payload: { sessionId: null, reason }, exceptSession: keepSessionId });
  return res.count;
}
