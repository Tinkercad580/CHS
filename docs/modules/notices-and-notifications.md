# Notices and notifications

**Spec:** MASTER_SPEC C11. **Code:** [modules/notifications/](../../backend/src/modules/notifications),
[core/push.ts](../../backend/src/core/push.ts), [core/mail.ts](../../backend/src/core/mail.ts).
**Endpoints:** `notifications.*` (the caller's own), `notices.*` (society).
**Setup of Firebase and SMTP:** [../NOTIFICATIONS.md](../NOTIFICATIONS.md).

## Notifications

`notify({ societyId, userIds, category, title, body, data, channels?, urgent?, email? })`
in [notify.ts](../../backend/src/modules/notifications/notify.ts) is the one way the
system tells anyone anything. For each recipient it:

1. **Writes an inbox row** in `notifications`, always. `data.route` is the screen
   a tap opens (`/bills/<id>`, `/payments/<id>`, `/notices/<id>`, `/notifications`).
2. **Queues a push delivery** if the person has a resident or gate phone
   registered and wants push for this category.
3. **Queues an email delivery** if they have an email and want email for this category.
4. **Emits `notifications.changed`** to them over realtime, which updates the unread badge.

The deliveries are recorded in `notification_deliveries` (QUEUED → SENT /
FAILED / SKIPPED) and sent by the `notify.push` and `notify.email` jobs.

| Category | Sent for | Default push / email | Can switch off |
|---|---|---|---|
| BILLING | a bill run is published, a supplementary bill | on / on | yes |
| PAYMENT | a payment succeeded or failed | on / on | yes |
| NOTICE | a notice is published | on / on | yes |
| EMERGENCY | an EMERGENCY notice | on / on | **no** |
| ACCOUNT | account security, test sends | on / on | **no** |
| APPROVAL | (reserved for request decisions) | on / on | yes |
| REPORT | scheduled reports | off / on | yes |
| GENERAL | other | on / on | yes |

**Quiet hours:** push waits until the society's quiet hours end (default
22:00–07:00 IST), unless the notification is urgent. Email isn't held.

**Push details:**
- Firebase Admin SDK multicast reaches up to 10 of a person's phones in one call.
- Data carries `notificationId`, `category`, `societyId`, `route` and `unread`.
- `badge` is the unread count, and pushes about the same bill or notice collapse into one.
- Urgent pushes are high priority, go to the `emergency` Android channel, and are time-sensitive on iOS.
- The time-to-live is a day, or an hour for urgent ones.
- Dead tokens are deleted; transient failures are retried.

**Email details:**
- One table-based HTML layout plus a text version, from the same text.
- The subject and an action button can be overridden per notification.

### Endpoints for the person

| Endpoint | Does |
|---|---|
| `notifications.registerDevice { token, app: resident\|gate, platform, deviceName }` | Upsert by token. A token moves to whoever signed in last on that phone. |
| `notifications.unregisterDevice { token }` | Called on sign-out; works with a restricted token too |
| `notifications.list` (`unread`, `societyId`, cursor) | The inbox, newest first, with a total |
| `notifications.unreadCount`, `markRead`, `markAllRead` | The badge and reading |
| `notifications.preferences` | Push and email per category, `hasEmail` (the apps prompt to add one when false), registered phones |
| `notifications.updatePreferences` | Mandatory categories stay on |
| `notifications.test` | Sends yourself a test. Reports whether push reached a phone and whether email went out. |

## Notices

A notice is the committee's formal communication. Once published it's a
**record**, and it can't be edited or deleted.

**Lifecycle:** DRAFT → PUBLISHED → (SUPERSEDED by a correction).

| Step | Endpoint | Rules |
|---|---|---|
| Draft | `notices.create` / `update` / `discard` | Title, body, category (GENERAL, MAINTENANCE_SHUTDOWN, WATER, MEETING, EMERGENCY, CIRCULAR, FINANCIAL, FACILITY), audience, channels (push, email), ack required, pinned, expiry. EMERGENCY needs an `emergencyReason`, which is logged. Only drafts can be edited or deleted. |
| Publish | `notices.publish` | The audience is resolved **once** into `notice_recipients`, which is the proof of service. The row is locked, so publishing twice isn't possible. Refused if nobody matches. Delivery happens after commit. |
| Correct | `create` with `supersedesId` → publish | The old notice becomes SUPERSEDED and points to the new one |
| Read | `notices.markRead` | First open; also marks the matching inbox item read |
| Acknowledge | `notices.acknowledge` | Only when `ackRequired`; audited |
| Report | `notices.report` | Per recipient: name, unit, push status, email status, read at, acknowledged at, plus totals. Also as the NOTICE_DELIVERY report (Excel/CSV). |

**Audiences:**

| Audience | Matches |
|---|---|
| `ALL` | Every active login in the society |
| `OWNERS` | Anyone who owns a unit, or has user type OWNER or CO_OWNER |
| `TENANTS` | Anyone renting, or with user type TENANT |
| `RESIDENTS` | Anyone linked to a unit, except guards and staff |
| `STAFF` | Guards and staff |
| `ADMINS` | ADMIN-role members |
| `BUILDINGS` | Anyone linked to a unit in the listed buildings, through their access unit, ownership or tenancy |
| `UNITS` | Anyone linked to the listed units, the same way |

Guards never receive FINANCIAL notices, whatever the audience. Only people
with a login can receive a notice; owners with no app account aren't
recipients.

**Reading:**
- `notices.list` is the committee view, with read and acknowledgement stats.
- `notices.feed` is the recipient's view: pinned first, then newest, with
  expired notices dropped. It's surface `common`, so guards can read notices
  addressed to them.
