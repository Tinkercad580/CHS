import { endpoint } from "../define";
import { Id, Ok, Page } from "../schemas/common";
import * as N from "../schemas/notifications";
import { z } from "zod";

/** The caller's own inbox, devices and preferences. Not society-scoped: one inbox across societies. */
export const notifications = {
  registerDevice: endpoint({
    method: "POST",
    path: "/me/devices",
    summary: "Register this phone for push (resident and gate apps)",
    access: { kind: "authenticated" },
    body: N.RegisterDeviceBody,
    response: Ok,
    invalidates: ["notifications.preferences"],
  }),
  unregisterDevice: endpoint({
    method: "POST",
    path: "/me/devices/unregister",
    summary: "Stop push to this phone (call on sign-out)",
    access: { kind: "authenticated" },
    allowRestricted: true,
    body: N.UnregisterDeviceBody,
    response: Ok,
    invalidates: ["notifications.preferences"],
  }),
  list: endpoint({
    method: "GET",
    path: "/me/notifications",
    summary: "Inbox, newest first",
    access: { kind: "authenticated" },
    query: N.NotificationListQuery,
    response: Page(N.Notification),
  }),
  unreadCount: endpoint({ method: "GET", path: "/me/notifications/unread-count", summary: "Unread badge", access: { kind: "authenticated" }, response: N.UnreadCount }),
  markRead: endpoint({
    method: "POST",
    path: "/me/notifications/:notificationId/read",
    summary: "Mark one as read",
    access: { kind: "authenticated" },
    response: Ok,
    invalidates: ["notifications.list", "notifications.unreadCount"],
  }),
  markAllRead: endpoint({
    method: "POST",
    path: "/me/notifications/read-all",
    summary: "Mark all as read",
    access: { kind: "authenticated" },
    body: z.object({ societyId: Id.optional() }),
    response: Ok,
    invalidates: ["notifications.list", "notifications.unreadCount"],
  }),
  preferences: endpoint({
    method: "GET",
    path: "/me/notification-preferences",
    summary: "Per-category push and email choices, whether an email is on file, and registered phones",
    access: { kind: "authenticated" },
    response: N.NotificationPreferences,
  }),
  updatePreferences: endpoint({
    method: "PUT",
    path: "/me/notification-preferences",
    summary: "Change push and email choices (emergency and account notices stay on)",
    access: { kind: "authenticated" },
    body: N.UpdatePreferencesBody,
    response: N.NotificationPreferences,
    invalidates: ["notifications.preferences"],
  }),
  test: endpoint({
    method: "POST",
    path: "/me/notifications/test",
    summary: "Send yourself a test push and email — checks the Firebase and SMTP setup end to end",
    access: { kind: "authenticated" },
    rateLimit: "sensitive",
    response: N.TestNotificationResult,
    invalidates: ["notifications.list", "notifications.unreadCount"],
  }),
};
