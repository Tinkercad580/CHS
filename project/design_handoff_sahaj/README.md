# Handoff: Sahaj — housing society management platform

## Overview

Sahaj is a management platform for Indian cooperative housing societies (CHS). It covers three products against one shared data model:

| Product | Platform | User | Purpose |
|---|---|---|---|
| Admin console | Web, desktop-first | Committee member / secretary | Units, members, billing, tickets, notices, gate oversight |
| Resident app | Mobile | Owner, tenant, or both | Dues, notices, visitors, amenities, helpdesk, daily help, AGM votes |
| Gate app | Mobile, dark | Security guard | Visitor verification, entry log, staff attendance, parcels, alerts |

The reference deployment is **Shanti Vihar CHS, Pune — 248 units**. Mock data is consistent across all three products: the same flats, people, bills, passes and tickets appear from every angle, so a reviewer can follow one event (a resident issues a gate code → the guard verifies it → the entry appears in the log) across products.

## About the design files

Everything in `design-files/` is a **design reference written in HTML** — a prototype demonstrating intended appearance and behaviour. It is not production code and should not be copied into an app.

The task is to **recreate these designs in the target codebase**, using its existing framework, component library, state management and styling conventions. The user's stated target stack is **React for web and React Native for mobile**. If no codebase exists yet, build fresh in those.

The prototype files are `.dc.html` — a single-file component format specific to the design tool. Each one contains an HTML template and a JavaScript logic class. **Read them for structure, styling and behaviour; do not port the format.** `support.js` is the design tool's runtime and is irrelevant to implementation — it is included only so the files open in a browser.

To view any file: open it directly in a browser. `Sahaj Complete.dc.html` is a hub with a tab bar over all six sections.

## Fidelity

**High fidelity.** Final colours, typography, spacing, copy, animation timings and interaction behaviour. Recreate pixel-accurately using the codebase's own primitives.

Two files are specification galleries rather than working prototypes (`Resident App.dc.html`, `Gate App.dc.html`) — static screen inventories with annotations. The two `* Prototype.dc.html` files are fully interactive and are the behavioural source of truth where they disagree.

---

## Design tokens

Declared as CSS custom properties on `:root`, with a full dark theme under `:root[data-theme="dark"]`. Every consumer reads `var(--token, #literalFallback)` so a missing variable degrades to the light value rather than the browser default.

### Colour — light

| Token | Value | Use |
|---|---|---|
| `--surface` | `#FFFFFF` | Cards, sheets, inputs, the app bar |
| `--canvas` | `#F7F9F8` | Screen background inside a device |
| `--canvas-deep` | `#EFF3F1` | Page background behind a device frame |
| `--surface-hover` | `#FAFCFB` | Row hover |
| `--subtle` | `#EDF1EF` | Inert fills, table totals, avatar grounds |
| `--border` | `#E3E9E6` | Default 1px border |
| `--border-soft` | `#F1F4F3` | Divider inside a card |
| `--border-strong` | `#CCD6D2` | Input border, secondary button border |
| `--ink` | `#0F1A17` | Primary text |
| `--ink-soft` | `#4A5B56` | Body and secondary text |
| `--ink-muted` | `#6B7A75` | Labels, timestamps, placeholders |
| `--ink-dim` | `#A8B5B0` | Chevrons, disabled glyphs |
| `--accent` | `#0E6B5C` | Primary action, active nav, brand |
| `--accent-ink` | `#0A5749` | Text and icons on accent washes |
| `--accent-wash` | `#E6F2EF` | Accent tint ground |
| `--accent-200` | `#C9E4DC` | Accent border |
| `--ok` / `--ok-ink` / `--ok-wash` | `#167A3C` / `#14663A` / `#E8F5EC` | Paid, present, valid, inside |
| `--warn` / `--warn-ink` / `--warn-wash` / `--warn-border` | `#B45309` / `#8F4A0A` / `#FDF3E7` / `#F5DFBE` | Due, expiring, standby |
| `--bad` / `--bad-ink` / `--bad-wash` / `--bad-border` | `#C0342B` / `#9B2B22` / `#FCEDEC` / `#F6D9D6` | Overdue, invalid, absent, emergency |
| `--info` / `--info-ink` / `--info-wash` / `--info-border` | `#1D4ED8` / `#12327A` / `#EAF0FE` / `#C7D7FB` | Neutral notice, AGM, informational |
| `--rail` / `--rail-ink` / `--rail-soft` / `--rail-line` | `#FFFFFF` / `#0F1A17` / `#5A6B66` / `#E3E9E6` | Admin sidebar |
| `--rail-hover` / `--rail-active` / `--rail-active-ink` / `--rail-foot` | `#F2F8F6` / `#E6F2EF` / `#0A5749` / `#F7F9F8` | Admin sidebar states |

### Colour — dark (`:root[data-theme="dark"]`)

`--surface` `#151C1A` · `--canvas` `#0E1413` · `--canvas-deep` `#090E0D` · `--surface-hover` `#1B2422` · `--subtle` `#1D2624` · `--border` `#2B3532` · `--border-soft` `#222B29` · `--border-strong` `#3A453F` · `--ink` `#EEF3F1` · `--ink-soft` `#A7B8B2` · `--ink-muted` `#8A9B95` · `--ink-dim` `#6F7E79` · `--accent` `#0E6B5C` · `--accent-ink` `#5FD3B6` · `--accent-wash` `#113931` · `--accent-200` `#1A5A4C` · `--ok` `#1E8C48` / `--ok-ink` `#7BD69F` / `--ok-wash` `#11311E` · `--warn` `#C2650F` / `--warn-ink` `#F3BE79` / `--warn-wash` `#33260E` / `--warn-border` `#4A3616` · `--bad` `#C93F35` / `--bad-ink` `#F4A39B` / `--bad-wash` `#331916` / `--bad-border` `#4A231F` · `--info` `#3466E0` / `--info-ink` `#A9C2FA` / `--info-wash` `#15204A` / `--info-border` `#23306A` · `--rail` `#101715` / `--rail-ink` `#EEF3F1` / `--rail-soft` `#9DAFA9` / `--rail-line` `#232D2A` / `--rail-hover` `#1A2321` / `--rail-active` `#14382F` / `--rail-active-ink` `#6FDCC0` / `--rail-foot` `#0C1211`

