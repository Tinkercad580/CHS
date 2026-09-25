import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db";
import { addUser, call, login, makeSociety, resetDb } from "../helpers";

let S: Awaited<ReturnType<typeof makeSociety>>;
let admin: string;
let owner: Awaited<ReturnType<typeof addUser>>;
let tenant: Awaited<ReturnType<typeof addUser>>;
let guard: Awaited<ReturnType<typeof addUser>>;
let ownerToken: string;
let tenantToken: string;
let guardToken: string;
const sid = () => S.society.id;

/** Delivery runs as background jobs; wait for them to settle. */
async function settle(notificationIds: string[], ms = 4000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const queued = await prisma.notificationDelivery.count({ where: { notificationId: { in: notificationIds }, status: "QUEUED" } });
    if (!queued) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("NOTE", 3);
  admin = (await login(S.admin.mobile)).token;
  owner = await addUser(sid(), "OWNER", { name: "Owner One", unitId: S.units[0]!.id });
  tenant = await addUser(sid(), "TENANT", { name: "Tenant Two", unitId: S.units[1]!.id });
  guard = await addUser(sid(), "GUARD", { name: "Guard" });
  ownerToken = (await login(owner.mobile)).token;
  tenantToken = (await login(tenant.mobile)).token;
  guardToken = (await login(guard.mobile)).token;
  await prisma.user.update({ where: { id: owner.user.id }, data: { email: "owner@example.in" } });
  // Quiet hours that never bite during the test, whatever the clock says.
  await call(api.society.updateSettings, { params: { societyId: sid() }, body: { quietHoursStart: "03:00", quietHoursEnd: "03:01" } }, admin);
});

describe("devices and preferences", () => {
  it("registers a phone for push; the same token moves to whoever signs in next", async () => {
    const token = "fcm-token-abcdefghijklmnopqrstuvwxyz-0001";
    expect((await call(api.notifications.registerDevice, { body: { token, app: "resident", platform: "android", deviceName: "Pixel 8" } }, tenantToken)).status).toBe(200);
    await call(api.notifications.registerDevice, { body: { token, app: "resident", platform: "android" } }, ownerToken);
    expect(await prisma.deviceToken.findUniqueOrThrow({ where: { token } })).toMatchObject({ userId: owner.user.id });
    const prefs = await call(api.notifications.preferences, {}, ownerToken);
    expect(prefs.body.data.hasEmail).toBe(true);
    expect(prefs.body.data.devices).toHaveLength(1);
  });

  it("tells the apps when there's no email on file", async () => {
    expect((await call(api.notifications.preferences, {}, tenantToken)).body.data.hasEmail).toBe(false);
  });

  it("emergency and account notices can't be switched off", async () => {
    const r = await call(api.notifications.updatePreferences, { body: { preferences: [{ category: "EMERGENCY", push: false, email: false }, { category: "NOTICE", push: true, email: false }] } }, ownerToken);
    const by = Object.fromEntries(r.body.data.preferences.map((p: { category: string }) => [p.category, p]));
    expect(by.EMERGENCY).toMatchObject({ push: true, email: true, mandatory: true });
    expect(by.NOTICE).toMatchObject({ push: true, email: false });
  });
});

