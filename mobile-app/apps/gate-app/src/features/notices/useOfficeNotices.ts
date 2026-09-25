import { useEffect, type RefObject } from "react";
import { api, type NoticeRecord as Notice } from "@chs/contract";
import { useApiInfiniteQuery } from "@chs/api-client/react";
import { useGuard } from "../../api/guard";
import { useGate } from "../../state/GateProvider";

/**
 * The office's notices to this guard — `notices.feed`, pinned first, newest
 * next. One cached query shared by the shell (tab badge) and the notices
 * screen; realtime `notices.changed` refetches it, so nothing polls.
 */
export function useOfficeNotices() {
  const { societyId } = useGuard();
  const feed = useApiInfiniteQuery(api.notices.feed, { params: { societyId }, query: { limit: 30 } });
  return { feed, unread: feed.items.filter(isUnread).length };
}

/**
 * Announces a notice that arrives mid-shift with a toast. Mounted once, by the
 * shell. The feed is where a notice's category is known, so an emergency is
 * shown in stop red as an urgent toast. A foreground push for a notice only
 * refetches the feed (SignedInHandset), so the toast comes from here and the
 * two never double up.
 *
 * `seen` is owned by SignedInHandset, which outlives the shell: the shell
 * unmounts while the handset is locked, and a notice that arrived meanwhile must
 * still be announced when it remounts on unlock.
 */
export function useNoticeArrivals(seen: RefObject<Set<string> | null>) {
  const { actions } = useGate();
  const { feed, unread } = useOfficeNotices();

  useEffect(() => {
    if (feed.status !== "success") return;
    // The first load of the session is what was already waiting; only later arrivals are news.
    if (seen.current === null) {
      seen.current = new Set(feed.items.map((n) => n.id));
      return;
    }
    for (const n of feed.items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (!isUnread(n)) continue;
      const emergency = n.category === "EMERGENCY";
      actions.toast(`${emergency ? "Emergency" : "From the office"}: ${n.title}`, emergency ? "bad" : "ok", { urgent: emergency });
    }
  }, [feed.items, feed.status, actions, seen]);

  return { unread };
}

export function isUnread(n: Notice): boolean {
  return n.mine !== null && !n.mine.read;
}

export function needsAck(n: Notice): boolean {
  return n.ackRequired && n.mine !== null && !n.mine.acknowledged;
}

export const NOTICE_CATEGORY_LABEL: Record<Notice["category"], string> = {
  GENERAL: "General",
  MAINTENANCE_SHUTDOWN: "Maintenance",
  WATER: "Water",
  MEETING: "Meeting",
  EMERGENCY: "Emergency",
  CIRCULAR: "Circular",
  FINANCIAL: "Accounts",
  FACILITY: "Facility",
};
