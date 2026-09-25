import { useCallback } from "react";
import { api, type AppNotification, type NotificationPreferences } from "@chs/contract";
import { useApi, useApiQuery } from "@chs/api-client/react";
import { useResident } from "../state/ResidentProvider";
import { useSocietyId } from "./billing";
import { heldUnits } from "./identity";

/**
 * The notification inbox, its unread badge and the per-category preferences.
 * These are the account's, not the society's: one inbox across societies.
 * `notifications.changed` refetches all three.
 */

export type { AppNotification, NotificationPreferences };
export type NotificationCategory = AppNotification["category"];

export function useUnreadCount() {
  return useApiQuery(api.notifications.unreadCount);
}

export function useNotificationPreferences() {
  return useApiQuery(api.notifications.preferences);
}

/**
 * The feed's three icon tones: warn for emergencies and money that went wrong,
 * ok for money received, info for the rest. A payment notification says how it
 * went in `data.status` ("SUCCESS" or "FAILED", payments.service.ts); one with
 * no status is shown as information rather than guessed at.
 */
export function notificationTone(n: AppNotification): "warn" | "ok" | "info" {
  if (n.category === "EMERGENCY") return "warn";
  if (n.category === "PAYMENT") return n.data.status === "FAILED" ? "warn" : n.data.status === "SUCCESS" ? "ok" : "info";
  return "info";
}

/**
 * The preference screen's rows. The design groups by what a resident recognises
 * rather than by the API's eight categories, so "Bills and receipts" is two of
 * them. Emergencies and account security can't be switched off (MASTER_SPEC C11).
 */
export const PREFERENCE_ROWS: { key: string; label: string; detail: string; categories: NotificationCategory[] }[] = [
  { key: "notices", label: "Society notices", detail: "Anything the committee posts", categories: ["NOTICE"] },
  { key: "bills", label: "Bills and receipts", detail: "New bills, payment confirmations", categories: ["BILLING", "PAYMENT"] },
  { key: "approvals", label: "Requests and approvals", detail: "Household, tenancy and vehicle requests", categories: ["APPROVAL"] },
  { key: "reports", label: "Statements and reports", detail: "Accounts and reports the office sends", categories: ["REPORT"] },
  { key: "general", label: "Other updates", detail: "Everything else from the society", categories: ["GENERAL"] },
  { key: "emergency", label: "Emergencies", detail: "Fire, security, water and power alerts", categories: ["EMERGENCY"] },
  { key: "account", label: "Account and security", detail: "Sign-ins and password changes", categories: ["ACCOUNT"] },
];

/**
 * Opens the screen a notification points at. The server's `data.route` is one of
 * `/bills/<id>`, `/payments/<id>`, `/notices/<id>` or `/notifications`; anything
 * else lands on the inbox rather than nowhere. A payment has no screen of its
 * own, so it opens the statement of its flat, where its receipt is listed.
 */
export function useOpenRoute() {
  const { state, actions } = useResident();
  const client = useApi();
  const societyId = useSocietyId();
  const identity = state.identity;

  return useCallback(
    (route: string) => {
      const [, kind, id] = route.split("/");
      if (kind === "bills" && id) return actions.openBill(id);
      if (kind === "notices" && id) return actions.openNotice(id);
      if (kind === "payments" && id) {
        void client
          .call(api.payments.get, { params: { societyId, paymentId: id } })
          .then((p) => {
            if (heldUnits(identity).includes(p.unitLabel)) actions.setUnit(p.unitLabel);
          })
          .catch(() => undefined)
          .finally(() => actions.goStatement());
        return;
      }
      if (state.screen !== "notifs") actions.goNotifs();
    },
    [actions, client, societyId, identity, state.screen]
  );
}
