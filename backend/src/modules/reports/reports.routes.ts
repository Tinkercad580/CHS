import { api, schemas } from "@chs/contract";
import { AppError } from "../../core/errors";
import { handle } from "../../core/http/bind";
import * as svc from "./reports.service";

const TYPES = new Set<string>(schemas.reports.REPORT_TYPES);
function reportType(t: string) {
  const type = t.toUpperCase().replaceAll("-", "_");
  if (!TYPES.has(type)) throw new AppError("NOT_FOUND", "No such report.");
  return type as (typeof schemas.reports.REPORT_TYPES)[number];
}

export const reportBindings = [
  handle(api.reports.dashboard, (_i, { society }) => svc.dashboard(society.societyId)),
  handle(api.reports.get, ({ params, query }, { society }) => svc.runReport(society.societyId, reportType(params.type), query)),
  handle(api.reports.email, ({ params, body }, { society, actor }) => svc.emailReport(society, actor.userId, reportType(params.type), body)),
];
