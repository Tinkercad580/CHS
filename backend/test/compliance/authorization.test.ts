import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db";
import { addUser, call, login, makeSociety, mobile, resetDb } from "../helpers";

let S: Awaited<ReturnType<typeof makeSociety>>;
let adminToken: string;

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("AUTHZ");
  adminToken = (await login(S.admin.mobile)).token;
});

describe("permissions", () => {
  it("a user without the permission is refused and the refusal names what was needed", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    const r = await call(api.users.list, { params: { societyId: S.society.id } }, token);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("FORBIDDEN");
    expect(r.body.error.details.required).toEqual(["users.manage"]);
  });

  it("guards are hard-restricted to the gate even if an admin grants more (MASTER_SPEC A1.2)", async () => {
    const g = await addUser(S.society.id, "GUARD", { permissions: ["gate.operate", "bills.view"] });
    const { token } = await login(g.mobile);
    // A resident-surface endpoint:
    const home = await call(api.members.myHome, { params: { societyId: S.society.id } }, token);
    expect(home.body.error.code).toBe("SURFACE_NOT_ALLOWED");
    // The gate's plate lookup works:
    const plates = await call(api.members.vehicles, { params: { societyId: S.society.id }, query: { plate: "MH" } }, token);
    expect(plates.status).toBe(200);
  });

  it("a guard mistakenly given users.manage still can't reach admin endpoints", async () => {
    const g = await addUser(S.society.id, "GUARD");
    await prisma.societyUser.update({ where: { id: g.societyUser.id }, data: { permissions: ["gate.operate", "users.manage"] } });
    const { token } = await login(g.mobile);
    const r = await call(api.users.list, { params: { societyId: S.society.id } }, token);
    expect(r.body.error.code).toBe("SURFACE_NOT_ALLOWED");
  });
});

describe("granting access", () => {
  it("an admin can't grant permissions they don't hold", async () => {
    const limited = await addUser(S.society.id, "SECRETARY", { permissions: ["users.manage", "members.manage"] });
    const { token } = await login(limited.mobile);
    const r = await call(
      api.users.create,
      { params: { societyId: S.society.id }, body: { name: "Escalated", mobile: mobile(), role: "ADMIN", userType: "COMMITTEE", permissions: ["users.manage", "accounts.close"] } },
      token,
    );
    expect(r.status).toBe(403);
    expect(r.body.error.message).toContain("accounts.close");
  });

  it("a USER can't hold admin permissions", async () => {
    const r = await call(
      api.users.create,
      { params: { societyId: S.society.id }, body: { name: "Wrong", mobile: mobile(), role: "USER", userType: "OWNER", permissions: ["bills.view", "users.manage"] } },
      adminToken,
    );
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("creates from a template and one mobile maps to one account across societies", async () => {
    const m = mobile();
    const r = await call(api.users.create, { params: { societyId: S.society.id }, body: { name: "Tara Iyer", mobile: m, userType: "OWNER", templateCode: "OWNER", unitId: S.units[0]!.id } }, adminToken);
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("INVITED");
    expect(r.body.data.unitLabel).toBe("A-101");
    const dup = await call(api.users.create, { params: { societyId: S.society.id }, body: { name: "Tara again", mobile: m, userType: "OWNER", templateCode: "OWNER" } }, adminToken);
    expect(dup.body.error.code).toBe("MOBILE_ALREADY_EXISTS");

    const other = await makeSociety("AUTHZ2");
    const otherToken = (await login(other.admin.mobile)).token;
    const again = await call(api.users.create, { params: { societyId: other.society.id }, body: { name: "Tara", mobile: m, userType: "TENANT", templateCode: "TENANT" } }, otherToken);
    expect(again.status).toBe(200);
    expect(again.body.data.userId).toBe(r.body.data.userId);
  });

  it("a full admin can provision every template, staff and guards included", async () => {
    for (const templateCode of ["STAFF", "GUARD", "ACCOUNTANT", "AUDITOR", "TREASURER"]) {
      const r = await call(api.users.create, { params: { societyId: S.society.id }, body: { name: `T ${templateCode}`, mobile: mobile(), userType: "STAFF", templateCode } }, adminToken);
      expect(r.status, templateCode).toBe(200);
    }
  });

  it("lists carry a total across pages", async () => {
    const r = await call(api.users.list, { params: { societyId: S.society.id }, query: { limit: 2 } }, adminToken);
    expect(r.body.data.items).toHaveLength(2);
    expect(r.body.data.total).toBeGreaterThan(2);
    expect(r.body.data.items[0]).toHaveProperty("twoFactorEnabled", false);
  });

  it("no one can change their own role or permissions", async () => {
    const me = await prisma.societyUser.findFirstOrThrow({ where: { societyId: S.society.id, userId: S.admin.user.id } });
    const r = await call(api.users.update, { params: { societyId: S.society.id, userId: me.id }, body: { permissions: ["users.manage"] } }, adminToken);
    expect(r.status).toBe(403);
  });

  it("no one can suspend themselves", async () => {
    const me = await prisma.societyUser.findFirstOrThrow({ where: { societyId: S.society.id, userId: S.admin.user.id } });
    const r = await call(api.users.suspend, { params: { societyId: S.society.id, userId: me.id }, body: { reason: "Testing" } }, adminToken);
    expect(r.status).toBe(403);
  });
});

describe("suspension", () => {
  it("revokes access immediately and ends sessions when it was the only society", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    const r = await call(api.users.suspend, { params: { societyId: S.society.id, userId: u.societyUser.id }, body: { reason: "Moved out" } }, adminToken);
    expect(r.body.data.status).toBe("SUSPENDED");
    expect((await call(api.me.get, {}, token)).status).toBe(401);
    expect((await call(api.auth.lookup, { body: { mobile: u.mobile } })).body.data.next).toBe("NOT_REGISTERED");

    await call(api.users.reactivate, { params: { societyId: S.society.id, userId: u.societyUser.id } }, adminToken);
    expect((await login(u.mobile)).token).toBeTruthy();
  });

  it("every admin action lands in the audit log with the permission used", async () => {
    const logs = await call(api.society.auditLogs, { params: { societyId: S.society.id }, query: { entity: "society_user" } }, adminToken);
    expect(logs.status).toBe(200);
    const suspend = logs.body.data.items.find((l: { action: string }) => l.action === "user.suspend");
    expect(suspend.permission).toBe("users.manage");
    expect(suspend.actorName).toBe("Admin");
    expect(suspend.before.status).toBe("ACTIVE");
    expect(suspend.after.status).toBe("SUSPENDED");
  });

  it("the audit log can't be edited or deleted, even directly in the database", async () => {
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.updateMany({ data: { action: "tampered" } })).rejects.toThrow(/append-only/);
  });
});

