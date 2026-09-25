import { endpoint } from "../define";
import { Ok, Page } from "../schemas/common";
import * as N from "../schemas/notifications";
import { inSociety, sp } from "./_shared";

export const notices = {
  list: endpoint({
    method: "GET",
    path: sp("/notices"),
    summary: "All notices with delivery stats (committee view)",
    access: inSociety("notices.publish"),
    query: N.NoticeListQuery,
    response: Page(N.Notice),
  }),
  feed: endpoint({
    method: "GET",
    path: sp("/my/notices"),
    summary: "Notices sent to me — pinned first, newest next",
    access: inSociety(),
    surface: "common",
    query: N.NoticeListQuery,
    response: Page(N.Notice),
  }),
  get: endpoint({ method: "GET", path: sp("/notices/:noticeId"), summary: "One notice", access: inSociety(), surface: "common", response: N.Notice }),
  create: endpoint({
    method: "POST",
    path: sp("/notices"),
    summary: "Draft a notice",
    access: inSociety("notices.publish"),
    body: N.NoticeInput,
    response: N.Notice,
    invalidates: ["notices.list"],
  }),
  update: endpoint({
    method: "PATCH",
    path: sp("/notices/:noticeId"),
    summary: "Edit a draft (published notices are immutable)",
    access: inSociety("notices.publish"),
    body: N.NoticeInput.partial(),
    response: N.Notice,
    invalidates: ["notices.list", "notices.get"],
  }),
  publish: endpoint({
    method: "POST",
    path: sp("/notices/:noticeId/publish"),
    summary: "Publish: fixes the recipient list and sends push/email",
    access: inSociety("notices.publish"),
    response: N.Notice,
    invalidates: ["notices.list", "notices.get", "notices.feed"],
  }),
  discard: endpoint({
    method: "DELETE",
    path: sp("/notices/:noticeId"),
    summary: "Delete a draft",
    access: inSociety("notices.publish"),
    response: Ok,
    invalidates: ["notices.list"],
  }),
  markRead: endpoint({
    method: "POST",
    path: sp("/notices/:noticeId/read"),
    summary: "Record that I opened it",
    access: inSociety(),
    surface: "common",
    response: Ok,
    invalidates: ["notices.feed", "notices.get"],
  }),
  acknowledge: endpoint({
    method: "POST",
    path: sp("/notices/:noticeId/acknowledge"),
    summary: "“I have read this” — the proof of service",
    access: inSociety(),
    surface: "common",
    response: N.Notice,
    invalidates: ["notices.feed", "notices.get"],
  }),
  report: endpoint({
    method: "GET",
    path: sp("/notices/:noticeId/report"),
    summary: "Delivery and acknowledgement report, per recipient",
    access: inSociety("notices.publish"),
    response: N.NoticeReport,
  }),
};