Theme is set by writing `data-theme="dark"` on the document element. The page's inherited text colour belongs in the stylesheet (`body { color: var(--ink) }`), not in an inline style on the page-root element — and note that `getComputedStyle` returns stale values for a React subtree for some time after the attribute flips, so verify a theme switch from a screenshot rather than from computed styles. A 280ms `background-color, border-color, color` transition is applied to every element whose inline style references a surface, canvas, rail or subtle token, so the switch eases rather than snaps.

### Gate app palette

The gate handset is **permanently dark in both themes** — it is a night-shift device and must not flash white. It uses its own scale, which shifts only slightly under `data-theme="dark"`:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--g-bg` | `#0A1512` | `#06100D` | Screen |
| `--g-card` | `#122320` | `#0D1B18` | Card, nav bar |
| `--g-card-2` | `#18302B` | `#132824` | Raised card, input, keypad |
| `--g-line` | `#21403A` | `#1B3630` | Border |
| `--g-ink` | `#EAF5F1` | — | Primary text |
| `--g-soft` | `#8FB0A6` | — | Secondary text |
| `--g-dim` | `#6A8B81` | — | Timestamps, inactive tabs |
| `--g-go` | `#19B888` | — | Allow, valid, inside, primary action |
| `--g-stop` | `#E04A3C` | — | Deny, invalid, alert |
| `--g-hold` | `#E8A33D` | — | Expired, held parcel, offline |

Ink on `--g-go` is `#04231B`, never white.

### Typography

Two families, loaded from Google Fonts:

- **Figtree** 400 / 500 / 600 / 700 / 800 — all UI text
- **IBM Plex Mono** 400 / 500 / 600 — codes, plates, currency, timers, day numbers, eyebrow labels
- **Noto Sans Devanagari** 400 / 500 / 600 / 700 — required for Marathi and Hindi; the stack is `Figtree, "Noto Sans Devanagari", system-ui, sans-serif`

The scale, as used (`font` shorthand: `weight size/line-height family`):

| Role | Spec | Letter-spacing |
|---|---|---|
| Page title, web | `800 clamp(28px,4vw,42px)/1.08` | `-.03em` |
| Screen title, mobile | `700 24px/1.2` | `-.024em` |
| Screen title, gate | `700 25px/1.16` | `-.026em` |
| Section heading | `700 25px/1.2` | `-.022em` |
| Card title, large | `700 19px/1.25` | `-.02em` |
| Money, hero | `700 34px/1` or `700 30px/1` | `-.03em` |
| Money, mono | `700 16px/1.2 IBM Plex Mono` | — |
| Card title | `600 14.5px/1.3` | — |
| Body | `400 14.5px/1.62` or `400 13px/1.5` | — |
| Label | `600 12.5px/1` | — |
| Meta, timestamp | `400 11.5px/1.35` | — |
| Eyebrow | `600 11.5px/1 IBM Plex Mono`, uppercase | `.1em` |
| Tab label | `600 10.5px/1` | — |
| Gate code, display | `700 40px/1 IBM Plex Mono` | `.2em` |
| Gate code, keypad | `700 30px/1 IBM Plex Mono` | — |
| Status pill | `700 10.5px/1.3` or `600 11px/1.3` | `.04em` on gate |

Long headings carry `text-wrap: balance`; paragraphs carry `text-wrap: pretty`.

### Spacing, radius, elevation

Spacing runs on a loose 4px grid; the recurring values are 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 26, 30, 34, 44px. Mobile screens pad `0 22px`; cards pad 14–18px; sheets pad `10px 22px 28px`.

| Radius | Use |
|---|---|
| 5–8px | Chips, tiny status pills, day cells |
| 9–12px | Buttons, inputs, icon tiles, filter pills |
| 13–16px | Cards, list rows |
| 18–22px | Feature cards, hold buttons |
| 26px top / 38px bottom | Bottom sheets |
| 34–46px | Phone bezel |
| 999px | Filter pills, toggles, badges |

Shadows are sparse and always downward-biased with negative spread:

- Card lift: `0 10px 26px -18px rgba(15,26,23,.3)`
- Hover lift: `0 14px 28px -18px rgba(15,26,23,.34)`
- Phone frame: `0 34px 70px -30px rgba(15,26,23,.5)`
- Sheet: `0 14px 30px -14px rgba(9,14,13,.5)`
- Toggle knob: `0 2px 5px rgba(0,0,0,.22)`

### Motion

`--ease: cubic-bezier(.2,.7,.3,1)` for state changes; `--ease-out: cubic-bezier(.22,1,.36,1)` for entrances.

| Keyframe | Definition | Applied to |
|---|---|---|
| `scIn` / `gIn` | `opacity 0→1`, `translate3d(0,10px,0) scale(.985)→none` | Screen content blocks |
| `cardIn` | `opacity 0→1`, `translate3d(0,18px,0) scale(.965)→none` | Repeating list cards |
| `tabIn` | `opacity 0→1`, `translate3d(0,14px,0)→none` | Hub section switch |
| `sheetUp` | `translateY(102%)→none` | Bottom sheets |
| `toastIn` | `opacity 0→1`, `translateY(14px) scale(.97)→none` | Toasts |
| `popIn` | `scale(.5)→1.1→1`, opacity 0→1 | Success glyphs |
| `fadeIn` | `opacity 0→1` | Scrims, inline errors |
| `spin` | `rotate(360deg)` | Loading rings |
| `shimmer` | `background-position -260px→260px` | Skeletons |
| `pulseGo` | expanding `box-shadow` ring | The gate's Allow-in button |

**Sequencing is the signature of this design.** Screens do not animate as one block — content cascades top to bottom:

```
screen content blocks:  .5s  cardIn/scIn, delay (n-1) × 0.075s, capped at .9s
list rows inside:       .46s cardIn,      delay 0.14s + (n-1) × 0.065s, capped at .78s
tagged cards:           .56s cardIn,      delay 0.1s + (n-1) × 0.085s, capped at .78s
settings/pref rows:     .56s cardIn,      delay 0.38s + (n-1) × 0.07s
```

