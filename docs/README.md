# Documentation

Start with **[ARCHITECTURE.md](ARCHITECTURE.md)**, then read whatever the
task in front of you needs. The product specification is
[../MASTER_SPEC.md](../MASTER_SPEC.md).

## Getting going
| | |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Set up, run everything locally, demo accounts |
| [../scripts/README.md](../scripts/README.md) | The dev scripts, ports, and the `/mnt/e` file-watching caveat |
| [TESTING.md](TESTING.md) | Test suites, what they cover, how to write one |

## System
| | |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | The whole system on one page: repo shape, contract-first API, request path, auth, tenancy, realtime, jobs, billing, money |
| [server/SERVER.md](server/SERVER.md) | The API server: start-up, request pipeline, errors, logging, rate limits, **configuration reference** |
| [server/WORKERS_AND_JOBS.md](server/WORKERS_AND_JOBS.md) | The queue, every background job and schedule, after-commit work |
| [server/REALTIME.md](server/REALTIME.md) | Socket.io: rooms, events, client behaviour, scaling |
| [DATABASE.md](DATABASE.md) | Data model, conventions, database-enforced rules, numbering, migrations, seed |
| [database/TABLES.md](database/TABLES.md) | Every table and column (generated) |
| [API.md](API.md) | Wire conventions, using the API from an app, adding an endpoint |
| [api/ENDPOINTS.md](api/ENDPOINTS.md) | Every endpoint, access rule, inputs, cache effects, realtime events (generated) |
| [packages.md](packages.md) | `@chs/contract` and `@chs/api-client` |
| [SECURITY.md](SECURITY.md) | Accounts, sessions, authorisation, tenancy, data protection, known gaps |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Containers, nginx, CI, deployment, backups, what's not set up yet |
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | **Firebase push and SMTP email setup**, scheduled reports |
| [LOADING_AND_MOTION.md](LOADING_AND_MOTION.md) | How every screen loads, and motion rules |

## Modules (backend features)
| | |
|---|---|
| [modules/auth.md](modules/auth.md) | Sign-in states, tokens, sessions, 2FA, temporary passwords |
| [modules/users-and-access.md](modules/users-and-access.md) | Roles, permissions, templates, provisioning rules, import |
| [modules/society-and-structure.md](modules/society-and-structure.md) | Society profile, settings, go-live, billing config, banks, statutory config, buildings, units, parking |
| [modules/members.md](modules/members.md) | Owners, occupancy, tenancies, household, approvals, unit 360, directory |
| [modules/notices-and-notifications.md](modules/notices-and-notifications.md) | Inbox, push, email, preferences; notices, audiences, proof of service |
| [modules/billing.md](modules/billing.md) | Charge heads and Rule 106C-12, the engine, interest, GST, runs, corrections, ledger, dues |
| [modules/payments.md](modules/payments.md) | Confirmation path, allocation, channels, the dummy gateway, cancellation |
| [modules/reports-and-platform.md](modules/reports-and-platform.md) | Dashboard, report library, emailed reports, the platform console, health |

## Flows (end to end)
| | |
|---|---|
| [flows/sign-in.md](flows/sign-in.md) | Every sign-in path |
| [flows/onboarding-a-society.md](flows/onboarding-a-society.md) | From nothing to a live society |
| [flows/monthly-billing.md](flows/monthly-billing.md) | Generate, check, publish, notify |
| [flows/paying-dues.md](flows/paying-dues.md) | Online, cash, cheque, cancellation |
| [flows/publishing-a-notice.md](flows/publishing-a-notice.md) | Compose, publish, deliver, acknowledge, report |
| [flows/tenancy-lifecycle.md](flows/tenancy-lifecycle.md) | Tenant in, reminders, tenant out |
| [flows/resident-requests.md](flows/resident-requests.md) | Resident asks, office decides |

## Apps
| | |
|---|---|
| [apps/admin-web.md](apps/admin-web.md) | Admin console |
| [apps/resident-app.md](apps/resident-app.md) | Resident app |
| [apps/gate-app.md](apps/gate-app.md) | Gate app |

## Decisions and compliance
| | |
|---|---|
| [adr/](adr/) | Architecture decision records |
| [compliance/RULES_REGISTER.md](compliance/RULES_REGISTER.md) | Every statutory rule, its value, source and verification status |
| [compliance/SOURCES.md](compliance/SOURCES.md), [compliance/CHANGELOG_COMPLIANCE.md](compliance/CHANGELOG_COMPLIANCE.md) | Primary sources; rule changes over time |
