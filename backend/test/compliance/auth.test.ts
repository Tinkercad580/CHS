import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, totpCode } from "../../src/core/crypto";
import { prisma } from "../../src/core/db";
import { addUser, call, login, makeSociety, mobile, PASSWORD, resetDb } from "../helpers";

/**
 * MASTER_SPEC E4 compliance item 8 — authentication:
 * temporary password single-use with 24 h expiry; forced change before any
 * screen; lockout after 5 failures; no self-signup path.
 */

let S: Awaited<ReturnType<typeof makeSociety>>;
let adminToken: string;

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("AUTH");
  adminToken = (await login(S.admin.mobile)).token;
});

describe("lookup and activation", () => {
  it("routes each kind of number to the right screen", async () => {
    const invited = await addUser(S.society.id, "OWNER", { withPassword: false });
    expect((await call(api.auth.lookup, { body: { mobile: invited.mobile } })).body.data.next).toBe("CREATE_PASSWORD");
    expect((await call(api.auth.lookup, { body: { mobile: S.admin.mobile } })).body.data.next).toBe("ENTER_PASSWORD");
    expect((await call(api.auth.lookup, { body: { mobile: mobile() } })).body.data.next).toBe("NOT_REGISTERED");
  });

  it("accepts +91, spaces and a leading 0 in the number", async () => {
    const r = await call(api.auth.lookup, { body: { mobile: `+91 ${S.admin.mobile.slice(0, 5)} ${S.admin.mobile.slice(5)}` } });
    expect(r.body.data.next).toBe("ENTER_PASSWORD");
  });

  it("has no self-signup: an unregistered number can't create a password", async () => {
    const m = mobile();
    const r = await call(api.auth.activate, { body: { mobile: m, password: "Fresh2026x", confirmPassword: "Fresh2026x", acceptTerms: true } });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("MOBILE_NOT_REGISTERED");
    expect(await prisma.user.findUnique({ where: { mobile: m } })).toBeNull();
  });

  it("activates an admin-added number once, then refuses a second activation", async () => {
    const u = await addUser(S.society.id, "OWNER", { withPassword: false });
    const body = { mobile: u.mobile, password: "Fresh2026x", confirmPassword: "Fresh2026x", acceptTerms: true as const };
    const first = await call(api.auth.activate, { body });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("SIGNED_IN");
    const second = await call(api.auth.activate, { body });
    expect(second.body.error.code).toBe("PASSWORD_ALREADY_SET");
  });

  it("requires accepting the terms", async () => {
    const u = await addUser(S.society.id, "OWNER", { withPassword: false });
    const r = await call(api.auth.activate, { body: { mobile: u.mobile, password: "Fresh2026x", confirmPassword: "Fresh2026x", acceptTerms: false } });
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("password policy", () => {
  it.each([
    ["short1", "At least 8"],
    ["password", "letter"],
    ["12345678", "letter"],
    ["password1", "too common"],
  ])("rejects %s", async (pw) => {
    const u = await addUser(S.society.id, "OWNER", { withPassword: false });
    const r = await call(api.auth.activate, { body: { mobile: u.mobile, password: pw, confirmPassword: pw, acceptTerms: true } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(["VALIDATION_FAILED", "PASSWORD_POLICY_VIOLATION"]).toContain(r.body.error.code);
  });

  it("rejects a password containing the mobile number", async () => {
    const u = await addUser(S.society.id, "OWNER", { withPassword: false });
    const pw = `a${u.mobile}`;
    const r = await call(api.auth.activate, { body: { mobile: u.mobile, password: pw, confirmPassword: pw, acceptTerms: true } });
    expect(r.body.error.code).toBe("PASSWORD_POLICY_VIOLATION");
  });

  it("rejects reuse of any of the last three passwords", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    const change = (current: string, next: string) =>
      call(api.me.changePassword, { body: { currentPassword: current, newPassword: next, confirmPassword: next } }, token);
    expect((await change(PASSWORD, "Second2026a")).status).toBe(200);
    expect((await change("Second2026a", "Third2026a")).status).toBe(200);
    const reuse = await change("Third2026a", "Second2026a");
    expect(reuse.body.error.code).toBe("PASSWORD_POLICY_VIOLATION");
  });
});

describe("lockout", () => {
  it("locks after 5 wrong passwords, refuses even the right one, and an admin can unlock", async () => {
    const u = await addUser(S.society.id, "OWNER");
    for (let i = 0; i < 4; i++) {
      const r = await call(api.auth.login, { body: { mobile: u.mobile, password: "Wrong2026x" } });
      expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
    }
    // The fifth wrong attempt is the one that locks, and it says so.
    const fifth = await call(api.auth.login, { body: { mobile: u.mobile, password: "Wrong2026x" } });
    expect(fifth.body.error.code).toBe("ACCOUNT_LOCKED");
    const locked = await call(api.auth.login, { body: { mobile: u.mobile, password: PASSWORD } });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    expect((await call(api.auth.lookup, { body: { mobile: u.mobile } })).body.data.next).toBe("LOCKED");

    const unlock = await call(api.users.unlock, { params: { societyId: S.society.id, userId: u.societyUser.id } }, adminToken);
    expect(unlock.status).toBe(200);
    expect(unlock.body.data.status).toBe("ACTIVE");
    expect((await call(api.auth.login, { body: { mobile: u.mobile, password: PASSWORD } })).body.data.status).toBe("SIGNED_IN");
    const events = await prisma.authEvent.findMany({ where: { userId: u.user.id }, select: { type: true } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["LOGIN_FAILED", "LOCKED", "UNLOCKED", "LOGIN_SUCCESS"]));
  });
});

describe("temporary passwords", () => {
  async function issue(societyUserId: string) {
    const r = await call(api.users.issueTempPassword, { params: { societyId: S.society.id, userId: societyUserId } }, adminToken);
    expect(r.status).toBe(200);
    return r.body.data as { tempPassword: string; expiresAt: string };
  }

  it("is single use and forces a change before anything else", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { tempPassword, expiresAt } = await issue(u.societyUser.id);
    expect(tempPassword).toHaveLength(10);
    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(23.9 * 3_600_000);

    const first = await call(api.auth.login, { body: { mobile: u.mobile, password: tempPassword } });
    expect(first.body.data.status).toBe("PASSWORD_CHANGE");
    const restricted = first.body.data.restrictedToken as string;

    // The restricted token opens nothing but the forced change.
    const blocked = await call(api.me.get, {}, restricted);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // Used once; the same temporary password no longer works.
    const again = await call(api.auth.login, { body: { mobile: u.mobile, password: tempPassword } });
    expect(again.body.data?.status).not.toBe("SIGNED_IN");

    const changed = await call(api.auth.forcedChange, { body: { newPassword: "MyOwn2026x", confirmPassword: "MyOwn2026x" } }, restricted);
    expect(changed.body.data.status).toBe("SIGNED_IN");
    expect((await call(api.me.get, {}, changed.body.data.tokens.accessToken)).status).toBe(200);
    // The restricted token died with the change.
    expect((await call(api.auth.forcedChange, { body: { newPassword: "Other2026x", confirmPassword: "Other2026x" } }, restricted)).status).toBe(401);
  });

  it("expires after 24 hours", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { tempPassword } = await issue(u.societyUser.id);
    await prisma.tempPassword.updateMany({ where: { userId: u.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await call(api.auth.login, { body: { mobile: u.mobile, password: tempPassword } });
    expect(r.body.error.code).toBe("TEMP_PASSWORD_EXPIRED");
  });

  it("an invited user given a temporary password is sent to the password screen, not create-password", async () => {
    const u = await addUser(S.society.id, "OWNER", { withPassword: false });
    expect((await call(api.auth.lookup, { body: { mobile: u.mobile } })).body.data.next).toBe("CREATE_PASSWORD");
    const { tempPassword } = await issue(u.societyUser.id);
    expect((await call(api.auth.lookup, { body: { mobile: u.mobile } })).body.data.next).toBe("ENTER_PASSWORD");
    const r = await call(api.auth.login, { body: { mobile: u.mobile, password: tempPassword } });
    expect(r.body.data.status).toBe("PASSWORD_CHANGE");
  });

  it("issuing a new one supersedes the old one", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const a = await issue(u.societyUser.id);
    await issue(u.societyUser.id);
    const r = await call(api.auth.login, { body: { mobile: u.mobile, password: a.tempPassword } });
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("is never stored in plain text and is logged with the issuing admin", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { tempPassword } = await issue(u.societyUser.id);
    const row = await prisma.tempPassword.findFirstOrThrow({ where: { userId: u.user.id }, orderBy: { createdAt: "desc" } });
    expect(row.passwordHash).not.toContain(tempPassword);
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
    const ev = await prisma.authEvent.findFirstOrThrow({ where: { userId: u.user.id, type: "TEMP_PASSWORD_ISSUED" } });
    expect(ev.actorId).toBe(S.admin.user.id);
    const audits = await prisma.auditLog.findMany({ where: { entityId: u.societyUser.id } });
    expect(JSON.stringify(audits)).not.toContain(tempPassword);
  });

  it("can't be used to take over an admin of another society", async () => {
    const other = await makeSociety("OTHR");
    const shared = await addUser(other.society.id, "SECRETARY");
    const here = await addUser(S.society.id, "OWNER", { mobile: shared.mobile });
    const r = await call(api.users.issueTempPassword, { params: { societyId: S.society.id, userId: here.societyUser.id } }, adminToken);
    expect(r.status).toBe(403);
  });
});

describe("sessions", () => {
  it("rotates refresh tokens and revokes the session when an old one is replayed", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { refreshToken } = await login(u.mobile);
    const rotated = await call(api.auth.refresh, { body: { refreshToken } });
    expect(rotated.status).toBe(200);
    const replay = await call(api.auth.refresh, { body: { refreshToken } });
    expect(replay.body.error.code).toBe("REFRESH_TOKEN_INVALID");
    // The thief's replay killed the legitimate successor too.
    const successor = await call(api.auth.refresh, { body: { refreshToken: rotated.body.data.refreshToken } });
    expect(successor.body.error.code).toBe("REFRESH_TOKEN_INVALID");
    expect(await prisma.authEvent.count({ where: { userId: u.user.id, type: "REFRESH_REUSE_DETECTED" } })).toBe(1);
  });

  it("signs out other devices on password change but keeps this one", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const a = await login(u.mobile);
    const b = await login(u.mobile);
    const r = await call(api.me.changePassword, { body: { currentPassword: PASSWORD, newPassword: "Changed2026x", confirmPassword: "Changed2026x" } }, a.token);
    expect(r.status).toBe(200);
    expect((await call(api.me.get, {}, a.token)).status).toBe(200);
    expect((await call(api.me.get, {}, b.token)).status).toBe(401);
  });

  it("logout ends the session at once, not when the access token expires", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    expect((await call(api.auth.logout, { body: {} }, token)).status).toBe(200);
    expect((await call(api.me.get, {}, token)).status).toBe(401);
  });

  it("an admin's force-logout ends every session", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    await call(api.users.logoutAll, { params: { societyId: S.society.id, userId: u.societyUser.id } }, adminToken);
    expect((await call(api.me.get, {}, token)).status).toBe(401);
  });
});

describe("two-factor sign-in for admins", () => {
  it("enrols, then requires the code at sign-in", async () => {
    const a = await addUser(S.society.id, "SECRETARY");
    const { token } = await login(a.mobile);
    const setup = await call(api.me.twoFactorSetup, {}, token);
    const secret = setup.body.data.secret as string;
    const code = () => totpCode(secret, Math.floor(Date.now() / 30_000));
    expect((await call(api.me.twoFactorEnable, { body: { code: code() } }, token)).status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(stored.totpSecret).not.toContain(secret);
    expect(decrypt(stored.totpSecret!)).toBe(secret);

    const step1 = await call(api.auth.login, { body: { mobile: a.mobile, password: PASSWORD } });
    expect(step1.body.data.status).toBe("TWO_FACTOR");
    const wrong = await call(api.auth.verifyTwoFactor, { body: { challengeToken: step1.body.data.challengeToken, code: "000000" } });
    expect(wrong.body.error.code).toBe("TWO_FACTOR_INVALID");
    const ok = await call(api.auth.verifyTwoFactor, { body: { challengeToken: step1.body.data.challengeToken, code: code() } });
    expect(ok.body.data.status).toBe("SIGNED_IN");
  });

  it("isn't offered to non-admins", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    expect((await call(api.me.twoFactorSetup, {}, token)).status).toBe(403);
  });
});