Repeating cards are marked with a `data-card` attribute (`bill`, `notice`, `pass`, `ticket`, `amenity`, `booking`, `poll`, `tenant`, `util`, `notif`, `staff`, `plate`, `entry`, `parcel`, `alert`, `member`, `vehicle`, `role`, `setting`, `pref`, `lang`) and staggered by `:nth-child`. Do not select on inline style strings — React normalises shorthand properties, which silently breaks such selectors.

Interaction timings: hover lift `translateY(-2px)` or `-3px` over 200ms; press `scale(.98)`–`(.988)` over 140–160ms; toggles slide the knob `left: 3px → 23px` over 220ms.

Everything above is suppressed under `@media (prefers-reduced-motion: reduce)`, which forces both `animation-duration` **and** `animation-delay` to near-zero. Duration alone is insufficient — with a stagger, the delay *is* the timing, and elements carry `animation-fill-mode: both`, so they would sit invisible through their delay.

---

## Roles and data scoping

The resident app supports three roles, switched from Profile → "View the app as". This is not cosmetic; it changes what data exists.

| Role | Unit | Dues | AGM vote | Tenant records |
|---|---|---|---|---|
| **Owner** | A-1204, resident | All bills including facility charges | Yes, one vote per flat | None — empty state |
| **Tenant** | B-702, rented | Maintenance and parking only; facility charges excluded | No — shown an explanation, not a ballot | None — empty state |
| **Owner and tenant** | A-1204 owned/occupied + C-405 let out | Two ledgers, switchable from a Home block; C-405 shows maintenance only | Yes, against the occupied flat | One live agreement for C-405 |

Scope the tenant list on the role, not just its summary line — showing another household's rent is a privacy failure.

---

## Screens

### 1. Foundation Kit — `Foundation Kit.dc.html`

A specification page, not a product screen: colour ramps, type scale, spacing, icons, buttons, form controls, tables, cards, modals, drawers, empty/loading/error/success states, and motion demos. Use it as the single source for token values and component anatomy. Sticky sub-navigation; theme toggle in the header.

### 2. Admin console — `Admin Web.dc.html`

Desktop web, 1440px reference.

**Layout** — a 246px fixed sidebar, `position: sticky; top: 0; height: 100vh`, and a fluid content column.

**Sidebar** (light, `--rail`): 30px accent logo tile + "Sahaj / Admin console"; a society switcher button (24px accent-wash tile "SV", name, "248 units · Pune", chevron); a scrolling nav in labelled groups with 6px custom scrollbar; a fixed footer with 30px round avatar, "Sanjay Patil", "Secretary · full access". Header and footer are `flex: none` so only the nav scrolls.

Nav item states: rest `transparent` / `--rail-soft`; hover `--rail-hover` / `--accent-ink`; active `--rail-active` / `--rail-active-ink` with a `--accent` dot marker and an accent count badge.

**Content**: a sticky top bar (search field, theme toggle, notification bell with `--bad` dot, avatar), then dashboard stat cards, a filterable data table, modal and drawer patterns.

**Every table is live.** The generic page template (used by Members, Users, Payments, Recovery, Gate, Vendors, Notices, Meetings, Documents, Requests, Reports and Accounting) drives real behaviour from one data object per page:

- **Search** filters across every column, case-insensitive, and the footer switches from "Showing 6 of 248 units" to "Showing 2 matching rows"
- **Filter chips** toggle on and off, matched against the occupancy, status and date columns
- **Column headers sort**, ascending then descending, with a ↑/↓ marker on the active column. Currency and date columns sort numerically (₹9,625 before ₹43,180), text columns alphabetically — a single `parseFloat` probe decides which
- **Pagination** switches pages and guards the ends with a toast rather than a dead click
- **Empty state** appears when a search or chip matches nothing, with a Clear button
- Changing screens resets search, chip, sort and page

**Staff & help** — the admin counterpart to the resident daily-help screen, and the source of truth for attendance:

- A **30-column attendance sheet**, one row per person, one cell per day of the month, colour-coded present / absent / weekly off. Every cell is clickable and cycles through the three states; the toast names the person and date, and Present and Payable recompute immediately
- Four stat cards derived from the sheet, never stored: registered count, attendance percentage across person-days, total absences, and payable this month pro-rated on days present
- Role chips filter the sheet
- **Add staff** issues a standing pass (`ST-nnnn`), computes the per-day rate live from the monthly salary, and seeds the month as "not yet recorded" rather than inventing attendance
- Clicking a name opens a detail modal — pass, flats, phone, police verification, salary, days present, payable — with **Revoke pass**, which removes the person and their sheet row together
- Export writes the sheet as CSV

**Amenities** — the admin counterpart to resident booking:

- A **booking calendar**, three slots × five days, each cell either free or showing the amenity, flat and state. Confirmed cells are accent-tinted, pending ones warn-tinted
- Clicking a booked cell opens it: flat, who booked it, when, and the charge going to their next bill, with **Confirm booking** and **Release slot**
- Clicking a free cell opens **Block a slot** pre-filled with that day and slot — for repairs and society functions. It requires a reason (residents see it) and refuses to double-book
- Filter chips narrow the calendar to confirmed or pending
- The rates table lists capacity, hours, rate and deposit, and each **status pill is a toggle** that opens or closes the amenity for booking
- **Add amenity** takes name, capacity, hours, rate and deposit, and the amenity becomes bookable immediately

**Every page's primary action opens a real form.** Rather than 13 bespoke modals, one modal renders from a per-page field spec (`FORMS` keyed by screen), which is the structure worth carrying into the real build:

```
{ k: "a", label: "Unit", ph: "A-1206", kind: "mono", req: true }
{ k: "c", label: "Occupancy", kind: "pick", opts: [...] }
{ k: "pill", label: "Status", kind: "pick", opts: [...], kinds: { Clear: "ok", Due: "warn" } }
```

`k` maps the field to its table column, so a saved record lands in the right cells. `kind` drives both the input treatment and the coercion: `mono` upper-cases and renders in IBM Plex Mono, `money` strips non-numerics and formats as `₹9,625.00` on save, `pick` renders as a row of option buttons instead of a text field. `kinds` maps the chosen status to a semantic pill colour.

