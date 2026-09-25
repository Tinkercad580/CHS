import { useApiQuery } from "@chs/api-client/react";
import { api } from "@chs/contract";

/**
 * Where a notification's `data.route` leads in the console. The server
 * writes routes for the resident app ("/bills/<id>", "/notices/<id>",
 * "/payments/<id>"); the console has the same records under its own paths.
 * A route the console has no screen for (the resident app's own inbox) opens
 * nothing — the drawer just marks it read.
 */
export function consoleRoute(data: Record<string, string>): string | null {
  const route = data.route ?? "";
  const m = /^\/(notices|bills|payments)\/([0-9a-f-]{36})$/i.exec(route);
  if (m) return m[1] === "notices" ? `/notices/record/${m[2]}` : m[1] === "bills" ? `/billing/bills/${m[2]}` : `/payments/record/${m[2]}`;
  if (route === "/approvals" || route.startsWith("/approvals/")) return "/members/approvals";
  if (data.noticeId) return `/notices/record/${data.noticeId}`;
  if (data.billId) return `/billing/bills/${data.billId}`;
  if (data.paymentId) return `/payments/record/${data.paymentId}`;
  return null;
}

/** The unread badge on the bell. One small read, refreshed by `notifications.changed`. */
export function useUnreadCount(): number {
  const q = useApiQuery(api.notifications.unreadCount);
  return q.data?.unread ?? 0;
}
