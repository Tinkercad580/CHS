# 0003 — The database enforces the invariants it can

**Status:** accepted, 2026-09-25

**Decision.** Rules that must never break — one current primary owner per
unit, one open tenancy/occupancy, date order, an append-only audit log — are
partial unique indexes, CHECK constraints and triggers in a hand-written
migration, in addition to service-level checks that produce friendly errors.

**Consequences.** A bug, a script or a console session can't corrupt them.
Prisma doesn't model these objects; `prisma migrate diff` confirms it doesn't
try to drop them.
