import { endpoint } from "../define";
import * as R from "../schemas/reports";
import { inSociety, sp } from "./_shared";

export const reports = {
  dashboard: endpoint({
    method: "GET",
    path: sp("/dashboard"),
    summary: "Committee dashboard: billed vs collected, ageing, defaulters, occupancy",
    access: inSociety(["reports.view", "billing.generate", "payments.record", "accounts.manage", "society.configure"]),
    response: R.Dashboard,
  }),
  get: endpoint({
    method: "GET",
    path: sp("/reports/:type"),
    summary: "Run a report and return its rows",
    access: inSociety(["reports.view", "billing.generate", "payments.record", "accounts.manage", "notices.publish", "members.manage"]),
    query: R.ReportParams,
    response: R.ReportData,
  }),
  email: endpoint({
    method: "POST",
    path: sp("/reports/:type/email"),
    summary: "Email a report to me as Excel or CSV (needs an email on my account)",
    access: inSociety(["reports.view", "billing.generate", "payments.record", "accounts.manage", "notices.publish", "members.manage"]),
    rateLimit: "sensitive",
    body: R.EmailReportBody,
    response: R.EmailReportResult,
  }),
};
