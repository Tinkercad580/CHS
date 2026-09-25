# Compliance changelog

Every change to a statutory rule, what changed in code and config, and the
migration that applied it.

## 2026-09-25 — initial seed

- `statutory_config` seeded with platform defaults, all `verified_on = NULL`
  (`backend/prisma/seed/statutory.ts`), effective from 2026-06-30.
- DB-level integrity rules added in migration `20260925090000_integrity_constraints`.
- Nothing verified yet; see RULES_REGISTER.md.
