# Workers and background jobs

Anything slow or unreliable runs outside the request that caused it: sending
push and email, repeating housekeeping, scheduled reports.

## The queue

The queue lives in [backend/src/core/queue.ts](../../backend/src/core/queue.ts) and runs in one of two modes:

| | With `REDIS_URL` | Without it (development, tests) |
|---|---|---|
| Backend | BullMQ, a queue named `chs` | In-process `setTimeout` |
| Durability | Survives restarts | Lost on restart |
| Across instances | Shared; repeating jobs are scheduled once cluster-wide | Every instance runs its own |
| Retries | Exponential backoff from 5 s, `attempts` per job | Same policy, in process |
| Kept | Completed 24 h (max 5,000); failed 14 days | — |

Code never branches on the mode. You define a job once and enqueue it:

```ts
const deliver = defineJob<{ deliveryId: string }>("notify.push", async ({ deliveryId }, { attempt }) => { … }, { attempts: 5 });
await deliver.enqueue({ deliveryId }, { delayMs, jobId });
```

A handler runs inside a system request context, so audit rows and events
work as they do in a request. Its events and after-commit tasks are
published only after the handler returns successfully. A job that throws is
retried, and one that returns is done.

Every job is **idempotent**, because queues retry and schedules drift. Each
one either checks the state it's about to change (for example "already
SENT? return"), or uses a unique `jobId` (for example
`daily:<society>:<user>:<date>`) so BullMQ won't enqueue it twice.

**Worker processes.** Every API instance also runs the worker, with
concurrency 5. To separate them, run extra instances with `RUN_JOBS=false`
for HTTP only, and keep at least one instance with jobs on.

## Jobs

| Job | Triggered by | Does | Attempts |
|---|---|---|---|
| `notify.push` | `notify()` for each push delivery | Sends to all of a person's registered phones in one FCM multicast. Deletes dead tokens and records the outcome. Retries only transient failures (quota, FCM unavailable, network). | 5 |
| `notify.email` | `notify()` for each email delivery | Renders the HTML email and sends it over SMTP | 6 |
| `messaging.deliver` | `sendMessage()` (temporary passwords, tenancy reminders) | Delivers an `outbound_messages` row: email via SMTP; SMS and WhatsApp via the provider port, which only logs today | 6 |
| `reports.email` | `POST …/reports/:type/email`, the digests | Runs the report, builds Excel or CSV, and emails it as an attachment | 4 |
| `members.tenancy-expiry` | every 6 h | Reminds the owner and tenant T-30 (configurable) before a tenancy ends. Once it has ended, ends it, vacates the unit, and suspends the tenant's access (MASTER_SPEC C3). | 5 |
| `payments.expire-checkouts` | every 10 min | Cancels online checkouts left unfinished for 30 min | 5 |
| `reports.daily-collections-tick` | hourly | At 20:00 IST, enqueues `reports.daily-collections` | 5 |
| `reports.daily-collections` | the tick | For each live society with collections today, emails the day's collections to people holding `payments.record` or `accounts.manage` | 5 |
| `reports.weekly-digest-tick` | hourly | At 08:00 IST, enqueues `reports.weekly-digest` | 5 |
| `reports.weekly-digest` | the tick (Mondays only) | Emails defaulters plus last week's collections to administrators | 5 |
| `system.cleanup` | hourly | Deletes sessions expired over 7 days ago, idempotency keys older than 1 day, login attempts older than 30 days, and temporary passwords expired over 30 days ago | 5 |

The schedule lives in [backend/src/jobs/index.ts](../../backend/src/jobs/index.ts), and the handlers sit
in the module that owns the data:
- [notify.ts](../../backend/src/modules/notifications/notify.ts)
- [messaging.ts](../../backend/src/core/messaging.ts)
- [reports.service.ts](../../backend/src/modules/reports/reports.service.ts)
- [payments.service.ts](../../backend/src/modules/payments/payments.service.ts)

Scheduled reports go only to people who have an email and haven't turned off
REPORT email.

## After-commit work

Some work must happen only once a database change is committed, and never
for a change that rolled back. Notifying residents about published bills is
one example. Services call:

```ts
notifyLater({ … });                                 // notifications
afterCommit(async () => { … });                     // anything else
```

These calls are queued on the request context. The HTTP binding (or the job
runner) starts them after the handler succeeds, and drops them if it throws.

## Adding a job

1. `defineJob` in the module that owns the data, with a narrow payload (ids, not rows).
2. Make it idempotent: check the current state, or pass a unique `jobId`.
3. If it repeats, add a `repeat(name, everyMs)` line to `jobs/index.ts`. For a
   specific time of day, use an hourly tick that checks the IST hour, as the
   digests do.
4. Test it by calling the handler's effect directly, or enqueue it and poll for the state change.
