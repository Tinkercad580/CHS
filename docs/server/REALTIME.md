# Realtime

The apps stay current without polling. When something changes, the server
pushes an event over a websocket, and the client refetches exactly the reads
that event names.

- Server: [backend/src/core/realtime.ts](../../backend/src/core/realtime.ts)
- Events: [packages/contract/src/events.ts](../../packages/contract/src/events.ts)
- Client: [packages/api-client/src/realtime.ts](../../packages/api-client/src/realtime.ts), plus `RealtimeSync` in
  [react.tsx](../../packages/api-client/src/react.tsx)

## Connection

- Socket.io runs at path `/realtime` on the API port. Nginx proxies it with the
  websocket upgrade in production.
- The handshake sends the **access token** in `auth.token`. The server
  verifies it, checks that the session is live and the token version
  matches, and refuses the connection otherwise.
- The server joins the socket to rooms taken from the database; clients never
  pick rooms:

| Room | Who's in it |
|---|---|
| `user:<userId>` | every socket of that person |
| `session:<sessionId>` | this one device |
| `society:<societyId>` | every active member of the society |
| `society:<societyId>:admins` | the society's ADMIN-role members |
| `unit:<unitId>` | the unit's access users, owners and current tenant |

Rooms are computed when the socket connects. The client reconnects with a
fresh token after sign-in and after any disconnect, which picks up new
memberships.

## Events

A service raises an event, and the event says who should get it:

```ts
events.emit({ name: "billing.changed", to: { admins: societyId, unit: unitId }, payload: { unitId } });
```

Inside a request, the event is buffered and published only after the handler
succeeds, so a rolled-back change never announces itself. Each event type
lists the reads it makes stale:

| Event | Sent when | Invalidates |
|---|---|---|
| `session.revoked` | a session or all sessions are revoked | `me.sessions`; `sessionId: null` also signs the client out |
| `account.suspended` | a membership is suspended | `me.get` |
| `me.changed` | profile, role or permissions changed | `me.get` |
| `users.changed` | a user is added, edited, locked, activated… | user lists and records |
| `society.changed` | profile, settings, billing config | society reads |
| `structure.changed` | buildings, units, parking | structure reads |
| `members.changed` | memberships, occupancy, tenancy, household | member reads, my home |
| `approvals.changed` | a request is raised or decided | approvals, my home |
| `banks.changed` | bank accounts | bank accounts, onboarding |
| `notifications.changed` | a notification is created or read | inbox, unread count |
| `notices.changed` | a notice is published, read or acknowledged | notice lists, feed, report |
| `billing.changed` | a run is published, a bill cancelled, a credit note issued | bills, dues, ledger, dashboard |
| `payments.changed` | a payment succeeds, fails or is reversed | payments, dues, bills, dashboard |

The authoritative mapping from each event to the reads it invalidates is in
[docs/api/ENDPOINTS.md](../api/ENDPOINTS.md#realtime-events).

## Client behaviour

Inside `ApiProvider`, `RealtimeSync`:
- connects when the session is `signedIn`, and disconnects otherwise;
- on every event, invalidates the React Query keys the event lists;
- on `session.revoked` with `sessionId: null`, signs the client out;
- on `me.changed` and `account.suspended`, refreshes `useMe()`;
- after a reconnect, invalidates everything on screen, because events may
  have been missed while offline.

Screens never subscribe to events by hand.

## Scaling

With `REDIS_URL` set, the `@socket.io/redis-adapter` delivers an event raised
on one instance to sockets connected to any instance. Without Redis,
realtime works on a single instance only.

When a session is revoked, its sockets are told and then disconnected
within about 250 ms.