Behaviour on save: required fields are validated one at a time, with the offending field's border and "required" hint turning `--bad` and a toast naming it ("Unit is needed"); an empty date column defaults to "Just now"; the new row is **prepended to live state**, filters and paging reset so it is visible, and the footer gains "· 1 added by you". Each form supplies its own confirmation sentence — "Nikhil Rane added at A-1206", "Receipt RCP-2026-09-1206 recorded against B-0902".

The 13 forms: Add member, Add user, statutory config key, Record receipt, New voucher, Bulk notice, Add gate device, Add vendor, Compose notice, Create meeting, Upload document, New request, Schedule report.

**Row clicks open a detail drawer** built from the page's own column labels paired with that row's values, with the status pill, a provenance note, and Edit — which re-opens the form pre-filled from the record and **updates it in place**.

Create and update share one modal, so the distinction has to be carried explicitly: opening the form from the page's primary action clears the edit target, while Edit stashes `{ key, isNew, idx }`. On save, an edited row that the user added is replaced at its index in `added`; an edited *seed* row is written into an `edits` override map keyed by the row's **position in the static array**, stamped on during the merge as `_seed` (`p.rows.map((r, i) => edits[cur][i] || r)`). The key must be immutable and independent of any editable field: keying by the displayed primary key looks correct until someone corrects a mistyped unit number, receipt number or contract number — the next edit is then written under the new key, matches no static row, and is silently discarded while the stale override keeps winning. Without that split, a shared modal appends on every save and you get two contradictory records under the same unit number, receipt number or contract number. The edit target is cleared on Cancel and Escape as well as on save.

**One write path per column, and defaults belong to the field.** The loop over the form's fields is the only place a column is assigned: a typed value wins, and a field left blank takes the default *it declares* (`blank: "Just now"`, `"Never"`, `"None"`, `"v1"`). Two things this replaced, both of which silently destroyed real input:

- A convenience line after the loop (`if (!ed && !money) row.e = f.blank`) that reapplied the fifth column's empty default unconditionally — so on the seven pages with no money column, a date the form had just asked for and accepted was thrown away with a success toast.
- Defaults inferred from column *position* (`x.k === "d" ? "Just now" : "—"`), which is only right where column four happens to be a date. On Users, column four is Unit, so leaving it blank filed the user with "Just now" as their flat number.

**An update must overlay, never rebuild.** The edit target also carries the original record (`orig`), and the saved row starts as a copy of it — only columns the form actually declares are overwritten, and a field left blank while editing keeps its existing value rather than taking the create-time default. Rebuilding the row from the form alone destroys every column the form does not cover: a member's ₹43,180 outstanding balance blanked to "—" after renaming the owner, a user's last-login date replaced by "Never", a document's expiry replaced by its version string. Two related traps:

- **The semantic pill colour must fall back to the original, not to "ok".** Seed statuses are often outside the form's `kinds` map ("Locked 15 min", "Gate app only", "Read-write"), so a bare `kinds[pill] || "ok"` repaints a locked-out account green. Resolve `kinds[pill]`, else keep the original `k` when the status is unchanged.
- **A pick whose current value is outside its option list must still render as selected.** Seed vocabularies drift from form vocabularies (`OWNER` vs `Owner`, "NOC for sale" absent from the options, "Insurance" missing from the folder list). Match case-insensitively and prepend the record's own value as an option when it is unlisted, otherwise Edit shows an empty control and the user "fills" it with a value inconsistent with its neighbours.

**Field labels are derived from the table, not authored alongside it.** Each form supplies `meta` — an array of five input descriptors (`kind`, `ph`, `opts`, `req`) plus a `pill` descriptor — and `formFields(page)` zips that array against `PAGES[page].cols`, taking every label from the column the field actually writes:

```
fields = f.meta.map((m, i) => ({ ...m, k: K5[i], label: p.cols[i].label }))
```

Authoring labels by hand alongside the column list looks fine and drifts immediately: a "Published" date field landing on a Channels column, "Received on" overwriting a bank UTR, a whole Add-gate-device form writing rows into a visitor log. Deriving the label makes that class of bug unrepresentable — a mis-binding now shows up as an obviously wrong label rather than as silent data loss.

Two consequences worth keeping in the real build: the `opts` for each pick and the `kinds` map for each status must be drawn from the vocabulary actually present in that page's rows (the seed data uses "Legal · Sec. 101", "Push · WA · SMS · Email", "Locked 15 min" — not tidier invented equivalents); and where the form and the table genuinely disagree about *what the page is*, the form is the thing that should change. The gate page's table is a visitor log, so its primary action is "Log a visitor", not "Add gate device". The update confirmation is composed from the record itself ("Renamed User updated.") rather than rewriting the create sentence — a regex over the create phrasing silently fails on any form whose sentence lacks the expected verb.

**Secondary actions open a result panel, not a toast.** Each is a modal with a real three-column table of outcomes, a summary line, and either an action button or a plain Close for read-only references (`PANELS`, keyed by screen). The pattern matters because these are the actions where the *result* is the whole point:

- **Upload statement** (Payments) — 142 credits read, each row showing what it matched to and, where it didn't, *why*: "narration has no unit", "two units owe this exactly", "bulk credit, needs splitting". 136 auto-matched, 6 left for a human. Acting posts the 136.
- **Import from Excel** (Members) — 248 rows with per-row results including a blank unit number and a duplicate of an earlier row; imports the 245 that are clean and leaves 3 flagged.
- **Recompute** (Billing) — every charge head re-evaluated against statutory config, showing which two moved and why (3 units newly tenanted, 11 days of interest), then republishes the 34 affected bills.
- **Analytics** (Helpdesk) — 30-day volume and median close time by category, with the conclusion stated.
- **Defaulter board**, **Asset register**, **Record pack**, **Tally export**, **Visitor log**, **Folder export** — same shape, each ending in the action its data implies.
- **Permission templates**, **Statutory config**, **Notice templates**, **Template manager** — read-only references, so they close rather than act.

Cells flagging a problem ("No match", "Blocking", "Overdue", "Missing", "Duplicate") render in `--bad-ink` so the exceptions are findable without reading every row.

