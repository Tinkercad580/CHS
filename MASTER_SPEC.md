# MASTER_SPEC.md — Final Consolidated Specification
## Society, Building & Apartment Management Platform — Maharashtra

**Version:** 2.0 (final, supersedes all earlier documents)
**Date:** 07 Sep 2026
**Supersedes:** `SRS_CHS_Management_Platform.md`, `CHS_Development_Phase_Plan.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `V1_SCOPE.md`, `V2_BACKLOG.md`, `PRODUCT_MODES.md`

This is the single source of truth. It contains: the role model, authentication design, technology stack, repository structure, complete feature list, Maharashtra compliance rules, database design, API design, build phases from scratch to production, and the deferred backlog.

---

# PART A — FOUNDATIONAL DECISIONS

## A1. Role model — exactly two roles

| Role | Who | Access |
|---|---|---|
| **ADMIN** | Society committee (secretary, treasurer, chairman) or hired society manager | Full society control. Manages all access. |
| **USER** | Everyone else: flat owner, co-owner, family member, tenant, security guard, housekeeping staff, accountant/auditor | Only what the admin grants |

There is no third role. Every non-admin person is a **USER** whose visible modules are controlled by **admin-assigned permissions**.

### A1.1 How one role covers many kinds of people
Each user record carries a `user_type` label (for display and reporting only) and a set of **module permissions** the admin toggles:

| user_type | Typical permissions admin grants |
|---|---|
| `OWNER` | Bills, pay, ledger, helpdesk, visitor approval, notices, documents, requests, meetings, amenities |
| `CO_OWNER` | Same as owner, minus voting and sale NOC |
| `FAMILY` | Helpdesk, visitor approval, notices, amenities |
| `TENANT` | Bills (if bill-payer), helpdesk, visitor approval, notices, amenities. No voting, no society finance, no sale NOC |
| `GUARD` | Gate module only. No financial data, no resident phone numbers |
| `STAFF` | Assigned tasks and tickets, attendance. Nothing else |
| `ACCOUNTANT` | Accounting read/write as granted |
| `AUDITOR` | Accounting read-only, year-scoped |

Permission strings: `bills.view`, `payments.pay`, `ledger.view`, `helpdesk.create`, `helpdesk.resolve`, `gate.operate`, `visitor.approve`, `notices.view`, `documents.view`, `meetings.vote`, `amenities.book`, `requests.raise`, `accounts.view`, `accounts.edit`, `staff.attendance`, `reports.view`.

**Admin-side permissions** (a society may have several admins with different scope): `society.configure`, `members.manage`, `billing.generate`, `billing.publish`, `payments.record`, `accounts.manage`, `accounts.close`, `recovery.notice`, `helpdesk.manage`, `gate.manage`, `notices.publish`, `meetings.manage`, `documents.manage`, `requests.approve`, `compliance.manage`, `users.manage`, `audit.view`.

### A1.2 Honest note on this design
Collapsing to two roles keeps the product simple, and the permission layer covers the real cases. Two things to watch:
- **Legally, some actions belong to the general body, not the committee.** Setting the interest rate on dues and withdrawing from the sinking fund require a general body resolution. The system enforces this not by role but by requiring a **resolution reference** before the action saves. Keep that rule even with two roles.
- **Guards must be hard-restricted, not just permission-restricted.** A guard logs in on the gate app, which only ever calls gate endpoints. Even if a permission were mis-toggled, the app surface doesn't expose finance.

---

## A2. Authentication — admin-provisioned, password-based, no OTP

### A2.1 Design
1. **Admin adds the user first.** In the admin portal: name, **mobile number** (the login identifier), unit, user_type, permissions. Optionally email.
2. **User installs the app** (Play Store / App Store) or opens the web app, and enters their mobile number.
3. **System checks the number.**
   - **Found and no password set** → screen: "Create your password." User sets password, confirms, accepts terms, account activated, logged in.
   - **Found and password set** → screen: "Enter your password." Normal login.
   - **Not found** → screen: "Your number is not registered. Please contact your society office." Nothing else. No self-signup, no OTP, no way in.
4. **Forgot password.** The user has **no self-service reset**. They contact the admin. Admin opens the user record → "Generate temporary password" → system creates a random temporary password, shows it to the admin, and sends it to the user by SMS/WhatsApp/email. The user logs in with it and is **forced to set a new password before reaching any screen**.
5. **Change password** inside the app: current password → new → confirm. All other sessions are logged out.
6. **Admin login** is the same mechanism (mobile + password), with the first admin of a society provisioned by the platform super-admin. Admins additionally get optional TOTP two-factor.

### A2.2 Security requirements
- Passwords hashed with **argon2id** (fallback bcrypt cost 12). Never stored or logged in plain text.
- Policy: minimum 8 characters, at least one letter and one number, blocked common-password list, cannot equal the mobile number, cannot reuse the last 3 passwords.
- Temporary passwords: 10 characters, random, **single use, expire in 24 hours**, `must_change_password = true` forced on next login.
- Rate limiting: 5 failed attempts → account locked 15 minutes; 10 failures in an hour from one IP → IP throttled. Lockouts visible to the admin, who can unlock.
- Sessions: access JWT 15 minutes, rotating refresh token 30 days, device-bound, hashed at rest. "Logout all devices" available to the user and to the admin.
- Deactivation: admin can suspend a user instantly; all sessions revoked, history retained.
- Every auth event logged: login success, failure, lockout, password created, password changed, temporary password issued, session revoked.
- No password over any channel except the one-time temporary password, and that is flagged as such.

### A2.3 Screens required
**Web/app (user):** enter mobile → create password (first time) → login → forced change (after temporary) → change password → locked-out notice → not-registered notice.
**Admin portal:** user list, add user, edit permissions, generate temporary password, unlock account, suspend/reactivate, view sessions, view auth audit log.

### A2.4 What this design gives up, and the mitigation
No OTP means no SMS cost and no delivery failure at login — good. But it also means **the admin is the only recovery path**, so:
- Show the admin a clear, copyable temporary password and a one-tap "send via WhatsApp" action.
- Send the user a notification when a temporary password is issued, so a malicious reset is visible.
- Log every temporary-password issuance with which admin did it.
- Optional per-society setting (V2): allow email-based self-reset for users who have a verified email.

---

## A3. Technology stack

| Layer | Technology |
|---|---|
| Backend API | **Node.js + Express + TypeScript** |
| Database | PostgreSQL 16 |
| ORM / query | Prisma (or Knex + typed repositories) |
| Cache, queue | Redis + BullMQ |
| File storage | S3-compatible object storage (India region) |
| Web admin + web user portal | **React 18 + TypeScript + Vite**, React Router, TanStack Query, Tailwind |
| Mobile (user + guard + staff) | **React Native + TypeScript** (Play Store, App Store) |
| PDF generation | Puppeteer / Playwright HTML→PDF with templated HTML |
| Auth | JWT access + refresh, argon2id hashing |
| Notifications | FCM + APNs (push), WhatsApp Business API, DLT-registered SMS, SES/SendGrid email |
| Payments | Licensed payment aggregator (Razorpay / Cashfree) + bank virtual accounts |
| Realtime | Socket.io (gate visitor approval, ticket updates) |
| Testing | Jest + Supertest (API), Vitest + React Testing Library (web), Jest + RN Testing Library (mobile), Playwright (E2E) |
| Infrastructure | Docker, GitHub Actions CI, container hosting, managed Postgres and Redis |
| Observability | Sentry, structured logs (pino), health checks, uptime monitoring |

**Language rule:** TypeScript everywhere, `strict: true`. Plain JavaScript only in build config files.

---

## A4. Repository structure

```
society-platform/
├── README.md
├── MASTER_SPEC.md                    # this document
├── docker-compose.yml
├── package.json                      # workspaces root
├── tsconfig.base.json
├── .github/workflows/                # ci.yml, deploy-staging.yml, deploy-prod.yml
│
├── docs/
│   ├── adr/                          # architecture decision records
│   ├── api/                          # generated OpenAPI
│   └── compliance/
│       ├── RULES_REGISTER.md
│       ├── SOURCES.md
│       └── CHANGELOG_COMPLIANCE.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed/
│   │       ├── roles-permissions.seed.ts
│   │       ├── charge-heads.seed.ts
│   │       ├── chart-of-accounts.seed.ts
│   │       ├── statutory-config.seed.ts
│   │       ├── compliance-items.seed.ts
│   │       └── ticket-categories.seed.ts
│   ├── src/
│   │   ├── server.ts                 # express bootstrap
│   │   ├── app.ts                    # middleware chain, route mounting
│   │   ├── config/
│   │   │   ├── env.ts                # zod-validated environment
│   │   │   └── constants.ts
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── password.service.ts       # argon2, policy, history
│   │   │   │   ├── token.service.ts          # JWT issue/rotate/revoke
│   │   │   │   ├── temp-password.service.ts
│   │   │   │   ├── lockout.service.ts
│   │   │   │   └── auth.routes.ts
│   │   │   ├── authz/
│   │   │   │   ├── permissions.ts            # permission string constants
│   │   │   │   ├── require-permission.ts     # middleware
│   │   │   │   └── permission.service.ts
│   │   │   ├── tenancy/
│   │   │   │   ├── society-context.middleware.ts
│   │   │   │   └── scoped.repository.ts      # injects society_id, always
│   │   │   ├── audit/
│   │   │   │   ├── audit.middleware.ts
│   │   │   │   └── audit.service.ts
│   │   │   ├── money/
│   │   │   │   ├── money.ts                  # integer paise, no floats
│   │   │   │   └── rounding.ts
│   │   │   ├── statutory/
│   │   │   │   └── statutory-config.service.ts  # effective-dated lookups
│   │   │   ├── numbering/
│   │   │   │   └── series.service.ts         # gapless bill/receipt numbers
│   │   │   ├── events/
│   │   │   │   ├── event-bus.ts
│   │   │   │   └── events.ts
│   │   │   ├── queue/
│   │   │   │   └── queue.ts
│   │   │   ├── storage/
│   │   │   │   ├── storage.service.ts
│   │   │   │   └── virus-scan.ts
│   │   │   ├── pdf/
│   │   │   │   ├── pdf.service.ts
│   │   │   │   └── templates/                # bill, receipt, notice, NOC, minutes (EN + MR)
│   │   │   ├── i18n/
│   │   │   │   ├── en.json
│   │   │   │   └── mr.json
│   │   │   ├── errors/
│   │   │   │   ├── app-error.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── validation/
│   │   │   │   └── validate.ts               # zod request validation
│   │   │   └── db/
│   │   │       ├── prisma.ts
│   │   │       └── transaction.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── users/                        # admin-provisioned users, permissions
│   │   │   ├── society/                      # society master, settings, banks
│   │   │   ├── structure/                    # buildings, floors, units, parking
│   │   │   ├── members/                      # memberships, occupancy, tenancy, family, vehicles, pets
│   │   │   ├── billing/
│   │   │   ├── payments/
│   │   │   ├── accounting/
│   │   │   ├── recovery/
│   │   │   ├── helpdesk/
│   │   │   ├── gate/
│   │   │   ├── staff/
│   │   │   ├── notifications/
│   │   │   ├── notices/
│   │   │   ├── meetings/
│   │   │   ├── documents/
│   │   │   ├── requests/
│   │   │   ├── amenities/
│   │   │   ├── vendors/                      # vendors, contracts, assets, maintenance
│   │   │   ├── compliance/
│   │   │   ├── reports/
│   │   │   └── platform/                     # super-admin, plans, usage
│   │   │
│   │   ├── integrations/
│   │   │   ├── payment/    gateway.port.ts, razorpay.adapter.ts, van-webhook.controller.ts
│   │   │   ├── whatsapp/   whatsapp.port.ts, bsp.adapter.ts
│   │   │   ├── sms/        sms.port.ts, dlt.adapter.ts
│   │   │   ├── email/
│   │   │   ├── push/       fcm.adapter.ts, apns.adapter.ts
│   │   │   ├── bank/       statement-parsers/, bank-api.adapter.ts
│   │   │   └── tally/      voucher-export.ts
│   │   │
│   │   └── jobs/
│   │       ├── billing/    generate-bills.job.ts, accrue-interest.job.ts
│   │       ├── payments/   poll-pending.job.ts, reconcile.job.ts
│   │       ├── recovery/   reminders.job.ts, escalate-stages.job.ts
│   │       ├── helpdesk/   sla-breach.job.ts
│   │       ├── compliance/ due-reminders.job.ts
│   │       ├── notifications/ dispatch.job.ts, retry.job.ts
│   │       ├── metrics/    daily-aggregate.job.ts
│   │       └── privacy/    retention-anonymise.job.ts
│   └── test/
│       ├── unit/
│       ├── integration/
│       ├── e2e/
│       └── compliance/                       # CI gate — see Part E
│
├── web-app/                                  # React: admin portal + user web portal
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       │   ├── auth/          EnterMobile.tsx, CreatePassword.tsx, Login.tsx, ForcedChange.tsx
│       │   ├── admin/         dashboard, setup, users, members, billing, payments, accounting,
│       │   │                  recovery, helpdesk, gate, staff, notices, meetings, documents,
│       │   │                  requests, amenities, vendors, compliance, reports, settings
│       │   └── user/          home, bills, pay, receipts, helpdesk, visitors, notices,
│       │                      meetings, documents, requests, amenities, profile
│       ├── features/                         # per feature: components/, hooks/, api/, types.ts
│       ├── components/                       # shared UI kit
│       ├── lib/               api-client.ts, auth-context.tsx, permissions.ts, formatters.ts
│       ├── hooks/
│       ├── i18n/              en/, mr/
│       └── styles/
│
├── mobile-app/                               # React Native: user + guard + staff
│   ├── package.json
│   ├── app.json
│   ├── android/
│   ├── ios/
│   └── src/
│       ├── App.tsx
│       ├── navigation/        RootNavigator.tsx, AuthStack.tsx, UserTabs.tsx, GateStack.tsx, StaffStack.tsx
│       ├── screens/
│       │   ├── auth/          EnterMobile, CreatePassword, Login, ForcedChangePassword, NotRegistered
│       │   ├── user/          Home, Bills, BillDetail, Pay, Receipts, Ledger, Helpdesk,
│       │   │                  TicketDetail, Visitors, PreApprove, Notices, Meetings, Documents,
│       │   │                  Requests, Amenities, Profile, Family, Vehicles, Settings, SOS
│       │   ├── gate/          GateHome, NewVisitor, ScanPass, Delivery, Cab, StaffInOut,
│       │   │                  ActiveVisitors, Incident, Blacklist, SosAlerts
│       │   └── staff/         MyTasks, MyTickets, Attendance
│       ├── features/
│       ├── components/
│       ├── services/          api.ts, auth.ts, secure-store.ts, push.ts, camera.ts, qr.ts
│       ├── offline/           db.ts, schema.ts, outbox.ts, sync.ts     # gate app local-first
│       ├── theme/
│       └── i18n/
│
├── packages/
│   ├── shared-types/          # DTOs and enums generated from OpenAPI, used by web + mobile
│   ├── shared-utils/          # money formatting, date helpers, validators
│   └── config/                # eslint, prettier, tsconfig presets
│
└── infra/
    ├── docker/                Dockerfile.api, Dockerfile.web, nginx.conf
    ├── terraform/
    └── scripts/               backup.sh, restore-drill.sh, migrate.sh