describe("idempotency", () => {
  it("replays a retried request instead of performing it twice", async () => {
    const body = { name: "Retry Person", mobile: mobile(), userType: "OWNER" as const, templateCode: "OWNER" };
    const params = { societyId: S.society.id };
    const first = await call(api.users.create, { params, body }, adminToken, { "idempotency-key": "retry-key-0001" });
    const second = await call(api.users.create, { params, body }, adminToken, { "idempotency-key": "retry-key-0001" });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers["idempotent-replay"]).toBe("true");
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it("refuses the same key for a different request", async () => {
    const params = { societyId: S.society.id };
    await call(api.users.create, { params, body: { name: "Key One", mobile: mobile(), userType: "OWNER", templateCode: "OWNER" } }, adminToken, { "idempotency-key": "retry-key-0002" });
    const r = await call(api.users.create, { params, body: { name: "Key Two", mobile: mobile(), userType: "OWNER", templateCode: "OWNER" } }, adminToken, { "idempotency-key": "retry-key-0002" });
    expect(r.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("gate app boundaries", () => {
  it("only guards can sign in to the gate app", async () => {
    const resident = await addUser(S.society.id, "OWNER");
    const r = await call(api.auth.login, { body: { mobile: resident.mobile, password: "Sahaj@2026", client: "gate" } });
    expect(r.body.error.code).toBe("SURFACE_NOT_ALLOWED");
    const g = await addUser(S.society.id, "GUARD");
    expect((await call(api.auth.login, { body: { mobile: g.mobile, password: "Sahaj@2026", client: "gate" } })).body.data.status).toBe("SIGNED_IN");
  });

  it("a resident's temporary password isn't spent by trying the gate app", async () => {
    const resident = await addUser(S.society.id, "OWNER");
    const t = await call(api.users.issueTempPassword, { params: { societyId: S.society.id, userId: resident.societyUser.id } }, adminToken);
    const gate = await call(api.auth.login, { body: { mobile: resident.mobile, password: t.body.data.tempPassword, client: "gate" } });
    expect(gate.body.error.code).toBe("SURFACE_NOT_ALLOWED");
    const app = await call(api.auth.login, { body: { mobile: resident.mobile, password: t.body.data.tempPassword, client: "resident" } });
    expect(app.body.data.status).toBe("PASSWORD_CHANGE");
  });

  it("guards don't receive financial notices or the society's tax identifiers", async () => {
    const g = await addUser(S.society.id, "GUARD");
    const gt = (await login(g.mobile)).token;
    const n = await call(api.notices.create, { params: { societyId: S.society.id }, body: { title: "Audited accounts", body: "Attached.", category: "FINANCIAL", audience: { kind: "ALL" } } }, adminToken);
    await call(api.notices.publish, { params: { societyId: S.society.id, noticeId: n.body.data.id } }, adminToken);
    expect((await call(api.notices.feed, { params: { societyId: S.society.id } }, gt)).body.data.items.map((x: { title: string }) => x.title)).not.toContain("Audited accounts");
    await call(api.society.update, { params: { societyId: S.society.id }, body: { pan: "AAAAS1234C" } }, adminToken);
    expect((await call(api.society.get, { params: { societyId: S.society.id } }, gt)).body.data.pan).toBeNull();
  });
});
