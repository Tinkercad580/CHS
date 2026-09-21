import type { TenantAgreement } from "../types/common";
import { FOCUS_UNIT_LET_OUT } from "./society";

/** The owner-and-tenant role's own tenancy history for the let-out unit — an active agreement plus one that has ended. */
export const tenantAgreements: TenantAgreement[] = [
  {
    unit: FOCUS_UNIT_LET_OUT,
    tenantName: "Rohan and Priya Mehta",
    startDate: "2025-04-01",
    endDate: "2027-03-31",
    monthlyRent: 42000,
    policeVerified: true,
    nonOccupancyCharge: 485,
  },
  {
    unit: FOCUS_UNIT_LET_OUT,
    tenantName: "Ankit Bansal",
    startDate: "2023-04-01",
    endDate: "2025-03-31",
    monthlyRent: 36000,
    policeVerified: true,
    nonOccupancyCharge: 485,
  },
];
