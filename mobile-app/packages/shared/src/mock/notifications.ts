import type { AppNotification, NotificationPreference } from "../types/common";

export const notifications: AppNotification[] = [
  { id: "f1", kind: "warn", title: "Water supply off Thursday", body: "Main pump replacement, 10am to 4pm.", when: "2 hours ago", unread: true },
  { id: "f2", kind: "info", title: "Rohan Deshpande is expected at 7:00pm", body: "Gate code 4821 was sent to their phone.", when: "5 hours ago", unread: true },
  { id: "f3", kind: "ok", title: "Ticket TKT-2274 was resolved", body: "Corridor light on the 12th floor was replaced.", when: "4 days ago", unread: false },
  { id: "f4", kind: "info", title: "September bills are out", body: "₹6,050 payable by 17 September.", when: "11 days ago", unread: false },
];

export const notificationPreferences: NotificationPreference[] = [
  { key: "notices", label: "Society notices", detail: "Anything the committee posts", on: true },
  { key: "bills", label: "Bills and receipts", detail: "New bills, payment confirmations", on: true },
  { key: "visitors", label: "Visitor arrivals", detail: "When the gate lets a guest in", on: true },
  { key: "tickets", label: "Ticket updates", detail: "Replies and status changes", on: false },
];
