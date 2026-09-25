# Security

How the platform protects accounts, society data and money. Details of each
mechanism are in [modules/auth.md](modules/auth.md) and
[modules/users-and-access.md](modules/users-and-access.md).

## Accounts

- **No self-signup** (MASTER_SPEC A2). An admin adds a mobile number, and
  only then can someone set a password for it. Unknown numbers get "not
  registered" and nothing else.
- **Passwords**:
  - hashed with argon2id (19 MiB memory, t=2);
  - at least 8 characters, with a letter and a digit;
  - can't contain the mobile number, can't be a common password, can't repeat one of the last three;
  - verification takes the same time whether or not the account has a password.
- **Lockout**:
  - five wrong passwords lock the account for 15 minutes;
  - the attempt that locks says so, and an admin can unlock early;
  - ten failures an hour from one IP throttle that IP (`LOGIN_IP_FAILURES_PER_HOUR`);
  - both counters live in the database, so they hold across instances.
- **Temporary passwords**:
  - 10 characters from an alphabet without look-alike characters, hashed;
  - single use, valid for 24 hours, replaced when a newer one is issued;
  - logging in with one gives a restricted token that can only complete the forced change;
  - the plain value is shown once to the issuing admin and sent once to the user; it's never stored, logged or cached for idempotent replay;
  - an admin can't reset the login of someone who administers another society they don't.
- **Two-factor** (admins, optional): TOTP (RFC 6238), with the secret encrypted at rest (AES-256-GCM).
- **Gate app**: only accounts with a GUARD membership or `gate.operate` can
  sign in with `client: "gate"`.

## Sessions

- Access JWTs (HS256) last 15 minutes. Refresh tokens are random, stored
  hashed, rotate on every use, and last 30 days.
- **Reuse detection**: presenting an already-rotated refresh token revokes
  the whole session.
- **Instant revocation**: every request checks that the session is live and the
  user's token version matches. Logout, logout-all, suspension and password
  changes therefore take effect on the next request. A revoked session's
  websockets are disconnected.
- Password-change and 2FA-challenge tokens are signed with a **separate key**,
  so they can never pass as access tokens.

## Authorisation

- **Two roles, explicit permissions** (MASTER_SPEC A1). Every society endpoint
  declares the permission it needs in the contract, and the binding checks it
  before the handler runs.
- Admins can only grant permissions they hold themselves. A USER can't hold
  admin permissions. Nobody can change their own role or permissions, or
  suspend themselves. The last admin who can manage users can't be removed.
- **Guards are hard-restricted by surface**: a GUARD token is refused on any
  endpoint not marked `gate` or `common`, whatever permissions were toggled on.
  Guards also:
  - never see phone numbers (the plate lookup returns unit and vehicle only);
  - never receive FINANCIAL notices;
  - get the society profile without its PAN, TAN, GSTIN or registration number.
- **Residents** act only for units they're linked to: their access unit, units
  they own, and units they rent. Additions to their household go to an
  approvals queue.

## Multi-tenancy

Every society endpoint carries `:societyId`, and access is resolved against
that society before the handler runs. Services scope every query by it. An id
from another society is "not found" even inside your own society's path.

A compliance test walks **every** society endpoint in the contract with
another society's admin token and expects 403. New endpoints are covered
automatically.

## Data protection

- **Output filtering**: responses are parsed through the contract's schema,
  so a column that isn't declared (such as a password hash) can't leak.
- **Masking**: bank account numbers are masked in every response.
- **Audit log**: every admin action records who did it, which permission they
  used, the IP, the user agent, the request id, and before/after JSON with
  secrets redacted. The log is append-only in the database.
- **Log redaction**: logs redact credentials, tokens and passwords.
- **Money integrity**: published bills, their lines and the ledger are
  immutable in the database, and corrections are reversals.
- **Webhooks**: they're HMAC-SHA256 signed over the exact bytes received, and
  idempotent by event id. Amounts must match the order.
- **Idempotency**: money-moving POSTs honour `Idempotency-Key`.
- **Secrets**: they come from the environment, and production refuses to start
  with the development defaults. The Firebase service account goes in
  `secrets/` (gitignored) or the platform's secret store.

## Transport and headers

- helmet provides CSP, HSTS, no-sniff and frame denial.
- CORS allows configured origins only.
- nginx terminates TLS in production.

## Known gaps and decisions pending

- **Claiming an invited number**: a number an admin has added, but that hasn't
  set a password, can be activated by whoever types it first. The
  mitigation today is that admins see the activation in realtime. An
  activation code issued by the office would close it; see
  [ARCHITECTURE.md](ARCHITECTURE.md#authentication-master_spec-a2).
- **Shared networks**: the per-IP login throttle can block a whole society on
  shared Wi-Fi. Tune `LOGIN_IP_FAILURES_PER_HOUR`.
- **Gate PIN**: the gate app's shift PIN is local to the handset.
  Server-side device binding comes with the gate module (MASTER_SPEC C9).
- **Not done yet**: a third-party VAPT, DPDP data export and deletion flows,
  PII field encryption beyond TOTP secrets, and Redis-backed rate limits
  across instances.
