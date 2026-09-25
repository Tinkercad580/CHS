import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db";
import { addUser, call, login, makeSociety, mobile, resetDb } from "../helpers";

let S: Awaited<ReturnType<typeof makeSociety>>;
let admin: string;
let owner: Awaited<ReturnType<typeof addUser>>;
let ownerToken: string;

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("MEMB", 4);
  admin = (await login(S.admin.mobile)).token;
  owner = await addUser(S.society.id, "OWNER", { name: "Anita Deshpande", unitId: S.units[0]!.id });
  ownerToken = (await login(owner.mobile)).token;
});

const sid = () => S.society.id;
/** A calendar date `days` from today, so the tests don't age. */
const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe("membership", () => {
  it("allows one primary owner per unit at a time, and ceasing keeps history", async () => {
    const unitId = S.units[0]!.id;
    const first = await call(api.members.addMembership, { params: { societyId: sid(), unitId }, body: { person: { name: "Anita Deshpande", mobile: owner.mobile }, kind: "PRIMARY", admissionDate: "2019-03-01" } }, admin);
    expect(first.status).toBe(200);
    expect(first.body.data.person.userId).toBe(owner.user.id);

    const second = await call(api.members.addMembership, { params: { societyId: sid(), unitId }, body: { person: { name: "Someone Else" }, kind: "PRIMARY", admissionDate: "2020-01-01" } }, admin);
    expect(second.body.error.code).toBe("BUSINESS_RULE_VIOLATION");

    const co = await call(api.members.addMembership, { params: { societyId: sid(), unitId }, body: { person: { name: "Rajesh Deshpande" }, kind: "CO_OWNER", admissionDate: "2019-03-01" } }, admin);
    expect(co.status).toBe(200);

    const ceased = await call(api.members.ceaseMembership, { params: { societyId: sid(), membershipId: co.body.data.id }, body: { cessationDate: "2025-01-01", reason: "Gifted share" } }, admin);
    expect(ceased.body.data.cessationDate).toBe("2025-01-01");
    const overview = await call(api.members.unitOverview, { params: { societyId: sid(), unitId } }, admin);
    expect(overview.body.data.currentMembers).toHaveLength(1);
    expect(overview.body.data.pastMembers[0].person.name).toBe("Rajesh Deshpande");
  });

  it("the database itself refuses a second current primary owner", async () => {
    const unitId = S.units[0]!.id;
    const p = await prisma.person.create({ data: { societyId: sid(), name: "Direct Insert" } });
    await expect(
      prisma.membership.create({ data: { societyId: sid(), unitId, personId: p.id, kind: "PRIMARY", admissionDate: new Date("2021-01-01") } }),
    ).rejects.toThrow();
  });
});

