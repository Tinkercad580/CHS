# Sahaj — complete design handoff

Everything in this folder is the current state of the design, as of 14 Sep 2026.
Nothing is a mockup image: every screen here is a working prototype you can click.

---

## Start here

| File | What it is |
|---|---|
| `00-OPEN-THIS-FIRST.html` | **The whole thing, offline, one file.** Six tabs across the top: Foundation, Admin web, Resident prototype, Gate prototype, Resident screens, Gate screens. No server, no build, no network. Open it in any browser. |
| `README.md` | The design decisions and the reasoning behind them — read this before changing anything. |
| `DESIGN_NOTES.md` | This file. Inventory, conventions, and what to build first. |
| `MASTER_SPEC.md` | The original product specification this was designed against. |
| `design-files/` | The uncompiled source. One `.dc.html` per surface, plus `support.js`. |
| `screenshots/` | 45 stills, named by surface and screen. |

---

## The four surfaces

**Foundation Kit** — the design system itself. 12 sections: principles, colour (light and dark), typography, spacing, icons, buttons, form controls, cards, tables, feedback states, empty/loading/error states, and motion. Everything else is built from these.

**Admin web** — 18 screens for the society office. Sidebar shell, dashboard, members & units, users & access, billing, payments, accounting, recovery, gate devices, vendors, notices, meetings, documents, requests, reports, staff attendance, amenities calendar, plus a flow map. Fully interactive: forms save, records open, payments post.

**Resident app** — the phone app for owners and tenants. Dues and payment (QR with a 10-minute timer, or an installed UPI app), notices, visitors and gate passes, helpdesk, amenities booking, AGM voting, statement, daily-help attendance, tenants, personal details, SOS.

**Gate app** — the guard's handset. Shift sign-in, visitor verification by code, walk-in approval loop, daily staff in/out, visitor log, parcels, alerts, plate lookup, shift handover. Dark by default — it is used at night.

---

## Conventions a developer needs

**Colour is a token, never a literal.** Every colour is `var(--name, #fallback)`. The fallback is the light value, so the design renders correctly even if the stylesheet fails. Dark mode is one attribute on `<html>` — `data-theme="dark"` — which re-points the same tokens. Never hardcode a hex in a component.

**Spend colour only on exceptions.** A figure turns `--bad` because it is a problem, not because it is money. Four equally-coloured stats say nothing.

**Derive, never duplicate.** This is the single rule that caused the most rework. A count, a total or a summary must be computed from the rows actually rendered — never written alongside them. The record page carries none of its own facts; it derives them from its row, and its stat tiles derive from its sections after any runtime additions are merged in. See README for the three times this went wrong and why.

**One total, one owner.** A unit owes money; a login does not. The user record links to the member record rather than restating the balance.

**Test for the state you mean.** `pill === "Active" ? "Lock" : "Unlock"` offers to unlock accounts nobody locked. Test for locked.

**Every action changes state.** No button toasts and stops. Locking flips the pill and the list row; receiving a payment moves the chip, the tile, the alert, the ledger and the list together.

**Empty states are designed, not missing.** "None registered", "Nothing open", "Not on file" — never a blank card, and never another record's data borrowed to fill the gap.

**Motion is one system.** Staggered reveal on scroll (`data-reveal`), 4px lift on card hover, `cubic-bezier(.2,.7,.3,1)` throughout. All of it collapses under `prefers-reduced-motion`.

---

## Suggested build order

1. **Tokens and the shell.** Foundation Kit's colour and type sections, then the admin sidebar/header and the mobile tab bars. Everything hangs off these.
2. **Members & units, then the member record.** The record page is the pattern for every other entity — get its derivation discipline right once and reuse it.
3. **Billing → payments → ledger.** The money path is the one users check most and forgive least.
4. **The gate handset.** It has the hardest constraint (offline, gloved hands, night) and the simplest data.
5. **The resident app.** Largest surface, but it mostly consumes what the first four produce.

---

## Known gaps, stated honestly

- Translation covers navigation and headings only; body copy is English throughout.
- The admin sidebar collapses to a hamburger below ~1100px; the intermediate widths are not specially designed.
- The prototypes are separate files, so a gate mark-in cannot literally update the resident's attendance grid live. The data model supports it; in a real build they share a backend.
- Photographic imagery is absent by choice — no stock photos, no AI images. Icons are line-drawn SVG.
