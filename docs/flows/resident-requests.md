# Flow: a resident asks, the office decides

Covers family members, vehicles, pets, tenants and data corrections.
Rules: [../modules/members.md](../modules/members.md#approvals--residents-ask-the-office-decides).

1. **The resident adds something** for their unit in the app
   (`members.addFamily`, `addVehicle`, `addPet`, `createTenancy`). Because
   they don't hold `members.manage`, the API stores a **member approval**
   with the payload and returns `{ approvalId }`. The app shows it as "With
   the office".
2. **Admins get `approvals.changed`**, and the dashboard's pending count goes up.
3. **An admin opens the approvals queue** (`members.approvals`), then approves or
   rejects it with an optional note (`members.decideApproval`). On approval,
   the stored payload is applied, for example the vehicle is registered.
4. **The resident is told:** `approvals.changed` updates the app. The decision
   and note appear in `members.myHome.recentDecisions` for 14 days.

Removing a family member, vehicle or pet doesn't need approval.

**Reporting a wrong detail:** `members.reportCorrection { message }` files a
DATA_CORRECTION request, and the office fixes the record by hand.