describe("tenancy and occupancy", () => {
  it("a tenancy makes the unit TENANTED; ending it vacates the unit and suspends the tenant's login", async () => {
    const unitId = S.units[1]!.id;
    const tenantMobile = mobile();
    const t = await call(
      api.members.createTenancy,
      { params: { societyId: sid(), unitId }, body: { tenant: { name: "Vikram Sethi", mobile: tenantMobile }, startDate: day(-200), endDate: day(400), monthlyRentPaise: 3_800_000, billPayer: "TENANT", createLogin: true } },
      admin,
    );
    expect(t.status).toBe(200);
    expect(t.body.data.monthlyRentPaise).toBe(3_800_000);
    let o = await call(api.members.unitOverview, { params: { societyId: sid(), unitId } }, admin);
    expect(o.body.data.occupancy.status).toBe("TENANTED");
    expect(o.body.data.activeTenancy.tenant.name).toBe("Vikram Sethi");
    expect(o.body.data.appUsers[0]).toMatchObject({ name: "Vikram Sethi", userType: "TENANT", status: "INVITED" });
    const tenanted = await call(api.structure.units, { params: { societyId: sid() }, query: { occupancy: "TENANTED" } }, admin);
    expect(tenanted.body.data.total).toBe(1);
    expect(tenanted.body.data.items[0]).toMatchObject({ id: unitId, tenantName: "Vikram Sethi", occupancySince: day(-200) });

    const dup = await call(api.members.createTenancy, { params: { societyId: sid(), unitId }, body: { tenant: { name: "Second" }, startDate: day(-10), endDate: day(300) } }, admin);
    expect(dup.body.error.code).toBe("BUSINESS_RULE_VIOLATION");

    const ended = await call(api.members.endTenancy, { params: { societyId: sid(), tenancyId: t.body.data.id }, body: { endedOn: day(-1) } }, admin);
    expect(ended.body.data.active).toBe(false);
    o = await call(api.members.unitOverview, { params: { societyId: sid(), unitId } }, admin);
    expect(o.body.data.occupancy.status).toBe("VACANT");
    expect(o.body.data.occupancyHistory.map((x: { status: string }) => x.status)).toEqual(["VACANT", "TENANTED"]);
    expect(o.body.data.appUsers[0].status).toBe("SUSPENDED");
  });

  it("an owner's tenant goes to the approvals queue and is applied on approval", async () => {
    const unitId = S.units[0]!.id;
    const req = await call(api.members.createTenancy, { params: { societyId: sid(), unitId }, body: { tenant: { name: "Rohan Mehta" }, startDate: day(-5), endDate: day(360) } }, ownerToken);
    expect(req.body.data.approvalId).toBeTruthy();
    const queue = await call(api.members.approvals, { params: { societyId: sid() } }, admin);
    const item = queue.body.data.items.find((a: { id: string }) => a.id === req.body.data.approvalId);
    expect(item).toMatchObject({ kind: "TENANT_ADD", requestedByName: "Anita Deshpande", unitLabel: "A-101" });
    const decided = await call(api.members.decideApproval, { params: { societyId: sid(), approvalId: item.id }, body: { decision: "APPROVED" } }, admin);
    expect(decided.body.data.status).toBe("APPROVED");
    const o = await call(api.members.unitOverview, { params: { societyId: sid(), unitId } }, admin);
    expect(o.body.data.activeTenancy.tenant.name).toBe("Rohan Mehta");
    // Deciding twice is refused.
    const again = await call(api.members.decideApproval, { params: { societyId: sid(), approvalId: item.id }, body: { decision: "REJECTED" } }, admin);
    expect(again.body.error.code).toBe("CONFLICT");
    const home = await call(api.members.myHome, { params: { societyId: sid() } }, ownerToken);
    expect(home.body.data.recentDecisions.map((a: { id: string }) => a.id)).toContain(item.id);
  });
});

describe("household", () => {
  it("a resident's additions need approval; an admin's apply at once", async () => {
    const unitId = S.units[0]!.id;
    const byOwner = await call(api.members.addFamily, { params: { societyId: sid(), unitId }, body: { name: "Ira Deshpande", relation: "Child" } }, ownerToken);
    expect(byOwner.body.data.approvalId).toBeTruthy();
    const home = await call(api.members.myHome, { params: { societyId: sid() } }, ownerToken);
    expect(home.body.data.pendingApprovals.map((a: { summary: string }) => a.summary)).toContain("Family: Ira Deshpande (Child)");

    const byAdmin = await call(api.members.addVehicle, { params: { societyId: sid(), unitId }, body: { plate: "mh 12 kj 4471", type: "CAR", make: "Honda City" } }, admin);
    expect(byAdmin.body.data.plate).toBe("MH12KJ4471");
    const dup = await call(api.members.addVehicle, { params: { societyId: sid(), unitId: S.units[2]!.id }, body: { plate: "MH12KJ4471", type: "CAR" } }, admin);
    expect(dup.body.error.code).toBe("CONFLICT");
  });

  it("a resident can't see or change another unit", async () => {
    const other = S.units[3]!.id;
    expect((await call(api.members.unitOverview, { params: { societyId: sid(), unitId: other } }, ownerToken)).status).toBe(403);
    expect((await call(api.members.addPet, { params: { societyId: sid(), unitId: other }, body: { name: "Bruno", species: "Dog" } }, ownerToken)).status).toBe(403);
  });

  it("the gate's plate lookup returns the unit and never a phone number", async () => {
    const g = await addUser(sid(), "GUARD");
    const { token } = await login(g.mobile);
    const r = await call(api.members.vehicles, { params: { societyId: sid() }, query: { plate: "4471" } }, token);
    expect(r.body.data.items[0]).toMatchObject({ plate: "MH12KJ4471", unitLabel: "A-101" });
    expect(JSON.stringify(r.body)).not.toMatch(/\b[6-9]\d{9}\b/);
  });

  it("nominee shares must total 100% and only the member or office may set them", async () => {
    const m = await prisma.membership.findFirstOrThrow({ where: { unitId: S.units[0]!.id, kind: "PRIMARY", cessationDate: null } });
    const bad = await call(api.members.setNominees, { params: { societyId: sid(), membershipId: m.id }, body: { nominees: [{ name: "Ira", relation: "Child", shareBps: 6000 }] } }, ownerToken);
    expect(bad.body.error.code).toBe("VALIDATION_FAILED");
    const ok = await call(
      api.members.setNominees,
      { params: { societyId: sid(), membershipId: m.id }, body: { nominees: [{ name: "Ira", relation: "Child", shareBps: 6000 }, { name: "Rajesh", relation: "Spouse", shareBps: 4000 }] } },
      ownerToken,
    );
    expect(ok.body.data).toHaveLength(2);
  });
});

