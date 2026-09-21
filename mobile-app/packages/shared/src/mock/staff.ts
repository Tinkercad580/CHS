import type { StaffMember, Guard } from "../types/common";
import { FOCUS_UNIT_OWNER } from "./society";

/** Shared staff/guard seed — the gate app's roster and the resident app's "daily help" reference the same people. */
export const staff: StaffMember[] = [
  {
    passNo: "ST-1001",
    name: "Sunita Kamble",
    role: "housekeeping",
    flatsServed: [FOCUS_UNIT_OWNER, "A-1203"],
    phone: "+91 98220 11223",
    policeVerified: true,
    monthlySalary: 5200,
    perDayRate: 217,
  },
  {
    passNo: "ST-1002",
    name: "Mahesh Jadhav",
    role: "gardener",
    flatsServed: [],
    phone: "+91 98230 44556",
    policeVerified: true,
    monthlySalary: 9000,
    perDayRate: 346,
  },
  {
    passNo: "ST-1003",
    name: "Vikram Singh",
    role: "plumber",
    flatsServed: [],
    phone: "+91 99870 33221",
    policeVerified: true,
    monthlySalary: 12000,
    perDayRate: 461,
  },
  {
    passNo: "ST-1004",
    name: "Anita Rao",
    role: "housekeeping",
    flatsServed: ["B-0702", "B-0701"],
    phone: "+91 98811 22990",
    policeVerified: false,
    monthlySalary: 5200,
    perDayRate: 217,
  },
];

export const guards: Guard[] = [
  { id: "guard-1", name: "Ramesh Yadav", dutyPin: "4291" },
  { id: "guard-2", name: "Suresh More", dutyPin: "7715" },
];
