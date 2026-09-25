# Admin console (web-app)

The browser console a housing society's committee uses to run the society. Source: [`web-app/`](../../web-app/). This page describes the code as it stands; where the code and this page disagree, the code wins and this page is out of date.

Related: [ARCHITECTURE.md](../ARCHITECTURE.md) (the system as a whole), [API.md](../API.md) (the HTTP API), [LOADING_AND_MOTION.md](../LOADING_AND_MOTION.md) (loading and animation rules).

---

## 1. What it is

The admin console is the web app for society administrators: the secretary, the treasurer and other committee members whose membership in a society has role `ADMIN`. They use it to add users and grant access, keep the member and unit register, set charge heads and rates, generate and publish each month's bills, record cash, cheque and bank-transfer receipts, publish notices and check who received them, and run reports. Residents, tenants, guards and staff do not use it. They use the resident and gate mobile apps, and the console turns them away after sign-in (see `NotAdminScreen`). The UI calls the product "Sahaj".

Most of the console talks to the API; the modules the API does not have yet (accounting, recovery, gate, helpdesk and so on) still render local fixtures. [Section 6](#6-still-on-mock-data) lists them.

---

## 2. Running it

```bash
./scripts/api.sh      # the API on http://localhost:4100 (start this first)
./scripts/start.sh    # the console on http://localhost:5273
```

[`scripts/start.sh`](../../scripts/start.sh) installs `web-app/node_modules` if Vite is missing, kills whatever holds the port, and runs `npm run dev --prefix web-app -- --port 5273 --strictPort`. Options:

| Setting | Effect |
|---|---|
| `CHS_WEB_PORT=6000 ./scripts/start.sh` | Serve on another port. The default is 5273, not Vite's 5173, because another project on the dev machine uses 5173. |
| `./scripts/start.sh --reinstall` | Delete `web-app/node_modules` and install from scratch. |

**Proxy.** [`vite.config.ts`](../../web-app/vite.config.ts) proxies `/api` and `/realtime` (WebSocket) to `CHS_API_URL`, which defaults to `http://localhost:4100`. The browser sees a single origin, so there are no CORS preflights, and the URLs are the same relative URLs production uses (in production nginx does the proxying). `server.host` is on, so a phone on the LAN can open the console. When `WSL_DISTRO_NAME` is set, file watching uses polling because the repo lives on a drvfs mount (`/mnt/e`).

**`VITE_API_ORIGIN`.** [`src/api/client.ts`](../../web-app/src/api/client.ts) builds the base URL as `${VITE_API_ORIGIN || window.location.origin}/api/v1`, and uses the same origin for the realtime socket. Leave it unset for local development and for production behind nginx. Set it only when the API is on a different origin.

**Demo sign-in.** In a non-production database, `./scripts/api.sh` seeds the demo society "Shanti Vihar CHS" ([`backend/prisma/seed/index.ts`](../../backend/prisma/seed/index.ts)). The demo password is `Sahaj@2026`.

| Mobile | Who | What the console does with them |
|---|---|---|
| `9820011001` | Sunil Kulkarni, Secretary template (every admin permission), has a password and an email | The normal demo account |
| `9820011002` | Meera Joshi, Treasurer template, no password, no email | Shows the first-sign-in "create password" screen, then the missing-email banner. With no `users.manage` or `notices.publish`, it also shows `NoAccess` on those screens. |
| `9822041155` | Anita Deshpande, owner (role `USER`) | Signs in, then gets "This console is for society administrators" |

Other scripts: `npm run build --prefix web-app` (`tsc -b && vite build`) and `npm run lint --prefix web-app` (oxlint). The web app has no test suite of its own.

---

## 3. How it's built

### 3.1 Entry and providers

[`src/main.tsx`](../../web-app/src/main.tsx) renders `<App />` in `StrictMode` and imports `styles/globals.css`, which in turn imports the Google Fonts (Figtree, IBM Plex Mono, Noto Sans Devanagari) and `tokens.css`.

[`src/app/App.tsx`](../../web-app/src/app/App.tsx) nests the providers in this order:

```
ThemeProvider                       light/dark: sets data-theme on <html>
└ ApiProvider                       @chs/api-client/react: client, session, realtime, React Query
  └ AdminStoreProvider              cross-page UI state, toasts, selected society
    └ SessionGate                   decides between the sign-in screens and the console
      └ BrowserRouter
        └ Routes → AdminLayout → <Outlet/>
```

The router sits **inside** the session gate. The sign-in screens are not routes: the URL stays as it was during sign-in, and the router mounts at that URL once the admin is signed in.

The singletons live in [`src/api/client.ts`](../../web-app/src/api/client.ts):

| Object | Configuration |
|---|---|
| `apiClient` | `createApiClient({ baseUrl: <origin>/api/v1, tokens: localStorageTokenStore("chs.admin.session"), headers: { "X-Client": "admin-web" }, onSessionExpired: () => session.expire() })`. Tokens live in `localStorage` under `chs.admin.session`. The client refreshes an access token that has less than 10 s left, retries once after a 401, and runs only one refresh at a time. Requests time out after 20 s. Endpoints marked `idempotent` get an `Idempotency-Key` header. |
| `realtime` | `createRealtime({ origin, getAccessToken })`, a Socket.io connection at `/realtime`. |
| `session` | `new SessionController(apiClient, { client: "admin", deviceName: navigator.userAgent.slice(0, 90) })` |
| `queryClient` | `createQueryClient()`: `staleTime` 30 s, `gcTime` 5 min, refetch on window focus. Queries retry at most twice and only when the error is retryable (network error, timeout, 503, 429). Mutations never retry. It is created in this module rather than inside `ApiProvider` so that sign-out can empty it. |

`ApiProvider` ([`packages/api-client/src/react.tsx`](../../packages/api-client/src/react.tsx)) also mounts `RealtimeSync`:

- The socket connects (and refreshes its auth) while the session is signed in, and disconnects otherwise.
- Every server event invalidates the query ids listed in `REALTIME_EVENTS[event].invalidates` ([`packages/contract/src/events.ts`](../../packages/contract/src/events.ts)).
- `session.revoked` with `sessionId: null` expires the session. `me.changed` and `account.suspended` call `session.refreshMe()`.
- After a disconnect, reconnecting invalidates every query, because events may have been missed.

### 3.2 Session gate

[`src/app/SessionGate.tsx`](../../web-app/src/app/SessionGate.tsx) renders from `useSession()` alone:

| `session.state.status` | Renders |
|---|---|
| `unknown` (start-up, restoring) | A bare canvas `div`, with no splash screen or timer. If `session.restore()` threw (the API could not be reached), it renders `UnreachableScreen` with a retry and keeps the stored tokens. |
| `signedOut` | `SignInScreen` |
| `passwordChange` | `ForcedChangeScreen` (after a sign-in with a temporary password) |
| `twoFactor` | `TwoFactorScreen` |
| `signedIn` | `AdminOnly`: `NotAdminScreen` if the user has no `ADMIN` membership and is not a platform admin, otherwise the console |

On start-up the gate calls `session.restore()` once (a ref guards against StrictMode's double effect). `restore()` reads `/me`:

- A 401 clears the tokens and ends at `signedOut`.
- A user with `mustChangePassword` also has their tokens cleared, because a stored full session cannot complete a forced change.

The gate also manages the cache. On `signedOut` it calls `queryClient.clear()`, so one person's rows never show for the next person on the same browser. On `signedIn` it seeds the `me.get` query with the session's `me`.

### 3.3 Routes

All routes render inside `AdminLayout`. The specific routes are listed before the generic catch-alls. Record routes are keyed by their id (`Keyed`, `UserRecordRoute`, `UnitRecordRoute`, `RecordRoute`, `GenericRoute`), so moving from one record to the next remounts the page and resets its modals and local state.

| Path | Component | Data | Purpose |
|---|---|---|---|
| `/` | [`DashboardPage`](../../web-app/src/features/dashboard/DashboardPage.tsx) | API (partly placeholders) | Society overview |
| `/users` | [`UsersPage`](../../web-app/src/features/users/UsersPage.tsx) | API | User list, add user, permission templates |
| `/users/record/:userId` | [`UserRecordPage`](../../web-app/src/features/users/UserRecordPage.tsx) | API | One user: access, sessions, sign-in history |
| `/members` | [`MembersPage`](../../web-app/src/features/members/MembersPage.tsx) | API | Unit register, add member |
| `/members/approvals` | [`ApprovalsPage`](../../web-app/src/features/members/ApprovalsPage.tsx) | API | Approvals queue: residents' family, vehicle, pet, tenant and correction requests |
| `/members/record/:unitId` | [`UnitRecordPage`](../../web-app/src/features/members/UnitRecordPage.tsx) | API | One unit: household, money, tenancy, vehicles, and edits to all of them |
| `/setup` | [`SetupPage`](../../web-app/src/features/setup/SetupPage.tsx) | API | Society setup: go-live checklist (redirects to the first tab the admin can read when they lack `society.configure`) |
| `/setup/:tab` | `SetupPage` with `tab` | API | `profile`, `billing`, `banks`, `buildings`, `parking`, `statutory`. Any other tab is Not found. |
| `/billing` | [`BillingPage`](../../web-app/src/features/billing/BillingPage.tsx) | API | Bill runs, generate a run |
| `/billing/runs/:runId` | [`RunPage`](../../web-app/src/features/billing/RunPage.tsx) | API | Run preview: recompute, publish, discard |
| `/billing/bills` | [`BillsPage`](../../web-app/src/features/billing/BillsPage.tsx) | API | All bills. Query params `?period=YYYY-MM&state=UNPAID\|OVERDUE\|PAID`. |
| `/billing/bills/:billId` | [`BillRecordPage`](../../web-app/src/features/billing/BillRecordPage.tsx) | API | One bill: lines, receipts, cancel, credit note |
| `/billing/heads` | [`ChargeHeadsPage`](../../web-app/src/features/billing/ChargeHeadsPage.tsx) | API | Charge heads, rates, simulation |
| `/billing/ledger/:unitId` | [`LedgerPage`](../../web-app/src/features/billing/LedgerPage.tsx) | API | A unit's ledger with running balance |
| `/payments` | [`PaymentsPage`](../../web-app/src/features/payments/PaymentsPage.tsx) | API | Collections desk, record a receipt |
| `/payments/record/:paymentId` | [`PaymentRecordPage`](../../web-app/src/features/payments/PaymentRecordPage.tsx) | API | One payment: allocation, clear or bounce a cheque, cancel |
| `/notices` | [`NoticesPage`](../../web-app/src/features/notices/NoticesPage.tsx) | API | Notice list, compose |
| `/notices/record/:noticeId` | [`NoticeRecordPage`](../../web-app/src/features/notices/NoticeRecordPage.tsx) | API | One notice: publish, delivery report, correction |
| `/reports` | [`ReportsPage`](../../web-app/src/features/reports/ReportsPage.tsx) | static | Report library |
| `/reports/:slug` | `ReportsPage` with `slug` | API | Run one report. Query params `from`, `to`, `period`, `unit`, `noticeId`. |
| `/flows` | [`FlowsPage`](../../web-app/src/features/flows/FlowsPage.tsx) | mock | Static reference of eight product journeys |
| `/helpdesk` | [`HelpdeskPage`](../../web-app/src/features/helpdesk/HelpdeskPage.tsx) | mock | Ticket kanban |
| `/compliance` | [`CompliancePage`](../../web-app/src/features/compliance/CompliancePage.tsx) | mock | Compliance checklist |
| `/staff` | [`StaffPage`](../../web-app/src/features/staff/StaffPage.tsx) | mock | Staff and attendance |
| `/amenities` | [`AmenitiesPage`](../../web-app/src/features/amenities/AmenitiesPage.tsx) | mock | Amenities and bookings |
| `/audit` | [`AuditLogPage`](../../web-app/src/features/audit/AuditLogPage.tsx) | API | Society audit log |
| `/:pageKey/record/:rowKey` | [`RecordPage`](../../web-app/src/features/record/RecordPage.tsx) | mock | Record page for a generic table row |
| `/:pageKey` | [`GenericPage`](../../web-app/src/features/generic/GenericPage.tsx) | mock | Table page driven by `PAGES[pageKey]`, for the keys in `MOCK_PAGES` only: `accounting`, `recovery`, `gate`, `vendors`, `meetings`, `documents`, `requests` |
| `*` | [`NotFoundPage`](../../web-app/src/features/generic/NotFoundPage.tsx) | — | Any other address |

`App.tsx` lets the two generic routes through only for `MOCK_PAGES`. Any other `pageKey` (a typo, or an old address such as `/reports/record/x` for a screen that now has its own routes) renders `NotFoundPage`, which names the address and offers "Go back" and "Open the dashboard". So does a path with more segments than any route.

### 3.4 Layout and shell

[`src/layouts/AdminLayout.tsx`](../../web-app/src/layouts/AdminLayout.tsx):

- **Sidebar**: 246 px and sticky. Below 1100 px (tracked with a resize listener, not a media query) it becomes a 262 px overlay drawer with a scrim. From top to bottom it holds:
  - the brand
  - the society switcher button
  - the nav from [`src/mock/nav.ts`](../../web-app/src/mock/nav.ts), grouped Overview / Society / Money / Operations / Governance / Insight (Governance ends with "Audit log"). Each item links to `/${key}`, and `dash` links to `/`. Badges come from the API through `useNavBadges()`: only Members & units has one, the count of pending approvals (`members.approvals` `total`, for `members.manage` holders), shown when it is above 0.
  - a footer with the admin's initials, name and `accessSummary()` (for example "Committee · full access"), an account button (the gear, which opens `AccountModal`) and a sign-out button.
- **Top bar** (sticky):
  - a menu button when narrow
  - `GlobalSearch` ([`layouts/GlobalSearch.tsx`](../../web-app/src/layouts/GlobalSearch.tsx)): see below
  - `FyChip`: the society's current financial year, "FY 2026-27", from `society.get` `fyStartMonth` and today in India (`fyLabel`). It no longer says "open": nothing in the API closes a year.
  - the theme toggle
  - a bell that opens `NotificationsDrawer`. Its red dot shows only while `notifications.unreadCount` is above 0, and its label reads "Notifications, N unread".
- **Main**: `EmailBanner` (see [4.9](#49-account-notification-settings-and-the-email-prompt)), then the route `<Outlet/>`.
- **Overlays**: `SocietyModal`, `NotificationsDrawer`, `AccountModal`, and the `Toaster`. Escape closes the rail, the society modal and the drawer.

**Search.** Typing two or more characters searches, 250 ms after the last key, up to three lists in parallel with their own `q`, 5 results each: units (`structure.units`, label or owner), users (`users.list`, name or mobile) and bills (`billing.bills`, number, title or payer). A group is searched only when the admin holds that list's permission. Results are grouped; arrows move, Enter or a click opens the unit record, user record or bill, and Escape closes. ⌘K / Ctrl+K focuses the box from anywhere. While the first results are in flight the panel shows skeleton lines; with none it says "Nothing matches", or the server's message if a search failed.

Sign-out calls `session.logout()`. It posts `auth.logout` with the refresh token, ignores a network failure, clears the tokens and sets `signedOut`. The gate then empties the cache.

### 3.5 Society switcher and the selected society

An admin can hold `ADMIN` memberships in several societies. [`src/api/society.ts`](../../web-app/src/api/society.ts) provides these helpers:

- `useConsoleMe()` reads `me` through the `me.get` query, seeded from the session. Realtime `me.changed` events therefore reach the sidebar without a reload.
- `adminMemberships(me)` returns the memberships with `role === "ADMIN"`.
- `useCurrentSociety()` returns the membership whose `societyId` equals `AdminStore.state.societyId`, and falls back to the first admin membership. It returns `null` only for a platform admin with no society. A stored id from another account, or from a society the user has since lost, falls back the same way.
- `holds(membership, ...perms)` is true if the membership holds any of the listed permissions. It mirrors the contract's `access` rule so a screen can hide what the server would refuse.

**Storage.** The chosen id is kept in `AdminStore` and written to `localStorage` under `chs.admin.society`. It is read back at start-up, so the choice survives a reload. When storage is blocked it lasts for the tab.

**Switching.** Picking a society in `SocietyModal` dispatches `switchSociety`, navigates to `/` and shows a toast. The switcher is disabled when there are fewer than two societies. Every API query has `societyId` in its params, which makes it part of the cache key, so a switch reads the other society's data. Most pages also key their inner component by `societyId`, which resets filters.

### 3.6 Theming

[`src/styles/tokens.css`](../../web-app/src/styles/tokens.css) defines the colours as CSS custom properties on `:root` (light) and redefines them under `:root[data-theme="dark"]`:

- surfaces: `--surface`, `--canvas`, `--subtle`, `--border*`
- ink: `--ink`, `--ink-soft`, `--ink-muted`, `--ink-dim`
- accent: `--accent`, `--accent-ink`, `--accent-wash`
- status: `--ok*`, `--warn*`, `--bad*`, `--info*`
- sidebar: `--rail*`

[`ThemeProvider`](../../web-app/src/app/ThemeProvider.tsx) toggles `data-theme="dark"` on `<html>`, in a layout effect so a reload in dark mode does not flash light. Components write `var(--token, #lightFallback)`, so a missing variable falls back to the light value. `.theme-transition` and a global transition rule ease the switch over 280 ms, and `prefers-reduced-motion` switches animation off in `tokens.css`. The toggle is stored in `localStorage` under `chs.admin.theme`; with nothing stored the theme follows `prefers-color-scheme`. Reads and writes are wrapped, so blocked storage leaves the choice for the tab.

Styling is inline `style` objects throughout. Shared style constants live in [`lib/uiStyles.ts`](../../web-app/src/lib/uiStyles.ts) (`cardStyle`, `cellStyle`, `monoCell`, `amountCell`, `rowBorder`) and [`lib/tableKit.ts`](../../web-app/src/lib/tableKit.ts) (`primaryBtnStyle`, `secondaryBtnStyle`).

### 3.7 Shared components

| Component | File | Use |
|---|---|---|
| `PageHeader`, `LiveStatGrid`, `ApiTable`, `PagerButtons` | [`components/ApiTable.tsx`](../../web-app/src/components/ApiTable.tsx) | The list-page frame for API data: title, stat cards whose value may be `null` (shown as a skeleton bar), search box, filter chips, sortable header, rows from a `LoadState<T[]>`, empty and "Nothing matches" states with "Clear search and filters", footer text, and a numbered pager |
| `DataTable`, `CardHead`, `SubNav`, `PanelTabs`, `Note`, `Blurb`, `Form`, `FieldPair`, `ConfirmModal`, `Crumbs`, `RetryButton`, `CardButton` | [`components/Kit.tsx`](../../web-app/src/components/Kit.tsx) | `DataTable` is a table without list chrome, with skeleton rows in the real columns and an inline error with retry. `SubNav` is a tab strip built from real links (Billing, Members & units, Society setup). `PanelTabs` is the same look with buttons, for tabs without a URL (the account dialog). `ConfirmModal` is the confirm step for irreversible actions, with an optional reason field (`reason.optional` labels it optional) and the server's error message. `CardButton` is the small button inside a card or table row. |
| `ImportModal` | [`components/ImportModal.tsx`](../../web-app/src/components/ImportModal.tsx) | CSV / XLSX import with a dry run first, for `users.import` and `structure.importUnits` (both take `ImportBody`): lists the expected columns, reads the file as base64 (5 MB cap), shows the server's per-row errors, and offers "Import N" only for a file with no errors, because the server imports all or nothing |
| `DataBoundary` | [`components/DataBoundary.tsx`](../../web-app/src/components/DataBoundary.tsx) | Renders `loading` / `ready` / `error` for any `LoadState`. The error branch shows the message, "Nothing was changed." and "Try again". |
| `Skeleton`, `SkeletonText`, `SkeletonRows` | [`components/Skeleton.tsx`](../../web-app/src/components/Skeleton.tsx) | Placeholders, shown only while a request is in flight |
| `Spinner` | [`components/Spinner.tsx`](../../web-app/src/components/Spinner.tsx) | Shown inside the button that started a request |
| `ModalShell`, `ModalHeader`, `ModalFooter`, `GhostButton`, `PrimaryButton` | [`components/ModalShell.tsx`](../../web-app/src/components/ModalShell.tsx) | Scrim and card. Escape or a scrim click closes it (many API modals pass a no-op `onClose` while busy). `PrimaryButton` takes `busy`, `busyLabel`, `tone="bad"` and `type="submit"`. |
| `TextField`, `PickField`, `SelectField`, `CheckField`, `FormError` | [`components/FormFields.tsx`](../../web-app/src/components/FormFields.tsx) | Fields for API forms. `TextField` has a real `<label>`, a `hint`, an `error` rendered under the field with `aria-invalid`, and `time` / `password` types. `PickField` is a radio group of buttons. The first three take `disabled` (read-only billing configuration). `FormError` shows a server message that belongs to no single field, verbatim. |
| `FieldRow` | same file | Field for the mock forms (`DataFormModal`, `QuickModal`) |
| `Pill`, `DotPill` | [`components/Pill.tsx`](../../web-app/src/components/Pill.tsx) | Status pill. Kinds: `ok`, `warn`, `bad`, `info`, `mute`. |
| `NoSociety`, `NoAccess` | [`components/NoSociety.tsx`](../../web-app/src/components/NoSociety.tsx) | "No society to show" for a platform admin with no society. "You don't have access… It needs the X permission" when the membership lacks it. Pages render these instead of firing requests the server would refuse. |
| `Toaster` | [`components/Toaster.tsx`](../../web-app/src/components/Toaster.tsx) | Bottom-centre stack. Each toast has its own 2.8 s timer. `toast(text, "ok" \| "warn")` comes from `useAdminStore()`. |
| `RecordHeaderCard`, `RecordTiles`, `RecordAlertCard`, `RecordColumns`, `SectionCard`, `RecordSkeleton`, `RecordMessage` | [`features/record/RecordView.tsx`](../../web-app/src/features/record/RecordView.tsx) | The record-page layout, shared by the mock `RecordPage` and every API record page. `SectionCard` accepts a `load` state and shows a skeleton or error in place; `actions` adds header buttons beside its own one (a tenancy's Edit and End), and `rowAction(i)` gives a people or list row its own button, or none when it returns `null` (Remove on a family row, Open on a receipt). View models are built with `section()` and `tile()` from [`features/record/recordModel.ts`](../../web-app/src/features/record/recordModel.ts). |
| `StatGrid`, `DataFormModal`, `QuickModal`, `PanelModal` | `components/` | Mock-page pieces. `PanelModal` is also used for the Users & access "Permission templates" panel. |

Table helpers in [`lib/tableKit.ts`](../../web-app/src/lib/tableKit.ts):

- `useCursorPager(resetKey)` turns server cursors into numbered pages. Page N becomes reachable once pages 1 to N-1 have been seen. A change of `resetKey` returns to page 1; the reset happens during render, so a stale cursor is never requested.
- `useSettled(value, 250)` debounces the search box.
- `rowProps(open)` gives a clickable row that also opens on Enter and is focusable.

### 3.8 Formatting helpers

**Money.** The wire carries integer paise. [`lib/money.ts`](../../web-app/src/lib/money.ts) converts on digit strings, never through a float:

| Function | Example |
|---|---|
| `inr(paise)` | `1284050` → `₹12,840.50`. `{ whole: true }` drops `.00`. Negatives get `−`. |
| `inrRound(paise)` | Rounded to the rupee, for dashboard figures |
| `inrShort(paise)` | `₹8.24 Cr`, `₹16.5 L` |
| `rupeesToPaise(input)` | `"12,840.5"` → `1284050`. `null` for anything that is not a non-negative amount with at most 2 decimals. |
| `paiseToInput(paise)` | Pre-fills a rupee field: `180000` → `"1800"` |
| `rateKind`, `rateFromInput`, `rateToInput`, `rateLabel`, `RATE_FIELD_UNIT`, `wireRateUnit` | Charge-head rates. The admin types rupees (up to 6 decimals) or a percent (up to 2 decimals). The wire stores paise or basis points as a decimal string. |
| `periodLabel("2026-10")`, `periodShort`, `nextPeriod` | `October 2026`, `Oct 2026`, `2026-11` |
| `todayIso()`, `istDate(iso)` | Today, or a timestamp's date, in `Asia/Kolkata` as `YYYY-MM-DD` |
| `fyLabel(fyStartMonth)` | `FY 2026-27` for today in India (`FY 2026` for a January start) |
| `bpsChange(bps)` | `+12.4%` |

[`lib/format.ts`](../../web-app/src/lib/format.ts) has older float-based `money()` / `moneyDecimal()` and the mock-table search and sort helpers. The API screens use `lib/money.ts` only.

**Dates and wire values.** [`lib/apiFormat.ts`](../../web-app/src/lib/apiFormat.ts):

- `formatMobile` → `98200 11001`
- `formatDate` → `01 Apr 2026`
- `formatWhen` → `Today, 08:14`, `Yesterday, 19:02` or a date
- `formatDateTime`, `formatUntil`
- `enumLabel("SELF_OCCUPIED")` → `Self-occupied`
- `userStatusPill`, `authEventLabel`, `deviceLabel`

**Domain labels.** [`lib/moneyLabels.ts`](../../web-app/src/lib/moneyLabels.ts) (billing, payments and notices despite its name):

- `CATEGORY_LABEL`, `METHOD_LABEL`, `needsResolution`, `isFund`
- the `BILL_STATE` / `RUN_STATE` pills
- `MODE_LABEL`
- `paymentPill`: a pending cheque is "In clearing", a failed cheque "Bounced", a reversed receipt "Cancelled"
- `BUCKET_LABEL`
- `NOTICE_CATEGORY_LABEL`, `audienceLabel`, `channelsLabel`, `deliveryLabel`, `noticePill`

[`lib/permissionLabels.ts`](../../web-app/src/lib/permissionLabels.ts) groups permission strings into modules for display (`moduleRows`, `modulesSummary`) and finds the template a user's permissions exactly match (`matchingTemplate`). The API does not record which template was applied.

### 3.9 Error handling

Every failed call rejects with `ApiError` ([`packages/api-client/src/errors.ts`](../../packages/api-client/src/errors.ts)). It carries:

- `code`: a contract `ErrorCode`, or `NETWORK_ERROR` / `TIMEOUT`
- `status`, `message`, `details`, `requestId`
- `fieldErrors`: messages keyed by dotted path, taken from a `VALIDATION_FAILED` response
- `retryable`

[`lib/apiErrors.ts`](../../web-app/src/lib/apiErrors.ts) `splitError(err, fields)` decides where the messages go:

- **Field errors**: messages whose path is in `fields` go under those fields.
- **Form error**: shown above the buttons. This is the first unplaced field message, or else `err.message`. It is `null` when every issue landed on a field.
- **Non-`ApiError` failures** become "Something went wrong. Try again."

Forms follow one pattern:

1. Check locally what the server would refuse (missing unit, bad amount, reason too short), so all problems show at once.
2. Call `mutateAsync`.
3. Pass the error through `splitError`, mapping wire paths to form fields where they differ (for example `unitId` → `unit`, `person.name` → `name`).

Some codes get their own handling:

| Code | Where | Handling |
|---|---|---|
| `ACCOUNT_LOCKED` | Password step | Moves to the locked screen with `details.lockedUntil` |
| `MOBILE_ALREADY_EXISTS` | Add user | Shown under the mobile field |
| `CONFLICT` with `details.runId` | Generate bills | Offers "Open that run" |
| `EMAIL_REQUIRED` | Email report | Opens the inline add-email form |
| `CONFLICT` | Deciding an approval | Shown as the server says it ("This request has already been decided."); the queue is refetched and the dialog offers only "Back to the queue" |
| `INTEREST_RATE_EXCEEDS_CAP`, `RESOLUTION_REQUIRED` | Billing configuration, statutory values | Shown verbatim above the Save button |
| `INVALID_CREDENTIALS`, `TWO_FACTOR_INVALID` | Change password, two-factor | Shown under the current-password or code field |
| `NOT_FOUND` | Record pages | "This … could not be found" with Back and no retry |

One-click actions report through a toast. Success shows the success text; failure shows `e.message` as a `warn` toast.

### 3.10 Loading rules

These follow [LOADING_AND_MOTION.md](../LOADING_AND_MOTION.md):

- Queries become `LoadState<T>` through `toLoadState(query)`. A loading state lasts exactly as long as the request, and nothing adds a timer.
- Lists use `placeholderData: keepPreviousData`, so the current rows stay on screen while the next page or search result loads. The pager learns `nextCursor` only when `!isPlaceholderData`.
- A stat card with value `null` shows a skeleton bar; a failed count shows `—`.
- Record pages show `RecordSkeleton` until the main query answers. Secondary sections pass `load={toLoadState(q)}` to `SectionCard` and load independently.
- A spinner appears only inside the button that was pressed, with a status label ("Publishing…", "Checking units…").
- Pages enter with a single `fadeUp .3s` on the container. There is no per-row stagger.
- Mock screens render their fixtures on the first paint and have no loading state.

---

## 4. Features

Permissions below are the contract's `access` rules. "Any of" means holding at least one of them is enough. The UI checks the same rules with `holds()` so that it can hide actions or show `NoAccess`. The server still enforces every rule.

Every mutation invalidates the queries listed in its contract entry's `invalidates` (`useApiMutation` does this), so lists and records refetch without cache patching. Realtime events do the same for changes made by someone else. Each subsection lists the events that affect it.

### 4.1 Sign-in screens

Files: [`features/auth/SignInScreens.tsx`](../../web-app/src/features/auth/SignInScreens.tsx), [`features/auth/AuthKit.tsx`](../../web-app/src/features/auth/AuthKit.tsx). All calls go through `SessionController` ([`packages/api-client/src/session.ts`](../../packages/api-client/src/session.ts)). No screen touches tokens directly.

| Screen | When | Endpoint |
|---|---|---|
| Mobile | `signedOut` | `auth.lookup` returns `next`: `ENTER_PASSWORD`, `CREATE_PASSWORD`, `LOCKED` (with `lockedUntil`) or not registered |
| Enter your password | `ENTER_PASSWORD` | `auth.login`. Wrong password: the field error shows and the field is cleared. `ACCOUNT_LOCKED` moves to the locked screen. |
| Create your password | `CREATE_PASSWORD` | `auth.activate` with `{ mobile, password, confirmPassword, acceptTerms: true }`. The terms box is checked client-side because the body types `acceptTerms` as the literal `true`. The policy hint comes from `schemas.auth.PASSWORD_MIN_LENGTH`. |
| Number not registered | lookup found nothing | Shows "contact your society office". There is no sign-up and no OTP. |
| Account locked | `LOCKED` | Shows the unlock time and minutes left, "Try again" (lookup again) and "Use a different number" |
| Set a new password | `passwordChange` | `auth.forcedChange` with the restricted token. "Cancel and sign out" is offered. |
| Two-factor code | `twoFactor` | `auth.verifyTwoFactor`, 6 digits. "Back to sign in" calls `session.expire()`. |
| This console is for society administrators | signed in without an admin membership | Sign out only |
| Can't reach the server | `restore()` failed | Retry |

The device sent with each sign-in is `{ client: "admin", deviceName: <user agent> }`.

### 4.2 Dashboard

[`features/dashboard/DashboardPage.tsx`](../../web-app/src/features/dashboard/DashboardPage.tsx)

| Endpoint | Permission (any of) | Used for |
|---|---|---|
| `reports.dashboard` | `reports.view`, `billing.generate`, `payments.record`, `accounts.manage`, `society.configure` | All figures |
| `billing.runs` | `billing.generate`, `billing.publish` | Latest published run (header subtitle, bill count), current draft |

The page shows:

- **Greeting** by time of day and the admin's first name. The subtitle names the month of the latest published run and how long ago it was published.
- **Buttons**: "Export" goes to `/reports`. The primary button is "Review <month> draft" when a draft run exists, otherwise "New bill run" (goes to `/billing`).
- **Stat cards**: billed this month and FY, collected this month with a progress bar and the FY collection efficiency, outstanding with an ageing bar (0–30 / 31–60 / 61–90 / 90+). The "Compliance score" card shows `—` because there is no compliance API.
- **Billed vs collected**: this month against the year to date. The design's six-month chart is not built, because the API has no collections by month.
- **Needs your attention**: a draft run (goes to the run), overdue over 30 days (goes to `/reports/defaulters`), pending approvals (goes to `/members/approvals`), invited users who never signed in (goes to `/users`).
- **Top defaulters**: up to 5, each linking to the unit record, plus "All", which goes to `/reports/defaulters`.
- **Residents**: occupancy split, active and invited app users, notices this month.
- **Fund balances** and **Today at the gate** keep their place but show `—` ("not live yet").

Without a dashboard permission the page says so and does not call the API. If the dashboard call fails, an error card with retry is shown above the cards.

Realtime: `billing.changed` and `payments.changed` invalidate `reports.dashboard`, and `billing.changed` also invalidates `billing.runs`.

### 4.3 Users & access

Files: [`features/users/UsersPage.tsx`](../../web-app/src/features/users/UsersPage.tsx), [`UserRecordPage.tsx`](../../web-app/src/features/users/UserRecordPage.tsx), [`UserModals.tsx`](../../web-app/src/features/users/UserModals.tsx). Every endpoint here needs `users.manage`. Without it, the page and the record both render `NoAccess`.

**List (`/users`).**

- `users.list` with `q`, `status` / `role` from the chips, `cursor` and `limit: 20`.
- Chips: Locked (`LOCKED`), Never logged in (`INVITED`), Admins (`role=ADMIN`), Suspended.
- Search, chips and paging are done by the server. Sorting only reorders the current page, because the endpoint has no sort parameter.
- The four stat cards (Active, Never logged in, Locked out, Admins) each run their own `users.list` with `limit: 200`. The count reads "200+" when there is a next cursor.
- "Permission templates" opens a `PanelModal` built from `users.templates`.
- "Import users" opens `ImportModal` on `users.import` (columns `name`, `mobile`, `user_type` required; `unit`, `email` optional). The dry run lists each bad row (bad mobile, unknown unit, a type with no resident template, a mobile already in the society). The server imports all or nothing, so "Import N users" appears only for a clean file.
- The status pill comes from `userStatusPill`: Suspended, "Locked until …", "Password not set" (INVITED), "Gate app only" (guards), Active.

**Add user** (`AddUserModal`, `users.create`, idempotent):

- Fields: name, mobile, permission template (picked from `users.templates`), unit label (optional), email (optional).
- The form checks against `schemas.users.CreateUserBody` before sending.
- The unit label is resolved to an id with `structure.units?q=<label>` and must match exactly.
- The template supplies `role`, `userType` and `templateCode` together, because an admin template on a `USER` role is refused.
- On success the admin lands on the new user's record.

**Record (`/users/record/:userId`).**

- Reads: `users.get`, `users.sessions`, `users.authEvents` (`limit: 20`), `users.templates`.
- Tiles: last sign-in, active sessions, permission count with the matched template name ("Custom" when none matches), account state.
- Sections: Sign-in history, Sessions (with "Sign out everywhere"), Profile details, Money (a link to the unit's member record when the user has a unit), Modules visible (with "Edit").

Actions:

| Action | Endpoint | Shown when |
|---|---|---|
| Reset password | `users.issueTempPassword` | Not yourself |
| Change template | `users.update` `{ templateCode, userType }` | Not yourself |
| Edit (name, unit, email, notes) | `users.update`. `unitId` is sent only if the unit changed. | Always |
| Edit permissions (checkboxes) | `users.update` `{ permissions }` | "Modules visible" → Edit, not yourself. The Administration group is disabled unless the user's role is `ADMIN`. |
| Unlock | `users.unlock` | Status `LOCKED` (also on the alert card) |
| Reactivate | `users.reactivate` | Status `SUSPENDED` (also on the alert card) |
| Suspend (reason required) | `users.suspend` | Otherwise, not yourself |
| Sign out everywhere | `users.logoutAll` | Has sessions, not yourself |

The mobile number cannot be edited.

Realtime: `users.changed` invalidates `users.list`, `users.get`, `users.sessions` and `users.authEvents`.

### 4.4 Members & units, and the unit record

Files: [`features/members/MembersPage.tsx`](../../web-app/src/features/members/MembersPage.tsx), [`UnitRecordPage.tsx`](../../web-app/src/features/members/UnitRecordPage.tsx), [`MemberModals.tsx`](../../web-app/src/features/members/MemberModals.tsx).

**List (`/members`).**

- Guard: the `structure.units` rule. Any of `society.configure`, `members.manage`, `billing.generate`, `gate.operate`, `gate.manage`.
- Reads:
  - `structure.units` with `q`, `buildingId` (one chip per building), `cursor` and `limit: 20`
  - `structure.buildings`
  - `members.approvals` with `status: PENDING, limit: 1` for its `total`, only with `members.manage`
- Columns: Unit, Primary owner, Occupancy, Carpet area, Outstanding, Status.
  - Outstanding is always `—`, because the unit list carries no dues.
  - Status is Inactive, "Data missing" (no owner or no carpet area), or Active.
- The "Tenanted" and "Vacant" cards show `—`, because the list has no occupancy totals.

- With `members.manage` the page has the tabs Units / Approvals (`MembersTabs`), a "Review N requests" button when requests are waiting, and "Add member". Without it none of these show, since the server would refuse them.

**Add member** (`AddMemberModal`, `members.addMembership`, needs `members.manage`):

- Fields: unit label (resolved by exact match with `useUnitResolver`), name, mobile, kind (primary owner, co-owner or associate, from `schemas.members.MEMBERSHIP_KINDS`), share certificate number, admission date (defaults to today in India).
- A member is a register entry, not a login. Giving them app access is a separate step in Users & access.

**Approvals queue (`/members/approvals`).** [`ApprovalsPage.tsx`](../../web-app/src/features/members/ApprovalsPage.tsx), needs `members.manage` (`NoAccess` otherwise).

- `members.approvals` with `status` from the chips (Pending, Approved, Rejected), `cursor` and `limit: 25`, through `useCursorPager`. The server lists oldest first. The footer quotes `total`.
- Stat cards: waiting, approved and rejected, each a `limit: 1` read of its `total`. The waiting card names when the oldest request arrived.
- Columns: request (kind and the server's summary), unit, requested by, details (the first three payload fields), received, status. A pending row says "Review →"; a decided row shows the pill and who decided it when.
- Opening a row shows everything the resident sent, read per kind from the payload (the body of the endpoint the request stands for): family name, relation, mobile, birth date; vehicle plate, type, make, colour, owner, sticker; pet name, species, breed, vaccination; tenant name, mobile, email, dates, rent and deposit (paise formatter), police intimation, occupants, bill payer, login requested; a correction's message. Anything else is listed as it came.
- **Decide** (`members.decideApproval`): an optional note to the resident, then Approve or Reject, then a confirm step that says what approving will do ("Riya Deshpande will be added to A-1204's household") and that a decision cannot be undone. Approving applies the request on the server; a correction or profile change is only marked done. A `CONFLICT` (another admin decided first) is shown verbatim and the queue refetched.
- "Open unit" goes to the unit record.

Realtime: `approvals.changed` invalidates `members.approvals`, so the queue, the nav badge and the dashboard count follow other admins' decisions and new requests.

**Unit record (`/members/record/:unitId`).**

- Reads:
  - `members.unitOverview`
  - `billing.ledger`, for the balance, advance and "Paid this FY"
  - `billing.bills` with `unitId, limit: 12`, which fills the Ledger section. This needs any of `billing.generate`, `billing.publish`, `payments.record`, `accounts.manage`.
  - `billing.unitCharges` with `unitId`, `billing.heads` (for the manual heads) and `billing.runs` (for the earliest start date), only with `billing.generate` or `society.configure`
- "Paid this FY" sums `PAYMENT` ledger credits since 1 April and leaves out payments that a `REVERSAL` entry later cancelled.
- Header chips: occupancy, tenant, "No owner recorded", "Carpet area missing", "₹X outstanding".
- Tiles: Occupancy, Carpet area, Paid this FY, Outstanding.
- An "Outstanding" alert card with "Receive ₹X" appears when there are dues and the admin holds `payments.record`.
- Sections: Ledger, Household, Tenancy, Occupancy history, Past tenancies, Past members, Profile details, Manual charges, Vehicles, Pets, App users, Nominees. Tenancy (with "No tenant recorded") and Pets show even when empty for a `members.manage` holder, so there is somewhere to add them.
- The tenancy's rent and deposit use `inr()`.

Actions ([`MemberModals.tsx`](../../web-app/src/features/members/MemberModals.tsx)). An admin with `members.manage` applies family, vehicle, pet and tenancy changes directly; the server sends only residents' requests to the queue.

| Action | Where | Endpoint | Permission |
|---|---|---|---|
| Record payment / Receive ₹X | header, alert card | `RecordPaymentModal` with the unit fixed and the dues suggested | `payments.record` |
| Unit ledger | header | `/billing/ledger/:unitId` | — |
| Add member | header, Household | `AddMemberModal` with the unit pre-filled | `members.manage` |
| Add family | Household | `members.addFamily` (`FamilyModal`: name, relation, mobile, birth date, checked with `FamilyMemberInput`) | `members.manage` |
| Remove (family row) | Household | `members.removeFamily`, after a confirm | `members.manage` |
| Add tenant | Tenancy, when none | `members.createTenancy` (`TenancyModal`: name, mobile, email, start, end, rent and deposit in rupees, police intimation, occupants, bill payer, "give the tenant an app login") | `members.manage` |
| Edit | Tenancy | `members.updateTenancy` (end date, rent, deposit, police intimation, occupants, bill payer) | `members.manage` |
| End tenancy | Tenancy | `members.endTenancy` (`EndTenancyModal`, the date it ended); the server suspends the tenant's access | `members.manage` |
| Change occupancy | Occupancy history | `members.setOccupancy` (`OccupancyModal`: status, from date, note) | `members.manage` |
| Add vehicle / Remove | Vehicles | `members.addVehicle` (`VehicleModal`: plate checked with `VehicleInput`, type, make, colour, owner, sticker, one of the unit's parking slots) / `members.removeVehicle` after a confirm | `members.manage` |
| Add pet / Remove | Pets | `members.addPet` / `members.removePet` after a confirm | `members.manage` |
| Set amount | Manual charges | `billing.createUnitCharge` (`UnitChargeModal` with the unit fixed: an active MANUAL head, the monthly amount, from, until, note) | `billing.generate` or `society.configure` |
| Add charge | Ledger | `AdhocBillModal` for this unit | `billing.publish` |

Realtime: `members.changed` and `structure.changed` invalidate `members.unitOverview` and `structure.units`; vehicle changes go to the whole society, so the gate's plate lookup refreshes too. `approvals.changed` invalidates `members.approvals`. `billing.changed` and `payments.changed` invalidate `billing.ledger` and `billing.bills`. `billing.unitCharges` is refreshed by the admin's own `createUnitCharge`.

### 4.5 Billing

Billing screens share [`BillingShell.tsx`](../../web-app/src/features/billing/BillingShell.tsx):

- `BillingGuard` requires any of `billing.generate`, `billing.publish`, `society.configure`, `payments.record` or `accounts.manage`, and keys its children by society. Its `need` narrows it to one screen's own rule ([`billingAccess.ts`](../../web-app/src/features/billing/billingAccess.ts)): the run preview needs `RUNS_PERMS` (`billing.generate` or `billing.publish`), Bills `BILLS_PERMS`, Charge heads `HEADS_PERMS`. Without it the screen shows `NoAccess` and fires no request.
- `BillingHeader` renders the title and the tabs Bill runs / Bills / Charge heads, leaving out the tabs the admin cannot open.

Realtime: `billing.changed` invalidates `billing.runs`, `billing.run`, `billing.bills`, `billing.bill`, `billing.ledger` and `reports.dashboard`. `billing.heads` is refreshed only by the admin's own head and rate mutations.

#### Bill runs (`/billing`)

[`BillingPage.tsx`](../../web-app/src/features/billing/BillingPage.tsx) reads `billing.runs` (any of `billing.generate`, `billing.publish`).

- **Stats**: last published run, current draft, billed this FY (published runs only), and the next period, which is the month after the latest non-discarded run.
- **Table**: period, bill date, due date, bill count, total, published time, status.
- **Primary button** (`billing.generate` only): "Review <month>" when a draft exists, otherwise "Generate bills".

**Generate bills** (`GenerateRunModal`, `billing.createRun`, needs `billing.generate`):

- Fields: period (month input, pre-filled with the suggestion), optional bill date ("Defaults to the 1st") and due date ("Defaults to billing setup").
- On success the server has computed every bill; the modal shows a toast and navigates to the run.
- A `CONFLICT` whose `details.runId` is set means the period already has a run, and the modal offers "Open that run".

#### Run preview (`/billing/runs/:runId`)

[`RunPage.tsx`](../../web-app/src/features/billing/RunPage.tsx) reads:

- `billing.run`
- `billing.heads`, for each head's method and the rate in force at `run.periodStart`
- `billing.runs`, to find the last published run with an earlier period
- that previous run's `billing.run`, for the building comparison

It shows:

- A step strip: Snapshot, Compute, **Preview**, Approve, Publish. A draft sits on Preview; a published run shows every step done.
- **Head-wise totals**: label, method code, amount, units and rate label, then the total billed.
- **Variance by building**: each building's change against the previous run. A 10 % move fills the bar, and anything over 5 % is amber. With no previous run the bars show each building's share of this run.
- The **units whose bill moved more than 10 %** (`run.variances`). Each links to the unit record.
- **Exceptions** raised by the engine (`run.exceptions`: code, unit, message).

Actions on a draft:

| Action | Endpoint | Permission | Notes |
|---|---|---|---|
| Recompute | `billing.recomputeRun` | `billing.generate` | Toast with the new count and total |
| Publish N bills | `billing.publishRun` (idempotent) | `billing.publish` | Disabled when `billCount` is 0. Opens a `ConfirmModal`. `useApiMutation` keeps one Idempotency-Key for the run until the publish succeeds, so a retry after a timeout is replayed by the server. |
| Discard | `billing.discardRun` | `billing.generate` | Opens a `ConfirmModal`, then returns to `/billing` |

The publish confirm tells the admin three things:

- Bills get numbers, are posted to ledgers and residents are notified.
- Published bills cannot be edited; a mistake is corrected by cancelling that bill or issuing a credit note.
- How many exceptions are still listed, if any. Its cancel button is then labelled "Review exceptions".

A published run shows "View N bills", which goes to `/billing/bills?period=…`. A discarded run shows a note.

#### Bills (`/billing/bills`) and one bill

[`BillsPage.tsx`](../../web-app/src/features/billing/BillsPage.tsx) reads `billing.bills` with `q` (bill number, title or payer), `period`, `state`, `cursor` and `limit: 25`. The permission is any of `billing.generate`, `billing.publish`, `payments.record` or `accounts.manage`.

- Period chips are the latest three published runs, plus the period in the URL if it is not among them. State chips: Unpaid, Overdue, Paid. Both filters live in the URL.
- The footer quotes `total` only without a state filter, because the payment-state filter is applied after the page is read on the server.
- "Supplementary bill" (`billing.publish`) opens `AdhocBillModal`.

**Supplementary bill** (`AdhocBillModal`, `billing.adhocBills`, idempotent, needs `billing.publish`):

- Fields: unit labels (comma or space separated, resolved together, and every one must match), title, 1 to 20 lines of label and rupee amount, due date (defaults to today + 15 days).
- A note shows the per-unit total times the number of units.
- The endpoint is idempotent, and the same form input keeps the same Idempotency-Key until it succeeds, so pressing the button again after a dropped connection does not bill twice.

[`BillRecordPage.tsx`](../../web-app/src/features/billing/BillRecordPage.tsx) (`/billing/bills/:billId`) reads:

- `billing.bill`
- `payments.list` with `unitId, limit: 200` through `useApiInfiniteQuery`, fetching every page, then keeping the payments with an allocation to this bill. The list has no bill filter, and a bill can be paid long after it was issued. The section shows its skeleton until the last page is in. This needs any of `payments.record`, `accounts.manage`, `billing.publish`.

It shows:

- Tiles: total (charges, interest, GST), paid, balance, arrears carried.
- Head-wise breakup: each line's `method` / `kind`, the engine's `basis` text and `ruleRef`, then totals.
- Bill details, and receipts against this bill, each with "Open" to its payment.

The Back button returns to wherever the admin came from (`useBack`).

| Action | Endpoint | Shown when |
|---|---|---|
| Record payment | `payments.record` via `RecordPaymentModal`, balance suggested | Published, balance > 0, `payments.record` |
| Unit ledger | route | Always |
| Credit note | `billing.creditNote` (amount, reason of at least 5 characters, `billId`) | Published, `billing.publish` |
| Cancel bill | `billing.cancelBill` (reason of at least 5 characters, `ConfirmModal`) | Published, `paidPaise === 0`, `billing.publish` |

#### Charge heads (`/billing/heads`)

[`ChargeHeadsPage.tsx`](../../web-app/src/features/billing/ChargeHeadsPage.tsx) and [`HeadModals.tsx`](../../web-app/src/features/billing/HeadModals.tsx) read `billing.heads` (any of `billing.generate`, `billing.publish`, `society.configure`) and `billing.runs`.

- **Stats**: active heads, fund heads, active heads with no rate (excluding `MANUAL`), and "Rates can start". That date is the 1st of the month after the last published period, or the 1st of the current month if nothing is published.
- **Opening a head** shows its category, method, current rate, base head, resolution, filters and full rate history (Current and Upcoming pills).
- **Simulate** calls `billing.simulate` with a chosen `asOf` date and has a unit filter.
- **Retire / Reactivate** calls `billing.updateHead` `{ active }`.
- **Rename** (`RenameHeadModal`) calls `billing.updateHead` `{ name, nameMr }`. Code, category and method stay; published bills keep the name they were issued with.
- A `MANUAL` head shows **Unit amounts** instead of a rate history: `billing.unitCharges` with `headId` (unit, from, until, amount, note), a summary of the units billed and the monthly total (each unit's latest amount that has not ended), and "Add unit amount" (`UnitChargeModal`, `billing.createUnitCharge`: unit label, amount in rupees, from, until, note). The server closes the unit's previous amount on the new start date. Rename and Add unit amount replace the head's dialog, and closing them returns to it.
- **Set new rate** opens `SetRateModal`.
- Editing requires any of `billing.generate`, `society.configure`.

**Add charge head** (`CreateHeadModal`, `billing.createHead`):

1. Category first, from `schemas.billing.CHARGE_CATEGORIES`.
2. The apportionment options are exactly `schemas.billing.ALLOWED_METHODS[category]` (Rule 106C-12(3)). A single allowed method is preselected and explained.
3. Name and code. The code is suggested from the name (2 to 20 characters of A–Z, 0–9 and `_`).
4. A `PERCENT_OF_HEAD` head must pick a base head. The base cannot itself be a percentage head, and for `NON_OCCUPANCY` it must be a `SERVICE` head.
5. `SINKING_FUND`, `REPAIR_FUND` and `GB_APPROVED_OTHER` show general-body resolution fields. They are required only for `GB_APPROVED_OTHER`.
6. A "GST applies" checkbox.

**Set rate** (`SetRateModal`, `billing.setRate`):

- The rate is typed in rupees or percent. The hint echoes how it will be stored ("stored as 25 basis points").
- `FIXED_PER_UNIT_TYPE` takes one rupee amount per unit type (RESIDENTIAL, COMMERCIAL, SHOP, OFFICE, PARKING_ONLY).
- The start date defaults to the earliest allowed date. Fund categories require the resolution.
- The server's refusals are shown verbatim: a date inside a published period, a fund below its statutory minimum, non-occupancy over its cap.
- `MANUAL` heads have no Set rate or Simulate button; their amounts are set per unit.

#### Unit ledger (`/billing/ledger/:unitId`)

[`LedgerPage.tsx`](../../web-app/src/features/billing/LedgerPage.tsx) reads `billing.ledger` with optional `from` / `to` dates.

- Stats: balance due, advance, billed (debits) and received and credited (credits) in the rows shown.
- Rows run oldest first with a running balance. Bill rows open the bill; payment rows open the payment.
- Buttons: credit note (`billing.publish`), add charge (`billing.publish`, which opens `AdhocBillModal`), record payment (`payments.record`).

### 4.6 Payments

Files: [`features/payments/PaymentsPage.tsx`](../../web-app/src/features/payments/PaymentsPage.tsx), [`PaymentRecordPage.tsx`](../../web-app/src/features/payments/PaymentRecordPage.tsx), [`RecordPaymentModal.tsx`](../../web-app/src/features/payments/RecordPaymentModal.tsx). Guard: any of `payments.record`, `accounts.manage`, `billing.publish` (the `payments.list` rule).

**Collections desk (`/payments`).**

- `payments.list` with `unitId`, `status`, `from` / `to`, `cursor` and `limit: 25`.
- The list API has no text search, so the search box takes a unit label and resolves it with `useUnitLookup` (debounced, exact match). A label that does not match shows an empty list.
- Chips: Cheques pending (`PENDING`), Recorded today (`from = to = today`, which filters on the recorded date), Cancelled (`REVERSED`), Failed.
- Stats:
  - Collected today: `SUCCESS` payments recorded today whose `paidAt` is also today in IST
  - Cheques in clearing: count and amount
  - Payments on record: `total` from a `limit: 1` query
  - Unmatched credits: always `—`, because bank statement matching is not live

**Record receipt** (`RecordPaymentModal`, `payments.record`, idempotent, needs `payments.record`). The same form input keeps its Idempotency-Key until it succeeds, so a second press after a timeout is replayed, not recorded twice.

- The unit is fixed when the modal is opened from a unit, bill or ledger. From the desk it is typed, looked up live, and the owner and dues (from `billing.ledger`) are shown before saving.
- The amount follows the found unit's dues until the admin types their own. Paying more than is due shows a note that the extra is held as advance.
- Modes: Cash, Cheque, UPI, NEFT, IMPS, RTGS, Other. Every mode except cash needs a reference (the cheque number or UTR). A cheque also takes bank and cheque date, and a note says it stays pending until cleared.
- On success from the desk, the admin lands on the payment's record.
- The toast depends on the result. A `PENDING` cheque says "counts once cleared"; anything else names the issued receipt number.

**Payment record (`/payments/record/:paymentId`).**

- Reads `payments.get`.
- Tiles: amount, amount against bills, amount held as advance, status.
- Allocation table: interest first, then the oldest bills, the rest as advance. Rows with a bill open that bill.
- Payment details.

| Action | Endpoint | Shown when |
|---|---|---|
| Mark cleared | `payments.chequeAction` `{ action: "clear" }` | Status `PENDING`, mode `CHEQUE`, `payments.record` |
| Mark bounced (optional reason, labelled optional) | `payments.chequeAction` `{ action: "bounce", reason? }` | same |
| Cancel receipt (reason of at least 5 characters) | `payments.cancelReceipt` | Status `SUCCESS`, receipt `ISSUED`, `payments.record` |
| Unit ledger | route | Always |

Realtime: `payments.changed` invalidates `payments.list`, `payments.get`, `billing.bills`, `billing.ledger` and `reports.dashboard`. This includes online payments that residents complete in the resident app.

### 4.7 Notices

Files: [`features/notices/NoticesPage.tsx`](../../web-app/src/features/notices/NoticesPage.tsx), [`NoticeRecordPage.tsx`](../../web-app/src/features/notices/NoticeRecordPage.tsx), [`NoticeComposer.tsx`](../../web-app/src/features/notices/NoticeComposer.tsx). Every admin endpoint here needs `notices.publish`, and both pages show `NoAccess` without it.

**List (`/notices`).**

- `notices.list` with `q`, `status` / `category` from the chips (Drafts, Published, Superseded, Emergency), `cursor` and `limit: 25`.
- Columns: title, audience, channels, published date, read, acknowledged, state (`noticePill`: Draft, Superseded, Expired, Ack pending, Emergency, Published).
- Stats come from the latest 100 published notices (`limit: 100`) and a `limit: 1` drafts query: sent this month (the month in India, and each notice's publish date in India), read %, acknowledged % of those that required acknowledgement, and the draft count.

**Composer** (`NoticeComposer`, `notices.create` / `notices.update`). It saves a **draft**; publishing is a separate step.

| Field | Values and rules |
|---|---|
| Title | 3 to 160 characters |
| Body | 3 to 20 000 characters |
| Category | From `schemas.notifications.NOTICE_CATEGORIES`. `EMERGENCY` requires a reason of at least 5 characters, which bypasses quiet hours and is logged. |
| Send to | Everyone, Owners, Tenants, Residents, Staff, Committee, Buildings (toggle buttons built from `structure.buildings`), Units (labels resolved together, and all must match) |
| Channels | Push and Email checkboxes. With neither ticked, a note says the notice appears only in the apps' notice list. |
| Acknowledgement required, Pin to the top | Checkboxes |
| Expires | Local datetime, sent as ISO |
| Corrects an earlier notice | Select of published notices that have not been superseded. Sets `supersedesId`. |

**Record (`/notices/record/:noticeId`).**

- Reads `notices.get`, plus `notices.report` for published notices and `structure.buildings` for building names.

For a draft:

- Tiles: status, audience, channels, expiry.
- **Publish** calls `notices.publish` after a `ConfirmModal`. The confirm names the audience and channels, says the recipient list is fixed and the notice becomes immutable, and warns that an emergency bypasses quiet hours. The toast reports how many recipients it reached, and says so when an earlier notice was marked superseded.
- **Edit** opens the composer on the draft.
- **Delete draft** calls `notices.discard` after a confirm, then returns to `/notices`.

For a published notice:

- Tiles: recipients, read, acknowledged, delivered (push and email counts from the report).
- The notice body.
- The **Delivery & acknowledgement** table, one row per recipient: name, unit, push status, email status, read time, acknowledged time (or Pending). This table is the proof of service, and `EmailReport` with `type="notice-delivery"` and `{ noticeId }` emails it.
- **Issue correction** (when not already superseded) opens the composer in correction mode: the title is prefixed "Correction: ", the text is copied and `supersedesId` is set. Saving navigates to the new draft.
- A "Corrections" section lists the notice this one corrects and the one that corrected it, each with its own "Open".

Realtime: `notices.changed` invalidates `notices.list`, `notices.get` and `notices.report`, so read and acknowledgement counts update while the admin is looking.

### 4.8 Reports

[`features/reports/ReportsPage.tsx`](../../web-app/src/features/reports/ReportsPage.tsx) and [`EmailReport.tsx`](../../web-app/src/features/reports/EmailReport.tsx). Guard: any of `reports.view`, `billing.generate`, `payments.record`, `accounts.manage`, `notices.publish`, `members.manage`, the rule for both `reports.get` and `reports.email`.

`/reports` is the library, one card per entry in `REPORTS`. An unknown slug shows a message above the library. The slug is sent as the `:type` path parameter, and the backend maps `bill-register` to `BILL_REGISTER` and so on.

| Slug | Parameters (in the URL query) |
|---|---|
| `defaulters` | none |
| `collections` | `from`, `to` (defaults: the last 30 days) |
| `bill-register` | `period` (default: this month) |
| `receipt-register` | `from`, `to` |
| `member-ledger` | `unit`: a label, resolved to `unitId` |
| `occupancy` | none |
| `tenant-register` | none |
| `notice-delivery` | `noticeId`, from a select of the latest 100 published notices. The notice list needs `notices.publish`, so without it the report is left out of the library and its URL shows `NoAccess`. |

`/reports/:slug` runs `reports.get` once its parameters are valid, and shows a "waiting" message until then.

- Columns come from the response. `money`, `number` and `date` columns are formatted, and money and number columns are right-aligned.
- `totals` are shown in the footer: under their column when they match one, otherwise as extra lines.
- ISO dates and periods in the server's subtitle are rewritten as readable dates.
- "Find in results" filters the rows on the client.

**Email me Excel / CSV** (`EmailReport`, `reports.email` with `{ ...params, format: "xlsx" | "csv" }`):

- The file is built in the background and mailed to the admin. The response gives `to`, and the page shows "Queued… will arrive at <to>".
- If the server answers `EMAIL_REQUIRED`, the component shows an inline "Add your email" form. It saves the address with `me.update` and then sends the report that was originally asked for.

### 4.9 Account, notification settings and the email prompt

[`features/account/AccountPanels.tsx`](../../web-app/src/features/account/AccountPanels.tsx)

**`EmailBanner`** appears at the top of every page while `me.email` is empty.

- It explains that summaries, digests and reports cannot reach the admin, and saves an address in place with `me.update`.
- "Dismiss" is remembered per user in `localStorage` (`chs.admin.emailPrompt.dismissed.<userId>`).
- It goes away for good once an email is saved: `me.update` invalidates `me.get`, and `useApiMutation` also calls `session.refreshMe()`.

**`AccountModal`** opens from the gear in the sidebar footer: "Your account", the admin's name, mobile and email, and four tabs (`PanelTabs`). None of it needs a society permission.

*Notifications* reads `notifications.preferences`.

- An email field, saved with `me.update`. An empty field sends `null`.
- Push and email checkboxes per category: Reports & digests, Billing, Payments, Approvals, Notices, General, Emergencies, Account security. Mandatory categories are disabled.
- Save calls `notifications.updatePreferences` with only the non-mandatory rows, and only if something changed.
- The modal lists the phones registered for push.
- "Send me a test" calls `notifications.test` and reports whether push and email were sent, and why not if they were not.

*Password* ([`AccountSecurity.tsx`](../../web-app/src/features/account/AccountSecurity.tsx)) calls `me.changePassword` with the current password, the new one and its confirmation, checked first with `schemas.auth.ChangePasswordBody` (the policy line quotes `PASSWORD_MIN_LENGTH`). A wrong current password shows under that field. The server signs out every other session; this one stays.

*Devices* lists `me.sessions` (fetched again each time the tab opens): the device label, client, IP, since when, last used, and "This device". "Sign out" on a row calls `me.revokeSession` after a confirm; on this device it then signs out here. "Sign out everywhere" calls `me.logoutAll` after a confirm and returns to the sign-in screen.

*Two-factor*: "Set up two-factor" calls `me.twoFactorSetup` and shows the setup key (grouped in fours) and the `otpauth://` link as text, each with Copy; there is no QR code. A 6-digit code then calls `me.twoFactorEnable`. When two-factor is on, the tab offers "Turn off two-factor" with a current code (`me.twoFactorDisable`). A wrong code shows under the field.

**Notifications drawer** ([`NotificationsDrawer.tsx`](../../web-app/src/features/account/NotificationsDrawer.tsx)), from the bell:

- `notifications.list` with `limit: 20` through `useApiInfiniteQuery`, newest first, with "Show older" for the next page. Skeleton rows while the first page loads; an error with "Try again"; an empty state.
- Unread items are tinted and dotted. Opening one calls `notifications.markRead` and, when `consoleRoute(data)` ([`notifications.ts`](../../web-app/src/features/account/notifications.ts)) maps it to a console screen, closes the drawer and navigates. The server writes resident-app routes: `/notices/<id>` becomes `/notices/record/<id>`, `/bills/<id>` becomes `/billing/bills/<id>`, `/payments/<id>` becomes `/payments/record/<id>`, `/approvals` becomes `/members/approvals`; anything else (the test notification's `/notifications`) opens nothing. An item from another society the admin runs switches to that society first; one from a society they do not run only marks read.
- "Mark all read" (`notifications.markAllRead`) shows while anything is unread.
- Realtime: `notifications.changed` invalidates `notifications.list` and `notifications.unreadCount`.

### 4.10 Society setup

Files: [`features/setup/SetupPage.tsx`](../../web-app/src/features/setup/SetupPage.tsx) (shell, checklist), [`SetupForms.tsx`](../../web-app/src/features/setup/SetupForms.tsx) (profile, settings, billing), [`SetupStructure.tsx`](../../web-app/src/features/setup/SetupStructure.tsx) (banks, buildings, units, parking), [`SetupStatutory.tsx`](../../web-app/src/features/setup/SetupStatutory.tsx).

The page keeps the design's setup screen: "Society setup" with the registration line under it (name · Reg. number · GST registered or not · financial year starts 1 April, from `society.get`), the onboarding figures and the statutory table. Each area is a tab with its own URL. A tab is offered only when the admin can read it; writes inside a tab need the stricter write permission.

| Tab | Path | Reads (permission, any of) | Writes (permission) |
|---|---|---|---|
| Checklist | `/setup` | `society.onboarding` (`society.configure`), `structure.buildings`, `society.bankAccounts`, `billing.heads` | `society.goLive` (`society.configure`) |
| Profile & settings | `/setup/profile` | `society.get`, `society.settings` (`society.configure` for the tab) | `society.update`, `society.updateSettings` (`society.configure`) |
| Billing | `/setup/billing` | `society.billingConfig` (`society.configure`, `billing.generate`) | `society.updateBillingConfig` (`society.configure`; read-only otherwise) |
| Bank accounts | `/setup/banks` | `society.bankAccounts` (`society.configure`, `accounts.manage`, `payments.record`) | `createBankAccount`, `updateBankAccount` (`society.configure`) |
| Buildings & units | `/setup/buildings` | `structure.buildings` (`society.configure` for the tab) | `createBuilding`, `updateBuilding`, `bulkCreateUnits`, `importUnits` (`society.configure`) |
| Parking | `/setup/parking` | `structure.parking` (`society.configure`, `members.manage`) | `createParkingSlot` (`society.configure`), `allotParkingSlot` (`members.manage`) |
| Statutory config | `/setup/statutory` | `society.statutoryConfig` (`compliance.manage`, `society.configure`, `billing.generate`) | `setStatutoryConfig` (`compliance.manage`) |

`/setup` for an admin without `society.configure` redirects to the first tab they can read; with none, `NoAccess`.

- **Checklist.** Stat cards: onboarding percent and items remaining, buildings (names, how many have lifts), active charge heads, active bank accounts and their purposes. The go-live checklist shows a progress bar and every `society.onboarding` item with its hint, a "Required" pill on undone items that block going live, and a button to where it is fixed (profile, buildings, billing setup, bank accounts, charge heads, Users & access, Members & units). The header has "Statutory config" and, while the society is a draft, "Go live" (enabled when `canGoLive`), which confirms and calls `society.goLive`. A live society shows "Live since …".
- **Profile.** Name, type, registration number and date, registrar's office, address, city, district, PIN, PAN, TAN, GSTIN, GST registered, financial-year start month, office email and phone. Checked with `UpdateSocietyBody` first; only the changed fields are sent.
- **Settings.** Languages and default language, quiet hours, visitor-record retention, tenancy reminder days, auto-suspend tenants at the end of a tenancy, directory, financial transparency, compliance summary. Only changed fields are sent.
- **Billing.** Cycle, bill and due day, grace days, interest rate (percent, stored as basis points), rounding, bill and receipt number formats (must include `{SEQ}`), part payments, and the allocation order (reorder with up/down buttons). Changing the rate shows the meeting and date of the general-body resolution; the server's `RESOLUTION_REQUIRED` and `INTEREST_RATE_EXCEEDS_CAP` messages are shown verbatim. The card says when the configuration was last changed and the period it is in force from.
- **Bank accounts.** Bank and account name, masked number and IFSC, type, purpose, opening balance and date, virtual-account prefix, active. Add takes the full account number once; Edit cannot change it, and "Account is in use" closes an account.
- **Buildings & units.** A warning for buildings with no construction cost. Table: name and wing, floors, lift, year built, construction cost, unit count, Edit. "Add building" / Edit: name, wing, floors, year, construction cost in rupees, lift. "Lay out units" (`bulkCreateUnits`): building, floor range, units a floor, number pattern (`{floor}` with G for ground, `{n}` as 01, 02…), type, carpet area, water inlets, with a preview ("2 units: Z-101, Z-102") and the 2,000-unit limit; existing units are skipped and listed. "Import units" is `ImportModal` on `structure.importUnits` (`building`, `number`, `floor` required; `type`, `carpet_area`, `built_up_area`, `water_inlets`, `share_certificate`).
- **Parking.** Slot, type, building, allotted unit (a link to its record) and Allot / Re-allot / Free. Allot looks the unit up as it is typed and shows its owner; Free confirms first and clears the slot from any vehicle.
- **Statutory config.** The design's table, one row per key: key, what it controls, the value in force today (a society's own row wins over the platform's), its source (resolution, rule citation or source note), effective from, and a state pill (Society override, Verified, Not verified). A scheduled value shows under the current one. Search filters by key or setting. A row opens its full history. "Add society value" / "Set society value" (`compliance.manage`) takes the key, value, from date, optional resolution and note; the server decides whether the society may set it and within what bound, and its refusal is shown as written.

Realtime: `society.changed`, `structure.changed` and `banks.changed` invalidate the tab's reads.

### 4.11 Audit log

[`features/audit/AuditLogPage.tsx`](../../web-app/src/features/audit/AuditLogPage.tsx) reads `society.auditLogs` (needs `audit.view`, `NoAccess` otherwise) with `q` (matches the action or the person), `entity` from the chips (Payments, Bills, Bill runs, Notices, Users, Approvals, Society), `cursor` and `limit: 50`, newest first.

- Columns: when (with seconds), who, action ("Payment · cheque clear" over the raw `payment.cheque_clear`), record kind and id, permission, IP.
- A row opens the entry with the before and after JSON the server stored.
- The endpoint has no sort; the header does not reorder.

---

## 5. Key flows

### First sign-in (create password)

1. An admin added the number in Users & access (`users.create`). The user's status is `INVITED`, shown as "Password not set".
2. On the console, the person enters the mobile. `auth.lookup` returns `CREATE_PASSWORD`.
3. They type a new password and its confirmation, tick the terms, and press "Create password and sign in". This calls `auth.activate`.
4. If the result is `SIGNED_IN`, the session stores the tokens and switches to `signedIn`, the gate seeds `me.get`, and the console renders at the current URL. If the result is `TWO_FACTOR`, the two-factor screen comes first.
5. If the user holds no `ADMIN` membership, they see "This console is for society administrators" and can only sign out.
6. If they have no email, the `EmailBanner` asks for one.

### Generating and publishing a month's bills

1. Go to Billing (`/billing`). Check Charge heads first: the "Without a rate" card should be 0, and any rate change should start on or after "Rates can start".
2. Press "Generate bills". The period defaults to the month after the latest run; bill and due dates can be left empty. "Generate" calls `billing.createRun`.
3. The console opens `/billing/runs/:runId`. Review the head-wise totals, the building variance against the previous published run, the units that moved more than 10 %, and the exceptions.
4. After fixing a rate or unit data, press "Recompute" (`billing.recomputeRun`).
5. Press "Publish N bills", read the confirm and press "Publish N" (`billing.publishRun`). Bills are numbered, ledgers are posted and residents are notified. The run page now shows every step done.
6. "View N bills" opens `/billing/bills?period=YYYY-MM`. From here on, a mistake is corrected with "Cancel bill" (unpaid bills only) or "Credit note". A published bill cannot be edited.
7. To abandon a draft instead, press "Discard" and confirm (`billing.discardRun`).

### Recording a cheque and clearing it

1. Open "Record receipt" from Payments, or "Record payment" from a unit record, bill or ledger.
2. Enter or confirm the unit. The form shows the owner and what they owe, and pre-fills the dues.
3. Choose **Cheque**, and enter the received date, the cheque number (required), and optionally the bank and cheque date. Press "Record cheque". This calls `payments.record`, and the payment is created as `PENDING`, shown as "In clearing". The dues do not change yet.
4. Later, filter Payments by "Cheques pending" and open the payment.
5. Press "Mark cleared" and confirm (`payments.chequeAction` `{ action: "clear" }`). The amount is allocated (interest first, then the oldest bills, the rest as advance) and a receipt is issued. The toast names the receipt number.
6. If the cheque bounced, use "Mark bounced" instead, with an optional reason. Nothing is credited.

### Cancelling a receipt

1. Open the payment (from Payments, a bill's receipts, or a ledger payment row). "Cancel receipt" is offered only for a `SUCCESS` payment whose receipt is `ISSUED`, and only to a `payments.record` holder.
2. Enter a reason of at least 5 characters and press "Cancel receipt" (`payments.cancelReceipt`). The payment is reversed in the ledger, not deleted. The amount is due again, and the receipt stays on record as cancelled.

### Composing and publishing a notice, then reading its proof of service

1. Go to Notices and press "Compose notice". Enter the title, body, category, audience (buildings or units if needed), channels, acknowledgement and pinning, and optionally an expiry. "Save draft" calls `notices.create`, and the console opens the draft's record.
2. Check the draft tiles. Use "Edit" (`notices.update`) to change it, or "Delete draft" (`notices.discard`) to drop it.
3. Press "Publish" and confirm (`notices.publish`). The recipient list is fixed and push and email go out. The toast gives the recipient count.
4. On the published record, the Delivery & acknowledgement table lists every recipient's push and email status, read time and acknowledgement. It refreshes on `notices.changed`.
5. "Email me Excel" or "Email me CSV" in that card mails the `notice-delivery` report for this notice, which is the proof of service. The same report is available from `/reports/notice-delivery`.
6. To fix a published notice, press "Issue correction", edit the copy and save it as a draft, then publish it. The original becomes Superseded.

### Deciding a resident's request

1. A resident asks from the app for a family member, vehicle, pet or tenant to be added (or reports a correction). The server records a `PENDING` approval and emits `approvals.changed`; the Members & units nav badge and the dashboard's "awaiting approval" line count it.
2. Open Members & units › Approvals (or "Review" on the dashboard). The queue lists pending requests, oldest first.
3. Open one. Check the details the resident sent; "Open unit" shows the unit record if needed.
4. Optionally write a note, press Approve or Reject, read the confirm and press "Approve request" / "Reject request" (`members.decideApproval`). Approving creates the family member, vehicle, pet or tenancy exactly as sent.
5. If another admin decided it first, the dialog shows "This request has already been decided." and the queue refreshes.

### Setting up a new society's structure

1. Society setup › Buildings & units › "Add building" for each wing, with floors, lift and construction cost.
2. "Lay out units" for each building (floors × units a floor, numbered by pattern), or "Import units" from a spreadsheet: "Check file" first, fix any rows listed, then "Import N units".
3. Profile & settings, Billing and Bank accounts complete the profile, billing configuration and the collections account.
4. The Checklist shows what is left. When every required item is done, "Go live" takes the society live.

### Emailing a report when no email is on file

1. Open a report (for example `/reports/collections`) and set its parameters.
2. Press "Email me Excel". `reports.email` answers `EMAIL_REQUIRED`.
3. The inline "Add your email to receive reports" form appears. Enter an address and press "Save and send". This calls `me.update`, then `reports.email` again with the same format.
4. "Queued. The Excel file will arrive at … in a few minutes." The global `EmailBanner` also goes away, because `me` now has an email.

### Issuing a temporary password

1. Go to Users & access and open the user. Neither "Reset password" nor Suspend is offered on your own record.
2. Press "Reset password", then "Generate temporary password" (`users.issueTempPassword`). The endpoint is deliberately not idempotent.
3. The password is shown **once**. The modal also gives its expiry (24 h), the channels it was sent by (`deliveredVia`), a Copy button and "Share on WhatsApp" (`whatsappShareUrl`). The password lives only in that modal's mutation state: closing the modal drops it, and generating again issues a new one.
4. The user signs in with it. The session enters `passwordChange` and the console shows "Set a new password" (`auth.forcedChange`) before anything else. This works for invited users too.

---

## 6. Still on mock data

These areas read `web-app/src/mock/*`. Their edits live only in `AdminStore` (in memory) and are lost on reload. The numbers they show are fixtures.

| Area | Route | Mock source | Why |
|---|---|---|---|
| User flows | `/flows` | `mock/flows.ts` | Static product reference, not data |
| Accounting | `/accounting` (generic) | `mock/pages.ts`, `forms.ts`, `panels.ts`, `record.ts` | No accounting module in the contract |
| Recovery | `/recovery` (generic) | same | No recovery module |
| Gate & visitors | `/gate` (generic) | same | No gate or visitor module (only `members.vehicles`, used by the gate app) |
| Vendors & assets | `/vendors` (generic) | same | No module |
| Meetings | `/meetings` (generic) | same | No module |
| Documents | `/documents` (generic) | same | No module |
| Requests | `/requests` (generic) | same | No module. Residents' family, vehicle, pet and tenant requests are the approvals queue under Members & units. |
| Helpdesk | `/helpdesk` | `mock/helpdesk.ts`, `panels.ts` | No module |
| Staff & help | `/staff` | `mock/staff.ts` | No module |
| Amenities | `/amenities` | `mock/amenities.ts` | No module |
| Compliance | `/compliance` | `mock/compliance.ts`, `panels.ts` | No module |
| Generic record pages | `/:pageKey/record/:rowKey` | `mock/record.ts` | Belong to the generic pages above |

The sidebar nav itself is still declared in `mock/nav.ts`; its badges are not (they come from the API).

`mock/pages.ts`, `forms.ts`, `panels.ts` and `record.ts` still carry entries for `setup`, `members`, `users`, `payments`, `notices`, `reports`, `billing` and `dash`. Those screens have their own API routes, and the generic routes accept only `MOCK_PAGES`, so these entries are unreachable. `PANELS.billing` and `PANELS.dash` are not referenced at all.

These are **placeholders, not mock data**:

- On the dashboard, the Compliance score, Fund balances and Today at the gate cards show `—`.
- On Members, the Outstanding column and the Tenanted and Vacant cards show `—`.
- On Payments, Unmatched credits shows `—`.

---

## 7. File map

| Path (under `web-app/`) | Responsibility |
|---|---|
| [`vite.config.ts`](../../web-app/vite.config.ts) | Dev proxy (`/api`, `/realtime` → `CHS_API_URL`), dedupe of React, React Query, zod and socket.io, LAN host, WSL polling |
| [`index.html`](../../web-app/index.html) | Page shell, title "Sahaj — Admin console" |
| [`src/main.tsx`](../../web-app/src/main.tsx) | React root |
| [`src/app/App.tsx`](../../web-app/src/app/App.tsx) | Provider tree and route table |
| [`src/app/SessionGate.tsx`](../../web-app/src/app/SessionGate.tsx) | Session restore, sign-in screen selection, admin-only gate, cache clear and seed |
| [`src/app/ThemeProvider.tsx`](../../web-app/src/app/ThemeProvider.tsx) | Light/dark toggle, stored in `localStorage` |
| [`src/api/client.ts`](../../web-app/src/api/client.ts) | `apiClient`, `realtime`, `session`, `queryClient` |
| [`src/api/society.ts`](../../web-app/src/api/society.ts) | `useConsoleMe`, `useCurrentSociety`, `holds`, `adminMemberships`, labels for the sidebar |
| [`src/api/units.ts`](../../web-app/src/api/units.ts) | Unit label to id, exact match only: `useUnitLookup` (live), `useUnitResolver` (one, at submit), `useUnitsResolver` (batch), `splitUnitLabels`. Every form that takes a unit label uses these. |
| [`src/layouts/AdminLayout.tsx`](../../web-app/src/layouts/AdminLayout.tsx) | Sidebar (with API badges), top bar (financial-year chip, theme, bell), society switcher, account dialog, notifications drawer, toaster |
| [`src/layouts/GlobalSearch.tsx`](../../web-app/src/layouts/GlobalSearch.tsx) | Top-bar search over units, users and bills; ⌘K / Ctrl+K |
| [`src/store/AdminStore.tsx`](../../web-app/src/store/AdminStore.tsx) | Reducer store: toasts, selected society (persisted), mock-page rows and edits, staff, amenities and helpdesk state |
| `src/components/` | Shared UI ([section 3.7](#37-shared-components)) |
| [`src/lib/loadState.ts`](../../web-app/src/lib/loadState.ts) | `LoadState<T>`, `ready`, `loading`, `failed` |
| [`src/lib/apiErrors.ts`](../../web-app/src/lib/apiErrors.ts) | `splitError` |
| [`src/lib/apiFormat.ts`](../../web-app/src/lib/apiFormat.ts) | Mobile, date and enum formatting, user status pill, auth event and device labels |
| [`src/lib/money.ts`](../../web-app/src/lib/money.ts) | Paise, rates and periods |
| [`src/lib/moneyLabels.ts`](../../web-app/src/lib/moneyLabels.ts) | Billing, payment and notice labels and pills |
| [`src/lib/permissionLabels.ts`](../../web-app/src/lib/permissionLabels.ts) | Permission grouping and template matching |
| [`src/lib/tableKit.ts`](../../web-app/src/lib/tableKit.ts) | Cursor pager, debounce, clickable rows, button styles |
| [`src/lib/uiStyles.ts`](../../web-app/src/lib/uiStyles.ts) | Card and cell style constants |
| [`src/lib/nav.ts`](../../web-app/src/lib/nav.ts) | `useBack(fallback)` |
| `src/lib/format.ts`, `rows.ts`, `formLogic.ts`, `recordDerive.ts`, `types.ts` | Mock-page machinery (row merge, form save, record derivation) and shared types |
| `src/features/auth/` | Sign-in screens |
| `src/features/dashboard/` | Dashboard |
| `src/features/users/` | Users & access list, record, modals |
| `src/features/members/` | Members & units list, approvals queue, unit record, and the register's modals (member, occupancy, tenancy, family, vehicle, pet) |
| `src/features/setup/` | Society setup: checklist, profile and settings, billing configuration, bank accounts, buildings and units, parking, statutory config |
| `src/features/audit/` | Audit log |
| `src/features/billing/` | Runs, run preview, bills, bill record, charge heads (with rename and unit amounts), ledger, their modals, and `billingAccess.ts` (each screen's permissions) |
| `src/features/payments/` | Collections desk, payment record, record-payment modal |
| `src/features/notices/` | Notice list, record, composer |
| `src/features/reports/` | Report library and viewer, `EmailReport` |
| `src/features/account/` | `EmailBanner`, `AccountModal` (notifications, password, devices, two-factor), `NotificationsDrawer`, `notifications.ts` (`consoleRoute`, `useUnreadCount`) |
| `src/features/record/` | `RecordView` components, `recordModel` builders, mock `RecordPage` |
| `src/features/generic/`, `flows/`, `helpdesk/`, `staff/`, `amenities/`, `compliance/` | Mock screens; `generic/NotFoundPage.tsx` is the Not found page |
| `src/mock/` | Fixtures for the mock screens, and the nav |
| `src/styles/tokens.css`, `globals.css` | Design tokens (light and dark), keyframes, skeleton, spinner, focus rings, fonts |

External packages the console depends on:

- [`packages/contract`](../../packages/contract/src/): endpoints under [`endpoints/*.ts`](../../packages/contract/src/endpoints/), schemas, permissions and realtime events
- [`packages/api-client`](../../packages/api-client/src/): the typed client, `SessionController`, realtime, and React hooks in [`react.tsx`](../../packages/api-client/src/react.tsx)

---

## 8. Adding a new API-backed page

1. **Contract first.** Make sure the endpoint exists in `packages/contract/src/endpoints/<module>.ts` with its `access` rule and its `invalidates` list. If other admins' changes should reach the screen live, add or extend an event in `events.ts`.
2. **Route.** Add a `<Route>` in `App.tsx` **above** the `:pageKey` catch-alls. Wrap record routes in `Keyed` so that a new id remounts the page.
3. **Guard.** Get the society from `useCurrentSociety()`. Render `NoSociety` when it is `null`, and `NoAccess` when `holds(society, ...)` fails the endpoint's rule. Key the inner component by `societyId`.
4. **Read** with `useApiQuery(api.x.y, { params: { societyId, ... }, query })` and render through `toLoadState()`: `ApiTable` for a list, `DataTable` for a plain table, `DataBoundary` or `RecordSkeleton` / `RecordMessage` for a record. Give lists `placeholderData: keepPreviousData` and `useCursorPager`.
5. **Write** with `useApiMutation(api.x.z)`. Put a busy spinner in the submit button, route errors through `splitError` to the fields and `FormError`, and show a toast on success. Do not patch the cache: `invalidates` handles refetching.
6. **Nav.** Point an entry in `mock/nav.ts` at the new key. The nav still lives under `mock/`. A count beside it comes from the API, in `useNavBadges()` in `AdminLayout`.

A sketch for a list page with one write:

```tsx
import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { ApiTable, PageHeader } from "../../components/ApiTable";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { ready } from "../../lib/loadState";
import { rowProps, useCursorPager, useSettled, primaryBtnStyle } from "../../lib/tableKit";
import { splitError } from "../../lib/apiErrors";
import { useAdminStore } from "../../store/AdminStore";

export function WidgetsPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Widgets" />;
  if (!holds(society, "widgets.manage")) return <NoAccess title="Widgets" need="widgets.manage" />;
  return <Widgets key={society.societyId} society={society} />;
}

function Widgets({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const { toast } = useAdminStore();
  const [search, setSearch] = useState("");
  const q = useSettled(search.trim());
  const paging = useCursorPager(q);

  const list = useApiQuery(
    api.widgets.list,
    { params: { societyId }, query: { q: q || undefined, cursor: paging.cursor, limit: 25 } },
    { placeholderData: keepPreviousData },
  );
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(list.data?.nextCursor);
  }, [list.data?.nextCursor, list.isPlaceholderData, learn]);

  const create = useApiMutation(api.widgets.create); // invalidates widgets.list via the contract
  const add = () =>
    create.mutate(
      { params: { societyId }, body: { name: "New widget" } },
      {
        onSuccess: (w) => toast(`${w.name} added.`, "ok"),
        onError: (e) => toast(splitError(e, []).form ?? e.message, "warn"),
      },
    );

  const state = toLoadState(list);
  const rows = state.status === "ready" ? ready(state.data.items) : state;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader
        title="Widgets"
        sub="…"
        actions={<button type="button" onClick={add} disabled={create.isPending} style={primaryBtnStyle}>Add widget</button>}
      />
      <ApiTable
        searchHint="Search widgets"
        search={search}
        onSearch={setSearch}
        chips={[]}
        cols={[{ label: "Name", align: "left" }]}
        sortCol={null}
        sortDir={1}
        onSort={() => undefined}
        rows={rows}
        renderRow={(w) => <tr key={w.id} {...rowProps(() => undefined)}><td>{w.name}</td></tr>}
        filtering={Boolean(q)}
        onClearFilters={() => setSearch("")}
        emptyTitle="No widgets yet"
        emptyBody="Add the first one."
        footer={list.status === "success" ? `Page ${paging.pageNo}` : " "}
        pager={paging.pager(Boolean(list.data?.nextCursor))}
      />
    </div>
  );
}
```

`api.widgets` and `widgets.manage` are placeholders; substitute the real endpoint and permission. For a form, follow `RecordPaymentModal` or `CreateHeadModal`: local checks first, then `mutateAsync`, then `splitError` in the `catch`.

---

## 9. Known gaps

What is still incomplete or inconsistent in the console, as found in the code.

**API endpoints the console does not call yet**

- **Members.** `members.setNominees`, `members.ceaseMembership` and `members.list` (the member register as a list) are unused, so nominees cannot be edited and a member cannot be ceased from the console. `members.vehicles` is used only by the gate app.
- **Units.** `structure.createUnit` and `structure.updateUnit` are unused: units are added in bulk (lay out or import) and cannot be edited or made inactive one by one from the console.
- **Charge heads.** Filters and sort order (`billing.updateHead` `filters` / `sortOrder`) cannot be edited. A unit amount on a manual head cannot be ended or corrected except by adding a new dated amount.
- **Permission templates.** The `users.*Template` writes are unused; templates are shown, not edited.
- **Platform admin.** `platform.societies` / `createSociety` are unused. A platform admin with no society membership gets `NoSociety` everywhere.

**Behaviour to be aware of**

- **A 401 answer is retried once.** `INVALID_CREDENTIALS` (wrong current password) and `TWO_FACTOR_INVALID` (wrong code) are 401s, and the shared client treats any 401 as an expired token: it refreshes and sends the request again. The admin stays signed in and sees the right message, but each wrong attempt reaches the server twice and counts twice against the `sensitive` rate limit.
- **Two-factor enrolment shows text only.** The setup key and the `otpauth://` link are shown to copy; there is no QR code, because the console has no QR library.
- **The notifications inbox spans societies.** The drawer lists every notification for the person. An item from a society the admin does not run in the console marks read but opens nothing.
- **Search is per list.** The top-bar search runs three list searches and shows the first five of each; it is not a ranked search across them, and it does not search notices or payments.
- **Nav badges.** Only Members & units has one (pending approvals). The design's Recovery, Helpdesk and Requests badges belong to modules with no API, and are not shown.
- **Statutory values** are shown with the server's units; rule-type values ("Before 30 september") are the code with underscores turned into spaces.

**Permission checks in the UI**

- Nav items are not hidden by permission; a screen the admin cannot use shows `NoAccess`.
- The dashboard's "New bill run" button and the Bill runs page are shown to billing admins who hold only `payments.record` or `accounts.manage`; the runs list then says it needs a billing permission rather than listing runs.

**Stale fixtures and docs**

- `mock/pages.ts`, `forms.ts`, `panels.ts` and `record.ts` still carry unreachable entries for the screens that now read the API (see [section 6](#6-still-on-mock-data)).
- `docs/LOADING_AND_MOTION.md` still points at `web-app/src/lib/motion.ts` `blockStyle()` for the admin fade. That file was removed because nothing used it; pages write the single `fadeUp .3s` on their container directly. It also says fixture screens wrap their data in `ready(...)`; they render their rows directly, and `ready(...)` is used by API screens that re-wrap derived rows.
- `scripts/start.sh` says the console is "on http://localhost:5173" in its header (the port is 5273), and that billing onwards still shows mock data.
