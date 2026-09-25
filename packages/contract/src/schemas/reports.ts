import { z } from "zod";
import { Id, IsoDate, Paise } from "./common";

export const Dashboard = z.object({
  asOf: IsoDate,
  units: z.number().int(),
  billedThisMonthPaise: Paise,
  collectedThisMonthPaise: Paise,
  billedFyPaise: Paise,
  collectedFyPaise: Paise,
  collectionEfficiencyBps: z.number().int().nullable(),
  outstandingPaise: Paise,
  /** Overdue balances by days past due; `notYetDue` is billed but inside its due date. */
  ageing: z.object({ notYetDue: Paise, d0_30: Paise, d31_60: Paise, d61_90: Paise, d90plus: Paise }),
  /** The last six months, oldest first, for the billed-vs-collected chart. */
  monthly: z.array(z.object({ month: z.string(), billedPaise: Paise, collectedPaise: Paise })),
  topDefaulters: z.array(z.object({ unitId: Id, unitLabel: z.string(), ownerName: z.string().nullable(), duePaise: Paise, oldestDueDate: IsoDate })),
  occupancy: z.record(z.string(), z.number().int()),
  pendingApprovals: z.number().int(),
  activeUsers: z.number().int(),
  invitedUsers: z.number().int(),
  noticesThisMonth: z.number().int(),
});

export const REPORT_TYPES = ["COLLECTIONS", "DEFAULTERS", "BILL_REGISTER", "RECEIPT_REGISTER", "MEMBER_LEDGER", "OCCUPANCY", "TENANT_REGISTER", "NOTICE_DELIVERY"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const ReportParams = z.object({
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  unitId: Id.optional(),
  noticeId: Id.optional(),
});

export const ReportData = z.object({
  type: z.enum(REPORT_TYPES),
  title: z.string(),
  subtitle: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string(), kind: z.enum(["text", "money", "date", "number"]) })),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  totals: z.record(z.string(), z.number()).nullable(),
});

export const EmailReportBody = ReportParams.extend({ format: z.enum(["xlsx", "csv"]).default("xlsx") });
export const EmailReportResult = z.object({ queued: z.literal(true), to: z.string() });
