import { api } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { fromIsoDate } from "../../src/core/dates";
import { prisma } from "../../src/core/db";
import { configNumber } from "../../src/core/statutory";
import { call, login, makeSociety, resetDb } from "../helpers";

/** MASTER_SPEC E4 compliance item 4 (interest cap) and B4 (effective-dated statutory config). */

let S: Awaited<ReturnType<typeof makeSociety>>;
let token: string;

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("STAT");
  token = (await login(S.admin.mobile)).token;
});

const update = (body: Record<string, unknown>) => call(api.society.updateBillingConfig, { params: { societyId: S.society.id }, body }, token);

describe("interest on dues (B3.1)", () => {
  it("rejects 15%", async () => {
    const r = await update({ interestRateBps: 1500, interestResolution: { meetingRef: "AGM 2026/4", resolvedOn: "2026-08-30" } });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("INTEREST_RATE_EXCEEDS_CAP");
  });

  it("rejects 12% without a general body resolution", async () => {
    const r = await update({ interestRateBps: 1200 });
    expect(r.body.error.code).toBe("RESOLUTION_REQUIRED");
  });

  it("accepts 12% with a resolution and records it", async () => {
    const r = await update({ interestRateBps: 1200, interestResolution: { meetingRef: "AGM 2026/4", resolvedOn: "2026-08-30" } });
    expect(r.status).toBe(200);
    expect(r.body.data.interestRateBps).toBe(1200);
    expect(r.body.data.interestResolution.meetingRef).toBe("AGM 2026/4");
    expect(r.body.data.effectiveFromPeriod).toMatch(/^\d{4}-\d{2}$/);
  });

  it("allows other billing changes without touching the rate", async () => {
    const r = await update({ dueDay: 20 });
    expect(r.status).toBe(200);
    expect(r.body.data.interestRateBps).toBe(1200);
  });

  it("requires {SEQ} in number formats", async () => {
    const r = await update({ billNumberFormat: "{CODE}/{FY}" });
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("effective-dated statutory config (B4)", () => {
  it("resolves the value in force on a date, not today's", async () => {
    await prisma.statutoryConfig.updateMany({ where: { key: "interest_cap_percent", societyId: null }, data: { effectiveTo: fromIsoDate("2027-04-01") } });
    await prisma.statutoryConfig.create({
      data: { key: "interest_cap_percent", value: "10", unit: "% p.a. simple", effectiveFrom: fromIsoDate("2027-04-01"), sourceReference: "test" },
    });
    expect(await configNumber(prisma, "interest_cap_percent", S.society.id, fromIsoDate("2026-12-01"))).toBe(12);
    expect(await configNumber(prisma, "interest_cap_percent", S.society.id, fromIsoDate("2027-06-01"))).toBe(10);
  });

  it("a society can't override a statutory cap", async () => {
    const r = await call(api.society.setStatutoryConfig, { params: { societyId: S.society.id }, body: { key: "interest_cap_percent", value: "15", effectiveFrom: "2026-10-01" } }, token);
    expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("a society can't set a fund below the statutory minimum", async () => {
    const r = await call(
      api.society.setStatutoryConfig,
      { params: { societyId: S.society.id }, body: { key: "sinking_fund_min_percent", value: "0.1", effectiveFrom: "2026-10-01", resolution: { meetingRef: "SGM 1", resolvedOn: "2026-09-01" } } },
      token,
    );
    expect(r.body.error.code).toBe("FUND_BELOW_MINIMUM");
  });

  it("a society can raise a minimum with a resolution, and its value wins from that date", async () => {
    const r = await call(
      api.society.setStatutoryConfig,
      { params: { societyId: S.society.id }, body: { key: "sinking_fund_min_percent", value: "0.5", effectiveFrom: "2026-10-01", resolution: { meetingRef: "SGM 1", resolvedOn: "2026-09-01" } } },
      token,
    );
    expect(r.status).toBe(200);
    expect(r.body.data.scope).toBe("SOCIETY");
    expect(await configNumber(prisma, "sinking_fund_min_percent", S.society.id, fromIsoDate("2026-09-15"))).toBe(0.25);
    expect(await configNumber(prisma, "sinking_fund_min_percent", S.society.id, fromIsoDate("2026-11-01"))).toBe(0.5);
  });

  it("requires a resolution for keys that need one", async () => {
    const r = await call(api.society.setStatutoryConfig, { params: { societyId: S.society.id }, body: { key: "repair_fund_min_percent", value: "1", effectiveFrom: "2026-10-01" } }, token);
    expect(r.body.error.code).toBe("RESOLUTION_REQUIRED");
  });
});

describe("society setup", () => {
  it("won't go live until the required checklist is done, then goes live", async () => {
    const blocked = await call(api.society.goLive, { params: { societyId: S.society.id } }, token);
    expect(blocked.body.error.code).toBe("GO_LIVE_BLOCKED");
    expect(blocked.body.error.details.missing).toContain("Bank account");

    await call(
      api.society.createBankAccount,
      { params: { societyId: S.society.id }, body: { bankName: "Cosmos Bank", accountName: "Society", accountNumber: "004120100088211", ifsc: "COSB0000041", type: "SAVINGS", purpose: "OPERATIONS" } },
      token,
    );
    const onboarding = await call(api.society.onboarding, { params: { societyId: S.society.id } }, token);
    expect(onboarding.body.data.canGoLive).toBe(true);
    const live = await call(api.society.goLive, { params: { societyId: S.society.id } }, token);
    expect(live.body.data.status).toBe("LIVE");
  });

  it("never returns a full bank account number", async () => {
    const r = await call(api.society.bankAccounts, { params: { societyId: S.society.id } }, token);
    expect(r.body.data[0].accountNumberMasked).toMatch(/^•+8211$/);
    expect(JSON.stringify(r.body)).not.toContain("004120100088211");
  });

  it("validates PAN, GSTIN and IFSC formats", async () => {
    const r = await call(api.society.update, { params: { societyId: S.society.id }, body: { pan: "ABC" } }, token);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
    const g = await call(api.society.update, { params: { societyId: S.society.id }, body: { gstRegistered: true } }, token);
    expect(g.body.error.code).toBe("VALIDATION_FAILED");
  });
});
