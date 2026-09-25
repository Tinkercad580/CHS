# Resident app

The Sahaj resident app (`mobile-app/apps/resident-app`) is an Expo SDK 57 app on
React Native 0.86 with expo-router. Its UI tokens, copy and remaining fixtures come
from `@sahaj/shared` (`mobile-app/packages/shared`). It calls the API through
`@chs/contract` and `@chs/api-client` (`packages/`, at the repo root).

This page covers what the app does, how it is put together, and how each feature
gets from a screen to the API. Paths are relative to this file.

## 1. What it is

The app is for people who live in, or own a flat in, a cooperative housing society:
owners, co-owners, family members and tenants. A signed-in resident can:

- see what is due on their flat, read each bill line by line, and pay (through the dummy gateway for now),
- read the flat's statement for the financial year and its receipts,
- read society notices and acknowledge the ones that ask for it,
- use a notification inbox, choose per-category push and email, and send a test,
- see the household, vehicles and tenancies the society holds for the flat, and ask to add family or vehicles (the office approves these),
- add an email address.

Visitors, the helpdesk, amenities, polls, daily help, deliveries and building
status are also in the app, but they still run on local fixtures and never reach
the server; each of those screens says so (see [section 7](#7-still-on-mock-data)).
The emergency screen raises no alert either: it says alerts aren't connected yet
and offers one-tap calls to 112 and the society office.

An account with no `USER`-role membership linked to a flat (an office-only admin or
a guard, say) signs in and sees a "No flat on this account" screen, with a sign-out
button and nothing else.

## 2. Running it

### Web preview

```
./scripts/api.sh                     # the API, in its own terminal
./scripts/mobile-web.sh resident     # http://localhost:8181
```

[`scripts/mobile-web.sh`](../../scripts/mobile-web.sh) installs the `mobile-app`
workspace if it has to, frees port 8181 (override with `CHS_RESIDENT_PORT`), and
starts `expo start --web`. If `app.json` or `metro.config.js` changed since the last
run it starts cold (`--clear`) without being asked. The API allows
`http://localhost:8181` in its default `CORS_ORIGINS`.

The repo lives on `/mnt/e`, a drvfs mount that sends no inotify events, so **Metro
does not see edits**. After changing a file, restart `mobile-web.sh` and then
hard-reload the browser tab (Ctrl-Shift-R). A tab left open across a restart keeps
running the old bundle. To find out which of the two happened:

```
./scripts/bundle-grep.sh resident 'some new string'
```

A hit means Metro has the change and the tab is stale. A miss means Metro never
picked up the edit, so restart with `--clear`. See [`scripts/README.md`](../../scripts/README.md).

On the web the session is kept in `localStorage` (key `chs.resident.session`), as
are the theme and language (`chs.resident.theme`, `chs.resident.language`), and
push is always unavailable. The Notifications settings screen says so.

> The banner `mobile-web.sh` prints ("There is no backend. Every screen renders
> fixtures… sign-in… is a mock") is out of date. Sign-in, dues, payments, notices,
> notifications and the household all call the API. The list of fixtures in
> `scripts/README.md` ("billing, payments, … notices") is also out of date for this app.

### Native builds

There is no checked-in `android/` or `ios/`. They are generated (Continuous Native
Generation) from [`app.json`](../../mobile-app/apps/resident-app/app.json) and
[`app.config.ts`](../../mobile-app/apps/resident-app/app.config.ts):

```
cd mobile-app/apps/resident-app
npx expo prebuild
npx expo run:android          # or: eas build -p android
```

Expo Go can't be used, because the app links native modules (React Native
Firebase, expo-secure-store, expo-notifications) that need a development build.

`app.config.ts` adds the following on top of `app.json`:

| Setting | Value |
|---|---|
| Android package / iOS bundle ID | `in.sahaj.resident`, overridable with `CHS_RESIDENT_ANDROID_PACKAGE` / `CHS_RESIDENT_IOS_BUNDLE_ID` (only before the first store release) |
| Firebase | Switched on per platform only if `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) is in the app folder at prebuild. Both are gitignored. |
| `extra.pushEnabled` | `true` if either Firebase file is present |
| `extra.apiOrigin` | `EXPO_PUBLIC_API_ORIGIN` at config time |
| Android | `POST_NOTIFICATIONS` permission, `minSdkVersion` 24 |
| iOS | `UIBackgroundModes: ["remote-notification"]`; static frameworks when the plist is present |
| Plugins | `expo-router`, `expo-font`, `expo-notifications` (colour `#0E6B5C`, default channel `default`), `expo-build-properties`, and the two `@react-native-firebase` plugins when Firebase is on |

URL scheme: `sahajresident`. Firebase setup, end to end, is in [`NOTIFICATIONS.md`](../NOTIFICATIONS.md).

### API origin

[`src/api/client.ts`](../../mobile-app/apps/resident-app/src/api/client.ts) resolves the origin in this order:

1. `process.env.EXPO_PUBLIC_API_ORIGIN` (inlined at bundle time),
2. `expo.extra.apiOrigin` (set from the same variable in `app.config.ts`),
3. `http://localhost:4100`.

REST calls go to `<origin>/api/v1` and carry an `X-Client: resident` header. The
realtime socket connects to the same origin. On an Android emulator or a phone,
`localhost` is the device itself, so set the variable to an address the device can
reach (for example `EXPO_PUBLIC_API_ORIGIN=http://10.0.2.2:4100` on the emulator,
or the machine's LAN IP) and restart Metro.

### Demo accounts

`./scripts/api.sh` seeds Shanti Vihar CHS: bills for August and September 2026,
most of August paid, and three notices. Accounts that have a password use `Sahaj@2026`.

| Mobile | Who | What the resident app shows |
|---|---|---|
| 9822041155 | Anita Deshpande | Owner of A-1204 (lives there) and C-0405 (let out, owner pays the bills). Role `owner_tenant`: two ledgers and the unit switch. Has an email. |
| 9812300702 | Vikram Sethi | Tenant of B-0702 (tenant pays the bills). Role `tenant`. No email, so the email prompt appears. |
| 9820011002 | Meera Joshi | No password yet, so this account takes the "Create your password" path. It is the treasurer and has no flat, so it ends on "No flat on this account". |
| 9820011001, 9890012345 | Secretary, guard | Sign in, then "No flat on this account". |

Five wrong passwords lock the account for 15 minutes.

## 3. How it's built

### Providers and the single route

[`src/app/_layout.tsx`](../../mobile-app/apps/resident-app/src/app/_layout.tsx) wraps everything:

```
SafeAreaProvider
  ApiProvider (client, session, realtime)    @chs/api-client/react
    ResidentProvider                         local store
      <Slot/>                                rendered only once the fonts have loaded
```

- `ApiProvider` creates the React Query client (30 s `staleTime`, refetch on focus,
  retry only errors marked retryable, at most twice, and mutations never) and mounts
  `RealtimeSync`. That component connects the socket while signed in, turns each
  server event into query invalidations (`REALTIME_EVENTS` in
  [`packages/contract/src/events.ts`](../../packages/contract/src/events.ts)),
  refetches everything after a reconnect, calls `session.expire()` on a
  `session.revoked` event that has no session id, and refreshes `/me` on
  `me.changed` / `account.suspended`.
- `ResidentProvider` ([`src/state/ResidentProvider.tsx`](../../mobile-app/apps/resident-app/src/state/ResidentProvider.tsx))
  is the local store (below). On mount it reads the theme and language this phone
  saved ([`devicePrefs.ts`](../../mobile-app/apps/resident-app/src/state/devicePrefs.ts)).
- Inside it, a `Canvas` paints the backdrop and status bar in the current theme.
- "Focus" on a phone is the app coming back to the foreground: `client.ts` points
  React Query's `focusManager` at `AppState` and its `onlineManager` at
  `expo-network` (`addNetworkStateListener`; an unknown `isConnected` counts as
  online). On the web React Query's own window listeners are used.

There is exactly one expo-router route,
[`src/app/index.tsx`](../../mobile-app/apps/resident-app/src/app/index.tsx), and it renders
`SessionGate`. After sign-in, screens are not routes. The shell switches between
them on `state.screen`.

### Session gate

[`SessionGate.tsx`](../../mobile-app/apps/resident-app/src/features/auth/SessionGate.tsx)
switches on `SessionController.state.status`
([`packages/api-client/src/session.ts`](../../packages/api-client/src/session.ts)):

| Status | Renders |
|---|---|
| `unknown` | A blank canvas while `restore()` checks the stored tokens. If it throws (the network is down), it shows "Can't reach Sahaj" with Try again, and the tokens are kept. |
| `signedOut` | `SignInFlow` |
| `passwordChange` | `ForcedChangeScreen` (nothing else is reachable) |
| `twoFactor` | `TwoFactorScreen` (only admins enable 2FA) |
| `signedIn` | `SignedInApp`, which renders `NoResidentHome` or `ResidentShell` |

On restore, a stored session whose `/me` says `mustChangePassword` is dropped and the
user signs in again. A 401 clears the tokens.

The gate watches for transitions. When status leaves `signedIn` for any reason
(sign-out, revoked session, refresh token rejected) it calls `queryClient.clear()`
and `actions.resetAll()`. `resetAll` keeps the phone's theme and language.

Push follows the session directly: the gate mounts `bindPushToSession(controller)`
([`bridge.ts`](../../mobile-app/apps/resident-app/src/push/bridge.ts)), which
subscribes to the `SessionController`. Arriving at `signedIn` calls `startPush()`
(this includes every cold start with a stored session); leaving it calls
`unregisterPush()`, whatever ended the session (see [section 5](#5-push-notifications)).

`SignedInApp` also applies the account's `me.language` (when it is `en` or `mr`)
until a language has been chosen on this phone.

`SignedInApp` picks the resident membership (`residentMembership`: the first
membership with role `USER` and a unit), derives the identity, and dispatches
`adoptIdentity`. It renders nothing until the store holds that user's identity, which
takes one frame.

Tokens are stored in the OS keychain through `expo-secure-store`
(`AFTER_FIRST_UNLOCK`), or in `localStorage` on the web. The API client refreshes the
access token itself and calls `session.expire()` when the refresh token is rejected.

### Identity, roles and active unit switching

[`src/api/identity.ts`](../../mobile-app/apps/resident-app/src/api/identity.ts) `deriveIdentity(me, membership, myHome)` produces:

- `identity`: `{ userId, societyId, societyName, homeUnit, homeHolding, otherUnits }`, stored in local state.
  - `homeHolding` is how the home flat is held, from the membership's `userType`: `owner`, `coOwner`, `family` or `tenant` (other user types count as `owner`).
  - `otherUnits` is every other unit in `myHome` where the user is a current member, in `myHome`'s order, each `{ label, letOut }` (`letOut` = it has an active tenancy). A tenant has none.
- `role`, which is one of:
  - `tenant` if the membership's `userType` is `TENANT`,
  - `owner_tenant` if one of `otherUnits` is let out,
  - `owner` otherwise, including co-owners and family members. The role only decides what a resident may do (vote, register household); what the app prints is `homeHolding`.

Because `otherUnits` depends on `members.myHome`, an owner starts with none and gains
them once that query answers. `adoptIdentity` resets the store when the user id
changes (keeping the phone's theme and language). For the same user it keeps the unit
being viewed if it is still in `heldUnits(identity)` (home first, then the others).

`state.unit` is the unit being viewed. When the account has more than one flat, Home
shows a switcher card with one button per flat ("A-1204 · owned", "C-0405 · rented
out"; two sit side by side, more wrap). Its title is the design's "You hold two
positions here" for one home plus one let-out flat, otherwise "You hold n flats here".
Pressing a button calls `actions.setUnit`.
`currentUnit(state)` ([`selectors.ts`](../../mobile-app/apps/resident-app/src/state/selectors.ts))
turns the unit into the header line and a tag: the home flat's holding (`Owner`,
`Co-owner`, `Family member`, `Tenant`), `Landlord` for a let-out flat, `Owner` for
another owned flat. The viewed unit scopes Dues, Statement, the Home dues card and
"Expected today", Household, Vehicles, the Profile "My unit" card and its daily-help
and helpdesk counts, the pay sheet subtitle, and the fixture screens (visitors,
tickets, bookings, daily help). Notices and notifications are not unit-scoped.

### Navigation, shell and tabs

[`ResidentShell.tsx`](../../mobile-app/apps/resident-app/src/features/shell/ResidentShell.tsx)
renders the screen whose key is `state.screen`, then the tab bar, then `PaymentSheets`
and `ToastStack`. It also mounts `usePushRouting()`.

Navigation lives in [`src/state/actions.ts`](../../mobile-app/apps/resident-app/src/state/actions.ts):

- `go(screen)` replaces the screen and clears `stack`.
- `go(screen, true)` pushes the current screen onto `stack` first.
- `back()` pops `stack`, falling back to `home`.

[`TabBar.tsx`](../../mobile-app/apps/resident-app/src/features/shell/TabBar.tsx) has
five tabs: Home, Dues, Notices, Visitors and Profile. Tapping one calls `go(tab)`,
which clears the stack. The bar is shown on `home`, `dues`, `notices`, `visitors`,
`profile` and `helpdesk`. Each sub-screen highlights its parent tab (for example
`bill` highlights Dues, and every Profile sub-screen and `helpdesk` highlight Profile).

| Screen key | Reached from |
|---|---|
| `bill` | a bill card on Dues; a push or inbox item routed to `/bills/<id>` |
| `statement` | the "Statement" button in the Dues header; a `/payments/<id>` route |
| `notice` | a notice card; Home's latest notice; a `/notices/<id>` route |
| `notifs` (inbox) | the bell on Home; the fallback route |
| `notifPrefs`, `personal`, `household`, `vehicles`, `tenants`, `dailyHelp`, `deliveries`, `language` | Profile settings rows |
| `personal` in edit mode | the email prompt; "Add your email" on `notifPrefs` |
| `invite`, `newTicket`, `amenities` | Home quick actions (`invite` also from Visitors) |
| `sos`, `utilities`, `polls` | Home header emergency button, status card, AGM card |
| `helpdesk` | the Profile "Helpdesk" row (with a back button), and after submitting a ticket (as a tab screen) |

The design (`Resident App.dc.html`) gives the helpdesk a tab of its own ("Help"). This
app's five tabs follow the prototype, where the helpdesk sits under Profile, so it is
reached from a Profile settings row instead.

**Android back button.** `useHardwareBack` in `ResidentShell` handles
`hardwareBackPress`: with a payment sheet open it closes it, otherwise it pops
`stack`, otherwise it goes to Home from any other screen, and only on Home does it let
the press through (the app exits). A payment sheet is a `Modal`, which receives the
press itself, so each sheet passes `onRequestClose` to `BottomSheet`: the method
picker and the app picker close, the QR sheet cancels the payment (as "Cancel
payment" does), the receipt finishes (as "Done"), the declined sheet closes, and
nothing happens while a call is in flight. The signed-out screens (sign-in steps,
forced change, 2FA) don't handle back, so it leaves the app there. No deep links are
wired up.

### Local store and server data

The store is one `useReducer` with two actions, `SET` (a patch) and `UPDATE` (an
updater), defined in [`types.ts`](../../mobile-app/apps/resident-app/src/state/types.ts).
[`initialState.ts`](../../mobile-app/apps/resident-app/src/state/initialState.ts)
creates it. Only the theme and the language are persisted (below). An app restart
or a sign-out puts everything else back to its initial value.

What the store still holds:

| Kind | Fields |
|---|---|
| Navigation | `screen`, `stack` |
| Identity | `identity`, `role`, `unit` |
| Preferences | `language`, `dark`, kept on the phone by [`devicePrefs.ts`](../../mobile-app/apps/resident-app/src/state/devicePrefs.ts) (expo-secure-store on a phone, `localStorage` on the web) and carried across sign-outs |
| Which server record is open | `activeBillId`, `activeNoticeId`, `dueFilter` |
| Payment sheet | `sheet` (`pay` / `qr` / `app` / `success` / `failed`), `payTarget`, `qrLeftSeconds`, `qrState` |
| Form inputs for server writes | `memberNameInput`, `relationInput`, `plateInput`, `vehicleTypeInput`, `editingPersonalDetails` |
| Session-only flag | `emailPromptDismissed` |
| Fixture data (deep-copied from `@sahaj/shared`) | `passes`, `tickets`, `amenities`, `bookings`, `dailyHelp`, `attendanceSheets`, `utilities`, `polls`, `votes`, `deliveryPref`, `renewed`, and form state for these |
| Local-only fields | `me` (alternate phone, emergency contact; they start empty, not as the fixture's numbers) |

`AppResidentState` omits the shared `ResidentState` fields nothing reads any more:
`household`, `vehicles`, `tenantAgreement(s)`, `log` (and the `note()` that wrote it),
and the SOS hold (`sosKind`, `holdingSos`, `sosPct`, `sosSent`).

Server data lives only in the React Query cache and is read through thin hooks:

| Hook (file) | Endpoint |
|---|---|
| `useResidentAccount` ([identity.ts](../../mobile-app/apps/resident-app/src/api/identity.ts)) | `useMe()` (session) + `members.myHome` |
| `useMyDues`, `useUnitBills`, `useUnitLedger`, `useUnitPayments`, `useUnitId` ([billing.ts](../../mobile-app/apps/resident-app/src/api/billing.ts)) | `billing.myDues`, `billing.myBills`, `billing.ledger`, `payments.mine` |
| `useNoticeFeed` ([notices.ts](../../mobile-app/apps/resident-app/src/api/notices.ts)) | `notices.feed` (limit 50) |
| `useUnreadCount`, `useNotificationPreferences`, `useOpenRoute` ([notifications.ts](../../mobile-app/apps/resident-app/src/api/notifications.ts)) | `notifications.unreadCount`, `notifications.preferences`, `payments.get` |
| `useSocietyProfile` ([society.ts](../../mobile-app/apps/resident-app/src/api/society.ts)) | `society.get` (the emergency screen's office number) |

Nothing polls. Coming back to the app refetches stale queries (the `focusManager`
wiring above). Mutations invalidate the queries listed in the endpoint's `invalidates`
field (`useApiMutation`), and the server's realtime events invalidate the rest
(`billing.changed`, `payments.changed`, `notices.changed`, `notifications.changed`,
`members.changed`, `approvals.changed`).

`useUnitId(label)` maps the unit label the app navigates by to a unit id. It looks
first in the dues cards and falls back to `myHome` for a flat that has never been billed.

### Theming, fonts, i18n

- Colours: `colorsFor(state.dark ? "dark" : "light")` in [`src/theme/index.ts`](../../mobile-app/apps/resident-app/src/theme/index.ts), using `lightColors` / `darkColors` from `@sahaj/shared`. `state.dark` defaults to `false`. The "Dark mode" switch, last in Profile's settings, calls `toggleTheme`, which saves the choice on the phone; the sign-in screens follow it too.
- Fonts: [`src/theme/fonts.ts`](../../mobile-app/apps/resident-app/src/theme/fonts.ts) loads Figtree (400 to 800), IBM Plex Mono (400 to 700) and Noto Sans Devanagari (400 to 700) before the first render. `AppText` picks the per-weight family and switches sans to Devanagari when the language is `mr` or `hi`. `forceLatin` keeps money, codes and plates in Latin script.
- Copy: `useT()` ([`src/hooks/useT.ts`](../../mobile-app/apps/resident-app/src/hooks/useT.ts)) binds `t(key)`, `c(id, field, fallback)` (translated fixture content) and `num(n)` (Devanagari numerals for `{n}`) from `@sahaj/shared`. There are three languages (English, Marathi, Hindi), chosen on the Language screen and saved on the phone. Until one is chosen there, the account's `me.language` is used (the API knows only `en` and `mr`); the choice is not written back to the API. Sign-in screens are English only, and so are most of the strings added for API states ("Couldn't load your dues", "Test mode", receipt rows). Server text such as bill titles and notices is shown as sent.

### Shared components

In [`src/components`](../../mobile-app/apps/resident-app/src/components):

| Component | Behaviour |
|---|---|
| `Skeleton` | Shimmer placeholder sized to the layout it stands in for. It is shown only while a query is actually `loading`, never on a timer ([`LOADING_AND_MOTION.md`](../LOADING_AND_MOTION.md)). |
| `LoadError` | The error branch of a `LoadState`: a title, the server's message, and "Try again" (refetch). |
| `Spinner` | The project's own ring spinner (no `ActivityIndicator`). It goes inside the control that is working. |
| `Button` | `loading` shows a spinner and disables the button. Callers also swap the label ("Signing in…", "Sending…"). The radius is derived from the height. |
| `ToastStack` | Bottom of the screen, at most 3 toasts, each with its own 2.8 s timer (`actions.toast(message, "ok" \| "warn")`). Toasts ignore touches. |
| `RevealItem` | A fade-and-rise on mount, in four tiers. There is no per-index cascade, and it respects reduced motion. |
| `BottomSheet` | A `Modal` sheet (or `fullScreen`) used by the payment flow. `onRequestClose` is what Android's back button does while it is open. |
| `LocalOnlyNote` | An info-coloured line on each fixture screen saying the feature isn't connected yet: what it shows is sample data or kept on this phone. |
| `EmptyState`, `Card`, `StatusPill`, `FilterPill` / `OptionButton` / `RadioRow` / `DayToggle`, `Toggle`, `ScreenHeader` / `TitleHeader`, `ScreenScroll`, `Icon`, `AnimatedPressable` | Layout primitives |

Screens turn a query into `LoadState` with `toLoadState` from `@chs/api-client/react`
and render `loading` as a skeleton, `error` as `LoadError`, and `ready` as content.
Infinite lists (`myBills`, `notifications.list`) switch on `status === "pending"` directly.

### Money and dates

All of these are in [`src/api/billing.ts`](../../mobile-app/apps/resident-app/src/api/billing.ts):

- Money travels as integer paise. `formatPaise` prints `₹4,850`, with Indian grouping, and shows paise only when there are some, always as two digits (`₹213.30`). The app never totals or derives a balance. Dues, bills and the ledger carry their own figures.
- Dates follow the IST calendar. `todayIso()` is UTC+5:30. The helpers are `dayMonth` ("15 Sep"), `longDate` ("15 September 2026"), `periodRange` ("1 Sep – 30 Sep 2026"), `dateTime` (en-IN, Asia/Kolkata), `timeAgo` ("2 hours ago", "Yesterday", then a date after 14 days) and `dueWhen` ("Due in 6 days", "Overdue by 10 days").
- `identity.ts` has `formatMobile` (`+91 98220 41155`), `formatPlate` (`MH 12 KJ 4471`), `monthYear` and `shortDate`.

### Error handling

- [`src/api/errors.ts`](../../mobile-app/apps/resident-app/src/api/errors.ts) `splitError(err, policyField?)` sends `ApiError.fieldErrors` to the fields and everything else to a single message. `PASSWORD_POLICY_VIOLATION` goes under the password field. Non-API errors become "Something went wrong. Try again."
- Server messages are shown as written.
- Read failures render `LoadError` with a retry. Write failures show a warn toast, or an inline field error when the server named a field.
- Queries retry only retryable errors (network or 5xx, as `ApiError.retryable` decides), and mutations never retry.

## 4. Features

Contract ids are written as `<group>.<name>` (`api.billing.myDues` in code). Their
definitions are in [`packages/contract/src/endpoints/`](../../packages/contract/src/endpoints/).
Society-scoped paths start with `/societies/:societyId`.

### 4.1 Sign-in

Files: [`SignInFlow.tsx`](../../mobile-app/apps/resident-app/src/features/auth/SignInFlow.tsx),
[`SessionGate.tsx`](../../mobile-app/apps/resident-app/src/features/auth/SessionGate.tsx),
[`authUi.tsx`](../../mobile-app/apps/resident-app/src/features/auth/authUi.tsx).

| Step | Endpoint | Behaviour |
|---|---|---|
| Mobile | `auth.lookup` | The field keeps 10 digits and accepts a pasted `+91…` or `0…`. It is validated with the contract's `schemas.Mobile` before sending. `next` picks the next step. |
| Create password (`CREATE_PASSWORD`) | `auth.activate` | Live rules: at least 8 characters, a letter and a number, not containing the mobile number. `schemas.auth.NewPassword` is checked on submit, the confirm field is checked on blur, and the terms box is required. `PASSWORD_ALREADY_SET` sends the user to the password step. |
| Enter password (`ENTER_PASSWORD`) | `auth.login` | `INVALID_CREDENTIALS` clears the field and refocuses it. `ACCOUNT_LOCKED` goes to the locked step with `details.lockedUntil`. The footer says there is no self-service reset: the office issues a one-time password. |
| Not registered (`NOT_REGISTERED`) | none | "Ask the office to add this number". "Use a different number" goes back. |
| Locked (`LOCKED`) | none | A countdown to `lockedUntil`. The button is disabled until then, and afterwards goes to the password step. |
| Forced change (`passwordChange`) | `auth.forcedChange` (restricted token) | New password plus confirm. A 401 means the restricted token expired, and the screen then offers "Sign in again" (`logout`). Saving signs other devices out. |
| Two-factor (`twoFactor`) | `auth.verifyTwoFactor` | A 6-digit code. "Start again" calls `expire()`. |

Every successful path hands the result to `SessionController.apply`. The gate, not
the sign-in screens, moves the user on. The mobile number is kept when the user goes
back from a step. Every call sends `client: "resident"` and a device name, `"<os> resident app"`.

### 4.2 Home

[`HomeScreen.tsx`](../../mobile-app/apps/resident-app/src/features/home/HomeScreen.tsx)

| Block | Source |
|---|---|
| Header: initials, a greeting by the hour in India ("Good morning" 4:00–11:59, "Good afternoon" to 16:59, "Good evening" after; Marathi and Hindi too), first name, unit line; emergency button; bell with unread dot | `useMe()`, `notifications.unreadCount` |
| Dues card | `billing.myDues`, the card for the viewed unit. If the unit has no card, it shows "Nothing due". The chip reads "Overdue since" (for the oldest overdue open bill), "Due <date>" (`nextDueDate`) or "Nothing due". Below the amount it shows the number of open bills and interest, or the advance. Tapping it opens Dues. |
| Email prompt | Shown if `!me.email` or `preferences.hasEmail === false`, and not dismissed. See [4.10](#410-email-prompt). |
| Building status | Fixture `utilities` |
| Quick actions | Pay dues (opens Dues), Invite guest, Raise ticket, Amenities |
| Unit switcher card | When the account has more than one flat. Switches the viewed unit. |
| Latest notice | `notices.feed`, the item with the newest `publishedAt` (the feed itself puts pinned notices first) |
| AGM votes card | Fixture polls. The line under the title counts the polls this flat hasn't voted on ("n of m AGM items need your vote"); a tenant reads "Owners are voting". The design's copy is used when there are exactly two polls, an English line otherwise, and no line at all when there are no polls. |
| Expected today | Fixture passes in the `expected` state for the viewed unit |

The dues card and latest notice each have their own skeleton and `LoadError`.

### 4.3 Dues, bills and bill detail

[`DuesScreen.tsx`](../../mobile-app/apps/resident-app/src/features/dues/DuesScreen.tsx),
[`BillCard.tsx`](../../mobile-app/apps/resident-app/src/features/dues/BillCard.tsx),
[`BillDetailScreen.tsx`](../../mobile-app/apps/resident-app/src/features/dues/BillDetailScreen.tsx)

**Dues list.** Endpoints: `billing.myBills` (`unitId`, limit 50, cursor pages, with
"Show older bills") and `payments.mine` (`unitId`, limit 100).

- The All / Unpaid / Paid filter runs over the bills already loaded; it does not refetch. The server's `state=` filter is not used because it applies after paging. Unpaid means `balancePaise > 0` and not cancelled. Paid means `paymentState === "PAID"`.
- A card has a 3 px left edge: ok (paid or cancelled), warn (open), bad (overdue). An open card shows the balance; a settled one shows the total. The tag is Maintenance or Supplementary.
- The "when" line reads "Paid 12 Aug" (the date of the latest successful payment allocated to that bill), "Settled", "Cancelled", "₹x paid · Due in n days", or `dueWhen`.
- There are separate empty states for "No bills yet", "No paid bills yet" and "Nothing outstanding".
- The header's "Statement" button opens the statement.

**Bill detail.** Endpoints: `billing.bill`, plus `billing.myDues` and `payments.mine`.

- The headline is the balance while the bill is open, or the total once it is settled. It adds the due or settled date, the bill number and the unit.
- "What this covers" lists each line with its `basis` ("3 inlets × ₹140"). Interest lines are drawn in the bad colour and credits as `− ₹x`. Below the lines come the total, then "Paid so far" and the balance for a part-paid bill.
- If the bill is open and has `arrearsPaise > 0`, a warning card says the earlier arrears are still due but are not part of this bill.
- Settled bills show "Settled on <date>" and the receipt number from the settling payment.
- **Pay rule**: the button pays everything due on the flat. The amount is the dues card's `totalDuePaise` if that is positive, otherwise the bill's balance. If it covers more than this bill, the title becomes "All dues for <unit>" with "Clears everything due on <unit>, oldest bill first." The button shows a spinner while the dues are loading.

Paying is started only from bill detail. Home's "Pay dues" and the dues card open
the Dues list.

### 4.4 Pay (dummy gateway)

[`PaymentSheets.tsx`](../../mobile-app/apps/resident-app/src/features/payment/PaymentSheets.tsx).
The sheet state is in the store (`sheet`, `payTarget`). The order and its outcome
are component state in `PaymentSheets`.

| Sheet | What happens |
|---|---|
| `pay` (method picker) | "Pay ₹x" with a "Test mode" tag. The rows are "Pay using QR code" and "Pay using installed app". Picking one calls **`payments.start`** with `{ unitId }` and no amount, so the server charges everything due at that moment. Both rows are disabled while the call runs, the chosen one shows "Starting the payment…", and an error appears inline. |
| `qr` | A 10-minute countdown held in the store (`qrLeftSeconds`), a decorative QR (`QrGraphic`, its pattern seeded from the order id, so it holds still while the clock runs), and "Waiting for the bank". "I have paid — check now" calls **`payments.completeDummyCheckout`** with `{ orderId, outcome: "success", method: "UPI" }`. When the code expires the order is cancelled (**`payments.cancelCheckout`**) and the button becomes "Generate a new code", which calls `payments.start` again: a new order, a new pattern, a fresh 10 minutes. "Cancel payment" closes the sheet with a "Nothing was charged" toast. |
| `app` | Three fake UPI apps. Tapping one completes with `success`. "Back" closes the sheet. |
| Both checkouts | A small "Simulate a failed payment" link completes with `outcome: "failure"`. |
| `success` (full screen) | The receipt number (or "Being issued"), amount, "Paid via", unit and date, all from the returned `Payment`, plus the Test mode tag. "Download receipt" shows a toast only. "Done" closes the sheet and goes to Dues. |
| `failed` | "Payment didn't go through", the amount, unit and `failureReason` (or "the bank declined it"), and "Nothing was charged". "Try again" goes back to `pay`, and that is a fresh `payments.start`, since a failed order can't be retried. |

**Abandoned checkouts.** `PaymentSheets` remembers the payment `payments.start` opened
(`openCheckout`) until it is completed. Whenever the sheets close, or go back to the
method picker, with that payment still open — "Cancel payment", the app picker's
"Back", a backdrop tap, the back button — or the QR expires, it calls
`payments.cancelCheckout` (`POST /societies/:sid/my/payments/:paymentId/cancel`,
CREATED → CANCELLED, payer only) without waiting on it. The server also cancels
checkouts left open for 30 minutes. Cancelled payments are not listed as receipts.

`completeDummyCheckout` invalidates `payments.mine`, `payments.get`,
`billing.myDues`, `billing.myBills`, `billing.bill` and `billing.ledger`, so Home,
Dues, the bill and the statement refresh themselves. `payments.start` is marked
`idempotent` in the contract; `useApiMutation` keeps one `Idempotency-Key` per input
until a call succeeds, so a retry after a timeout replays the same order, and the next
start after a success (a new code, a new attempt) is a new order.

### 4.5 Statement and ledger

[`StatementScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/StatementScreen.tsx).
Endpoints: `billing.ledger` (`from` = 1 April of the current financial year, IST),
`payments.mine`, `billing.myDues`.

- The closing balance comes from `ledger.balancePaise` (warn colour if above zero, ok otherwise). The line under it reads "Payable by", "Overdue since", "Fully settled, with ₹x paid in advance", or "Your account is settled".
- While something is due, an interest card shows the interest the dues card reports, or explains the rule if there is none. The app never estimates interest.
- "This year" lists the ledger entries: narration, date, kind (Bill, Payment, Credit note, Reversal, Opening balance, Advance applied), running balance, and `+`/`−` amount.
- Receipts are payments with a receipt, or `PENDING` payments: a cheque reads "Cheque awaiting clearance", any other mode "<mode> payment awaiting confirmation". Cancelled receipts and reversed payments are struck through. Abandoned and cancelled online checkouts are left out.
- "Download as PDF" has no PDF behind it yet; its toast says so, naming the financial year (`financialYear()` in `billing.ts`, "2026-27").

### 4.6 Notices

[`NoticesScreen.tsx`](../../mobile-app/apps/resident-app/src/features/notices/NoticesScreen.tsx),
[`NoticeDetailScreen.tsx`](../../mobile-app/apps/resident-app/src/features/notices/NoticeDetailScreen.tsx),
[`src/api/notices.ts`](../../mobile-app/apps/resident-app/src/api/notices.ts)

- **Feed** (`notices.feed`, limit 50, no paging): pinned notices first, then newest. The header reads "n unread of total". A card has a tag (category → AGM / Urgent / Facility / Billing / General; Urgent is shown as bad, AGM as info), a Pinned pill, `timeAgo`, an accent border and dot while unread, a blurb (the first paragraph, cut at a sentence), and "Needs your acknowledgement" when an acknowledgement is required and hasn't been given.
- **Detail** (`notices.get`): the tag, a "Replaced by a newer notice" pill if superseded, title, society name, posted time, and paragraphs.
- **Read**: when the notice loads unread (`mine !== null && !mine.read`), the screen calls `notices.markRead` once per visit.
- **Acknowledge**: the button appears only if `ackRequired` and the user is a recipient (`mine !== null`). It calls `notices.acknowledge` and shows the toast "Acknowledgement sent to the office." Once acknowledged, it becomes a disabled "Acknowledged". Errors show a warn toast. Both calls invalidate `notices.feed` and `notices.get`.

### 4.7 Notifications inbox, preferences and test send

**Inbox**, from the bell on Home:
[`NotifsFeedScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/NotifsFeedScreen.tsx).
Endpoints: `notifications.list` (limit 30, "Show older"), `notifications.unreadCount`,
`notifications.markRead`, `notifications.markAllRead` (body `{}`, shown only when
something is unread).

- Unread rows have the accent wash. The icon tone is warn for `EMERGENCY` and for a `PAYMENT` whose `data.status` is `FAILED`, ok for a `PAYMENT` with `status: "SUCCESS"`, and info for the rest (including payment notifications written before the server added `status`).
- Tapping a row marks it read (if it was unread) and opens `data.route` through `useOpenRoute`, the same routing a push tap uses ([section 5](#5-push-notifications)).
- The notices feed and the inbox are separate lists. The server links them: `notices.markRead` also marks that notice's inbox notification read and emits `notifications.changed` (`notices.service.ts`).

**Preferences**, from Profile → Notifications:
[`NotificationsScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/NotificationsScreen.tsx).
Endpoints: `notifications.preferences`, `notifications.updatePreferences`, `notifications.test`.

- A push status card, driven by `usePushState()`:
  - `granted`: "Notifications reach this phone".
  - `denied`: "Notifications are off", with an "Allow" button that calls `retryPush()`.
  - `pending`: "Setting up".
  - `unavailable`: one message for the web and another for a build without Firebase.
- "Send a test notification" calls `notifications.test`. A toast reports whether a push and/or an email went out; the notification always lands in the inbox too. The server rate-limits this endpoint.
- Two lists, "On this phone" (push) and "By email", group the eight categories into rows (`PREFERENCE_ROWS`):

| Row | Categories |
|---|---|
| Society notices | `NOTICE` |
| Bills and receipts | `BILLING`, `PAYMENT` |
| Requests and approvals | `APPROVAL` |
| Statements and reports | `REPORT` |
| Other updates | `GENERAL` |
| Emergencies | `EMERGENCY` (mandatory: locked on) |
| Account and security | `ACCOUNT` (mandatory: locked on) |

  A row shows as on if any of its categories is on. Toggling a row sets all of its
  non-mandatory categories. The screen sends every non-mandatory preference and shows
  the draft until the server answers. On failure it shows a warn toast and reverts.
- If `hasEmail` is false, the email list is replaced by "No email on your account" with an "Add your email" button.
- The Profile row shows "n of m on", counting only the rows that can be switched off, on the push channel.

### 4.8 Household, vehicles, tenants and profile

All of these read the one `members.myHome` query (`units[]` with members, family,
vehicles, parking, tenancies and occupancy, plus `pendingApprovals`). `members.changed`
and `approvals.changed` refetch it.

**Profile** ([`ProfileScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/ProfileScreen.tsx)):

- The name, and how the home unit is held: "Tenant", "Family member", else the membership kind label (Primary owner, Co-owner, Associate member), else "Co-owner" or "Owner" from the user type.
- A "My unit" card for the viewed unit: carpet area, occupancy, share certificate (or "Tenancy until" for a tenant), parking.
- Settings rows with their counts. Counts are left blank until `myHome` or the preferences have loaded. Daily help and Helpdesk ("1 open · 2 total") count the viewed unit's fixture rows, as their screens list them.
- A "Dark mode" switch at the foot of the settings card (the design has both themes but no switch inside the app).
- "Sign out" calls `signOut(session)` (see [section 5](#5-push-notifications)).

**Personal details** ([`PersonalDetailsScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/PersonalDetailsScreen.tsx)):

- The mobile number is locked ("Set by office").
- Email is editable and saves through `me.update` (`{ email }`, or `null` to clear it). `useApiMutation` refreshes the session's `/me` afterwards, and the saved value is shown from the draft until it does. `me.update` also invalidates `notifications.preferences`, so `hasEmail` (the Home prompt, the Notifications screen) updates straight away. Validation errors show under the field.
- Alternate phone and emergency contact are local only, chipped "Not shared with the office", start empty, and last until the app closes. The API has no fields for them. Saving says which is which ("Email saved to your account.").
- A "Member since" or "Tenant since" line and the residence rows come from `myHome`.

**Household** ([`HouseholdScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/HouseholdScreen.tsx)):

- Rows come from `householdRows`: the unit's current members (or just the user, for a tenant), then family records. A family record that duplicates a member by mobile or name is dropped. The user's own row is chipped "You".
- **Add** calls `members.addFamily` `{ name, relation: Spouse|Child|Parent }`. The name must be at least 2 characters. The response is either the created record ("added") or `{ approvalId }` ("sent to the society office for approval").
- Pending `FAMILY_ADD` approvals for the unit appear as dashed "With the office" rows (`PendingRow`).
- **Remove** calls `members.removeFamily`. It is offered only on family rows of the flat the user lives in; members and tenancies are changed by the office, and a let-out flat's family records are the tenant's side (as on Vehicles).
- The add form appears only when the viewed unit is the home unit. For a let-out flat, only its family records are listed.

**Vehicles** ([`VehiclesScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/VehiclesScreen.tsx)):

- Plates are listed spaced, with make and colour, and a parking slot chip or "Slot pending".
- **Register** calls `members.addVehicle` `{ plate (spaces and dashes stripped, at least 6 characters, uppercased), type: CAR|TWO_WHEELER }`, and gets back either a created record or `{ approvalId }`.
- Pending `VEHICLE_ADD` approvals show as dashed rows.
- **Remove** calls `members.removeVehicle`.
- Register and Remove are shown only for the home unit.

**My tenants** ([`TenantsScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/TenantsScreen.tsx)):

- Lists units the user is a member of that have an active or past tenancy (`landlordUnits`).
- Each agreement card shows the tenant, unit, rent and deposit (through `formatPaise`, so paise are kept), active or ended status, start and end dates, the police intimation reference (or "Not filed"), and who pays the society's bills.
- "Start renewal" is local only (`state.renewed`); its toast and label say the office hasn't been told.

### 4.9 Language

[`LanguageScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/LanguageScreen.tsx)
sets `state.language` to `en`, `mr` or `hi`, saves it on the phone, and shows a toast.
Nothing is sent to the API. With nothing saved, the language follows `me.language`.

### 4.10 Email prompt

This is on Home, in the `EmailPrompt` component. It is shown while the account has no
email: `!me.email`, or `notifications.preferences` answered `hasEmail: false`.

- "Add your email" calls `goAddEmail`, which sets `editingPersonalDetails` and pushes `personal`, so the email field opens ready to type.
- The close button sets `emailPromptDismissed`. That lasts until the store resets, on sign-out or app restart.
- After an email is saved the prompt goes at once: `me.update` refreshes `/me` and invalidates `notifications.preferences`.
- The same button appears on the Notifications screen when there is no email. The server refuses report emails with `EMAIL_REQUIRED` until an email is added ([`NOTIFICATIONS.md`](../NOTIFICATIONS.md)).

## 5. Push notifications

Two files are involved. [`src/push/push.ts`](../../mobile-app/apps/resident-app/src/push/push.ts)
knows Firebase. [`src/push/bridge.ts`](../../mobile-app/apps/resident-app/src/push/bridge.ts)
knows the app.

### Availability

`enabled` is `Platform.OS !== "web" && extra.pushEnabled`. When push is first used,
`push.ts` `require`s `@react-native-firebase/messaging` lazily, inside a try/catch,
and registers a no-op background handler. The server sends `notification` messages,
which the OS displays while the app is in the background. If `enabled` is false or
the module can't load, `isPushAvailable()` is false and every function turns into a
no-op that returns `"unavailable"`. This is the case on the web and in any build made
without `google-services.json` / `GoogleService-Info.plist`. The inbox still works.

`bridge.ts` keeps the permission result in a module-level store (`usePushState()`:
`pending` / `granted` / `denied` / `unavailable`). It is not in the resident store
because registration starts before the shell adopts the account and resets state.

### Registration

- **When**: `bindPushToSession` calls `startPush()` every time the session becomes `signedIn`, whether through a fresh sign-in or through `restore()` on a cold start. Nothing waits for it.
- **Steps** (`registerForPush`):
  1. On Android, create the channels (below).
  2. Ask permission. On Android 13 and later that means `POST_NOTIFICATIONS` through `PermissionsAndroid`, and then `messaging.requestPermission`. `AUTHORIZED` or `PROVISIONAL` count as granted.
  3. Get the FCM token.
  4. Call **`notifications.registerDevice`** `{ token, app: "resident", platform: "ios"|"android", deviceName }`.
- **Token refresh**: `onTokenRefresh` re-registers each new token. The previous listener is removed first. Errors are swallowed.
- Any exception during registration yields `"unavailable"`.
- **Retry**: the "Allow" button on the Notifications screen runs `retryPush()`, which asks again and registers.

### When the session ends

Unregistering is tied to the session, not to a button. `bindPushToSession` (mounted
once by `SessionGate`) sees every `signedIn` → anything-else transition and calls
`stopPush()`: the push state resets to `pending` (or `unavailable`), and
`unregisterPush()` stops the refresh listener, calls
**`notifications.unregisterDevice`** `{ token }`, and then `messaging.deleteToken()` so
the next account gets a new token. Both steps ignore errors. `stopPush()` runs once per
registration (a module flag set by `startPush` / `retryPush`).

- **Sign-out button** (`signOut(session)`, used by Profile and "No flat on this account"): `stopPush()` runs first, while the session is still valid, so the server call succeeds; then `session.logout()` calls `auth.logout` and clears the tokens, and the listener finds nothing left to do. `SessionGate` then clears the query cache and the store.
- **Revoked session, rejected refresh token**: the tokens are already gone when the listener fires, so `unregisterDevice` fails (401) and is ignored, but `deleteToken()` still runs. The server's copy of that token stops working at FCM, so it can't reach the phone.
- **Forced-change "Sign in again", 2FA "Start again"**: these never reached `signedIn` in this session, so nothing was registered and there is nothing to undo.

### Tap routing

`usePushRouting()` is mounted once by `ResidentShell`, so taps are handled only while
signed in. `onPushOpened` subscribes to `onNotificationOpenedApp` and also replays
`getInitialNotification()` (a tap that launched the app from cold). The route is
`data.route`, and it must start with `/`. `useOpenRoute` maps it:

| Server route | Sent by | Screen |
|---|---|---|
| `/bills/<id>` | bill published (`BILLING`) | `openBill(id)` pushes `bill` |
| `/notices/<id>` | notice published | `openNotice(id)` pushes `notice` |
| `/payments/<id>` | payment succeeded or failed (`PAYMENT`) | Calls `payments.get`. If the payment's unit is the home or let-out unit, it switches the viewed unit. Then it pushes `statement`, even if the lookup failed. |
| `/notifications` | test notification | pushes `notifs` (unless already there) |
| anything else | | pushes `notifs` |

The inbox rows use the same function.

### Foreground

`onForegroundPush` (`messaging.onMessage`) shows the push as a toast,
"<title> — <body>", in the default `ok` style. Emergencies get the same style.
Realtime `notifications.changed` updates the badge and inbox separately.

### Android channels

`ensureChannels()` creates two channels before the first registration:

| Channel | Name | Settings |
|---|---|---|
| `default` | Updates | `AndroidImportance.DEFAULT` |
| `emergency` | Emergencies | `MAX` importance, `bypassDnd`, vibration `[0, 400, 200, 400]`, public on the lock screen |

The server picks `emergency` for urgent messages (`channelId` in `backend/src/core/push.ts`)
and `default` for everything else. On iOS there are no channels, and permission is
asked through Firebase.

## 6. Key flows

### First sign-in (account created by the office, no password yet)

1. Mobile step: the user types the number, then `auth.lookup` returns `CREATE_PASSWORD`.
2. Create password: the rules tick off live, the terms box is checked, and the user taps "Activate account". That calls `auth.activate`, which returns `SIGNED_IN`, and the session stores the tokens.
3. The session listener (`bindPushToSession`) sees `signedIn` and calls `startPush()` (the OS permission prompt appears on a Firebase build); `SessionGate` renders `SignedInApp`.
4. `SignedInApp` finds the `USER` membership with a flat and dispatches `adoptIdentity`, which resets the store (keeping the phone's theme and language) with `unit = homeUnit`, and applies `me.language` if no language was chosen on this phone. `members.myHome` loads. If it shows other flats of theirs, they appear in the unit switcher; a let-out one makes the role `owner_tenant`.
5. The shell renders Home. The dues card, unread dot and latest notice load with skeletons, and the email prompt shows if there is no email.

If the office issued a temporary password, `auth.login` returns `PASSWORD_CHANGE`,
the gate shows the forced-change screen, and `auth.forcedChange` completes the sign-in.

### Paying dues

1. Dues tab (or Home's dues card): tap an open bill, which opens `bill` (`billing.bill`).
2. "Pay ₹x" calls `openPay({ unitId, unitLabel, amountPaise, title })`, and the `pay` sheet opens.
3. The user picks QR or app, which calls `payments.start({ unitId })` and returns a `Checkout` (`payment`, `orderId`, `amountPaise`). The sheet now shows the server's amount.
4. The user taps "I have paid" or an app. That calls `payments.completeDummyCheckout({ orderId, outcome: "success", method: "UPI" })`, which returns a `Payment` with status `SUCCESS`, and the `success` sheet opens.
5. Invalidation refetches dues, bills, the bill, the ledger and payments. The server also sends a `PAYMENT` notification (`/payments/<id>`) and realtime `payments.changed`.
6. "Done" closes the sheet and goes to Dues, where the bill now reads Paid.

If the user walks away instead (cancels the QR, backs out of the app picker, lets the
code expire), the started payment is cancelled on the server with
`payments.cancelCheckout`. After an expiry, "Generate a new code" starts a new order.

### A failed payment

1. The user follows steps 1 to 3 above, then taps "Simulate a failed payment". That calls `completeDummyCheckout` with `outcome: "failure"`, which returns a `Payment` that isn't `SUCCESS`.
2. The `failed` sheet shows the amount, unit and `failureReason`, and says "Nothing was charged".
3. "Try again" returns to `pay`. The previous checkout is discarded, so picking a method starts a new order. "Close" dismisses the sheet.
4. The server sends "Payment didn't go through" to the inbox and by push, with `data.status: "FAILED"`. The inbox shows it with the warn tone.

### Acknowledging a notice

1. On Notices, the card is unread and marked "Needs your acknowledgement". Tapping it opens `notice` (`notices.get`).
2. The notice loads unread, so `notices.markRead` fires once. The invalidations clear the unread dot in the feed.
3. The user taps "I have read this", which calls `notices.acknowledge`. A toast appears and the button becomes "Acknowledged". The server records this as proof of service.

### Adding a family member

1. Profile → Household (home unit only).
2. The user types a name, picks a relation, and taps "Add to household". That calls `members.addFamily`.
3. For a resident the response is `{ approvalId }`. The toast says the request went to the society office, and the invalidated `myHome` returns the request under `pendingApprovals`, which shows as a dashed "With the office" row.
4. When the office decides, realtime `approvals.changed` / `members.changed` refetch `myHome`. An approved request becomes a family row with a remove button; a rejected one disappears. No backend module sends an `APPROVAL`-category notification yet, so the only signal the resident gets is the list changing.

### Receiving and tapping a push

1. The server calls `notify()`, which writes the inbox row and sends FCM with `data.route` and a channel.
2. What happens next depends on the app's state:
   - In the background or killed: the OS shows the notification on the chosen channel. Tapping it opens the app. If a stored session restores, the shell mounts and `onPushOpened` receives the tap (from `onNotificationOpenedApp`, or `getInitialNotification` after a cold start). `useOpenRoute` then opens the screen.
   - In the foreground: the OS shows nothing. The shell shows a toast, and realtime `notifications.changed` updates the bell dot and the inbox. The user opens it from the inbox.
3. If the app is signed out when a notification is tapped, nothing is routed until the user signs in and the shell mounts.

## 7. Still on mock data

These features read and write local state seeded from `@sahaj/shared`
([`packages/shared/src/mock`](../../mobile-app/packages/shared/src/mock)). Nothing
reaches the server or the gate app. They are still local because the backend has no
modules or contract endpoints for them yet. The contract has no visitor, helpdesk,
amenity, poll, daily-help or SOS groups.

| Feature | Screens | What it does locally |
|---|---|---|
| Visitors and guest passes | `visitors`, `invite`, `passDone` | `createGuestPass` makes a random 4-digit code. "Share with guest" opens the phone's share sheet (`Share.share`) with the code; if sharing can't open (the web preview without `navigator.share`), a toast gives the code. Cancel removes the pass. |
| Daily help | `invite` (Daily help tab), `dailyHelp` | Standing pass `ST-xxxx`, a 30-day attendance sheet, "mark paid" |
| Helpdesk | `newTicket`, `helpdesk`, `ticket` | Tickets `TKT-<n>`, "urgent" flag, mark resolved. The toast says the ticket is saved on this phone and to call the office if it's urgent. The design's "n neighbours reported this" banner is not shown: its count was fixture data. |
| Amenities and booking | `amenities`, `book` | Slot picking, confirm and cancel bookings; nothing is charged |
| AGM polls | `polls`, `poll` | One vote per poll, tallies computed in `pollTally`. Tenants can't vote. The toast and the "Vote cast" card say it is saved on this phone and not counted. |
| Building status | `utilities` | Fixture utility states, marked as a sample |
| Deliveries | `deliveries` | A preference, "Saved on this phone. The gate can't see it yet." |
| Personal details extras | `personal` | Alternate phone, emergency contact |
| Tenancy renewal | `tenants` | `renewed` flag; "Renewal noted on this phone" |
| Receipt and statement download | pay `success`, `statement` | Toasts saying downloads aren't available yet |
| UPI apps and QR image | pay sheets | Fixed list of three fake apps, and a decorative QR |

Every one of these screens shows a `LocalOnlyNote` (or, on the forms, the toast) saying
the feature isn't connected: nothing claims to have been sent, notified or told. None of
this local data survives a sign-out or an app restart.

The emergency screen (`sos`, [`EmergencyScreen.tsx`](../../mobile-app/apps/resident-app/src/features/profile/EmergencyScreen.tsx))
is no longer a fixture. The design's hold-to-raise alert needs a backend that tells the
gate and the committee, and there is none, so the screen says "Emergency alerts aren't
connected yet" and offers a large red "Call 112" (India's emergency number) and the
society office's number from `society.get` → `contactPhone` ("Call office"; skeleton
while it loads, `LoadError` with retry, "No office number on record" if blank). Calls go
through `Linking.openURL("tel:…")`; if the phone can't place one, a toast gives the number.

`whenRequestSettles` in `actions.ts` is where these actions will later await a real
call. Today it resolves on the next tick. The fixtures are keyed to the demo units
(`A-1204`, `B-0702`, `C-0405`), and the screens filter by the viewed unit, so other
accounts mostly see empty lists.

## 8. File map

All under `mobile-app/apps/resident-app/`.

| Path | What it is |
|---|---|
| [`app.json`](../../mobile-app/apps/resident-app/app.json), [`app.config.ts`](../../mobile-app/apps/resident-app/app.config.ts) | Expo config; native IDs, Firebase switch, plugins, `extra` |
| [`metro.config.js`](../../mobile-app/apps/resident-app/metro.config.js) | Watches the workspace and `../packages`. Bare imports from `packages/*` are resolved as if from the app, so there is one React and one React Query. |
| [`src/app/_layout.tsx`](../../mobile-app/apps/resident-app/src/app/_layout.tsx) | Providers, font gate |
| [`src/app/index.tsx`](../../mobile-app/apps/resident-app/src/app/index.tsx) | The only route, which renders `SessionGate` |
| [`src/api/client.ts`](../../mobile-app/apps/resident-app/src/api/client.ts) | API client, realtime, `SessionController`, token store |
| [`src/api/identity.ts`](../../mobile-app/apps/resident-app/src/api/identity.ts) | `/me` + `myHome`, role derivation, household rows, mobile/plate formatting |
| [`src/api/billing.ts`](../../mobile-app/apps/resident-app/src/api/billing.ts) | Dues, bills, ledger and payment hooks; bill state; money and date formatting |
| [`src/api/notices.ts`](../../mobile-app/apps/resident-app/src/api/notices.ts) | Feed hook, tags, blurbs |
| [`src/api/notifications.ts`](../../mobile-app/apps/resident-app/src/api/notifications.ts) | Unread, preferences, preference rows, `useOpenRoute` |
| [`src/api/errors.ts`](../../mobile-app/apps/resident-app/src/api/errors.ts) | `splitError` |
| [`src/api/society.ts`](../../mobile-app/apps/resident-app/src/api/society.ts) | `useSocietyProfile`, phone formatting and `tel:` links |
| [`src/push/push.ts`](../../mobile-app/apps/resident-app/src/push/push.ts) | Firebase: availability, channels, permission, register/unregister, listeners |
| [`src/push/bridge.ts`](../../mobile-app/apps/resident-app/src/push/bridge.ts) | Push state store, `bindPushToSession`, `startPush`, `retryPush`, `signOut`, `usePushRouting` |
| [`src/state/`](../../mobile-app/apps/resident-app/src/state/) | `ResidentProvider`, reducer and types, initial state, actions, selectors, `devicePrefs` (theme and language on the phone) |
| [`src/features/auth/`](../../mobile-app/apps/resident-app/src/features/auth/) | `SessionGate` (gate, forced change, 2FA, no-flat, restore failure), `SignInFlow`, `authUi` |
| [`src/features/shell/`](../../mobile-app/apps/resident-app/src/features/shell/) | `ResidentShell` (with the Android back handler), `TabBar` |
| [`src/features/home/`](../../mobile-app/apps/resident-app/src/features/home/) | Home, dues card, latest notice, email prompt |
| [`src/features/dues/`](../../mobile-app/apps/resident-app/src/features/dues/) | Dues list, bill card, bill detail |
| [`src/features/payment/`](../../mobile-app/apps/resident-app/src/features/payment/) | Payment sheets, placeholder QR |
| [`src/features/notices/`](../../mobile-app/apps/resident-app/src/features/notices/) | Notice feed and detail |
| [`src/features/profile/`](../../mobile-app/apps/resident-app/src/features/profile/) | Profile and its sub-screens: statement, inbox (`NotifsFeedScreen`), preferences (`NotificationsScreen`), household, vehicles, tenants, personal, language, emergency, plus the fixture screens (amenities, book, building status, daily help, deliveries, polls) |
| [`src/features/visitors/`](../../mobile-app/apps/resident-app/src/features/visitors/), [`invite/`](../../mobile-app/apps/resident-app/src/features/invite/), [`helpdesk/`](../../mobile-app/apps/resident-app/src/features/helpdesk/) | Fixture features |
| [`src/components/`](../../mobile-app/apps/resident-app/src/components/) | Shared UI primitives |
| [`src/theme/`](../../mobile-app/apps/resident-app/src/theme/), [`src/hooks/`](../../mobile-app/apps/resident-app/src/hooks/) | Colours, type styles, fonts; `useTheme`, `useT` |
| [`mobile-app/packages/shared/src/`](../../mobile-app/packages/shared/src/) | Tokens, copy (`i18n/copy.ts`), content translations, numerals, fixtures, `formatInr` |
| [`packages/contract/src/endpoints/`](../../packages/contract/src/endpoints/) | Endpoint definitions the app calls |
| [`packages/api-client/src/react.tsx`](../../packages/api-client/src/react.tsx) | `ApiProvider`, `useApiQuery`, `useApiInfiniteQuery`, `useApiMutation`, `toLoadState`, realtime sync |

## 9. Known gaps

**Push and session**

- Foreground pushes always use the `ok` toast style, including emergencies. A toast can't be tapped to open the route.
- `usePushRouting` subscribes each time the shell mounts, and `getInitialNotification` is replayed on each subscription. Whether a second sign-in in the same process re-opens the launch notification depends on what React Native Firebase returns.
- `registerForPush` runs, and asks for permission, on every transition to `signedIn`, including each cold start with a stored session.
- When the session ends by itself (revoked, refresh rejected), `unregisterDevice` can't authenticate and fails; only the local `deleteToken()` happens. The server keeps the dead token row until FCM reports it invalid.

**Navigation**

- The helpdesk is reached from a Profile row, not from the design's own "Help" tab; the tab bar follows the prototype's five tabs.
- The Android back button isn't handled on the signed-out screens (sign-in steps, forced change, 2FA); there it leaves the app.
- A person with memberships in two societies sees only the first `USER` membership with a flat.
- A tenant who also owns a flat in the society sees only the rented one: the tenant path lists no other flats.
- A family member or co-owner gets the `owner` role, so they can vote in the (fixture) AGM polls and register household; only the labels follow their holding.
- The language is saved on the phone only; it is never written to `me.language`, and Hindi has no API value.

**Payments**

- "Download receipt" and "Download as PDF" have no files behind them yet; their toasts say so.
- `finishPay` always lands on Dues, whatever screen the payment started from.
- The QR is still a decorative placeholder, not an encoded UPI intent.

**Data freshness**

- The notices feed is capped at 50 items with no paging.
- Payment notifications written before the server added `data.status` show the neutral info tone.

**Fixtures and copy**

- Visitors, daily help, the helpdesk, amenities, AGM polls, building status, deliveries and tenancy renewal are local fixtures. Each says so on screen; none of their data survives a sign-out or restart.
- The fixtures are keyed to the demo units, so the samples appear for Anita and Vikram and other accounts mostly see empty lists.
- `useT` copy covers only the fixture-era strings. Sign-in, most API-state strings, the "not connected yet" notes and toasts, the emergency screen, the unit switcher's "You hold n flats here" and the AGM line for other than two polls are English only. The greeting has English, Marathi and Hindi forms.
- The emergency screen can't alert anyone; it only places calls. The design's "What is happening?" picker and contact list (gate on duty, committee, emergency contact, hospital) are gone with the alert.

**Stale docs**

- `mobile-web.sh`'s banner and `scripts/README.md` still describe billing and notices as fixtures.

**Unused**

- `expo-linking` and `socket.io-client` are absent from the app's own imports, but expo-router and api-client use them. `expo-network` is used only for React Query's online state; there is no offline indicator.
- The "Requests and approvals" preference row controls `APPROVAL`, but no backend module sends that category yet.