```

### A4.1 Layering rules (enforced by lint + CI)
```
Route → Controller → Service → Domain (pure rules) → Repository → DB
                        ↓
                 Events → Jobs → Notifications
```
1. `domain/` must not import repositories, integrations, or Express.
2. Controllers must not import repositories directly.
3. No money arithmetic outside `core/money`.
4. No raw SQL outside `repositories/`.
5. No statutory numeric literal (12, 0.25, 0.75, 7500, 20_00_000, 10) in billing or compliance code — they come from `statutory_config`.
6. Every module folder must have a `tests/` directory.
7. Cross-tenant isolation test and the compliance suite are required checks on every pull request.

---

# PART B — MAHARASHTRA COMPLIANCE (build this into every module)

**Principle:** statutory correctness ranks above features, UI polish and delivery speed. A wrong maintenance bill or a missed statutory deadline is a legal problem for the society, not a bug.

## B1. Mandatory research pass (before writing any billing code)

Do not code legal logic from memory. Research the primary sources, then record findings in `/docs/compliance/`.

**Sources to verify:**
1. **Maharashtra Co-operative Societies (Amendment) Rules, 2026** — new **Chapter XI-B, Rules 106C-1 to 106C-14**. Notified 18 June 2026, Maharashtra Government Gazette No. 366 dated 22 June 2026 (Notification No. Sanini 0321/C.R.41/13-C), **effective 30 June 2026**. Covers registration, membership, succession, funds, maintenance charges and apportionment, management and general body meetings, redevelopment, recovery of dues.
2. **Model Bye-Laws** — the 2014 bye-laws (in force) and the **draft revised Model Bye-Laws 2026** (objections closed 27 Aug 2026). **Check whether they have since been notified**; if yes, treat as authoritative and diff against 2014.
3. **MCS Act 1960** — recovery (Sec. 101, Sec. 154B-29 for the Mumbai regime), Sec. 79A directives, disputes (Sec. 91), audit (Sec. 81), returns (Sec. 79), election rules under the State Co-operative Election Authority, M-20 bond.
4. **Apartment Ownership Act 1970**, **MOFA 1963**, **MahaRERA** — for AOA-type and pre-conveyance buildings.
5. **Deemed conveyance** procedure and document checklist.
6. **Redevelopment** — Sec. 79A directives and the 2026 rules' procedure: consent threshold, SGM, PMC/architect appointment, tendering, records.
7. **Tax** — GST applicability to housing societies (per-member monthly threshold, society turnover threshold, rate), TDS on contractor/security/AMC payments, property tax rules of the relevant municipal corporation, professional tax.
8. **Safety** — structural audit intervals by building age, fire safety audit periodicity and form under the Maharashtra Fire Prevention and Life Safety Measures Act 2006, Maharashtra Lifts Act licensing and inspection, electrical/DG inspection, water tank cleaning norms.
9. **Data & payments** — DPDP Act 2023, RBI payment aggregator rules, NPCI UPI specifications, TRAI DLT rules for SMS, WhatsApp Business policy.

**Recording format** — `/docs/compliance/RULES_REGISTER.md`: one row per obligation with rule reference, plain-English requirement, source URL, date verified, code location, config key. `SOURCES.md`: every URL with date and one-line summary — primary sources only (Gazette, Sahakarayukta, municipal corporation circulars, CBIC notifications); blogs only as pointers. `CHANGELOG_COMPLIANCE.md`: every rule change, what changed, which code and config changed, migration applied.

**Uncertainty rule:** if sources conflict or a provision is ambiguous, **do not guess**. Implement as a configurable parameter with a conservative default, add `TODO(compliance)`, and list it in the register under "needs legal confirmation". Never hardcode a legal number in business logic.

Re-run this research quarterly, or immediately on any indication of a new gazette notification.

## B2. Charge apportionment — Rule 106C-12

**Permissible charges** under 106C-12(1): service charges; property tax; water charges; lift repairs, maintenance and running including new lift installation; car parking; interest on defaulted charges; loan repayment instalments and interest; non-occupancy charges; insurance; lease rent; non-agricultural tax; contributions to society funds; any other charge approved by the general body that does not contradict the Act and Rules.

**Service charges** under 106C-12(2) — an **exhaustive** list: salaries of office staff, lift men, watchmen, mali and other employees; property tax, electricity and water charges for an independent society office; printing, stationery and postage; travelling and conveyance for committee members and staff; sitting fees of committee members; annual subscription to the housing federation and affiliated societies; entrance fees for such affiliation; audit fees (internal, statutory, re-audit, test audit); expenses of general body, committee and sub-committee meetings; retainer fees, legal charges, territory enquiry fees; common electricity charges.

**Apportionment basis** under 106C-12(3) — implement exactly as the default rule set:

| Charge | Apportionment basis | Method code |
|---|---|---|
| Service charges | Equally by number of flats | `EQUAL_PER_UNIT` |
| Property tax | As fixed by local authority; common area by carpet area | `AUTHORITY_FIXED` + `PER_CARPET_AREA` |
| Water charges | By number and size of inlets/taps per sanctioned plan | `PER_WATER_INLET` |
| Lift maintenance, running, new lift | Equally among flats in the building **having** the lift; other buildings excluded | `BUILDING_SCOPED_EQUAL` |
| Car parking | Rate fixed by general body | `PER_PARKING_SLOT` |
| Interest on defaults | Rate fixed by general body, **not exceeding 12% simple p.a.** | `INTEREST_SIMPLE` |
| Loan repayment and interest | As fixed by the financing agency per instalment | `EXTERNAL_SCHEDULE` |
| Non-occupancy charges | **10% of service charges** (not of total maintenance) | `PERCENT_OF_HEAD` |
| Insurance | By carpet area; extra premium for commercial use borne by that occupant | `PER_CARPET_AREA` |
| Lease rent | By carpet area | `PER_CARPET_AREA` |
| Sinking fund | Minimum **0.25% p.a. of construction cost**, rate fixed by general body | `PERCENT_OF_CONSTRUCTION_COST` |
| Repair & maintenance fund | Minimum **0.75% p.a. of construction cost**, rate fixed by general body | `PERCENT_OF_CONSTRUCTION_COST` |
| Major repair fund | By carpet area | `PER_CARPET_AREA` |
| Education & training fund | ₹10 per member or the government-fixed rate, whichever is higher | `PER_MEMBER_FIXED_OR_MIN` |
| Election fund | Equally by members | `EQUAL_PER_UNIT` |
| Welfare fund | Voluntary | `VOLUNTARY` |
| Any other fund | Equally by members | `EQUAL_PER_UNIT` |
| Amenities (club, gym, pool) | By usage — only those using it | `USAGE_BASED` |
| Playground, garden, jogging track | Equally by number of flats | `EQUAL_PER_UNIT` |
| Other (penalty, one-off recovery) | Admin-entered per unit | `MANUAL` |
| Commercial surcharge | Flat amount by unit type | `FIXED_PER_UNIT_TYPE` |

## B3. Hard validations to enforce in code

1. **Interest cap** — configured rate ≤ 12% simple p.a.; require a general body resolution reference (meeting id + date) before the rate can be saved or changed; **never compound**.
2. **Non-occupancy base** — computed only on that unit's service-charges line, capped at 10%; applies **only** when occupancy = `TENANTED`. **Must not** apply when the flat is occupied by the member's family, even if the member does not personally reside there. Dedicated unit test required.
3. **Lift charges** — never billed to units in a building without a lift; ground-floor flats in a lift building **are** chargeable (the rule divides by building, not floor).
4. **Fund minimums** — reject sinking < 0.25% p.a. and repair < 0.75% p.a. of construction cost; require construction cost per building before enabling these heads.
5. **Service charges whitelist** — only expense categories on the 106C-12(2) list may map to the service-charges head; anything else needs its own head or the "other charges approved by the general body" route, which requires a resolution reference.
6. **GST** — apply only when the society is GST-registered **and** both thresholds are met: monthly maintenance per member above the prescribed limit (₹7,500 as last verified) **and** annual taxable turnover above the prescribed limit (₹20 lakh as last verified). Store both thresholds and the rate as effective-dated config; verify current values before release.
7. **Transfer premium** — cap enforced from config with a source reference; verify the current cap and the membership/waiting-period conditions in the notified bye-laws before enabling share transfer.
8. **Bill transparency** — every bill shows a head-wise breakup with the apportionment basis per head. Each `bill_line` stores method, rate, rate version, input attribute value and rule reference.
9. **Recovery** — demand notices must cite the correct provision, attach a ledger extract and interest computation, and record dispatch proof (RPAD/courier number and date). Legal bundles assemble bills, ledger, notices with dispatch proof, committee resolution and the applicable rule extract.
10. **Meetings** — enforce statutory notice periods and quorum from config; refuse to publish a notice violating the lead time without an explicit override plus recorded reason; validate the AGM date against the statutory deadline.
11. **Immutability** — published bills, receipts, vouchers, notices and approved minutes are never edited, only reversed or superseded, with the original retained.
12. **Retention** — financial records 8 years; visitor PII default 90 days then anonymised; DPDP consent captured with purpose text.

## B4. Effective-dated statutory configuration (mandatory design)

Table `statutory_config`: `key`, `value`, `unit`, `effective_from`, `effective_to`, `source_reference`, `rule_citation`, `verified_on`, `set_by`, `resolution_reference` (where a general body resolution is required), `society_id` nullable (null = platform default).

Seed keys: `interest_cap_percent`, `non_occupancy_percent`, `non_occupancy_base`, `sinking_fund_min_percent`, `repair_fund_min_percent`, `education_fund_min_amount`, `gst_rate`, `gst_member_threshold`, `gst_turnover_threshold`, `transfer_premium_cap`, `agm_notice_days`, `sgm_notice_days`, `agm_deadline_rule`, `audit_deadline_rule`, `quorum_rule`, `structural_audit_intervals`, `fire_audit_frequency`, `visitor_data_retention_days`.

**Billing resolves config as of the billing period, never "now".** Recomputing an old bill must reproduce the original amount to the paisa. Regression test required.

## B5. Compliance calendar seed

Each item carries rule citation, owner, due-date rule (fixed date / X days after FY end / recurrence / building-age based), reminder schedule, required evidence, status, history:

Statutory audit and report filing · audit rectification report · AGM within statutory date · annual returns to the Registrar · committee election cycle and M-20 bonds · structural audit by building age · fire safety audit · lift licence renewal and inspection · electrical and DG inspection · property tax · water charges · society insurance renewal · water tank cleaning · pest control · GST, TDS and professional tax filings · deemed conveyance status · redevelopment milestones · bye-law alignment review on rule change.

Plus a **regulatory update feed**: platform-level records of rule changes surfacing an advisory to affected societies with a one-click "apply recommended config change" that writes a new effective-dated `statutory_config` row and logs it.

## B6. Escalate to a human (do not decide alone)

When: a rule's interpretation affects money charged to residents; a statutory deadline or notice period is ambiguous; a society's registered bye-laws conflict with Chapter XI-B; GST or TDS treatment is unclear; personal data would be retained longer or shared more widely than B3.12 allows.

**Product disclaimer to display:** the platform assists with compliance and does not constitute legal advice; societies should confirm with a qualified advocate or the Registrar.

---

# PART C — COMPLETE FEATURE SPECIFICATION

Each module: purpose → admin features → user features → business rules → tables → jobs.

## C1. Users & access control (ADMIN-managed)

**Admin features**
- User list: name, mobile, unit, user_type, permissions summary, status (invited / active / locked / suspended), last login
- Add user: name, **mobile (login id)**, email (optional), unit, user_type, permission set from a template, notes
- Bulk add via Excel (name, mobile, unit, user_type)
- Edit permissions individually or apply a template
- Generate temporary password → shown to admin, sent by SMS/WhatsApp/email, single use, 24 h expiry, forces change
- Unlock a locked account; suspend and reactivate; force logout all devices
- View a user's sessions and auth history
- Permission templates: Owner, Co-owner, Family, Tenant, Guard, Staff, Accountant, Auditor — editable per society
- Additional admins: create with a scoped admin permission set (e.g. treasurer without gate management)
- Audit log viewer with filters and export

**User features**
- First login: enter mobile → create password → accept terms → in
- Login with mobile + password
- Change password (invalidates other sessions)
- View own profile, sessions, and log out other devices
- "Contact society office" guidance if not registered or locked out

**Rules** — one mobile = one account; deactivation revokes access instantly and retains history; no self-signup; no self-service password reset in V1; every auth event logged.

**Tables** — `users`, `user_permissions`, `permission_templates`, `sessions`, `password_history`, `temp_passwords`, `login_attempts`, `audit_logs`.

## C2. Society setup & configuration

**Admin features**
- Society profile: name, type (`SOCIETY_CHS` / `SOCIETY_AOA` / unregistered), registration number and date, address, district, registrar office, PAN, TAN, GST number and registered flag, financial year start, logo, letterhead, contact details
- Buildings: name, wings, floor count, lift present, construction year, **construction cost** (required for sinking/repair funds)
- Floors and units: unit number, type (residential / commercial / shop / office / parking-only), carpet area, built-up area, water inlet count, parking slots by type, lift-served flag, share certificate number, status
- Parking slot register with allotment
- Billing configuration: cycle (monthly / quarterly / half-yearly), generation day, due day, grace days, interest rate + resolution reference, interest method, rounding rule, bill and receipt number formats, allocation order, partial payment allowed, GST settings
- Bank accounts: name, number, IFSC, type, purpose (operations / sinking / repair), opening balance, VAN prefix
- Charge head seeding with correct default apportionment
- Excel import of units, members and opening balances with dry-run preview and error file
- Onboarding checklist with completion %; society status `draft → live` gate
- Society settings: notifications, numbering, languages, feature flags, data retention

**User features** — read-only society page (name, address, committee contacts, my unit details) with a "report incorrect detail" action that creates an admin task.

**Rules** — unit number unique per building; unit not deletable once billed (status change only); construction cost mandatory for percentage-of-cost funds; billing config changes take effect from the next unbilled period; go-live requires ≥1 admin, ≥1 unit, billing config, bank account, charge heads, opening balances.

**Tables** — `societies`, `buildings`, `floors`, `units`, `parking_slots`, `bank_accounts`, `billing_configs`, `numbering_series`, `import_jobs`, `import_rows`, `onboarding_items`, `society_settings`, `statutory_config`.

## C3. Members, occupancy & household

**Admin features**
- Member register: unit, primary owner, co-owners, associate members, share certificate number, shares held, admission date, cessation date
- Occupancy management: self-occupied / family-occupied / tenanted / vacant / locked / under-renovation, with effective dates — **drives non-occupancy legality**
- Tenancy records: tenant, agreement start and end, rent (optional), deposit, agreement document, police intimation acknowledgement, allowed occupants, **bill-payer = owner or tenant**
- Expiry reminders at T-30; auto-suspend tenant access on expiry unless extended
- Family members, vehicles (with parking slot and sticker), pets
- Domestic help registry with per-unit links and verification
- Approvals queue: profile changes, tenant additions, vehicle and pet additions, data corrections
- Unit 360: current owner, occupancy, tenant, family, vehicles, pets, documents, ledger, tickets, visitors, and full ownership and tenancy history
- Nominee records with percentage shares
- Directory visibility controls
- Bulk actions: resend credentials, export contact list, mark occupancy

**User features** — my home and unit details; my family; my tenant (owner only: add, set bill payer, end tenancy); my vehicles and pets; my nominee; directory search (respecting visibility); useful numbers.

**Rules** — exactly one primary owner per unit at a time; voting right on the primary owner only; tenants cannot vote or request a sale NOC; removal sets a cessation date, never deletes; non-occupancy applies only when `TENANTED`.

**Tables** — `persons`, `memberships`, `occupancies`, `tenancies`, `family_members`, `vehicles`, `pets`, `member_approvals`, `directory_preferences`, `nominees`.

## C4. Billing engine

**Admin features**
- Charge head manager: name (EN/MR), code, GL account, category, GST flag, apportionment method, applicability filters (unit type, building, occupancy, floor range, area range, tag), effective-dated rates, **live simulator** showing who gets billed how much
- Bill run: generate for a period → snapshot unit attributes → compute → preview (totals per head, per building, per unit; variance vs last period with ±% flags; exception list) → edit individual units → optional approval → **publish**
- Dependent head ordering (percentage-of-head heads computed after their base)
- Gapless FY-wise bill numbering; immutable published bills; PDF in EN and MR
- Arrears carry-forward; nightly simple-interest accrual with the 12% cap
- GST with dual threshold
- Ad-hoc and supplementary bills: to one unit, a filtered set, or all — repair contribution, penalty, transfer premium, NOC fee, amenity charge, legal cost recovery
- Unit-level recurring extras (e.g. second parking slot)
- Credit notes and debit notes with reason and approval; waivers with policy limits and mandatory reason
- Cancel-and-reissue while unpaid
- Bill template designer: letterhead, head grouping, footer notes, bank and UPI QR, language
- Unit ledger view and statement export

**User features** — dues card (current, arrears, interest, total, due date, days left); bill detail with head-wise breakup and per-head "why this amount" explanation; bill and receipt history; ledger statement download and email-to-self; raise a billing query (creates a ticket).

**Rules** — bill numbers gapless per FY; published bills immutable; rates effective-dated and never retro-applied to closed periods; interest simple only and capped; every bill line stores method, rate, rate version and input attribute.

**Tables** — `charge_heads`, `charge_rates`, `unit_charge_subscriptions`, `bill_runs`, `bills`, `bill_lines`, `unit_attribute_snapshots`, `ledger_entries`, `credit_notes`, `interest_accruals`, `bill_templates`.

**Jobs** — `generate-bills` (scheduled), `accrue-interest` (nightly), `render-bill-pdfs`, `notify-bill-published`.

## C5. Payments, receipts & reconciliation

**Channels** — in-app UPI / cards / net banking / wallets; dynamic UPI QR; **unit virtual account** bank transfer; manual cash, cheque, NEFT/RTGS/IMPS; UPI AutoPay / e-NACH mandates (V2).

**Admin features**
- Collections dashboard: collected today and this month, mode-wise split, pending gateway items, unmatched credits
- Manual receipt entry: unit, amount, mode, instrument number, date, bank, remarks
- Cheque lifecycle: received → deposited → cleared / bounced (bounce reverses the receipt and posts a bounce charge)
- Receipt list, search, print, bulk print, cancel with reason (reversal only)
- Advance balances and refund requests with approval
- Bank reconciliation workspace: statement upload (CSV/XLS/PDF per-bank parsers) or bank API, auto-match on VAN / UTR / amount+date, bulk match suggestions, manual mapping of unmatched credits, per-period reconciliation status
- Settlement reconciliation: aggregator report vs bank credit, gateway fee posted as expense, mismatch alerts
- Convenience fee policy: absorbed by society or passed to payer

**User features** — pay full, partial or a specific bill; choose method; success screen with receipt; receipt list, download and WhatsApp share; advance balance display; "processing" state with auto-refresh; failure guidance; AutoPay management (V2).

**Rules** — receipt only on confirmed success (cash immediate; cheque provisional until cleared); receipt numbering sequential per FY and immutable; allocation order configurable, locked after period close; webhooks idempotent by gateway reference; no card data stored; duplicate payment becomes an advance with a refund option.

**Tables** — `payments`, `payment_attempts`, `allocations`, `receipts`, `mandates`, `settlements`, `settlement_lines`, `bank_statement_imports`, `bank_statement_lines`, `reconciliation_matches`, `refunds`, `cheque_events`.

**Jobs** — `poll-pending-payments` (every 15 min for 24 h), `reconcile-settlements`, `apply-advances`, `notify-receipt`.

## C6. Accounting & finance

**Admin features**
- Chart of accounts seeded for societies: income (service charges, water, parking, non-occupancy, interest on dues, FD interest, transfer premium, NOC fees, other), expenses (salaries, security agency, housekeeping, electricity, water, property tax, lift AMC, generator, pest control, repairs, audit fees, legal, printing, bank charges, gateway fees), assets (bank, cash, FDs, receivables, vendor advances, fixed assets), liabilities (funds, deposits, member advances, TDS and GST payable)
- Auto-posting: bill → receivable Dr / income and fund Cr; payment → bank Dr / receivable Cr; interest → income; credit note → income reversal; gateway fee → expense
- Vouchers: receipt, payment, journal, contra; manual journals require narration and approver
- Expense workflow: requisition (category, amount, quotes above threshold, linked ticket or asset) → approval matrix by amount (with general body resolution reference above the GB threshold) → work order → bill entry with GST and TDS → payment voucher → vendor notified
- Petty cash: imprest, vouchers with bills, replenishment, cash count reconciliation
- Funds: sinking, repair & maintenance, major repair, education & training, election, welfare, reserve — with earmarked bank/FD mapping, **GB-resolution-gated withdrawals**, utilisation statements
- Fixed deposits: principal, rate, maturity, interest accrual, renewal reminders, auto-posting on maturity
- Fixed assets and annual depreciation posting
- Statutory: TDS rate master, deduction, challan and quarterly return data; GST output register; professional tax
- Budgets: annual budget per head, budget vs actual variance, AGM approval reference
- Period control: monthly soft close and year-end hard close with checklist (all bills published, bank reconciled, approvals cleared, suspense zero, unmatched credits zero); post-close corrections via reversing entries only
- Statements: trial balance, Income & Expenditure, Receipts & Payments, Balance Sheet with schedules, fund-wise statements, receivables and payables ageing, member ledger, vendor ledger, cash book, bank book, bank reconciliation statement, TDS register, GST register, budget vs actual, depreciation schedule, FD register
- Export: PDF, Excel, **Tally XML/CSV**
- **Auditor/accountant access**: year-scoped, read-only or read-write per permission, voucher drill-down with attachments, audit observation log (observation → society response → rectification status → closure) feeding the compliance module, full-year bundle download

**User features** — society financial transparency page (I&E summary, fund balances, budget vs actual) with society-controlled visibility; my ledger.

**Rules** — every posting has a source document; books always balanced; fund withdrawals need a resolution reference; closed periods immutable.

**Tables** — `accounts`, `vouchers`, `journal_lines`, `funds`, `fund_transactions`, `expense_requests`, `expense_approvals`, `purchase_orders`, `vendor_bills`, `payments_out`, `petty_cash`, `fixed_assets`, `depreciation_runs`, `fixed_deposits`, `tds_entries`, `gst_entries`, `budgets`, `budget_lines`, `accounting_periods`, `audit_observations`.

## C7. Dues recovery

**Admin features**
- Stage engine with configurable thresholds: **Watch** (1–30 days) → **Reminder** (30–60) → **Notice** (60–90) → **Final notice** (90–120) → **Legal** (120+)
- Automated reminder ladder at T+7/15/30 via push, WhatsApp and SMS with pay link and ledger snapshot
- Demand notice generation: society letterhead, ledger extract, interest computation, **correct rule and bye-law citation**, payment deadline; sent digitally and printable for registered post
- **Dispatch proof capture**: RPAD or courier number, date, receipt scan
- Committee resolution reference; defaulter flag with configurable restrictions (amenity booking blocked, NOC held, name on notice board per society policy)
- Legal case file: auto-assembled bundle (all bills, full ledger, every notice with dispatch proof, resolution, rule extract), recovery application tracking (Sec. 101 / 154B-29), advocate details, hearing diary with reminders, recovery certificate, execution and attachment status, closure
- Legal cost recovery as an ad-hoc charge
- Settlement and instalment plans with tracked instalments and auto-revert on default
- Waivers with approval and reason
- Defaulter board grouped by stage with bulk notice generation

**User features** — see own outstanding, interest and notices received; settlement plan status; pay at any stage; raise a dispute through the helpdesk.

**Rules** — payment at any stage auto-de-escalates and stops reminders; notice templates versioned and every issued notice retained; interest continues during the legal stage unless waived by resolution.

**Tables** — `recovery_cases`, `recovery_notices`, `notice_dispatches`, `hearings`, `settlements`, `settlement_instalments`.

**Jobs** — `send-reminders`, `escalate-stages`, `notice-followups`.

## C8. Helpdesk

**Admin features**
- Category tree (Plumbing, Electrical, Lift, Housekeeping, Security, Parking, Water supply, Common area, Noise/nuisance, Billing query, Suggestion, Other) with sub-categories
- Per category: scope (personal / common), default assignee, SLA (response minutes, resolution hours), escalation chain, visit slot needed, chargeable flag
- Working hours and holiday calendar for SLA pausing
- Queue with filters (status, category, building, assignee, SLA state, age); bulk assign
- Ticket detail with full timeline; internal notes vs public comments
- Escalation dashboard; analytics: volume by category, average response and resolution, SLA compliance %, reopen rate, assignee ratings, heat map by building
- Chargeable ticket → ad-hoc bill line through an approved charge head
- Material request from a ticket → expense requisition

**User features** — raise a ticket in ≤4 taps with up to 5 photos and a video, category, location picker (own flat / building-floor-common area), preferred slot; my tickets with status chips; timeline with photos and comments; chat-style updates; confirm resolution and rate 1–5; reopen within 72 h; follow community issues.

**Staff-permission users** — my assigned tickets; acknowledge, start, add notes and photos, reassign, escalate, request material, resolve with proof photo; offline draft; my rating.

**Lifecycle** — `OPEN → ASSIGNED → IN_PROGRESS → (ON_HOLD / AWAITING_PARTS / AWAITING_RESIDENT) → RESOLVED → CLOSED`, with `REOPENED` loop and `REJECTED` / `DUPLICATE` terminal states. Every transition records actor, timestamp and note; SLA timers start and pause per state.

**Rules** — only assignee or admin changes status; auto-close after 72 h of no confirmation; duplicate detection on same category and location within 24 h; common-area tickets have followers and one resolution notifies all.

**Tables** — `ticket_categories`, `sla_policies`, `tickets`, `ticket_status_history`, `ticket_comments`, `ticket_attachments`, `ticket_followers`, `ticket_assignments`, `escalations`, `ticket_ratings`.

**Jobs** — `sla-breach-check` (every 5 min), `auto-close-resolved`, `preventive-ticket-generator`.

## C9. Gate, visitors & security

**Gate app (mobile, offline-first, guard-permission user)**
- Home: New Visitor, Scan Pass, Delivery, Cab, Staff In/Out, Search, Emergency
- Offline store: residents, units, staff, active passes, blacklist cached; entries queued locally with local UUIDs; conflict-safe sync on reconnect; online/offline indicator; **24 h autonomy**
- Device binding to a gate; PIN unlock per guard shift; remote deregister from admin
- **Masked calling** — guard calls a resident through a proxy number; real numbers never shown
- Walk-in visitor: type → mobile (auto-fills returning visitor) → name → photo → destination unit → purpose → vehicle → submit → push to unit occupants with **Allow / Deny / Call** → 45 s no response → guard call option → 2 min no response → society fallback rule → on Allow: entry logged with in-time and pass
- Pre-approved pass: scan QR or key the 6-digit code → auto-verified, no resident interruption
- Delivery: courier and company, OTP handover option, "leave at gate" default per unit, parcel logged with photo, resident notified, collection marked, unclaimed reminder
- Cab: plate, driver name, entry and exit
- Service provider: expected duration, overstay alert
- Group event guests: bulk passes from a resident's uploaded guest list
- Move-in / move-out: admin-approved permit with date, lift slot and item list visible to the guard
- Exit marking: search active visitors, tap exit; auto-exit at day end with audit flag
- Staff and domestic help check-in/out; vehicle log
- Blacklist alerts; incident logging with photos; patrol checkpoint scans; shift handover
- SOS screen: siren, flat details, resident contacts
- Guard announcement from templates (water tanker arrived, lift stopped) if permitted

**Admin features** — gate and device management; visitor log with filters and export; parcel log; blacklist management with reason; move-in/out approvals; guard roster and shift records; incident register and monthly incident report; CCTV footage request workflow (request → approval → marked provided; no video stored); visitor retention settings.

**User features** — visitor approval push with 45 s countdown; pre-approve guest (name, mobile, window, single/multi entry, vehicle) generating code + QR sent by WhatsApp/SMS; expected delivery and leave-at-gate default; my visitor history; domestic help attendance calendar; my vehicles; SOS with category (medical, fire, security, harassment, other); emergency contacts.

**Rules** — visitor PII retained 90 days (configurable) then anonymised; residents see only their own visitor history; guards never see financial data or real phone numbers; offline entries keep the guard's local timestamp with server sync time recorded separately.

**Tables** — `gates`, `gate_devices`, `guard_shifts`, `visitors`, `visitor_passes`, `gate_entries`, `parcels`, `cab_entries`, `service_visits`, `move_requests`, `vehicle_logs`, `blacklist`, `sos_alerts`, `incidents`, `patrol_checkpoints`, `footage_requests`.

**Jobs** — `auto-exit-eod`, `overstay-alerts`, `unclaimed-parcel-reminder`, `anonymise-visitor-pii`.

## C10. Staff & domestic help

**Admin features** — staff registry (name, role, agency, joining date, salary, shift, ID proof, **police verification with expiry reminder**); attendance via QR, guard marking or geofenced check-in; leave marking; monthly attendance sheet feeding a salary expense voucher; recurring task checklists (daily cleaning, weekly tank check) with photo proof; domestic help verification and QR ID card issuance (printable); help-to-unit links.

**User features** — add domestic help (maid, cook, driver, nurse) for verification; view help attendance by month; mark help on leave; unlink help.

**Staff-permission users** — attendance check-in/out; my daily and preventive tasks with photo proof; leave request.

**Rules** — one help may be linked to many flats; entry allowed only with ≥1 active link; all employing residents notified on check-in.

**Tables** — `staff_persons`, `staff_unit_links`, `staff_attendance`, `staff_tasks`, `staff_leaves`.

## C11. Notifications & notices

**Notification service** — channels: push (FCM/APNs), WhatsApp Business API templates, DLT-registered SMS, email, in-app inbox. Event-driven: modules emit events, the service resolves recipients, template, language and channel order. Fallback chain (push → 60 s undelivered → WhatsApp → SMS), configurable per event. Preference matrix per society and per user (statutory notices not opt-outable). Template engine with variables, EN and MR, WhatsApp template ID mapping, preview and test-send. Delivery tracking per recipient per channel (queued / sent / delivered / read / failed) with provider IDs, retry with backoff, dead-letter queue. Quiet hours 22:00–07:00 for non-emergency, digest batching, cost cap alerts, per-society message metering.

**Admin features** — notice composer: title, rich body (EN/MR), attachments, audience (all / owners / tenants / building / floor / custom unit list / defaulters), category (General, Maintenance shutdown, Water, Meeting, Emergency, Circular, Financial), channels, schedule, **acknowledgement required**, expiry, pin to top; optional approval before publish; **delivery and acknowledgement report exportable as proof of service**; notice board print PDF; corrigendum flow (published notices immutable); emergency broadcast bypassing quiet hours with logged reason; template manager; message usage meter.

**User features** — notice feed (pinned first, unread badge); notice detail with attachments and **Acknowledge** button; in-app inbox of all notifications; per-category channel preferences; mute non-essential categories; emergency alerts always delivered.

**Tables** — `notification_events`, `notification_templates`, `notifications`, `notification_deliveries`, `user_notification_prefs`, `notices`, `notice_audiences`, `notice_acknowledgements`.

**Jobs** — `dispatch-notifications`, `retry-failed`, `delivery-status-sync`, `digest-builder`.

## C12. Meetings, polls & voting

**Admin features** — create meeting: type (AGM / SGM / Committee / sub-committee), date, time, mode (physical / online / hybrid with link), venue, agenda items (title, description, attachments, resolution text, voting required, mover, seconder); **statutory notice-period validation** with block or override-plus-reason; notice generation and publication with acknowledgement tracking; RSVP and proxy recording with document; attendance by QR self check-in or admin marking; **live quorum meter** with configurable rule; adjournment flow with auto-scheduled adjourned meeting; item-wise discussion notes, amendments and voting (show of hands with counts, in-app ballot for those present, remote e-voting behind a resolution flag); results computed and locked; minutes auto-drafted from agenda, notes and results → edited → chairman-approved → published, then immutable; member comment window; action items with owner, due date and reminders; **single-PDF record pack** (notice + delivery proof + attendance + resolutions + minutes) for the Registrar; polls (non-binding, all users) and binding votes (owners only, one per unit, anonymity option, defaulter exclusion if bye-laws allow); election module: announcement, returning officer, nomination window and forms, scrutiny and objections, candidate list, voting, counting, results, committee constitution, M-20 bond collection.

**User features** — meeting list and notice; RSVP; agenda with attachments; QR check-in; vote on resolutions; view results; read minutes and submit comments; poll participation; view action items.

**Rules** — one vote per unit exercised by the primary owner; tenants excluded from binding votes; minutes locked after approval, amendments only via the next meeting; notice periods from `statutory_config`.

**Tables** — `meetings`, `agenda_items`, `meeting_notices`, `rsvps`, `proxies`, `attendances`, `resolutions`, `votes`, `vote_ballots`, `minutes`, `action_items`, `polls`, `poll_options`, `poll_responses`, `elections`, `nominations`, `candidates`.

## C13. Document vault

**Admin features** — seeded folders: Registration & bye-laws · Land & conveyance · Building approvals (plans, CC, OC) · Audits (statutory, structural, fire, lift, electrical) · Insurance · AMC & contracts · Meeting records · Legal cases · Bank & FDs · Circulars · Redevelopment · Templates · Unit-level documents. Upload with metadata (title, category, date, expiry, visibility: admin-only / all users / specific units, tags); versioning on re-upload with old versions retained; **expiry reminders at 60/30/7 days**; OCR full-text search; download logging; virus scan; 50 MB cap; bulk upload; folder ZIP export.

**User features** — browse society public documents; my unit documents (agreement, share certificate, NOCs issued, tenancy agreement); search; download.

**Tables** — `documents`, `document_versions`, `document_acls`, `document_folders`.

**Jobs** — `document-expiry-reminders`, `ocr-index`.

## C14. Member requests & certificate generation

**Common engine** — request type → dynamic form → document checklist → fee (auto ad-hoc bill) → approval chain → generated output (templated PDF with letterhead, serial number, digital stamp) → delivery plus vault copy → status timeline with SLA.

**Request types**
1. **No-dues certificate** — instant if ledger clear
2. **NOC for sale / bank loan / mortgage** — dues check gate, admin approval, serial-numbered PDF
3. **Share transfer (sale / gift / inheritance)** — seller initiation, buyer details and KYC, membership application, entrance fee + share money + transfer premium billing, committee resolution reference, seller cessation with final settlement, buyer membership creation, **share certificate register endorsement**, parking and vehicle reassignment, welcome kit
4. **Nomination filing or change** — nominee percentages, generated nomination form, acknowledgement
5. **Succession on death** — death certificate, nominee claim, provisional membership, document checklist, approval, final transfer
6. **Renovation / interior work permit** — scope, contractor and worker IDs, drawings, timeline, deposit, structural-safety undertaking, approval, **permit visible to guard**, debris and working-hours rules, completion inspection, deposit refund or deduction
7. **Sub-letting intimation / leave & licence registration** — agreement, police intimation, non-occupancy activation
8. **Parking allotment or change** — availability check, allotment by policy, sticker issuance
9. **Pet registration**, **address proof**, **occupancy letter**, **name change**, **duplicate share certificate**, **key handover**, **mail forwarding**, **water inlet addition** (changes billing attributes, needs approval)
10. **Generic request** — free-form, for anything not templated

**Admin features** — requests inbox (Kanban by status with SLA colours), approve/reject with reason, fee configuration, document checklist configuration, **template manager** (EN/MR letter templates with variables, serial numbering), share certificate register view, issued-document register.

**User features** — request centre: raise, track status timeline, upload documents, pay fee, download generated output.

**Tables** — `requests`, `request_types`, `request_steps`, `request_documents`, `generated_documents`, `document_templates`, `share_register_entries`.

## C15. Amenities & bookings

**Admin features** — per amenity: name, type, capacity, slot length, operating hours, advance booking window, max bookings per unit per month, pricing (free / per slot / per hour / deposit), approval requirement, blackout dates, eligibility (owners/tenants, defaulters excluded), rules text, caretaker; booking calendar and approvals; post-use inspection checklist with photos; deposit refund or deduction; cancellation and refund policy by lead time; no-show tracking; waitlist; recurring slots; usage and revenue reports.

**User features** — availability calendar, book slot, purpose and guest count, pay or add to next bill, confirmation with QR (visible to guard for guest entry), my bookings, cancel per policy.

**Tables** — `amenities`, `amenity_slots`, `bookings`, `booking_charges`, `booking_inspections`.

## C16. Vendors, contracts & assets

**Admin features** — vendor master (category, contacts, PAN/GST, bank, MSME status, documents, rating), empanelment and blacklisting; contracts and AMCs (asset covered, period, value, payment schedule, SLA, penalty clause, documents, renewal reminders at 60/30 days, versioning on renewal); **service schedules** auto-generated by frequency (lift monthly, fire quarterly, tank cleaning quarterly, pest control monthly, DG half-yearly) with visit logging, report upload and missed-visit alerts; RFQ and quotation comparison with committee selection reasons; asset register (lifts, pumps, DG, transformer, fire system, CCTV, gym equipment, water tanks, STP, solar, intercom) with make, serial, install date, warranty, cost, location, QR tag, linked AMC, expected life; preventive maintenance checklists with photo proof; breakdown history from tickets; inventory and consumables with issue log and low-stock alerts; meter readings (electricity, water, DG hours, diesel) with consumption trends and anomaly alerts.

**Vendor-permission users** — assigned work orders, visit logging, bill upload, payment status.

**Tables** — `vendors`, `vendor_documents`, `contracts`, `service_schedules`, `service_visits`, `rfqs`, `quotations`, `assets`, `asset_maintenance_plans`, `maintenance_logs`, `inventory_items`, `inventory_transactions`, `meter_readings`.

## C17. Compliance module

**Admin features** — compliance calendar with the seeded Maharashtra set (see B5); per item: owner, due date rule, recurrence, reminder schedule, evidence required; evidence upload per occurrence; red/amber/green status and a **society compliance score**; overdue escalation; yearly compliance report for the Registrar or auditor; **regulatory update feed** with advisory and one-click recommended config change; statutory config editor with source reference, verification date and resolution reference; deemed conveyance tracker; redevelopment milestone tracker (V2/V3); audit observation rectification tracking; in-product legal disclaimer.

**User features** — read-only compliance summary if the society enables it (builds trust and reduces AGM friction).

**Tables** — `compliance_items`, `compliance_occurrences`, `compliance_evidence`, `regulatory_updates`.

**Jobs** — `compliance-due-reminders`, `compliance-score-recalc`, `regulatory-feed-check`.

## C18. Dashboards & reports

**Admin dashboard** — billed vs collected (month and FY), collection efficiency %, outstanding ageing (0-30 / 31-60 / 61-90 / 90+) with drill-through, top 10 defaulters with quick actions, fund balances, occupancy split, pending approvals, open tickets by category and SLA state, today's visitors, staff present, upcoming due dates and renewals, compliance score, recent activity from the audit log, budget variance; date-range and building filters; widget-level export; role-specific layouts.

**User home** — dues with Pay, last receipt, pinned notices, my open tickets, pending visitor approvals, upcoming meeting, upcoming booking, quick actions grid.

**Report library (PDF + Excel, filterable and schedulable)** — bill register · head-wise billing summary · bill vs collection per unit · GST summary · receipt register · mode-wise collection · daily cash book · gateway settlement · advance balances · defaulter list · ageing analysis · interest levied · waivers granted · member ledger · vendor ledger · unit-wise member list · occupancy report · tenant register with expiry · vehicle list · AGM contact list · ticket analytics · visitor log · staff attendance · amenity usage · notice delivery · notification cost · compliance report · audit log export · user access report · all financial statements from C6.

**Scheduled** — daily collection summary to the treasurer; weekly admin digest; monthly treasurer pack (ZIP); annual AGM pack.

**Implementation** — pre-aggregate into `daily_society_metrics` via a nightly job; dashboards read aggregates, not raw ledgers; large exports run in a queue with email delivery.

## C19. Committee handover, audit log & platform admin

**Handover** — generate pack on committee change: bank balances and signatories, FDs, fund positions, receivables, payables, open legal cases, contracts and AMCs, insurance, assets, keys register, open tickets, pending requests, compliance status, document inventory, system users; outgoing confirmation → incoming acceptance → admin role transfer → old access downgraded to read-only for a set period; all history retained.

**Audit log** — every create, update, delete, approve and auth event with actor, permission used, IP, device, timestamp and before/after JSON; searchable; exportable; retained 8 years.

**Platform (super-admin)** — society onboarding console, subscription plans and invoicing, usage metering (messages, storage, units), feature flags per plan and per society, support ticketing, impersonation with recorded reason, white-label branding (V3), multi-society and federation dashboards (V2.5).

**Tables** — `handovers`, `handover_items`, `audit_logs`, `plans`, `subscriptions`, `usage_meters`, `feature_flags`, `impersonation_logs`.

---

# PART D — DEVELOPMENT PLAN, SCRATCH TO PRODUCTION

## Phase 0 — Setup (1 week)
- Monorepo with npm/pnpm workspaces: `backend/`, `web-app/`, `mobile-app/`, `packages/`
- `docker-compose.yml`: Postgres 16, Redis, MinIO, backend, web
- TypeScript strict everywhere; eslint + prettier + import-boundary rules from A4.1
- Prisma schema skeleton and first migration; seed scripts scaffolded
- GitHub Actions: lint → typecheck → unit → integration → build; staging deploy on merge
- Sentry, pino logging, health endpoints
- Third-party sandboxes: payment aggregator, WhatsApp BSP, DLT SMS, FCM/APNs, email
- **Compliance research pass 1** → `/docs/compliance/RULES_REGISTER.md` + `SOURCES.md`
- Pilot inputs: 2 societies' real bills, bye-laws, charge heads, opening balance sheet

**Exit** — `docker-compose up` runs API + web + Postgres; CI green; staging reachable; compliance register drafted.

## Phase 1 — Auth & access control (2 weeks)
Backend: users, `user_permissions`, permission templates, sessions, `password_history`, `temp_passwords`, `login_attempts`, `audit_logs`. Endpoints per A2. argon2id, password policy and history, lockout, JWT issue/rotate/revoke, permission middleware, society-context middleware, audit interceptor.
Web: enter-mobile → create-password → login → forced-change → change-password; admin shell with permission-gated navigation; user management screens; audit log viewer.
Mobile: auth stack (EnterMobile, CreatePassword, Login, ForcedChangePassword, NotRegistered), secure token storage, session handling.

**Exit** — admin adds a mobile number, that person logs in and sets a password, no OTP anywhere; a wrong permission returns 403 and is logged; cross-tenant access blocked by an automated test.

## Phase 2 — Society setup (2 weeks)
Society, buildings, floors, units, parking, bank accounts, billing config, numbering series, `statutory_config` seed, Excel import with dry-run, onboarding checklist, draft→live gate.
Web: setup wizard, unit grid with bulk edit, settings pages, import screens.

**Exit** — a 500-unit society imported and taken live in under 30 minutes by a non-technical admin.

## Phase 3 — Members & occupancy (2 weeks)
Persons, memberships, occupancies, tenancies, family, vehicles, pets, approvals queue, unit 360, nominees, directory preferences.
Web: member list, unit 360, approvals. Mobile: my home, family, vehicles, tenant management, directory.

**Exit** — for any unit, the admin sees current owner, current occupants, since when, who lived there before, and all vehicles, on one screen.

## Phase 4 — Billing engine (4 weeks) — highest risk, highest value
All apportionment methods in `modules/billing/domain/apportionment/` as pure functions; `bill-calculator` with topological ordering; interest, GST and rounding calculators; the B3 hard-validation rules; charge heads with effective-dated rates and a live simulator; unit attribute snapshots; bill run preview → approve → publish; gapless numbering; PDF EN/MR; ledger; credit and debit notes; waivers; ad-hoc bills; nightly interest accrual.
Web: charge head manager, bill run screens, ledger view, template designer. Mobile: dues card, bill detail with per-head explanation, history.

**Exit** — golden-bill tests reproduce both pilot societies' real bills to the rupee; 1,000 units billed in under 2 minutes; recomputing a 12-month-old bill after config changes matches the original exactly.

## Phase 5 — Payments & reconciliation (3 weeks)
Manual receipts first, then aggregator integration, VANs, webhooks with idempotency, poll-fallback job, allocation engine, advances, refunds, cheque lifecycle, receipts with PDF, bank statement import and reconciliation workspace, settlement reconciliation.
Web: collections dashboard, receipts, manual entry, reconciliation workspace. Mobile: pay flow, receipts, share.

**Exit** — 95%+ of VAN and gateway payments auto-reconciled; receipt visible within 10 s of success; a full pilot month closed with no manual ledger fixes.

**★ Milestone: commercially usable. Begin paid pilots.**

## Phase 6 — Notifications & notices (2 weeks)
Notification service with all four channels, fallback chain, delivery tracking, retries, quiet hours, cost metering, template manager EN/MR; notices with audience targeting, acknowledgement and exportable delivery report; emergency broadcast; notice board print.

**Exit** — bill notification reaches 95%+ of users on at least one channel; any notice produces a delivery and acknowledgement report.

## Phase 7 — Dashboards & reports (2 weeks)
Nightly metrics aggregation; admin dashboard widgets; user home; report library with PDF/Excel; scheduled report packs.

**Exit** — the treasurer answers "how much collected, who hasn't paid, how old are the dues" in under 10 seconds on mobile.

## Phase 8 — Helpdesk (3 weeks)
Categories, SLA policies, ticket lifecycle, assignment, escalation, chargeable tickets, common-area tickets with followers, analytics; staff screens in the mobile app.

**Exit** — a pilot society runs a full month with zero complaints in WhatsApp; SLA compliance measurable and above 80%.

## Phase 9 — Gate, visitors & staff (4 weeks)
Gate app with local SQLite, outbox and sync; device binding and PIN shift unlock; all visitor flows; parcels; blacklist; masked calling; domestic help and staff attendance; SOS and incidents; patrol checkpoints; visitor retention job; realtime visitor approval via Socket.io.

**Exit** — a walk-in entry takes ≤30 s; 24 h offline with 200 entries syncs with zero loss or duplication; resident visitor-approval response rate above 70%.

**★ Milestone: daily utility, not just monthly billing.**

## Phase 10 — Accounting & recovery (4 weeks)
Chart of accounts, auto-posting, vouchers, expense workflow with approval matrix, petty cash, funds with resolution-gated withdrawals, FDs, fixed assets, depreciation, TDS, GST, budgets, period close, all statements, Tally export, auditor/accountant scoped access, audit observations; recovery stage engine, reminder ladder, demand notices with dispatch proof, defaulter restrictions, settlements, legal case files with one-click bundle.

**Exit** — a pilot society's statutory audit completed using only platform reports; trial balance always balanced; a complete legal bundle produced in one click.

## Phase 11 — Compliance, documents & requests (3 weeks)
Compliance calendar with the full Maharashtra seed, evidence, score, Registrar report, regulatory update feed, statutory config editor; document vault with versions, ACLs, expiry reminders and OCR; request engine with the C14 types and template manager.

**Exit** — no statutory or AMC deadline missed in a pilot society; residents obtain a sale NOC without visiting the society office.

## Phase 12 — Governance & operations (4 weeks)
Meetings with notice validation, quorum, voting and minutes; polls and binding votes; elections; handover pack; amenities; vendors, contracts, service schedules; assets and preventive maintenance; inventory; meter readings; dashboard v2.

**Exit** — a full AGM run end to end producing a compliant record pack; a committee handover completed with recorded acceptance.

## Phase 13 — Production hardening (3 weeks, then ongoing)
Marathi across UI, bills, receipts, notices and demand notices; elderly/simple mode; accessibility pass; third-party VAPT; 2FA enforcement for admins; secrets rotation; DPDP export and deletion flows; retention jobs; performance tuning and indexes; read replicas if needed; CDN for documents; backup and restore drills (RPO 1 h, RTO 4 h); blue-green deploys; runbooks; Play Store and App Store release pipelines; support and onboarding playbooks.

**Exit** — 99.9% uptime for a month; restore drill passed; app store releases automated; VAPT findings closed.

## Timeline summary

| Stage | Phases | Duration |
|---|---|---|
| Sellable MVP | 0–5 | ~14 weeks |
| Sticky product | 6–9 | ~11 weeks |
| Complete product | 10–12 | ~11 weeks |
| Production hardening | 13 | ~3 weeks |
| **Total** | | **~9–10 months** with 5–7 people |

Suggested team: 2 backend, 1 web frontend, 1–2 React Native, 1 QA, part-time CA advisor, part-time advocate review before Phase 10 ships.

---

# PART E — QUALITY, TESTING & OPERATIONS

## E1. Engineering rules
- **Money** — integer paise everywhere; no floats in financial paths; explicit rounding posted to a rounding account
- **Multi-tenancy** — `society_id` on every business table; injected by the scoped repository; automated cross-tenant leakage test in CI
- **Determinism** — billing is a pure function of (snapshotted unit attributes, effective-dated config, effective-dated rates)
- **Immutability** — append-only for bills, receipts, vouchers, ledger entries, notices, minutes, audit logs
- **Idempotency** — all payment webhooks and callbacks idempotent by external reference; `Idempotency-Key` header on money-moving POSTs
- **Soft delete** — `deleted_at`; no hard deletes of members, units or financial records
- **Background jobs** — all long work queued (BullMQ), retried with backoff, monitored on a job dashboard
- **Feature flags** — per society and per plan
- **Localisation** — every user-facing string and PDF template in EN and MR
- **Empty states and inline hints** on every screen; the admin is a volunteer, not a trained operator
- **Loading** — a skeleton describes a real wait and never creates one. Screens carry `LoadState<T>` (`ready` / `loading` / `error`); nothing holds content behind a timer, and `error` always offers a retry. Skeleton for content areas, spinner inside the button for an action, nothing at all for data already in memory. Per-item entrance stagger is not used in the admin web. See `docs/LOADING_AND_MOTION.md`
- **Offline tolerance** — gate app fully offline; user app caches dues, notices and passes read-only

## E2. Database conventions
UUID v7 primary keys · `society_id` on every business table with composite indexes · money as `BIGINT` paise · `timestamptz` stored UTC, rendered IST · `created_at`, `updated_at`, `deleted_at`, `created_by` on every table · effective dating on `charge_rates`, `statutory_config`, `occupancies`, `memberships`, `tenancies` · forward-only migrations · every compliance-driven migration referenced in `CHANGELOG_COMPLIANCE.md`.

## E3. API conventions
```
/api/v1/auth/...                          # public auth endpoints
/api/v1/me/...                            # current user
/api/v1/societies/:societyId/...          # society-scoped resources
/api/v1/platform/...                      # super admin
```
Bearer access token; `societyId` in the path re-validated server-side against the user's memberships; envelope `{ data, meta }` on success and `{ error: { code, message, details } }` on failure with stable machine-readable codes (e.g. `INTEREST_RATE_EXCEEDS_CAP`, `PASSWORD_POLICY_VIOLATION`, `MOBILE_NOT_REGISTERED`); cursor pagination; `?include=` expansions; zod validation on every request; OpenAPI generated from schemas, and `packages/shared-types` generated from OpenAPI so clients cannot drift.

## E4. Test suites
```
backend/test/
├── unit/          domain calculators and rules — fast, no DB, the bulk of tests
├── integration/   services + real Postgres via testcontainers
├── e2e/           onboard → add user → login → bill → pay → reconcile → notice → close
└── compliance/    REQUIRED CI GATE
```

**Compliance suite (release blockers)**
1. Golden bills — pilot societies' real bills reproduced to the rupee
2. One test per apportionment method, including the **family-occupied non-occupancy** case and the **lift-less building** case
3. Historical reproducibility — recompute a 12-month-old bill after config and rate changes; must match
4. Interest cap — 15% rejected; 12% without a resolution reference rejected
5. Cross-tenant isolation on every endpoint
6. Immutability — editing a published bill, receipt, voucher or approved minutes rejected; reversal path works
7. Notice period — AGM notice below the configured lead time blocked without override; override requires a logged reason
8. Auth — temporary password single-use and 24 h expiry; forced change before any screen; lockout after 5 failures; no self-signup path
9. Offline gate — 24 h offline, 200 entries, full sync, no loss or duplicates
10. Retention — visitor PII anonymised after the configured window

**Frontend** — Vitest + React Testing Library for web, Jest + RN Testing Library for mobile, Playwright for critical E2E journeys.

## E5. Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | API p95 < 500 ms; bill run 1,000 units < 2 min; app cold start < 3 s |
| Availability | 99.9% monthly; gate app fully functional offline 24 h |
| Scalability | 10,000 societies, 2 million units; stateless services scaled horizontally |
| Security | OWASP ASVS L2; TLS 1.2+; AES-256 at rest; PII field encryption; argon2id passwords; RBAC; rate limiting; 2FA for admins; annual VAPT |
| Privacy | DPDP Act 2023: consent, purpose limitation, deletion and export requests, breach notification; data resident in India |
| Auditability | Immutable financial records; audit log retained 8 years |
| Backup / DR | Daily encrypted backups, 35-day retention, RPO 1 h, RTO 4 h, quarterly restore drill |
| Localisation | English + Marathi UI, bills, receipts, notices; IN date and currency formats |
| Accessibility | WCAG 2.1 AA target for web; elderly/large-text mode |
| Usability | Core user tasks ≤ 3 taps; guard tasks ≤ 30 s |

## E6. Deployment & release
Environments local → dev → staging → production. Docker images for API and web; managed Postgres and Redis; object storage in India region. Migrations run as a pre-deploy step, forward-only. Mobile releases through Play Store and App Store with staged rollout; a minimum-supported-version check forces upgrade when an API contract changes. Feature flags gate incomplete modules per society. Runbooks for: failed bill run, gateway outage, WhatsApp template rejection, gate app sync failure, database restore.

---

# PART F — DEFERRED BACKLOG (not in V1)

**Rule:** do not build these during the phases above, and do not add "small" pieces of them opportunistically. Promote an item only when two of these are true: three or more paying societies formally requested it; it blocks a sales deal; a rule change makes it legally necessary (then it jumps the queue); it removes recurring support work; its dependency shipped and the remaining effort is under a week.

| Item | Impact | Effort | Target |
|---|---|---|---|
| UPI AutoPay / e-NACH mandates | High | 1 wk | V2 — *pull into V1 if collection efficiency is the main sales pitch* |
| Budgeting with AGM approval workflow | Medium | 1 wk | V2 |
| Community discussion board | Medium | 1 wk | V2 |
| Event calendar with RSVP and contributions | Medium | 1 wk | V2 |
| Redevelopment module | Medium | 3 wks | V3 |
| Deemed conveyance full workflow (beyond tracker) | Medium | 1 wk | V2.5 |
| Dispute management beyond recovery (Sec. 91, courts) | Low | 1 wk | V3 |
| Vendor portal app | Medium | 1.5 wks | V2.5 |
| Tender / RFQ sealed-bid module | Medium | 1.5 wks | V2.5 |
| Staff payroll with PF/ESIC and payslips | Medium | 2 wks | V3 — *consider integrating a payroll SaaS instead* |
| CCTV footage request workflow | Low | 0.5 wk | V2.5 |
| Rich resident directory with profiles | Low | 0.5 wk | V2.5 |
| Marketplace / classifieds / lost and found | Low | 1.5 wks | V3 |
| Anonymous feedback box | Low | 0.5 wk | V2.5 |
| Hindi and Gujarati localisation | Medium | 1 wk each | V2.5 |
| Document Q&A over the vault (AI) | Medium | 2 wks | V3 |
| e-Sign integration (Aadhaar e-Sign / DSC) | Medium | 1 wk | V2.5 |
| Bank direct APIs replacing statement upload | High | 2 wks | V2.5 |
| ANPR / RFID / boom barrier automation | Medium | 2 wks | V2.5 |
| Biometric / face attendance devices | Medium | 1 wk | V2.5 |
| Intercom / IP phone integration | Low | 1 wk | V3 |
| Live Tally sync, Zoho Books | Medium | 1.5 wks | V2.5 |
| Calendar sync for meetings | Low | 0.5 wk | V2.5 |
| WhatsApp chatbot (dues, pay, visitor approval, complaint) | High | 2 wks | V2.5 |
| IoT (water level, energy meters, smart locks) | Low | 3 wks | V3 |
| Society-level loan management with amortisation | Low | 1 wk | V2.5 |
| Insurance claim tracking | Low | 0.5 wk | V3 |
| Municipal property tax portal integration | Medium | 2 wks | V3 |
| Collection-risk prediction per unit | Medium | 2 wks | V3 |
| Expense anomaly detection | Medium | 1.5 wks | V3 |
| Ticket auto-categorisation from photo and text | Medium | 1.5 wks | V3 |
| Bill explanation chatbot in Marathi | High delight | 2 wks | V2.5 |
| Auto-draft minutes from meeting audio | Medium | 2 wks | V3 — depends on the meetings module |
| Anonymised cross-society benchmarking | Medium | 2 wks | V3 — needs a privacy review |
| Township / federation dashboard | Medium | 2 wks | V2.5 |
| Facility-management company console, white-label | High for that channel | 3 wks | V3 |
| Builder pre-handover console with society conversion | Medium | 2 wks | V3 |
| Public API and webhooks for third parties | Medium | 1 wk | V2.5 |
| Email-based self-service password reset | Medium | 0.5 wk | V2 — *optional per-society setting* |
| Rental mode (leases, rent roll, deposits, landlord P&L) | High for a second market | 6–8 wks | after society mode is proven |
| PG / hostel / co-living mode | Medium | 3 wks | V3 |
| SOC 2 / ISO 27001 certification | — | — | V3 |
| Read replicas and aggressive caching | — | — | V2.5, beyond ~500 societies |
| Resident app offline write mode | Low | 1 wk | V2.5 |

---

# PART G — HOW TO START

1. Read this document fully. It replaces every earlier spec.
2. Run **compliance research pass 1** (B1) and write `/docs/compliance/RULES_REGISTER.md` and `SOURCES.md` **before** any billing code. Verify every number in Part B against primary sources and correct this document if anything changed after 07 Sep 2026 — including whether the revised Model Bye-Laws have been notified.
3. Scaffold Phase 0, then propose the Phase 1–2 Prisma schema and API surface, and wait for approval before implementing.
4. Build strictly in phase order. At the end of each phase deliver: migration list, API list, test report against that phase's exit criteria, and the compliance items touched.
5. Open a `TODO(compliance)` and a register entry for anything legally uncertain. Never silently assume.
6. Re-run the compliance research quarterly and on any gazette notification; record diffs in `CHANGELOG_COMPLIANCE.md`.
7. Escalate to a human per B6 whenever money charged to residents or personal data handling is in question.

*End of document.*
