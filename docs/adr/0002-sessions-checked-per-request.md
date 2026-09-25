# 0002 — Access tokens are checked against the session on every request

**Status:** accepted, 2026-09-25

**Context.** MASTER_SPEC A2 requires instant effect for suspension, logout-all
and password changes. A purely stateless 15-minute JWT leaves a window.

**Decision.** Every authenticated request loads the session by primary key and
compares the user's `token_version`. Revocation is a row update.

**Consequences.** One indexed lookup per request (sub-millisecond). Revocation
is immediate across instances without a shared denylist. If load ever makes
this matter, cache the lookup for a few seconds — the window is then seconds,
not minutes.
