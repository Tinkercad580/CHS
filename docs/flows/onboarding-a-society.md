# Flow: onboarding a society

From nothing to a live society that can bill. MASTER_SPEC Phase 2's exit
target: a non-technical admin takes 500 units live in under 30 minutes.

1. **Platform** — a platform admin calls `platform.createSociety` with name,
   code (e.g. `SVCHS`), type, city and the first admin's name and mobile.
   The society is created as DRAFT, with the default permission templates,
   and the first admin gets the SECRETARY template.
2. **First admin signs in** — enters the mobile, creates a password, and is
   in the admin console.
3. **Profile** — `society.update`: registration, address, PAN / TAN / GSTIN,
   FY start month.
4. **Buildings** — `structure.createBuilding` for each wing: floors, lift,
   construction year and **construction cost** (the sinking and repair funds
   are computed from it).
5. **Units** — `structure.bulkCreateUnits` (floors × units by pattern) or
   `structure.importUnits` (CSV/XLSX, dry run first), then per-unit carpet
   area and water inlets.
6. **Owners and occupancy** — `members.addMembership` per unit (primary owner,
   co-owners), and `members.setOccupancy`. Tenancies with
   `members.createTenancy`.
7. **Logins** — `users.create` or `users.import` (name, mobile, unit,
   user_type). Residents then sign in themselves with create-password.
8. **Bank account** — `society.createBankAccount`.
9. **Billing config** — `society.updateBillingConfig`: cycle, due day, grace
   days, interest rate with its general body resolution, number formats.
10. **Charge heads and rates** — `billing.createHead` + `billing.setRate` for
    each head. Use `billing.simulate` to check the amounts.
11. **Go live** — `society.onboarding` shows what's missing, and
    `society.goLive` flips the society to LIVE once every required item is done.
12. **First bills** — see [monthly-billing.md](monthly-billing.md).