Three screens sit outside the generic template and need their own wiring — Billing's **Recompute**, Helpdesk's **New ticket**, and Compliance's **Registrar report** and **Apply fix**. Helpdesk's is a real create form (description, unit, category, priority with its SLA) that prepends a card to the Open column and moves the count; the compliance pair are result panels ending in a filing and a rule change. Verify inert buttons by mounting each nav screen in turn — a sweep run against whatever page happens to be mounted only ever sees that page.

The society switcher **switches**: picking Sahyadri Residency or Green Acres changes the sidebar identity, unit count and city, and returns to the dashboard. A dialog titled "Switch society" that cannot switch is the same stub in better clothing.

**A record opens as a full page, not a side drawer.** A drawer caps the useful width at ~480px, which forces every table into a stacked list and hides the things a reader came for below the fold. Clicking a row navigates to a record screen (`screen: "record"`, with `recFrom` holding the table to return to) laid out as:

- **Identity bar** — back chevron, avatar, name, a mono record code, meta facts, status chips, and the record's real actions right-aligned (Record payment / App access / Edit / Make inactive). Edit re-opens the same pre-filled form the table used.
- **A stat strip** — one bordered container divided into four cells by 1px hairlines (`gap:1px` over a border-coloured background, so the rules stay crisp and reflow correctly when the cells wrap). Each cell carries a 5px status dot, a small-caps label, the figure at 24px in tabular numerals, and a qualifier beneath. Colour is spent only where it carries meaning: the dot always, and the figure itself **only when it is an exception** — ₹12,840.50 outstanding reads in `--bad`, everything else in ink. Four separate cards each with a coloured stripe spend colour on all four equally and say nothing. The label row is height-locked to two lines so every figure sits on one baseline regardless of label length.
- **An exception card** when the record has one — outstanding balance with its due date and a "Receive ₹12,840.50" action. It only renders when there is something to say.
- **A two-column body**, 1.45fr / 1fr: substantial tables and people lists on the left (ledger, household, ageing buckets, notices served, service history), and reference on the right (a two-column detail grid, short lists, an activity trail).

**A record page should show what the person or unit actually uses, not an audit log of their clicks.** The first version led with "Recent activity — last 10 actions" (viewed a bill, signed in, failed sign-in). That is telemetry: it answers "what did they tap" when the admin on the phone needs "what do they have open". The user record now leads with **Helpdesk, Amenity bookings, Visitor passes and Notices**, and the sign-in/session detail is demoted to a single "Access" list in the right column. Sessions still matter — they are just not the headline.

**The login is not the unit — money lives on one, not the other.** A first pass put an outstanding balance on the user record, and the same person then showed ₹6,050 on their user page and ₹12,840.50 on their member page, one screen apart. The user record now carries **no money at all**; it links across ("The unit owns the ledger, not the login → Member record"). One number, one owner.

**Never-signed-in users cannot have app activity.** `RECORD.users(r)` reads `r.e` and `r.pill`: a login with no last-sign-in and "Password not set" shows em-dashes in the stat strip, "Nothing — never signed in" on every usage section, and an alert offering to resend the invite. Claiming 3 visitor passes for someone who never accepted their invite is the kind of detail that quietly tells a reviewer the data is fake.

**An action that only toasts is a drawing of an action.** Every record action now changes state and writes through to the source row, so the list and the record can never disagree: Lock/Unlock flips the pill, Reset password and Send invite move it to "Reset sent"/"Invite sent", Change template rewrites the user's type, Make inactive withdraws access. `patchActive(src, row, upd)` writes into `added` or `edits[src][row._seed]` — the same store the table reads — rather than keeping a parallel record-page state.

**Count the rows you rendered, not the rows you seeded.** Summaries computed inside `RECORD.*` cannot see rows added at runtime, so a stat tile reading "Open tickets 1" ends up sitting directly above a table of four. `rec:` now merges `recAdd` into the sections **first**, then derives every count from the merged result — ledger unpaid/settled, open tickets, upcoming bookings, passes issued, "Paid this FY", and the Outstanding total. `RECORD.*` supplies the rows and the copy; it no longer supplies any number that a user action can change.

**One total, carved rather than doubled.** The row's `e` column stays the single source of what a unit owes, and `RECORD.members` splits it into ledger lines. A charge added by hand is therefore *already inside* that total — prepending it as a row as well double-counts it (₹12,840.50 + ₹3,000 rendered as ₹18,840.50). The fix is `_carve`: `rec:` sums the hand-added unpaid rows and passes them in, and the auto-split covers only the remainder. Add ₹3,000 and chip, tile, alert, ledger sum and the list row all read ₹15,840.50.

Symmetrically, a payment settles hand-added charges too — it walks them off the ledger up to the amount received, since the single "Payment received · NEFT ₹15,840.50" line already accounts for them. Leaving them behind would show a cleared member with an unpaid row.

**Receive payment is the one that proves the model.** It opens pre-filled with the outstanding, accepts a part payment, and on save reduces the chip, the stat tile and the alert together, posts a "Payment received · Cash" line at the top of the ledger, and clears the row to "Clear" when nothing is left. ₹5,000 against ₹12,840.50 leaves ₹7,840.50 in all four places at once.

**Section actions generate their form from the section's own columns.** Rather than a bespoke modal per section, `sect(x)` reads `x.head` (or a `LIST_COLS` entry for untabled sections) and builds one field per column, with per-section placeholders, seeds and explanatory copy. Saving prepends the row into `recAdd[recordKey][heading]`, so an added household member or ledger charge appears on that record only. One modal serves Add charge, Add person, Raise ticket, Book, Issue pass, Register, Upload and Raise.

**Test for the state you mean, not for its opposite.** `live = r.pill === "Active"` then `live ? "Lock account" : "Unlock"` reads correctly but is wrong: any pill that is not exactly "Active" — "Gate app only", "Read-write", "Password not set" — falls through to "Unlock" on an account nobody locked. The test has to name the state it acts on (`/^Locked/.test(r.pill)`), and the action is suppressed entirely where it is meaningless, as on a login that has never been used.

