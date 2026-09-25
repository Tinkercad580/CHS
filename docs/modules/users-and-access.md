# Users and access

**Spec:** MASTER_SPEC A1, C1. **Code:**
- [backend/src/modules/users/](../../backend/src/modules/users)
- [core/http/authenticate.ts](../../backend/src/core/http/authenticate.ts) (`authorizeSociety`)
- [packages/contract/src/permissions.ts](../../packages/contract/src/permissions.ts)

**Endpoints:** `users.*` (all need `users.manage`).

## Roles, user types, permissions

- **Role** is `ADMIN` or `USER`, set per society membership (`society_users.role`).
- **User type** is a label only (OWNER, CO_OWNER, FAMILY, TENANT, GUARD, STAFF,
  ACCOUNTANT, AUDITOR, COMMITTEE, MANAGER). It's never an access decision,
  with one exception: **GUARD** is hard-restricted to gate and common endpoints.
- **Permissions** are strings on the membership. There are 16 user
  permissions (`bills.view`, `payments.pay`, `gate.operate`, …) and 17 admin
  permissions (`users.manage`, `billing.publish`, `notices.publish`, …).

Every society endpoint in the contract names the permission(s) it needs.
The binding checks them before the handler runs, and records which one was
used on the audit row.

## Permission templates

Each society gets the platform defaults when it's created, and can edit them
(`users.templates`, `users.upsertTemplate`):

| Code | Role | Grants |
|---|---|---|
| OWNER | USER | bills, pay, ledger, helpdesk, visitor approval, notices, documents, requests, voting, amenities |
| CO_OWNER | USER | the owner's permissions minus voting |
| FAMILY | USER | helpdesk, visitor approval, notices, amenities |
| TENANT | USER | bills, pay, helpdesk, visitor approval, notices, amenities |
| GUARD | USER | `gate.operate` |
| STAFF | USER | `helpdesk.resolve`, `staff.attendance` |
| ACCOUNTANT | USER | accounts view/edit, reports, ledger |
| AUDITOR | USER | accounts view, reports |
| SECRETARY | ADMIN | every permission |
| TREASURER | ADMIN | billing, payments, accounts, recovery, audit + the owner's permissions |

## Rules the service enforces

- **One mobile, one account.** Adding a number that already exists reuses the
  login. The person keeps their own name and email, and the society only adds
  its access record. Adding someone already in this society is `MOBILE_ALREADY_EXISTS`.
- **Grant bounds:** a USER can't hold admin permissions, and an admin can grant
  only what they hold.
- **Self-protection:** nobody can change their own role or permissions, or
  suspend themselves. The last admin with `users.manage` can't be removed.
- **Temporary passwords:**
  - 10 characters, single use, valid 24 hours;
  - the previous one is superseded;
  - sent by SMS and email through the outbox, with a WhatsApp share link returned to the admin;
  - refused for platform admins, and for people who administer another society the issuing admin doesn't;
  - deliberately not idempotent.
- **Suspension:**
  - sets `suspended_at`, and access to this society stops at once;
  - if it was the person's only society, every session is revoked;
  - the user gets `account.suspended` over realtime;
  - reactivation clears it.
- **Unlock** clears a lockout early.
- **Force logout** (`users.logoutAll`) revokes every session.

## Status shown for a user

| Status | Meaning |
|---|---|
| INVITED | added, no password yet |
| ACTIVE | has a password, not locked or suspended |
| LOCKED | inside a lockout window |
| SUSPENDED | membership suspended in this society |

The list filters by status, role, user type and unit, and has search and
cursor paging with a total.

## Bulk import

`users.import { format: csv|xlsx, contentBase64, dryRun }`:
- **Columns:** `name`, `mobile`, `user_type`, and optionally `unit` (for example `A-1204`) and `email`.
- **Checks:** each row is validated with the same schema as a single add, and duplicates within the file and existing users are reported with line numbers.
- **All or nothing:** a real run creates everyone in one transaction, and only if there are no errors.
- **Record:** every run is logged in `import_jobs`.

## Audit

Every create, update, suspend, reactivate, unlock, temporary password and
force logout writes an `audit_logs` row, with the before and after status.
Secrets are redacted. Admins read it with `society.auditLogs`.
