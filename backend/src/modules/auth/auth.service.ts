import type { LoginResult } from "@chs/contract";
import { assertNotReused, assertPasswordPolicy, hashPassword, verifyPassword } from "../../core/auth/password";
import { openSession, revokeAllSessions, type DeviceInfo } from "../../core/auth/sessions";
import { signRestrictedToken, verifyRestrictedToken } from "../../core/auth/tokens";
import { decrypt, verifyTotp } from "../../core/crypto";
import { env } from "../../config/env";
import { prisma, transaction } from "../../core/db";
import { AppError } from "../../core/errors";
import { events } from "../../core/events";
import { loadMe } from "./me";

/** MASTER_SPEC A2.2 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;
const IP_FAILURES_PER_HOUR = env.LOGIN_IP_FAILURES_PER_HOUR;

type AuthUser = NonNullable<Awaited<ReturnType<typeof findUser>>>;

async function findUser(mobile: string) {
  return prisma.user.findUnique({
    where: { mobile },
    include: {
      societyUsers: { where: { deletedAt: null, suspendedAt: null }, select: { societyId: true, role: true } },
    },
  });
}

/** Provisioned and able to reach at least one society (or the platform console). */
function canSignIn(user: AuthUser | null): user is AuthUser {
  return !!user && (user.isPlatformAdmin || user.societyUsers.length > 0);
}

function isLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil > new Date();
}

function lockedError(user: { lockedUntil: Date | null }) {
  const minutes = Math.max(1, Math.ceil(((user.lockedUntil?.getTime() ?? 0) - Date.now()) / 60_000));
  return new AppError("ACCOUNT_LOCKED", `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask your society office to unlock your account.`, {
    lockedUntil: user.lockedUntil?.toISOString(),
  });
}

const INVALID = () => new AppError("INVALID_CREDENTIALS", "The mobile number or password is incorrect.");

export async function lookup(mobile: string) {
  const user = await findUser(mobile);
  if (!canSignIn(user)) return { next: "NOT_REGISTERED" as const };
  if (isLocked(user)) return { next: "LOCKED" as const, lockedUntil: user.lockedUntil!.toISOString() };
  if (user.passwordHash) return { next: "ENTER_PASSWORD" as const };
  // An invited user the office has already given a temporary password signs in with it.
  const temp = await prisma.tempPassword.count({ where: { userId: user.id, usedAt: null, supersededAt: null, expiresAt: { gt: new Date() } } });
  return { next: temp ? ("ENTER_PASSWORD" as const) : ("CREATE_PASSWORD" as const) };
}

async function signedIn(userId: string, device: DeviceInfo): Promise<LoginResult> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null },
  });
  const tokens = await openSession(prisma, user, device);
  await prisma.authEvent.create({ data: { userId, type: "LOGIN_SUCCESS", ip: device.ip ?? null, userAgent: device.userAgent ?? null } });
  const { sessionId: _sid, ...pair } = tokens;
  return { status: "SIGNED_IN", tokens: pair, me: await loadMe(prisma, userId) };
}

async function passwordChangeStep(user: { id: string; tokenVersion: number }): Promise<LoginResult> {
  const { token, expiresAt } = await signRestrictedToken(user.id, "password_change", user.tokenVersion);
  return { status: "PASSWORD_CHANGE", restrictedToken: token, expiresAt: expiresAt.toISOString() };
}

/** First sign-in: the number was added by an admin and has no password yet. */
export async function activate(
  input: { mobile: string; password: string },
  device: DeviceInfo,
): Promise<LoginResult> {
  const user = await findUser(input.mobile);
  if (!canSignIn(user)) throw new AppError("MOBILE_NOT_REGISTERED", "Your number is not registered. Please contact your society office.");
  if (user.passwordHash) throw new AppError("PASSWORD_ALREADY_SET", "This number already has a password. Sign in instead.");
  assertPasswordPolicy(input.password, { mobile: input.mobile });

  const hash = await hashPassword(input.password);
  const now = new Date();
  // Conditional on the password still being unset, so two racing activations can't both win.
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: null },
    data: { passwordHash: hash, passwordChangedAt: now, activatedAt: now, termsAcceptedAt: now, mustChangePassword: false },
  });
  if (claimed.count !== 1) throw new AppError("PASSWORD_ALREADY_SET", "This number already has a password. Sign in instead.");

  await prisma.passwordHistory.create({ data: { userId: user.id, passwordHash: hash } });
  await prisma.authEvent.create({ data: { userId: user.id, type: "ACTIVATED", ip: device.ip ?? null, userAgent: device.userAgent ?? null } });
  // Activation is visible to every admin of the user's societies at once — the
  // mitigation for a number being claimed by someone other than its owner.
  for (const su of user.societyUsers) events.emit({ name: "users.changed", to: { admins: su.societyId }, payload: { userId: user.id } });
  return signedIn(user.id, device);
}