**Per-unit content is keyed to the unit.** Ticket and request references are unique keys — two units cannot both have raised TKT/1182. Content is keyed to `r.d`, so B-0311 gets `TKT/0311` and the full set belongs to one unit only. Two logins on the *same* unit do share its tickets, which is correct: the unit raised them, not the login.

**Sections branch by role, because the roles do different work.** A guard has no amenity bookings; an accountant issues no visitor passes. `RECORD.users(r)` reads the row's type and swaps both the stat strip and the section list: residents get tickets/bookings/passes/notices plus daily help and requests; guards get shifts, gate throughput and handover notes; accountants get posted vouchers and approvals pending. Showing a guard an empty "Amenity bookings" card is worse than not showing it.

**The member record spans everything the unit touches** — ledger, helpdesk, amenity bookings, gate activity, household, vehicles, daily help, requests, app users, notice acknowledgement and documents — because the unit, not the login, is what an admin is usually asked about.

**The record page must derive from the row, not sit beside it.** A hand-written context next to live row values produces a page that contradicts itself — two different join dates, "6 of 6 bills settled" beside an outstanding alert, a ledger whose unpaid rows sum to ₹6,050 under a headline of ₹12,840.50, and a settled member showing unpaid bills. `RECORD.members(r)` now computes from `r`: the join date comes from the row's own column; the ledger's unpaid rows are generated by splitting the row's outstanding across maintenance, parking and an arrears line so they **sum exactly to the headline**; the bills-settled count falls out of how many unpaid rows were generated; and a member with nothing owing gets no alert, no unpaid rows and "All 3 entries settled this FY". Per-unit detail (household, vehicles, share certificate, carpet area) renders only for the one unit it belongs to — everywhere else shows "Not on file" or "None registered" rather than borrowing another member's family and cars.

Also: the record screen must be excluded from the generic-page condition (`isGeneric: !custom.includes(cur)`), or the source table renders underneath it.

Sections are declared as data (`type: "table" | "people" | "grid" | "list" | "trail"`) so a new record type is a data entry, not new markup. Status words in table cells are mapped to semantic pills by a single matcher — paid/ok/current/valid to `--ok`, due/pending/overdue to `--warn`, failed/missed/legal to `--bad` — so "overdue" and "legal" are visually distinct without per-page colour decisions. Pages without hand-written context fall back to the full row plus a trail.

**Every modal has a close icon in its top-right corner**, in addition to Cancel and the scrim. Eight surfaces carry it: the 13-page form, the result panels, new ticket, add staff, add amenity, block a slot, the society picker and the booking detail.

**Responsive** — the breakpoint is **1100px**, tracked with a `resize` listener rather than a media query, because the sidebar changes from a layout participant to an overlay.

| | ≥ 1100px | < 1100px |
|---|---|---|
| Sidebar | 246px, `position: sticky`, in flow | 262px, `position: fixed`, `z-index: 70`, slides in over the content |
| Reveal | Always present | Hidden; a hamburger appears as the first item in the top bar |
| Scrim | None | `position: fixed; inset: 0; z-index: 60; background: rgba(9,14,13,.42)`, `fadeIn` 200ms |
| Entry animation | None | `railIn`: `translateX(-100%) → none`, 260ms on `--ease-out` |
| Dismissal | n/a | Scrim tap, Escape, or selecting any nav item |
| Shadow | None | `0 24px 60px -20px rgba(15,26,23,.4)` |

Selecting a nav item closes the drawer only when narrow — on desktop it stays put.

### 3. Resident app — `Resident Prototype.dc.html` (interactive) and `Resident App.dc.html` (gallery)

390 × 844 phone, 8px `#0B1512` bezel, 38px inner radius, 44px status bar.

**Tab bar** — 5 items, `grid-template-columns: repeat(5,1fr)`, `padding: 8px 8px 22px`, 52px minimum target. Icons are 21px line glyphs, stroke 1.8 rest / 2.3 active, colour `--ink-muted` → `--accent-ink`. Every glyph must be visually distinct at 21px:

| Tab | Glyph path |
|---|---|
| Home | `M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5` |
| Dues | `M3 7.5h18v11H3zM3 11.5h18M7 15.5h3` |
| Notices | `M4 4h16v13l-4 4H4zM8 9h8M8 13h5` |
| Visitors | `M4 20.5V3.5h9.5v17M13.5 12h6.5M17 9l3 3-3 3` |
| Profile | `M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6M12 12.1a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4M6.9 18.6a5.4 5.4 0 0 1 10.2 0` |

**Home** — accent-green header block (status bar inherits the accent ground and white ink here only) with a tappable name/avatar opening Profile, an SOS triangle button, and a bell with an unread dot. Then, overlapping the header by `-14px`: the dues card — eyebrow "Amount due", a due-date chip, `₹6,050` at `700 34px`, "across 2 bills", a full-width Pay now button. Below: a building-status strip, a 4-up quick-action grid (Pay dues, Invite guest, Raise ticket, Amenities), a role block when the role is owner-and-tenant, an AGM votes card, the latest notice, and today's expected visitors with an empty state.

**Dues** — title plus a Statement button; All / Unpaid / Paid filters that trigger a 520ms skeleton shimmer; bill cards with a 3px status edge (`--warn` unpaid, `--ok` paid), amount in mono, category chip. Empty state when a filter matches nothing.

**Bill detail** — total payable, a line-item breakdown with the basis of each charge shown ("1,180 sq ft × ₹3.20"), a totals row, then Pay. Paid bills show a receipt block instead.

**Payment** — exactly two methods, per the requirement: *Pay using QR code* and *Pay using installed app*.

- QR: a generated-looking QR, a **10-minute countdown** as `mm:ss` in mono, a draining progress bar, a polling row, "I have paid — check now", and Cancel with the reassurance "Cancelling here charges nothing." The timer chip goes accent → `--warn` under 60s → `--bad` at zero, where the QR desaturates (`grayscale(1) opacity(.45)`), an "Expired" badge covers it, and the only action is to generate a new code.
- Installed app: a picker of three UPI apps, then straight to success.
- Success is a full-screen takeover: `popIn` check, amount, a receipt table (receipt number, method, unit, date), Download, Done. The bill flips to Paid and the receipt persists.

