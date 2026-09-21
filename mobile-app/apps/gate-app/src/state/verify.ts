import { visitorPasses, type VerifyResult } from "@sahaj/shared";

/**
 * Looks a 4-digit code up against the live passes (the same seed the resident app
 * issues codes from — README.md's cross-product example). A pass already marked
 * "expired"/"cancelled", or one whose `validUntil` has quietly slipped into the past
 * since it was seeded, verifies as Expired rather than Valid — this check is run
 * fresh every time rather than trusting a stored flag.
 */
export function verifyCode(code: string): VerifyResult {
  const pass = visitorPasses.find((p) => p.code === code) ?? null;
  if (!pass) return { type: "unknown", pass: null };

  const expiredByState = pass.state === "expired" || pass.state === "cancelled";
  const expiredByTime = !!pass.validUntil && new Date(pass.validUntil).getTime() < Date.now();

  return { type: expiredByState || expiredByTime ? "expired" : "valid", pass };
}
