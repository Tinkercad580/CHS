import {
  isAdminPermission,
  type Endpoint,
  type Permission,
  type Surface,
} from "@chs/contract";
import type { Request } from "express";
import { verifyAccessToken, verifyRestrictedToken, peekTokenType } from "../auth/tokens";
import type { Actor, SocietyScope } from "../context";
import { prisma } from "../db";
import { AppError } from "../errors";

function bearer(req: Request): string | null {
  const h = req.header("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * Resolve the caller. An access token must belong to a live session whose
 * user's token version still matches — so revoking a session, suspending a
 * user or changing a password takes effect on the very next request, not
 * when the 15-minute token lapses.
 */
export async function authenticate(req: Request, endpoint: Endpoint): Promise<Actor | null> {
  const token = bearer(req);
  if (endpoint.access.kind === "public") return null;
  if (!token) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");

  if (peekTokenType(token) === "password_change") {
    if (!endpoint.allowRestricted) throw new AppError("PASSWORD_CHANGE_REQUIRED", "Set a new password to continue.");
    const { userId, ver } = await verifyRestrictedToken(token, "password_change");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tokenVersion !== ver || !user.mustChangePassword) {
      throw new AppError("UNAUTHENTICATED", "This step has expired. Sign in again.");
    }
    return { userId, sessionId: "", name: user.name, isPlatformAdmin: false, restricted: true };
  }

  const claims = await verifyAccessToken(token);
  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: { revokedAt: true, expiresAt: true, userId: true, user: { select: { name: true, tokenVersion: true, isPlatformAdmin: true, mustChangePassword: true } } },
  });
  if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt < new Date() || session.user.tokenVersion !== claims.ver) {
    throw new AppError("UNAUTHENTICATED", "Your session has ended. Sign in again.");
  }
  if (session.user.mustChangePassword && !endpoint.allowRestricted) {
    throw new AppError("PASSWORD_CHANGE_REQUIRED", "Set a new password to continue.");
  }
  return { userId: claims.sub, sessionId: claims.sid, name: session.user.name, isPlatformAdmin: session.user.isPlatformAdmin, restricted: false };
}

function surfaceOf(endpoint: Endpoint): Surface {
  if (endpoint.surface) return endpoint.surface;
  const access = endpoint.access;
  if (access.kind !== "society" || !access.permission) return "common";
  const perms = (Array.isArray(access.permission) ? access.permission : [access.permission]) as Permission[];
  return perms.every(isAdminPermission) ? "admin" : "common";
}

/**
 * Resolve the caller's standing in the society in the path and apply the
 * endpoint's permission rule. Also the guard hard-restriction: a GUARD may
 * call only gate and common endpoints, whatever permissions they were given.
 */
export async function authorizeSociety(
  actor: Actor,
  societyId: string,
  endpoint: Endpoint,
): Promise<{ scope: SocietyScope; permissionUsed: Permission | null }> {
  const su = await prisma.societyUser.findUnique({
    where: { societyId_userId: { societyId, userId: actor.userId } },
    include: { society: { select: { status: true } } },
  });
  if (!su || su.deletedAt) throw new AppError("SOCIETY_ACCESS_DENIED", "You don't have access to this society.");
  if (su.suspendedAt) throw new AppError("ACCOUNT_SUSPENDED", "Your access to this society is suspended. Contact the society office.");
  if (su.society.status === "SUSPENDED") throw new AppError("FORBIDDEN", "This society's account is suspended.");

  const surface = surfaceOf(endpoint);
  if (su.userType === "GUARD" && surface !== "gate" && surface !== "common") {
    throw new AppError("SURFACE_NOT_ALLOWED", "This isn't available on the gate app.");
  }

  const granted = new Set(su.permissions as Permission[]);
  let permissionUsed: Permission | null = null;
  const access = endpoint.access;
  if (access.kind === "society" && access.permission) {
    const needed = (Array.isArray(access.permission) ? access.permission : [access.permission]) as Permission[];
    permissionUsed = needed.find((p) => granted.has(p)) ?? null;
    if (!permissionUsed) throw new AppError("FORBIDDEN", "You don't have permission to do that.", { required: needed });
  }

  return {
    scope: {
      societyId,
      societyUserId: su.id,
      role: su.role,
      userType: su.userType,
      permissions: granted,
      unitId: su.unitId,
    },
    permissionUsed,
  };
}
