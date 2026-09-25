# Members, occupancy and household

**Spec:** MASTER_SPEC C3. **Code:** [modules/members/](../../backend/src/modules/members).
**Endpoints:** `members.*`.

## Who's who

- A **person** (`persons`) is someone the society records: an owner, a
  tenant, or a co-owner without a login. If they have a login,
  `persons.user_id` links them. Adding a person with a mobile number reuses
  the existing record and links the login automatically.
- A **membership** is a person's ownership of a unit: PRIMARY, CO_OWNER or
  ASSOCIATE, with share certificate, shares held, admission date and
  cessation date. There's exactly **one current primary owner per unit**,
  enforced in both the service and the database. Ceasing a membership sets
  a date and reason; nothing is ever deleted.
- **Which units a login acts for** is computed by `actingUnitIds`:
  - the access unit on their membership;
  - every unit they own;
  - every unit they currently rent.

## Occupancy (drives billing)

`members.setOccupancy { status, effectiveFrom }` records one of:
SELF_OCCUPIED, FAMILY_OCCUPIED, TENANTED, VACANT, LOCKED, UNDER_RENOVATION.

Occupancy is effective-dated:
- the previous row is closed on the new date;
- a change can't start before the current row;
- the full history is kept.

Non-occupancy charges apply **only while TENANTED**, never to a
family-occupied flat (B3.2).

## Tenancies

- **Recording one** (`members.createTenancy`):
  - fields: tenant (a person), start and end, rent, deposit, police intimation reference, allowed occupants, and who pays bills (owner or tenant);
  - `createLogin: true` also gives the tenant a TENANT login;
  - the unit becomes TENANTED from the start date;
  - only one open tenancy per unit; a lapsed one the job hasn't closed is closed on its end date.
- **Ending one** (`members.endTenancy`), by an admin or the owner:
  - vacates the unit;
  - suspends the tenant's access to that unit;
  - tells them over realtime.
- **Expiry job:**
  - reminds the owner and tenant 30 days before the end (configurable);
  - after the end, runs the same "end" step automatically, if the society setting is on.

See [../flows/tenancy-lifecycle.md](../flows/tenancy-lifecycle.md).

## Household

Family members, vehicles and pets live on a unit:
- **Vehicles:** plates are normalised (`mh 12 kj 4471` becomes `MH12KJ4471`) and validated, including BH-series plates. A plate is unique per society. A vehicle can be tied to a slot allotted to its unit.
- **Removal** is a soft delete.
- **The gate's plate lookup** (`members.vehicles`, surface `gate`) returns the unit, vehicle, owner name and slot, and **never a phone number**.

## Approvals — residents ask, the office decides

When an admin with `members.manage` adds a family member, vehicle, pet or
tenant, it applies at once. When a resident adds one for their own unit, it
becomes a **member approval** instead:
- the endpoint returns `{ approvalId }`;
- admins see it in `members.approvals`, with a summary and the requester;
- `members.decideApproval { decision, note }` applies the stored payload on
  approval. The row is locked, so two admins can't both apply it; a second
  decision is `CONFLICT`.

The resident sees their requests in `members.myHome`: pending ones, plus
decisions from the last 14 days with the office's note.

`members.reportCorrection` files a DATA_CORRECTION request, which an admin
acts on by hand.

Tenancies can only be requested by an **owner** of the unit.

## Unit 360 and my home

`members.unitOverview` is everything about one unit on one screen, the
Phase 3 exit criterion:
- the unit, its current and past members;
- current occupancy and its history;
- the active and past tenancies;
- family, vehicles, pets, parking slots, nominees;
- the app users linked to the unit and their status.

Admins can see any unit; residents only their own.

`members.myHome` returns the same overview for each unit the caller acts
for, plus their requests.

## Nominees

`members.setNominees` replaces a member's nominees. Shares are in basis points
and must total 100%. Only the member themself or the office can change them.

## Directory

`members.directory` lists members and tenants who opted in, only when the
society has the directory enabled. A mobile number is shown only if that
person chose to show it (`members.directoryPreference`).