**Notices** — unread items carry an accent border and dot; tags are Urgent (`--bad`), AGM (`--info`), Facility/Billing (`--subtle`). Detail view acknowledges with a state change to "Acknowledged".

**Visitors** — pass cards with state chips (Expected `--warn`, Inside `--ok`, Standing `--info`), a mono 4-digit code, Cancel where permitted.

**Invite** — a segmented control with two modes:
- *One-time guest*: name, purpose (Guest/Delivery/Cab/Service), validity (2 hours/Today/This week) → 620ms create → a random 4-digit code on a confirmation screen.
- *Daily help*: name, role (Housekeeping/Cook/Driver/Nanny/Care giver), the days of the week they come as 7 square toggles, an hours window (Morning / Twice daily / Full day / Evening), and monthly salary. It computes the per-day rate live — "₹5,200 over about 24 working days is ₹217 a day" — and issues a **standing pass** `ST-nnnn` instead of a code, creating the attendance record at the same time. The confirmation screen relabels itself accordingly and exits to "See attendance".

Cancelling a standing pass must also retire its attendance record. They are one object.

**Helpdesk** — ticket list with state chips; new-ticket form with category, description, an Urgent toggle, inline validation, and a duplicate-awareness banner ("4 other flats have reported lifts today") driven by a per-category count. Detail view shows a timeline and can be resolved.

**Profile** — avatar, name, role line; the three-role switcher; then settings rows: Personal details, My tenants, Daily help, Household members, Vehicles, Deliveries, Notifications, Language. Each row shows a live value.