/** Returns the lock expiry when this failure locked the account. */
async function recordFailure(user: AuthUser, device: DeviceInfo): Promise<Date | null> {
  const failed = user.failedAttempts + 1;
  const lock = failed >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = lock ? new Date(Date.now() + LOCKOUT_MS) : null;
  await prisma.user.update({
    where: { id: user.id },
    data: lock ? { failedAttempts: 0, lockedUntil } : { failedAttempts: failed },
  });
  await prisma.authEvent.create({
    data: { userId: user.id, type: lock ? "LOCKED" : "LOGIN_FAILED", ip: device.ip ?? null, userAgent: device.userAgent ?? null },
  });
  if (lock) for (const su of user.societyUsers) events.emit({ name: "users.changed", to: { admins: su.societyId }, payload: { userId: user.id } });
  return lockedUntil;
}

async function throttleIp(ip: string | null | undefined): Promise<void> {
  if (!ip) return;
  const since = new Date(Date.now() - 3_600_000);
  const failures = await prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } });
  if (failures >= IP_FAILURES_PER_HOUR) {
    throw new AppError("RATE_LIMITED", "Too many failed sign-ins from this network. Try again later.");
  }
}

export async function login(input: { mobile: string; password: string }, device: DeviceInfo): Promise<LoginResult> {
  await throttleIp(device.ip);
  const user = await findUser(input.mobile);
  const attempt = (success: boolean) =>
    prisma.loginAttempt.create({ data: { mobile: input.mobile, ip: device.ip ?? null, success } });

  if (!canSignIn(user)) {
    await verifyPassword(null, input.password); // equalise timing
    await attempt(false);
    throw INVALID();
  }
  if (isLocked(user)) {
    await attempt(false);
    throw lockedError(user);
  }

  // A live temporary password takes precedence: using it ends in a forced change.
  const temp = await prisma.tempPassword.findFirst({
    where: { userId: user.id, usedAt: null, supersededAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (temp && (await verifyPassword(temp.passwordHash, input.password))) {
    if (temp.expiresAt < new Date()) {
      await attempt(false);
      throw new AppError("TEMP_PASSWORD_EXPIRED", "This temporary password has expired. Ask your society office for a new one.");
    }
    const consumed = await prisma.tempPassword.updateMany({ where: { id: temp.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw INVALID();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true, failedAttempts: 0, lockedUntil: null },
    });
    await attempt(true);
    return passwordChangeStep(updated);
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await attempt(false);
    // The attempt that locks the account says so, rather than leaving the next one to reveal it.
    const lockedUntil = await recordFailure(user, device);
    throw lockedUntil ? lockedError({ lockedUntil }) : INVALID();
  }
  await attempt(true);

  if (user.mustChangePassword) return passwordChangeStep(user);
  if (user.totpEnabledAt) {
    const { token, expiresAt } = await signRestrictedToken(user.id, "two_factor", user.tokenVersion, 5 * 60);
    return { status: "TWO_FACTOR", challengeToken: token, expiresAt: expiresAt.toISOString() };
  }
  return signedIn(user.id, device);
}

export async function verifyTwoFactor(input: { challengeToken: string; code: string }, device: DeviceInfo): Promise<LoginResult> {
  const { userId, ver } = await verifyRestrictedToken(input.challengeToken, "two_factor");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { societyUsers: { where: { deletedAt: null, suspendedAt: null }, select: { societyId: true, role: true } } },
  });
  if (!user || user.tokenVersion !== ver || !user.totpSecret) throw new AppError("TWO_FACTOR_INVALID", "This step has expired. Sign in again.");
  if (isLocked(user)) throw lockedError(user);
  if (!verifyTotp(decrypt(user.totpSecret), input.code)) {
    const lockedUntil = await recordFailure(user, device);
    if (lockedUntil) throw lockedError({ lockedUntil });
    throw new AppError("TWO_FACTOR_INVALID", "That code is incorrect or has expired.");
  }
  return signedIn(user.id, device);
}

/** Replace a temporary (or admin-forced) password. Ends every other session. */
export async function forcedChange(userId: string, input: { newPassword: string }, device: DeviceInfo): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in again.");
  if (!user.mustChangePassword) throw new AppError("PRECONDITION_FAILED", "There is no password change pending.");
  assertPasswordPolicy(input.newPassword, { mobile: user.mobile });
  await assertNotReused(prisma, user.id, input.newPassword, user.passwordHash);

  const hash = await hashPassword(input.newPassword);
  await transaction(prisma, async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        activatedAt: user.activatedAt ?? new Date(),
        termsAcceptedAt: user.termsAcceptedAt ?? new Date(),
      },
    });
    await tx.passwordHistory.create({ data: { userId: user.id, passwordHash: hash } });
    await revokeAllSessions(tx, user.id, "PASSWORD_CHANGED");
    await tx.authEvent.create({ data: { userId: user.id, type: "PASSWORD_CHANGED", ip: device.ip ?? null, userAgent: device.userAgent ?? null } });
  });
  return signedIn(user.id, device);
}
