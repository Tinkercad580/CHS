import type { VisitorPass } from "../types/common";
import { FOCUS_UNIT_OWNER, FOCUS_UNIT_TENANT } from "./society";

/**
 * Shared visitor-pass seed. Both apps read the same list so a resident's
 * issued code and the gate's "expected passes" list describe one event,
 * not two — see README.md's cross-product example.
 */
export const visitorPasses: VisitorPass[] = [
  {
    id: "pass-1",
    code: "4821",
    kind: "guest",
    unit: FOCUS_UNIT_OWNER,
    name: "Rohan Deshpande",
    purpose: "Guest",
    state: "expected",
    issuedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    validUntil: new Date(Date.now() + 90 * 60_000).toISOString(),
  },
  {
    id: "pass-2",
    code: "7093",
    kind: "guest",
    unit: FOCUS_UNIT_TENANT,
    name: "Swiggy",
    purpose: "Delivery",
    state: "expected",
    issuedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    validUntil: new Date(Date.now() + 25 * 60_000).toISOString(),
  },
  {
    id: "pass-3",
    code: "1187",
    kind: "guest",
    unit: FOCUS_UNIT_OWNER,
    name: "Uber",
    purpose: "Cab",
    state: "expired",
    issuedAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    validUntil: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
  {
    id: "pass-4",
    code: "5502",
    kind: "standing",
    unit: FOCUS_UNIT_OWNER,
    name: "Sunita Kamble",
    purpose: "Service",
    state: "standing",
    issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
  },
];