**Sub-screens** — Personal details (mobile read-only and chipped "Set by the office" since it is the login identity; email, alternate phone, emergency contact editable behind an Edit toggle), Household members (add with relation, remove all but yourself), Vehicles (register with plate and type, remove), Notifications (4 switches, count reflected on the parent row), Language, Deliveries (3 standing options plus a preview of what the guard will see), Daily help (per-person 30-cell attendance grid, 10 columns, colour-coded present/absent/off/not-yet-recorded, with days present, per-day rate and payable total, and Mark salary paid), Amenities (4 bookable with day and slot pickers, one slot pre-taken, bookings list with cancel), Statement (closing balance, the bye-law 68 interest of 1.5% a month stated in money, a year's ledger of charges, payments, credits and interest), AGM votes (two items, live tallies with fill bars, one vote per flat, locked once cast), My tenants (agreement dates, rent, police verification, non-occupancy charge, renewal request), Emergency (four types, hold-to-confirm, and a list of who it reaches), Building status (5 utilities with state, cause and last-updated).

**Localisation** — English, Marathi and Hindi switch live from Profile → Language, and the coverage is **complete, including body copy**. Two separate tables:

1. **`COPY`** — the UI string pack, keyed by string id, one object per language. Read through a `t(key, n)` helper with a `{n}` interpolation slot (`acrossN: "{n} देयकांसाठी"`). Covers tab labels, every screen and sub-screen title, section headings, quick actions, filters, status chips (Unpaid / Paid), counts, settings-row labels and values, sub-screen intro paragraphs, and the dues CTA and due-date chip.

2. **`CONTENT`** — the *data* pack, keyed by record id, read through a `c(id, field, fallback)` helper that falls back to the English record. This is what makes body copy work: bill titles, periods, tags and due notes; notice tags, titles, blurbs, relative timestamps and full multi-paragraph bodies; ticket titles, states and last-update lines; amenity names and rates; utility names, states, causes and timestamps. Delivery preferences and the three role cards carry inline `mr` / `hi` objects instead, since they are UI constants rather than records.

Numerals are localised too — a `num()` helper maps 0-9 to ०-९ for Marathi and Hindi, applied to every interpolated count, so "४ पैकी २ न वाचलेल्या" reads correctly rather than mixing scripts. Currency stays in Latin digits with the ₹ symbol, matching Indian banking convention.

Proper nouns — people's names, flat numbers, the society name, courier brands — are deliberately **not** translated.

**Noto Sans Devanagari is required**, not optional. The stack is `Figtree, "Noto Sans Devanagari", system-ui, sans-serif`; without the face the two Indic languages fall back to whatever the OS supplies and the type goes inconsistent mid-sentence.

### 4. Gate app — `Gate Prototype.dc.html` (interactive) and `Gate App.dc.html` (gallery)

390 × 844, permanently dark.

**Sign-in gate.** The handset opens **locked**: "Sign in to start your shift", the rostered guard's name, and a 4-digit duty PIN keypad (demo PIN `4291`). A wrong PIN clears the field and says "not on today's roster". Until signed in there is no header, no tab bar, **and no other screen mounted at all** — gate every screen's render condition on duty state, not merely the chrome. A locked handset that still renders the entry screen leaks every live visitor code and can admit people.

Signing in stamps the time, reveals the header and tabs, and lands on Entry. Sign-out is a door icon beside the guard's name and a row at the foot of More; both re-lock and clear anything in flight — typed code, open verdict, pending walk-in.

**Tabs** — Entry, Staff, Log, Parcels, More across `repeat(5,1fr)`. "Verify" is deliberately *not* a tab label: it named both the sign-in and the visitor check, which read as the login repeating. Verify survives only as the action button on the Entry screen. Parcels carries a count badge in `--g-go`.

**Entry** — four 60 × 72px code boxes with the active one outlined in `--g-go`, a 3 × 4 keypad of 62px keys (digits, C in `--g-stop`, backspace), a Verify button that only turns green at four digits, a "No code? Log a walk-in" secondary, and the list of expected passes — tapping one fills and submits it.

Verification takes 620ms and produces one of three verdicts in a bottom sheet:

| Verdict | Treatment | Actions |
|---|---|---|
| Valid | `--g-go` check in a tinted tile, visitor/flat/host/purpose/validity table | **Allow in** (pulsing) / Turn away |
| Expired | `--g-hold` clock, same table with status | Try another code / Call the flat instead |
| Unknown | `--g-stop` cross, no table, explicit "do not let this person in on the code alone" | Try another code / Call the flat instead |

Allow in or Turn away writes an entry to the log and navigates there.

**Walk-in** — name, flat, purpose → "Asking A-1204" with a spinner while the resident is pinged (2.6s in the prototype) → approval → Allow in and log, recorded as "walk-in, resident approved". Cancellable at the waiting stage.

**Staff** — the register behind resident-side attendance. Five people with pass numbers and the flats they serve, filters for All/Inside/Out, a 3px status edge, and Mark in / Mark out which timestamps the change.

**Log** — today's movements with a status edge and chips (INSIDE, EXITED, TURNED AWAY), All/Inside/Turned away filters, and Mark exit on anyone inside. Empty state included.

**Parcels** — held parcels, each showing the flat's standing delivery instruction pulled from its preference; Handed to resident closes one. Logging a new parcel asks for the flat and courier and surfaces that flat's instruction as soon as the number is typed.

**More** — Raise an alert, Plate lookup, Shift handover, Walk-in entry, End shift and lock.

**Alert** — four types, a 2-second hold-to-confirm with a fill bar, and a recent-alerts list. Time-based, not tick-counted (see State below).

**Plate lookup** — partial search across registered plates, returning owner, flat, vehicle and slot; a miss instructs the guard to treat it as a walk-in.

**Shift handover** — four live counts (movements, still inside, parcels held, staff on site), a note for the next guard, and completion naming the receiving guard.

### 5. Hub — `Sahaj Complete.dc.html`

A tabbed shell over all six sections for review. Not a product surface; no need to implement.

---

## Interactions and behaviour

**Navigation** is a stack per phone: `screen` plus a `stack` array. Tab taps reset the stack; drill-downs push; back pops. Scroll resets to top on every transition.

**Validation** is inline and specific, never a generic error: an invite without a name says "A guest needs a name before the gate can verify them"; an empty ticket says "Tell us what is wrong so the right person is sent"; a short plate says "Enter the full registration number".

**Toasts** appear bottom-centre above the tab bar, max three, **each with its own dismissal timer of 2.8s**. A shared timer is a bug — a second toast cancels the first one's dismissal and strands it on screen.

**Loading** is either a 520ms skeleton shimmer (dues filter) or an inline spinner with a labelled button state ("Creating pass…", "Sending…", "Checking…").

**Empty states** carry an icon tile, a plain-language line, an explanation, and usually the action that fills them.

**Responsive**: the phone frames are fixed at 390 × 844 by intent. The surrounding page reflows and the side panels wrap. The admin console is desktop-first; below 1100px the sidebar becomes an overlay drawer (specified above).

---

## State management

Each prototype holds one state object. Translating to React or React Native, this is the shape to reproduce.

**Resident**
```
screen, stack[], role, unit, language, dark
bills[], activeBill, dueFilter, duesLoading, lastPaid
notices[] (unread, acked), activeNotice, notifs[]
passes[], newPass, form { name, purpose, window, category, issue, urgent }
tickets[], activeTicket
sheet (null | pay | qr | app | success), qrLeft (seconds), qrState (live | expired)
household[], vehicles[], prefs[], me { email, alt, emergency }, editing
amenity, bookDay, bookSlot, bookings[]
votes { pollId: optionKey }, activePoll, renewed
helpStaff[], activeHelp, paidHelp {}, helpForm { name, role, days[7], window, salary }
inviteType (guest | help), deliveryPref
sosKind, holdingSos, sosPct, sosSent
toasts[], log[]
```

**Gate**
```
onDuty, pin, pinError
screen, code, checking, result { type, pass }
entries[], logFilter
staff[], staffFilter
parcels[], parcelOpen, parcelUnit, courier
walkin { name, unit, purpose }, walkinStage (form | waiting | approved)
plateQuery, handoverNote, handoverDone
alertKind, holding, holdPct, alerts[]
offline, toasts[], log[]
```

Notes that matter:

- The **QR countdown** runs on a 1s interval, stops on expiry, and must be cleared on unmount, on cancel and on sheet close.
- **Hold-to-confirm** (gate alert, resident SOS) is computed from elapsed wall-clock time, not by incrementing a counter per tick. Background tabs and throttled frames make tick-counting silently fail to reach 100%.
- **Derived values are computed, never stored**: total due, unread counts, attendance totals, salary payable, vote tallies, parcels held, staff inside. Storing them invites the two screens to disagree.
- Amenity cost is an **explicit field** on each amenity, not parsed out of its display copy.
- Each product's mock data seeds from a constant and is deep-copied into state, so Reset restores it cleanly.

---

## Assets

No image assets. Every icon is an inline SVG on a 24 × 24 viewBox, `fill: none`, `stroke: currentColor` or a token, `stroke-width` 1.8–2.3, round caps and joins. The QR code is procedurally drawn from `<rect>` cells plus three finder squares — replace it with a real QR encoder.

Fonts come from Google Fonts: Figtree, IBM Plex Mono, Noto Sans Devanagari. Noto Sans Devanagari is required, not optional — without it Marathi and Hindi fall back to whatever the OS provides and the type goes inconsistent.

---

## Files

```
Sahaj Complete Design (offline, open this first).html
                              Self-contained build of everything — one click, no setup,
                              works offline. Fastest way to see all six sections.

screenshots/
  01-05 foundation            Tokens, components, states
  01-05 admin                 Dashboard wide, hamburger, drawer open, helpdesk, dark
  01-12 resident              Home, dues, bill, QR payment, notices, visitors,
                              invite, profile, daily help, statement, votes, emergency
  01-11 gate                  Locked, PIN entered, entry, valid verdict, log,
                              staff, parcels, more, plate lookup, handover, alert

design-files/
  Sahaj Complete.dc.html      Hub over all six sections, editable source
  Foundation Kit.dc.html      Tokens, components, states — the style source
  Admin Web.dc.html           Admin console, desktop web
  Resident Prototype.dc.html  Resident app, fully interactive — behavioural truth
  Gate Prototype.dc.html      Gate app, fully interactive — behavioural truth
  Resident App.dc.html        Resident screen inventory, annotated
  Gate App.dc.html            Gate screen inventory, annotated
  support.js                  Design-tool runtime — ignore, needed only to open the files
```

Open any file directly in a browser. In the two prototypes, the right-hand panel has jump buttons for every screen, scenario shortcuts (expired QR, all bills paid, empty states, offline gate, walk-in approval) and a running log of actions — use it to reach any state quickly.
