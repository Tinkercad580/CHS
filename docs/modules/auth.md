# Authentication

**Spec:** MASTER_SPEC A2. **Code:**
- [backend/src/modules/auth/](../../backend/src/modules/auth)
- [core/auth/](../../backend/src/core/auth)
- [core/http/authenticate.ts](../../backend/src/core/http/authenticate.ts)

**Endpoints:** `auth.*`, `me.*` (see [api/ENDPOINTS.md](../api/ENDPOINTS.md#auth)).

## Model

- Users are added by an admin; there's no self-signup, no OTP, and no
  self-service reset.
- A **user** is a login keyed by a 10-digit mobile number. One mobile is one
  account, across every society the person belongs to.
- Access to a society is a separate record, `society_users`; see
  [users-and-access.md](users-and-access.md).

## Sign-in states

`POST /auth/lookup { mobile }` returns the next screen:

| `next` | When |
|---|---|
| `NOT_REGISTERED` | No such user, or no active membership anywhere and not a platform admin. The apps show only "Your number is not registered. Please contact your society office." |
| `LOCKED` (+ `lockedUntil`) | 5 wrong passwords within the lock window |
| `CREATE_PASSWORD` | Added by an admin, never activated, and no live temporary password |
| `ENTER_PASSWORD` | Has a password, or a live temporary password |

Numbers are normalised: `+91`, spaces, dashes and a leading 0 are stripped.

## Flows

**First sign-in** — `POST /auth/activate { mobile, password, confirmPassword, acceptTerms: true }`:
1. The user must exist with no password. The claim is conditional, so two racing activations can't both win.
2. The password policy is checked. The terms timestamp is recorded.
3. `ACTIVATED` is recorded, and the society's admins get a realtime `users.changed`.
4. The result is `SIGNED_IN`, with tokens and `me`.

**Sign-in** — `POST /auth/login { mobile, password, client, deviceId?, deviceName? }` returns one of three results:
- `SIGNED_IN`: tokens and `me`;
- `PASSWORD_CHANGE`: a restricted token, after a temporary password or an admin-forced change;
- `TWO_FACTOR`: a 5-minute challenge token, for admins with TOTP enabled.

The order of checks:
1. IP throttle.
2. User exists and can sign in.
3. Not locked.
4. A live temporary password matches (consumed on use).
5. Otherwise the password matches.
6. If `client` is `gate`, the account must be a guard. This check runs before
   a temporary password is spent, so trying the wrong app doesn't use it up.

A failure increments the counter. The fifth failure locks for 15 minutes and
returns `ACCOUNT_LOCKED`. Unknown numbers and wrong passwords both return
`INVALID_CREDENTIALS`.

**2FA** — `POST /auth/2fa/verify { challengeToken, code }` checks the TOTP
code (±30 s), and wrong codes count toward the lockout. Enrolment is
`me.twoFactorSetup` (returns the secret and an otpauth URL), then `me.twoFactorEnable { code }`.
`me.twoFactorDisable` needs a current code. 2FA is offered to admins only.

**Forced change** — `POST /auth/forced-change` with the restricted token:
1. Checks the policy, then that the password isn't one of the last 3.
2. Clears `mustChangePassword`.
3. Revokes every session and bumps the token version.
4. Returns `SIGNED_IN`.

**Refresh** — `POST /auth/refresh { refreshToken }` rotates the refresh token
(its hash is stored). Presenting an already-rotated token revokes the session
and records `REFRESH_REUSE_DETECTED`.

**Logout and sessions:**
- `auth.logout` revokes this session.
- `me.logoutAll` revokes every session and bumps the version.
- `me.sessions` and `me.revokeSession` let the user manage their devices.

**Password change** — `me.changePassword` checks the current password, the
policy and reuse, then revokes every *other* session and keeps this one.

## Tokens

| Token | Signed with | Life | Grants |
|---|---|---|---|
| Access (JWT HS256: `sub`, `sid`, `ver`) | `JWT_ACCESS_SECRET` | 15 min | Everything the user's memberships allow, checked per request against the live session |
| Refresh (random, stored as SHA-256) | — | 30 days, sliding | A new token pair |
| Restricted `password_change` | `JWT_RESTRICTED_SECRET` | 10 min | `auth.forcedChange`, `auth.logout`, `notifications.unregisterDevice` only |
| Challenge `two_factor` | `JWT_RESTRICTED_SECRET` | 5 min | `auth.verifyTwoFactor` only |

Every authenticated request loads the session by id and compares the user's
`token_version`. That's why revocation, suspension and password changes are
immediate ([ADR 0002](../adr/0002-sessions-checked-per-request.md)).

## Audit trail

`auth_events` records the following for each user, with IP, user agent, the
acting admin where there is one, and a detail:
- activation, sign-in success and failure, lock and unlock;
- password changed, temporary password issued;
- session and all-sessions revoked, refresh reuse detected;
- 2FA enabled and disabled;
- suspended and reactivated.

Admins read it through `users.authEvents`.

## Client side

`SessionController` in `@chs/api-client` drives the state machine, and the
apps only render its state. See [../packages.md](../packages.md) and the app docs.
