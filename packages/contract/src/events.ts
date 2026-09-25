import { z } from "zod";

/**
 * Realtime events pushed over the socket. Each names the cached reads it
 * makes stale, so a client's `useRealtimeSync()` refetches exactly those and
 * nothing else — no screen subscribes to events by hand to stay current.
 *
 * Rooms: `society:<id>` (everyone active there), `society:<id>:admins`,
 * `user:<id>` (all of one person's sessions), `unit:<id>` (its occupants).
 */
export const REALTIME_EVENTS = {
  "session.revoked": {
    payload: z.object({ sessionId: z.string().nullable(), reason: z.string() }),
    invalidates: ["me.sessions"],
  },
  "account.suspended": {
    payload: z.object({ societyId: z.string(), reason: z.string() }),
    invalidates: ["me.get"],
  },
  "me.changed": { payload: z.object({}), invalidates: ["me.get"] },
  "users.changed": {
    payload: z.object({ userId: z.string().nullable() }),
    invalidates: ["users.list", "users.get", "users.sessions", "users.authEvents"],
  },
  "society.changed": {
    payload: z.object({}),
    invalidates: ["society.get", "society.settings", "society.onboarding", "society.billingConfig", "me.get"],
  },
  "structure.changed": {
    payload: z.object({ unitId: z.string().nullable() }),
    invalidates: ["structure.buildings", "structure.units", "structure.parking", "society.onboarding", "members.unitOverview"],
  },
  "members.changed": {
    payload: z.object({ unitId: z.string().nullable() }),
    invalidates: ["members.list", "members.unitOverview", "members.vehicles", "members.myHome", "members.directory", "structure.units"],
  },
  "approvals.changed": {
    payload: z.object({ approvalId: z.string(), status: z.string() }),
    invalidates: ["members.approvals", "members.myHome"],
  },
  "banks.changed": { payload: z.object({}), invalidates: ["society.bankAccounts", "society.onboarding"] },
  "notifications.changed": { payload: z.object({ unread: z.number().int().nullable() }), invalidates: ["notifications.list", "notifications.unreadCount"] },
  "notices.changed": { payload: z.object({ noticeId: z.string() }), invalidates: ["notices.list", "notices.feed", "notices.get", "notices.report"] },
  "billing.changed": {
    payload: z.object({ unitId: z.string().nullable() }),
    invalidates: ["billing.runs", "billing.run", "billing.bills", "billing.bill", "billing.ledger", "billing.myDues", "billing.myBills", "reports.dashboard"],
  },
  "payments.changed": {
    payload: z.object({ paymentId: z.string(), status: z.string() }),
    invalidates: ["payments.mine", "payments.get", "payments.list", "billing.myDues", "billing.myBills", "billing.bills", "billing.ledger", "reports.dashboard"],
  },
} as const;

export type RealtimeEventName = keyof typeof REALTIME_EVENTS;
export type RealtimePayload<N extends RealtimeEventName> = z.infer<(typeof REALTIME_EVENTS)[N]["payload"]>;

export const REALTIME_PATH = "/realtime";
