# Society setup and structure

**Spec:** MASTER_SPEC C2. **Code:**
- [modules/society/](../../backend/src/modules/society)
- [modules/structure/](../../backend/src/modules/structure)
- [core/statutory.ts](../../backend/src/core/statutory.ts)

**Endpoints:** `society.*`, `structure.*`.

## Society profile and settings

- **Profile** (`society.update`, needs `society.configure`):
  - name and type (SOCIETY_CHS, SOCIETY_AOA, UNREGISTERED);
  - registration number and date, address, city, district, pincode, registrar office;
  - PAN, TAN and GSTIN (format-validated), and the GST-registered flag, which needs a GSTIN;
  - FY start month, contact email and phone.
- **Settings** (`society.updateSettings`):
  - enabled languages and the default;
  - directory on or off;
  - financial transparency, compliance summary visibility;
  - visitor data retention in days, capped by statute (default 90);
  - quiet hours for push (default 22:00–07:00);
  - tenancy expiry reminder days, and auto-suspend on expiry.
- **Guards** get the profile without PAN, TAN, GSTIN or registration details.

## Onboarding and go-live

`society.onboarding` computes the checklist from the data every time; it's
never stored. `society.goLive` moves a society from DRAFT to LIVE only when
every required item is done:

| Item | Required for live |
|---|---|
| At least one administrator | ✓ |
| Buildings added | ✓ |
| Units added | ✓ |
| Billing configuration saved | ✓ |
| A bank account | ✓ |
| Profile and registration | — |
| Construction cost for every building (needed for sinking and repair funds) | — |
| Owners recorded for every unit | — |
| Charge heads, opening balances | — |

## Billing configuration

`society.updateBillingConfig` sets:
- cycle (monthly, quarterly or half-yearly), generation day and due day (1–28), grace days;
- interest rate in basis points, with a general body resolution reference;
- rounding (nearest rupee, up, none);
- bill and receipt number formats (`{CODE}`, `{FY}`, `{SEQ}` placeholders; `{SEQ}` required);
- whether partial payments are allowed;
- allocation order (interest, arrears, current).

Rules (MASTER_SPEC B3.1):
- the interest rate can't exceed the statutory cap (`INTEREST_RATE_EXCEEDS_CAP`);
- a changed non-zero rate needs the resolution (`RESOLUTION_REQUIRED`);
- changes apply from the current period on.

## Bank accounts

`society.createBankAccount` and `updateBankAccount` record:
- the bank, account name and number, validated IFSC, and type (savings or current);
- the purpose (operations, sinking fund, repair fund, other);
- the opening balance with its date, and a VAN prefix.

Account numbers are masked in every response.

## Statutory configuration

`society.statutoryConfig` lists every platform default and society override,
optionally as of a date. `society.setStatutoryConfig` (needs `compliance.manage`)
adds a society override from a date, within the key's bounds:
- a statutory cap can't be overridden;
- a minimum can only be raised;
- a maximum can only be lowered;
- some keys need a resolution.

The previous row is closed on the new row's effective date, and history is
never overwritten. See [../DATABASE.md](../DATABASE.md#statutory-configuration).

## Buildings, units, parking

- **Buildings** have a name, wing, floor count, lift present and construction
  year. The construction cost, in paise, drives the fund charges. Turning a
  building's lift on or off updates `lift_served` on all its units, because
  lift charges follow the building (B3.3).
- **Units:**
  - fields: number, floor, type (residential, commercial, shop, office, parking-only), status (active or inactive), carpet and built-up area, water inlets, lift served, share certificate number;
  - numbers are unique per building; the label is `<building>-<number>` (A-1204);
  - once a unit has been billed it can't be renumbered, only deactivated;
  - there's no delete.
- **Bulk layout** (`structure.bulkCreateUnits`) creates floors × units per floor
  by a pattern such as `{floor}{n}` (floor 0 is `G`, and `n` is zero-padded), skipping
  numbers that already exist. Up to 2,000 at a time.
- **Unit import** (`structure.importUnits`) takes CSV or XLSX with columns
  `building, number, floor[, type, carpet_area, built_up_area, water_inlets, share_certificate]`,
  with a dry run first. It's all or nothing, and every error carries its row number.
- **Unit search** understands labels: `q=A-12` finds building A, numbers
  starting 12. Filters: building, type, status, occupancy. Results carry the
  owner name, current occupancy with its start date, and the tenant's name.
- **Parking slots** have a code, a type (covered, open, stilt, two-wheeler,
  visitor) and an optional building. `allotParkingSlot` allots a slot to a unit
  or frees it; freeing also detaches any vehicle.

## Audit log

`society.auditLogs` (needs `audit.view`) lists every admin action, filterable by
entity, entity id, actor, date range and text.