describe("notices", () => {
  let noticeId: string;

  it("drafts, validates the emergency reason, and publishes to the chosen audience", async () => {
    const emergency = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Fire drill", body: "Assemble at the podium.", category: "EMERGENCY", audience: { kind: "ALL" } } }, admin);
    expect(emergency.body.error.code).toBe("VALIDATION_FAILED");

    const draft = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Water off Thursday", body: "Pump replacement, 10am to 4pm.", category: "WATER", audience: { kind: "RESIDENTS" }, ackRequired: true, channels: ["push", "email"] } }, admin);
    expect(draft.body.data.status).toBe("DRAFT");
    noticeId = draft.body.data.id;
    // Residents can't see a draft.
    expect((await call(api.notices.get, { params: { societyId: sid(), noticeId } }, ownerToken)).status).toBe(404);

    const pub = await call(api.notices.publish, { params: { societyId: sid(), noticeId } }, admin);
    expect(pub.body.data.status).toBe("PUBLISHED");
    expect(pub.body.data.stats.recipients).toBe(2); // owner + tenant; not the guard or the admin without a unit
  });

  it("reaches the inbox, push and email — per preferences", async () => {
    const rec = await prisma.noticeRecipient.findUniqueOrThrow({ where: { noticeId_userId: { noticeId, userId: owner.user.id } } });
    await settle([rec.notificationId!]);
    const d = await prisma.notificationDelivery.findMany({ where: { notificationId: rec.notificationId! } });
    // Push to the registered phone; no email, because the owner turned notice email off above.
    expect(d.map((x) => [x.channel, x.status])).toEqual([["PUSH", "SENT"]]);
    const inbox = await call(api.notifications.list, {}, ownerToken);
    expect(inbox.body.data.items[0]).toMatchObject({ category: "NOTICE", title: "Water off Thursday", read: false, data: { route: `/notices/${noticeId}` } });
    expect(inbox.body.data.items[0].data._emailSubject).toBeUndefined();
    expect((await call(api.notifications.unreadCount, {}, ownerToken)).body.data.unread).toBe(1);
  });

  it("the guard isn't a resident and doesn't get it", async () => {
    expect((await call(api.notices.feed, { params: { societyId: sid() } }, guardToken)).body.data.items).toHaveLength(0);
  });

  it("acknowledgement is recorded and marks the inbox item read", async () => {
    const ack = await call(api.notices.acknowledge, { params: { societyId: sid(), noticeId } }, ownerToken);
    expect(ack.body.data.mine).toEqual({ read: true, acknowledged: true });
    const report = await call(api.notices.report, { params: { societyId: sid(), noticeId } }, admin);
    const row = report.body.data.recipients.find((r: { name: string }) => r.name === "Owner One");
    expect(row).toMatchObject({ pushStatus: "SENT", acknowledgedAt: expect.any(String) });
    expect(report.body.data.notice.stats).toMatchObject({ recipients: 2, acknowledged: 1 });
  });

  it("is immutable once published; a correction supersedes it", async () => {
    expect((await call(api.notices.update, { params: { societyId: sid(), noticeId }, body: { title: "Changed" } }, admin)).body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect((await call(api.notices.discard, { params: { societyId: sid(), noticeId } }, admin)).body.error.code).toBe("BUSINESS_RULE_VIOLATION");
    const fix = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Water off Friday (corrected)", body: "The work moved to Friday.", category: "WATER", audience: { kind: "RESIDENTS" }, supersedesId: noticeId } }, admin);
    await call(api.notices.publish, { params: { societyId: sid(), noticeId: fix.body.data.id } }, admin);
    const old = await call(api.notices.get, { params: { societyId: sid(), noticeId } }, admin);
    expect(old.body.data).toMatchObject({ status: "SUPERSEDED", supersededById: fix.body.data.id });
  });

  it("targets tenants only, and staff only", async () => {
    const t = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Tenant verification", body: "Submit police intimation.", category: "CIRCULAR", audience: { kind: "TENANTS" } } }, admin);
    const p = await call(api.notices.publish, { params: { societyId: sid(), noticeId: t.body.data.id } }, admin);
    expect(p.body.data.stats.recipients).toBe(1);
    const st = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Gate roster", body: "New shifts from Monday.", category: "GENERAL", audience: { kind: "STAFF" } } }, admin);
    await call(api.notices.publish, { params: { societyId: sid(), noticeId: st.body.data.id } }, admin);
    const feed = await call(api.notices.feed, { params: { societyId: sid() } }, guardToken);
    expect(feed.body.data.items.map((n: { title: string }) => n.title)).toEqual(["Gate roster"]);
  });

  it("refuses to publish to nobody", async () => {
    const n = await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Empty building", body: "Nobody lives here.", category: "GENERAL", audience: { kind: "UNITS", unitIds: [S.units[2]!.id] } } }, admin);
    expect((await call(api.notices.publish, { params: { societyId: sid(), noticeId: n.body.data.id } }, admin)).body.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("residents can't compose notices", async () => {
    expect((await call(api.notices.create, { params: { societyId: sid() }, body: { title: "Hello all", body: "Party tonight.", category: "GENERAL", audience: { kind: "ALL" } } }, ownerToken)).status).toBe(403);
  });
});

describe("inbox", () => {
  it("marks everything read", async () => {
    await call(api.notifications.markAllRead, { body: {} }, ownerToken);
    expect((await call(api.notifications.unreadCount, {}, ownerToken)).body.data.unread).toBe(0);
  });

  it("the test notification reports what would be delivered", async () => {
    const r = await call(api.notifications.test, {}, tenantToken);
    // Log providers in tests: channels count as configured, the tenant has no phone and no email.
    expect(r.body.data).toEqual({ push: "no_devices", email: "no_email" });
  });

  it("an unregistered device stops receiving", async () => {
    await call(api.notifications.unregisterDevice, { body: { token: "fcm-token-abcdefghijklmnopqrstuvwxyz-0001" } }, ownerToken);
    expect(await prisma.deviceToken.count({ where: { userId: owner.user.id } })).toBe(0);
  });
});
