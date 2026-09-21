import type { HouseholdMember } from "../types/common";
import { FOCUS_UNIT_OWNER, FOCUS_UNIT_TENANT } from "./society";

export const household: HouseholdMember[] = [
  { id: "h1", unit: FOCUS_UNIT_OWNER, name: "Anita Deshpande", relation: "Self" },
  { id: "h2", unit: FOCUS_UNIT_OWNER, name: "Rajesh Deshpande", relation: "Spouse" },
  { id: "h3", unit: FOCUS_UNIT_OWNER, name: "Ira Deshpande", relation: "Child" },
  { id: "h4", unit: FOCUS_UNIT_TENANT, name: "Vikram Sethi", relation: "Self" },
];

/** Which household-member id is "you" for the signed-in resident, per unit — drives "You" chip + who can't be removed. */
export const selfMemberId: Record<string, string> = {
  [FOCUS_UNIT_OWNER]: "h1",
  [FOCUS_UNIT_TENANT]: "h4",
};
