import { api, flattenApi, REALTIME_EVENTS } from "@chs/contract";
import { describe, expect, it } from "vitest";
import { base32Encode, decrypt, encrypt, generateTempPassword, totpCode, verifyTotp } from "../../src/core/crypto";
import { financialYear, fromIsoDate } from "../../src/core/dates";
import { buildOpenApi } from "../../src/core/http/openapi";
import { applyBps, formatInr, fromWire, toWire } from "../../src/core/money";
import { formatNumber } from "../../src/core/numbering";

describe("money", () => {
  it("applies basis points with half-away-from-zero rounding", () => {
    expect(applyBps(10_000n, 1200)).toBe(1_200n);
    expect(applyBps(1n, 5000)).toBe(1n); // 0.5 → 1
    expect(applyBps(-1n, 5000)).toBe(-1n);
    expect(applyBps(3n, 3333)).toBe(1n); // 0.9999 → 1
    expect(applyBps(123_457n, 25)).toBe(309n); // 308.6425
  });

  it("formats with Indian digit grouping", () => {
    expect(formatInr(1_23_45_678_90n)).toBe("₹1,23,45,678.90");
    expect(formatInr(5n)).toBe("₹0.05");
    expect(formatInr(-1_000_00n)).toBe("-₹1,000.00");
  });

  it("refuses fractional or unsafe amounts at the wire boundary", () => {
    expect(() => fromWire(10.5)).toThrow();
    expect(() => toWire(2n ** 60n)).toThrow();
    expect(fromWire(null)).toBeNull();
  });
});

describe("crypto", () => {
  it("computes RFC 6238 TOTP test vectors", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(verifyTotp(secret, "287083", 59_000)).toBe(false);
  });

  it("round-trips field encryption and detects tampering", () => {
    const sealed = encrypt("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decrypt(sealed)).toBe("JBSWY3DPEHPK3PXP");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("generates temporary passwords that pass the policy and avoid look-alikes", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(10);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("dates and numbering", () => {
  it("labels financial years from April", () => {
    expect(financialYear(fromIsoDate("2026-03-31"))).toBe("2025-26");
    expect(financialYear(fromIsoDate("2026-04-01"))).toBe("2026-27");
  });

  it("renders bill numbers", () => {
    expect(formatNumber("{CODE}/{FY}/{SEQ}", { code: "SVCHS", fy: "2026-27", seq: 42 })).toBe("SVCHS/2026-27/000042");
  });
});

describe("contract", () => {
  it("gives every endpoint a unique id and method+path", () => {
    const all = flattenApi(api as never);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(new Set(all.map((e) => `${e.method} ${e.path}`)).size).toBe(all.length);
    for (const e of all) expect(e.id).toMatch(/^[a-z]+\.[A-Za-z]+$/);
  });

  it("only invalidates endpoints that exist", () => {
    const ids = new Set(flattenApi(api as never).map((e) => e.id));
    for (const e of flattenApi(api as never)) for (const i of e.invalidates ?? []) expect(ids, `${e.id} → ${i}`).toContain(i);
  });

  it("realtime events only invalidate endpoints that exist", () => {
    const ids = new Set(flattenApi(api as never).map((e) => e.id));
    for (const [name, def] of Object.entries(REALTIME_EVENTS)) for (const i of def.invalidates) expect(ids, `${name} → ${i}`).toContain(i);
  });

  it("builds an OpenAPI document covering every endpoint", () => {
    const doc = buildOpenApi() as { paths: Record<string, Record<string, unknown>> };
    const ops = Object.values(doc.paths).flatMap((p) => Object.keys(p));
    expect(ops.length).toBe(flattenApi(api as never).length);
  });
});
