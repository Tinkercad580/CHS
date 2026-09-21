import type { DailyHelp, AttendanceSheet, AttendanceState } from "../types/common";
import { FOCUS_UNIT_OWNER } from "./society";

const MON_FRI: DailyHelp["days"] = [true, true, true, true, true, false, false];
const ALL_WEEK: DailyHelp["days"] = [true, true, true, true, true, true, false];

export const dailyHelp: DailyHelp[] = [
  { passNo: "ST-1101", unit: FOCUS_UNIT_OWNER, name: "Lakshmi Bai", role: "Housekeeping", days: ALL_WEEK, window: "Twice daily", monthlySalary: 4500, perDayRate: Math.round(4500 / 26) },
  { passNo: "ST-1102", unit: FOCUS_UNIT_OWNER, name: "Ganesh Pawar", role: "Driver", days: ALL_WEEK, window: "Full day", monthlySalary: 12000, perDayRate: Math.round(12000 / 26) },
  { passNo: "ST-1103", unit: FOCUS_UNIT_OWNER, name: "Savita More", role: "Cook", days: MON_FRI, window: "Twice daily", monthlySalary: 7000, perDayRate: Math.round(7000 / 26) },
];

const codeToState = (n: number): AttendanceState => (n === 1 ? "present" : n === 0 ? "absent" : n === 2 ? "off" : "unrecorded");

/** 1 = present, 0 = absent, 2 = weekly off, 3 = not yet recorded — same 30-day pattern the prototype seeds. */
const RAW: Record<string, number[]> = {
  "ST-1101": [1, 1, 1, 1, 1, 0, 2, 1, 1, 1, 1, 1, 0, 2, 1, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 2, 1, 1],
  "ST-1102": [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 2, 1, 1],
  "ST-1103": [1, 1, 0, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 2, 1, 0],
};

export const attendanceSheets: AttendanceSheet[] = Object.entries(RAW).map(([personId, days]) => ({
  personId,
  days: days.map(codeToState),
}));
