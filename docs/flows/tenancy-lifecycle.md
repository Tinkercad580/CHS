# Flow: a tenancy, start to end

Rules: [../modules/members.md](../modules/members.md).

1. **Recording the tenancy.**
   - If the owner adds the tenant (resident app), it becomes a TENANT_ADD
     approval. The office approves it in the admin console (`members.decideApproval`).
   - If an admin adds it directly (`members.createTenancy`), it applies at once.
2. **On record.**
   - The tenancy stores the dates, rent, deposit, police intimation reference, allowed occupants and bill payer.
   - The unit becomes **TENANTED** from the start date, so non-occupancy charges apply from the next bill.
   - With `createLogin`, the tenant gets a TENANT login and signs in with create-password.
3. **During the tenancy.**
   - If the tenant is the bill payer, bills show the tenant's name.
   - Unit notices and bill notifications reach the tenant as well as the owner.
4. **30 days before the end** (configurable): the tenancy-expiry job SMSes
   the owner and the tenant.
5. **Renewal:** `members.updateTenancy { endDate }` extends it and resets the reminder.
6. **End.** Either the owner or an admin calls `members.endTenancy`, or the
   job does it after the end date when auto-suspend is on:
   - the unit becomes **VACANT** from that date;
   - the tenant's access to the unit is suspended, and they're told;
   - the history keeps the tenancy and the occupancy change.
7. **Next occupancy:** the admin records it (SELF_OCCUPIED, a new tenancy, …).
