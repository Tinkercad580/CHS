import { api, type NoticeRecord } from "@chs/contract";
import { useApiQuery } from "@chs/api-client/react";
import { useSocietyId } from "./billing";

/**
 * Society notices as the API sends them to this resident — pinned first, then
 * newest. Home's "Latest notice" and the Notices tab read the same query, so
 * opening one never fetches twice; `notices.changed` refetches it.
 */

export type Notice = NoticeRecord;

export function useNoticeFeed() {
  const societyId = useSocietyId();
  return useApiQuery(api.notices.feed, { params: { societyId }, query: { limit: 50 } }, { enabled: societyId !== "" });
}

/** The design's four notice tags. */
export type NoticeTag = "AGM" | "Urgent" | "Facility" | "Billing" | "General";

const TAG_BY_CATEGORY: Record<Notice["category"], NoticeTag> = {
  MEETING: "AGM",
  WATER: "Urgent",
  MAINTENANCE_SHUTDOWN: "Urgent",
  EMERGENCY: "Urgent",
  FACILITY: "Facility",
  FINANCIAL: "Billing",
  CIRCULAR: "General",
  GENERAL: "General",
};

export function noticeTag(notice: Notice): NoticeTag {
  return TAG_BY_CATEGORY[notice.category] ?? "General";
}

/** Tag colours — Urgent reads as bad, AGM as info, the rest quiet (the design's TAG_STYLE). */
export function noticeTagTone(tag: NoticeTag): "bad" | "info" | "subtle" {
  return tag === "Urgent" ? "bad" : tag === "AGM" ? "info" : "subtle";
}

/** A notice has no summary field; the card shows its first paragraph, cut at a sentence where it can be. */
export function noticeBlurb(body: string, max = 120): string {
  const first = body.split(/\n\s*\n/)[0]?.trim() ?? "";
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const stop = cut.lastIndexOf(". ");
  return stop > 40 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

export function noticeParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isUnread(notice: Notice): boolean {
  return notice.mine !== null && !notice.mine.read;
}