describe("structure", () => {
  it("lays out units by pattern and skips ones that exist", async () => {
    const b = await call(api.structure.createBuilding, { params: { societyId: sid() }, body: { name: "B", floorCount: 3, liftPresent: false } }, admin);
    const r = await call(api.structure.bulkCreateUnits, { params: { societyId: sid() }, body: { buildingId: b.body.data.id, fromFloor: 1, toFloor: 3, unitsPerFloor: 4, numberPattern: "{floor}{n}" } }, admin);
    expect(r.body.data.created).toBe(12);
    const again = await call(api.structure.bulkCreateUnits, { params: { societyId: sid() }, body: { buildingId: b.body.data.id, fromFloor: 1, toFloor: 1, unitsPerFloor: 4, numberPattern: "{floor}{n}" } }, admin);
    expect(again.body.data.created).toBe(0);
    expect(again.body.data.skipped).toHaveLength(4);
    const units = await call(api.structure.units, { params: { societyId: sid() }, query: { q: "B-2", limit: 50 } }, admin);
    expect(units.body.data.items.map((u: { label: string }) => u.label)).toEqual(["B-201", "B-202", "B-203", "B-204"]);
    // No lift in B: its units aren't lift-served (MASTER_SPEC B3.3).
    expect(units.body.data.items.every((u: { liftServed: boolean }) => !u.liftServed)).toBe(true);
  });

  it("imports units from CSV with a dry run first", async () => {
    const csv = "Building,Number,Floor,Carpet Area\nA,201,2,980\nA,202,2,abc\nZ,1,1,500\n";
    const dry = await call(api.structure.importUnits, { params: { societyId: sid() }, body: { format: "csv", contentBase64: Buffer.from(csv).toString("base64"), dryRun: true } }, admin);
    expect(dry.body.data.errors.map((e: { row: number }) => e.row)).toEqual([3, 4]);
    const commit = await call(api.structure.importUnits, { params: { societyId: sid() }, body: { format: "csv", contentBase64: Buffer.from(csv).toString("base64"), dryRun: false } }, admin);
    expect(commit.body.data.created).toBe(0); // all or nothing
    const good = "Building,Number,Floor,Carpet Area\nA,201,2,980\n";
    const ok = await call(api.structure.importUnits, { params: { societyId: sid() }, body: { format: "csv", contentBase64: Buffer.from(good).toString("base64"), dryRun: false } }, admin);
    expect(ok.body.data.created).toBe(1);
  });

  it("imports users from CSV", async () => {
    const csv = `name,mobile,unit,user_type\nPriya Patil,${mobile()},A-102,owner\nBad Row,123,A-102,owner\n`;
    const dry = await call(api.users.import, { params: { societyId: sid() }, body: { format: "csv", contentBase64: Buffer.from(csv).toString("base64"), dryRun: true } }, admin);
    expect(dry.body.data.valid).toBe(1);
    expect(dry.body.data.errors[0]).toMatchObject({ row: 3, field: "mobile" });
  });

  it("commits a clean user import in one transaction", async () => {
    const a = mobile();
    const b = mobile();
    const csv = `name,mobile,unit,user_type\nPriya Patil,${a},A-102,owner\nSneha Shinde,${b},A-103,tenant\n`;
    const r = await call(api.users.import, { params: { societyId: sid() }, body: { format: "csv", contentBase64: Buffer.from(csv).toString("base64"), dryRun: false } }, admin);
    expect(r.body.data).toMatchObject({ created: 2, errors: [] });
    const users = await call(api.users.list, { params: { societyId: sid() }, query: { q: "Sneha" } }, admin);
    expect(users.body.data.items[0]).toMatchObject({ userType: "TENANT", unitLabel: "A-103", status: "INVITED" });
  });
});
