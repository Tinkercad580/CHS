import type { Permission } from "@chs/contract";

/** What each Billing screen reads, from the contract's access rules (billing.runs, billing.bills, billing.heads). */
export const RUNS_PERMS: Permission[] = ["billing.generate", "billing.publish"];
export const BILLS_PERMS: Permission[] = ["billing.generate", "billing.publish", "payments.record", "accounts.manage"];
export const HEADS_PERMS: Permission[] = ["billing.generate", "billing.publish", "society.configure"];
