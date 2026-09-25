import { randomUUID } from "node:crypto";
import { api, flattenApi } from "@chs/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { call, login, makeSociety, resetDb } from "../helpers";

/**
 * MASTER_SPEC E4 compliance item 5 — cross-tenant isolation on every endpoint.
 *
 * Walks the contract, so an endpoint added later is covered without anyone
 * remembering to add a test: a full admin of society A calls every
 * society-scoped endpoint with society B's id and must be refused before the
 * handler runs, whatever the other parameters are.
 */

const societyEndpoints = flattenApi(api as never).filter((e) => e.access.kind === "society");

let A: Awaited<ReturnType<typeof makeSociety>>;
let B: Awaited<ReturnType<typeof makeSociety>>;
let tokenA: string;

beforeAll(async () => {
  await resetDb();
  A = await makeSociety("ISOA");
  B = await makeSociety("ISOB");
  tokenA = (await login(A.admin.mobile)).token;
});

describe("cross-tenant isolation", () => {
  it("covers a meaningful number of endpoints", () => {
    expect(societyEndpoints.length).toBeGreaterThan(50);
  });

  it.each(societyEndpoints.map((e) => [e.id, e] as const))("%s refuses another society's admin", async (_id, endpoint) => {
    const params: Record<string, string> = {};
    for (const [, name] of endpoint.path.matchAll(/:([A-Za-z0-9_]+)/g)) {
      // Real ids from B where they exist, so a leak would actually return B's data.
      params[name!] =
        name === "societyId" ? B.society.id : name === "unitId" ? B.units[0]!.id : name === "userId" ? B.admin.societyUser.id : name === "code" ? "OWNER" : randomUUID();
    }
    const res = await call(endpoint, { params, body: endpoint.body ? {} : undefined }, tokenA);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SOCIETY_ACCESS_DENIED");
  });

  it("A's own data is reachable, so the refusals above aren't a blanket failure", async () => {
    const res = await call(api.structure.units, { params: { societyId: A.society.id } }, tokenA);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((u: { id: string }) => u.id)).not.toContain(B.units[0]!.id);
  });

  it("ids from another society are not found even inside your own society's path", async () => {
    const res = await call(api.structure.updateUnit, { params: { societyId: A.society.id, unitId: B.units[0]!.id }, body: { floor: 2 } }, tokenA);
    expect(res.status).toBe(404);
  });
});
