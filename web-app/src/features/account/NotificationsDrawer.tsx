import { useNavigate } from "react-router-dom";
import { useApiInfiniteQuery, useApiMutation } from "@chs/api-client/react";
import { api, type AppNotification } from "@chs/contract";
import { useCurrentSociety } from "../../api/society";
import { RetryButton } from "../../components/Kit";
import { Skeleton } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import { formatWhen } from "../../lib/apiFormat";
import { useAdminStore } from "../../store/AdminStore";
import { consoleRoute, useUnreadCount } from "./notifications";

const DOT: Record<AppNotification["category"], string> = {
  EMERGENCY: "var(--bad,#C0342B)",
  BILLING: "var(--warn,#B45309)",
  PAYMENT: "var(--ok,#167A3C)",
  APPROVAL: "var(--info,#1D4ED8)",
  NOTICE: "var(--info,#1D4ED8)",
  REPORT: "var(--accent,#0E6B5C)",
  ACCOUNT: "var(--ink-soft,#5A6B66)",
  GENERAL: "var(--ink-soft,#5A6B66)",
};

/**
 * The bell's drawer: the admin's own inbox (`notifications.list`), newest
 * first, one page at a time. Opening an item marks it read (`markRead`) and
 * goes to its record when the console has one; "Mark all read" clears the
 * badge (`markAllRead`). The inbox is one per person across societies; an
 * item from another society the admin runs switches to it first.
 */
export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { dispatch } = useAdminStore();
  const { society, societies } = useCurrentSociety();
  const list = useApiInfiniteQuery(api.notifications.list, { query: { limit: 20 } });
  const unread = useUnreadCount();
  const markRead = useApiMutation(api.notifications.markRead);
  const markAll = useApiMutation(api.notifications.markAllRead);

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate({ params: { notificationId: n.id } });
    const to = consoleRoute(n.data);
    if (!to) return;
    if (n.societyId && n.societyId !== society?.societyId) {
      // A record in another society: only follow it if this admin runs that society too.
      if (!societies.some((s) => s.societyId === n.societyId)) return;
      dispatch({ type: "switchSociety", societyId: n.societyId });
    }
    onClose();
    navigate(to);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,26,23,.4)", display: "flex", justifyContent: "flex-end", animation: "veilIn .2s ease" }}>
      <div
        role="dialog"
        aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(400px,92vw)", height: "100%", background: "var(--surface,#fff)", boxShadow: "-16px 0 50px -20px rgba(15,26,23,.36)", display: "flex", flexDirection: "column", animation: "drawerIn .28s cubic-bezier(.2,.7,.3,1)" }}
      >
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, font: "700 17px/1.3 Figtree, sans-serif", letterSpacing: "-.015em" }}>
            Notifications
            {unread > 0 && <span style={{ marginLeft: 8, font: "500 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{unread} unread</span>}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate({ body: {} })}
              disabled={markAll.isPending}
              aria-busy={markAll.isPending || undefined}
              className="press-scale focus-ring"
              style={{ height: 30, padding: "0 10px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 8, background: "var(--surface,#fff)", font: "600 12px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: markAll.isPending ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {markAll.isPending && <Spinner size={11} />}
              Mark all read
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="focus-ring" style={{ width: 32, height: 32, border: 0, borderRadius: 9, background: "var(--canvas,#F7F9F8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft,#5A6B66)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {list.status === "pending" &&
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ padding: "14px 22px", borderBottom: "1px solid var(--border-soft,#F5F7F6)", display: "flex", gap: 12 }} aria-busy="true">
                <Skeleton width={8} height={8} radius={4} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  <Skeleton width="70%" height={13} />
                  <Skeleton width="90%" height={11} />
                  <Skeleton width={70} height={10} />
                </div>
              </div>
            ))}
          {list.status === "error" && (
            <div style={{ padding: "28px 22px", textAlign: "center" }}>
              <div style={{ font: "600 14px/1.4 Figtree, sans-serif", marginBottom: 4 }}>{list.error.message}</div>
              <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 14 }}>Your notifications could not be loaded.</div>
              <RetryButton onClick={() => void list.refetch()} />
            </div>
          )}
          {list.status === "success" && list.items.length === 0 && (
            <div style={{ padding: "40px 22px", textAlign: "center" }}>
              <div style={{ font: "600 14px/1.4 Figtree, sans-serif", marginBottom: 4 }}>Nothing yet</div>
              <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Approvals waiting for you, digests and notices sent to you appear here.</div>
            </div>
          )}
          {list.items.map((n) => {
            const to = consoleRoute(n.data);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className="row-hover focus-row"
                style={{ width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--border-soft,#F5F7F6)", background: n.read ? "transparent" : "var(--accent-wash,#E6F2EF)", padding: "14px 22px", display: "flex", gap: 12, cursor: to || !n.read ? "pointer" : "default", color: "inherit" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", marginTop: 6, background: DOT[n.category], opacity: n.read ? 0.45 : 1 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: `${n.read ? 500 : 600} 13.5px/1.4 Figtree, sans-serif` }}>{n.title}</span>
                  <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 3, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{n.body}</span>
                  <span style={{ display: "block", marginTop: 5, font: "500 11px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                    {formatWhen(n.createdAt)}
                    {to ? " · Open" : ""}
                  </span>
                </span>
                {!n.read && <span aria-label="Unread" style={{ width: 7, height: 7, flex: "none", marginTop: 7, borderRadius: "50%", background: "var(--accent,#0E6B5C)" }} />}
              </button>
            );
          })}
          {list.hasNextPage && (
            <div style={{ padding: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => void list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                className="press-scale focus-ring"
                style={{ height: 34, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: list.isFetchingNextPage ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {list.isFetchingNextPage && <Spinner size={12} />}
                {list.isFetchingNextPage ? "Loading…" : "Show older"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
