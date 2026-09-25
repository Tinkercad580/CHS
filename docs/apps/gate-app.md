# Gate app (Sahaj Gate)

The handset at the society gate, used by security guards. This page describes
the app as the code stands now: what it does, how it is built, and how each
feature gets from a screen to the API. Where a feature still runs on fixtures,
it says so.

Source: [`mobile-app/apps/gate-app`](../../mobile-app/apps/gate-app). Shared
tokens, types and fixtures: [`mobile-app/packages/shared`](../../mobile-app/packages/shared)
(`@sahaj/shared`). API contract: [`packages/contract`](../../packages/contract)
(`@chs/contract`). Client and React hooks: [`packages/api-client`](../../packages/api-client)
(`@chs/api-client`).

---

## 1. What it is

One phone at one gate, used by whichever guard is on shift. A guard signs in
with their own mobile number and password. They choose a four-digit duty PIN
for the shift, then work from five tabs: Entry, Staff, Log, Parcels, More.

Today the app splits into two halves.

| Half | Talks to the API | Features |
|---|---|---|
| Real | Yes | Sign-in (every step of MASTER_SPEC A2), refusing accounts that aren't guards, plate lookup against the society's vehicle register, notices from the office (feed, detail, read receipt, acknowledgement), the society office's phone number on the alert screen, push registration and tap routing, sign-out |
| Mock | No, in-memory fixtures | Visitor code verification, the "expected" pass list, walk-ins, the visitor log, parcels, staff attendance, alerts, shift handover |

The backend has no gate module yet (MASTER_SPEC C9, Phase 9). The mock half
reproduces the design prototype's screens so the flows can be reviewed, but it
never claims to have told anyone anything: every screen that would notify a
resident, the committee or the next guard says the record stays on this
handset, and the alert screen tells the guard to phone for help. See
[section 8](#8-still-on-mock-data-and-what-c9-adds).

| | |
|---|---|
| Expo SDK | 57 (`expo ~57.0.24`), expo-router, React Native 0.86.3, React 19.2.3 |
| App name / slug / scheme | `Sahaj Gate` / `sahaj-gate-app` / `sahajgate` |
| Store identifiers | `in.sahaj.gate` (Android package and iOS bundle ID), overridable with `CHS_GATE_ANDROID_PACKAGE` / `CHS_GATE_IOS_BUNDLE_ID` |
| Orientation / theme | Portrait, always dark (`userInterfaceStyle: "dark"`) |

---

## 2. Running it

### Web preview (the everyday loop)

```
./scripts/api.sh                 # the API on :4100, seeded with the demo society
./scripts/mobile-web.sh gate     # the gate app on http://localhost:8182
```

[`scripts/mobile-web.sh`](../../scripts/mobile-web.sh) installs the
`mobile-app/` npm workspace if needed. It frees port 8182 (override with
`CHS_GATE_PORT`), then runs `expo start --web`. It starts cold (`--clear`)
whenever `app.json` or `metro.config.js` is newer than the last run. The
resident app uses 8181, so both can run side by side. Narrow the browser to
about 400px.

**`/mnt/e` has no inotify.** The repo sits on a Windows drive mounted through
drvfs, so Metro never sees an edit. After changing a file:

1. Re-run `./scripts/mobile-web.sh gate`.
2. Hard-reload the browser tab (Ctrl-Shift-R). A tab left open runs the old bundle.

To find out whether an edit reached the bundle before you start debugging:

```
./scripts/bundle-grep.sh gate 'some new string'
```

A hit means Metro has the change and the tab is stale. A miss means Metro never
rebuilt, so restart with `--clear`. See [`scripts/bundle-grep.sh`](../../scripts/bundle-grep.sh).

On the web the session tokens and duty PIN live in `localStorage`, and push is
never available.

### Native builds

The app uses Continuous Native Generation: there are no `ios/` or `android/`
folders in git. Native settings live in [`app.json`](../../mobile-app/apps/gate-app/app.json)
and [`app.config.ts`](../../mobile-app/apps/gate-app/app.config.ts).

```
cd mobile-app/apps/gate-app
npx expo prebuild
npx expo run:android        # or run:ios, or an EAS build
```

`app.config.ts` adds these on top of `app.json`:

- the store identifiers;
- `POST_NOTIFICATIONS` on Android;
- `UIBackgroundModes: ["remote-notification"]` on iOS;
- the `expo-notifications` plugin (colour `#0E6B5C`, default channel `default`);
- `expo-build-properties` (Android `minSdkVersion 24`, plus static iOS frameworks when Firebase is present);
- the React Native Firebase plugins, only when `google-services.json` / `GoogleService-Info.plist` exist in the app folder.

Those two Firebase files are gitignored. Without them the build still works;
`extra.pushEnabled` is false and the app runs with no push. Firebase project
setup is in [NOTIFICATIONS.md](../NOTIFICATIONS.md). Push needs a native
build, because Expo Go and the web preview can't receive FCM. No `eas.json` is
checked in yet.

### API origin

[`src/api/client.ts`](../../mobile-app/apps/gate-app/src/api/client.ts) resolves
the origin in this order:

1. `process.env.EXPO_PUBLIC_API_ORIGIN`
2. `expo.extra.apiOrigin`, which `app.config.ts` also fills from `EXPO_PUBLIC_API_ORIGIN`
3. `http://localhost:4100`

Requests go to `${origin}/api/v1`, and the realtime socket connects to
`origin`. On a phone, `localhost` is the phone itself, so set
`EXPO_PUBLIC_API_ORIGIN=http://<your LAN IP>:4100` before bundling. On the
Android emulator use `http://10.0.2.2:4100`. `EXPO_PUBLIC_*` values are inlined
at bundle time. The API's default `CORS_ORIGINS` already includes
`http://localhost:8182`.

### Demo guard

The demo society (Shanti Vihar CHS), seeded by `api.sh`, has one guard:

| Mobile | Name | Password | Membership |
|---|---|---|---|
| 9890012345 | Ramesh Yadav | `Sahaj@2026` | `GUARD` template: role `USER`, user type `GUARD`, permissions `["gate.operate"]` |

Try the refusal path by signing in here as a resident, for example 9822041155
(Anita Deshpande). See [`scripts/README.md`](../../scripts/README.md) for all
demo accounts.

---

## 3. How it's built

### Provider tree

[`src/app/_layout.tsx`](../../mobile-app/apps/gate-app/src/app/_layout.tsx) builds this tree:

```
SafeAreaProvider
└─ ApiProvider (client, session, realtime, queryClient)   @chs/api-client/react: React Query + RealtimeSync
   └─ GateProvider                           the handset's local state (useReducer)
      ├─ StatusBar style="light"
      └─ View bg=colors.bg
         └─ <Slot/>, only once the fonts have loaded
```

There is exactly one route, [`src/app/index.tsx`](../../mobile-app/apps/gate-app/src/app/index.tsx).
It renders `SessionGate`. Every screen after that is chosen by state, not by
the router. `SessionGate` applies the top safe-area edge. The tab bar and the
auth screens pad their own bottom edge.

The API objects are created once, in `src/api/client.ts`:

- `apiClient`: `createApiClient` with base URL `${origin}/api/v1`. It sends the header `X-Client: gate`, and `onSessionExpired` calls `session.expire()`. The client refreshes an access token on 401 and runs one refresh at a time.
- `realtime`: a socket.io connection that authenticates with the current access token.
- `session`: `new SessionController(apiClient, { client: "gate", deviceName: "<os> gate handset" })`. The `client: "gate"` value goes in the body of every login, activate, two-factor and forced-change call. The server uses it to refuse accounts that aren't guards (see below).
- Token storage: `expo-secure-store` on a phone (keychain, `AFTER_FIRST_UNLOCK`) or `localStorage` on the web. The key is `chs.gate.session` either way.
- `queryClient`: `createQueryClient()` from the api-client, with `networkMode: "always"` for queries and mutations. On native, React Query's `focusManager` follows `AppState` (returning to the foreground refetches stale queries) and `onlineManager` follows `expo-network`'s `addNetworkStateListener` (regaining a connection refetches). `networkMode: "always"` keeps requests going out while the device reports no network: a paused first load would sit on its skeleton until the signal returned, whereas a failed one shows `LoadError` with Retry, and the header already says OFFLINE. The web keeps React Query's own browser listeners.

### Session gate

[`src/features/auth/SessionGate.tsx`](../../mobile-app/apps/gate-app/src/features/auth/SessionGate.tsx)
switches on `SessionController` state:

| Session status | Shows |
|---|---|
| `unknown` | A bare canvas while `controller.restore()` checks stored tokens. If the network fails, it shows "Can't reach Sahaj" with Try again. The stored tokens are kept. |
| `signedOut` | `SignInFlow`: mobile, then lookup, then one of four steps |
| `passwordChange` | `ForcedChangeScreen`: nothing else is reachable after a temporary password |
| `twoFactor` | `TwoFactorScreen`: only reached by an account that has TOTP on, such as an admin covering the gate |
| `signedIn` | `SignedInHandset`: not-a-guard, `ShiftScreen` or `GateShell` |

Inside `signedIn`, `SignedInHandset` decides:

1. If `guardMembership(me)` is null, it shows `NotAGuard` ("This account can't run the gate") with a Sign out button.
2. If the handset isn't on duty (`!state.onDuty`), it shows `ShiftScreen`, the duty PIN.
3. Otherwise it shows `GateShell`.

The shell is **mounted** only when the handset is on duty, not just hidden. A
locked handset holds no shell subtree, so it holds no visitor codes either.

When the session leaves `signedIn` for any reason (the sign-out button, five
wrong duty PINs, a revoked session, a dead refresh token), `SessionGate` does
five things:

- calls `unregisterPush()`, best-effort;
- deletes that user's duty PIN;
- clears the React Query cache (`queryClient.clear()`);
- calls `actions.endShift()`;
- unmounts the shell.

The first two run from a `session.subscribe` listener, so they happen at the
transition itself, however it came about, and don't depend on a render. When
the sign-out button started it, push was already unregistered (see
[4.4](#44-handover-and-sign-out)) and the second call does nothing. When the
session ended by itself the tokens are already gone, so the server can't be
told; `unregisterPush()` then only deletes the FCM token on the phone, FCM
refuses that token from then on, and the server prunes it on its next send.

A stored session the server refuses at launch (revoked or expired while the
app was closed) goes `unknown` → `signedOut` and never reaches `signedIn`.
`SessionGate`'s `restore` notes whether tokens were stored before calling
`controller.restore()`, and if they were and the result is `signedOut`, it
calls `unregisterPush()` too. That account's duty PIN can't be found then (the
user id went with the tokens); it stays in storage until the next password
sign-in on the handset, which clears it before the shift screen reads it.

The in-memory log, parcels, staff and alerts are *not* reset.

### Handset sign-in and the duty PIN

These are two separate checks.

**1. Handset sign-in (server-verified).** This is the same mobile-and-password
flow as the resident app, drawn in the gate's own style. It is in
[`SignInFlow.tsx`](../../mobile-app/apps/gate-app/src/features/auth/SignInFlow.tsx)
and [`authUi.tsx`](../../mobile-app/apps/gate-app/src/features/auth/authUi.tsx).

- The mobile field accepts a pasted `+91 98900 12345` or `098900…` and validates with `schemas.Mobile`.
- `auth.lookup` returns one of four next steps:
  - `CREATE_PASSWORD`: activate with password, confirm and terms, through `auth.activate`. If the server returns `PASSWORD_ALREADY_SET`, the app switches to the password step.
  - `ENTER_PASSWORD`: `auth.login`. On `INVALID_CREDENTIALS` the field clears. On `ACCOUNT_LOCKED` the app moves to the locked step.
  - `NOT_REGISTERED`: "ask the office to add you".
  - `LOCKED`: a countdown to `lockedUntil`. The server locks the account for 15 minutes after five wrong passwords.
- Password rules are checked live: at least 8 characters, a letter and a number, and not containing the mobile number. The server re-checks them.
- There is no self-service reset. The office issues a temporary password, which leads to the forced change.

**2. The duty PIN (local only).** It is in
[`ShiftScreen.tsx`](../../mobile-app/apps/gate-app/src/features/signin/ShiftScreen.tsx)
and [`shiftPin.ts`](../../mobile-app/apps/gate-app/src/features/signin/shiftPin.ts).

| Question | Answer in code |
|---|---|
| What it is | Four digits (`PIN_LENGTH = 4`), chosen by the guard on the first shift screen after a password sign-in, typed twice to confirm |
| What it checks | Only that the typed digits equal the stored PIN for **this signed-in user id**. It never reaches the server and proves nothing the password didn't already prove. It just re-opens the handset after the door icon locks it, or after the app restarts with the session still stored. |
| Where it's stored | Key `chs.gate.dutyPin.<userId>`, value JSON `{ pin, failures, startedAt }`. On a phone this is `expo-secure-store` with `AFTER_FIRST_UNLOCK`. On the web it is `localStorage`. The PIN is stored as-is, not hashed. |
| `startedAt` | Written when the PIN is chosen. It is the shift start time shown as "since 2:05pm" and survives a restart. There is no roster in the API. |
| When it's wiped | On every **password** sign-in: any move into `signedIn` from `signedOut`, `passwordChange` or `twoFactor` clears it before the shift screen reads it, so each shift chooses a fresh PIN. Also whenever the session **leaves** `signedIn`. A **restored** session (`unknown` → `signedIn`) keeps its PIN. |
| The 5-try rule | Each wrong entry increments `failures` and saves it, so a restart doesn't reset the count. The hint shows "Wrong PIN · N tries left, then you're signed out". The fifth wrong entry signs out for real, through the same path as the sign-out button: `unregisterPush()`, then `session.logout()`, which revokes the refresh token and clears the stored tokens. The keypad is replaced by "Signing out…" while that runs. A count already at the limit when the screen opens (the app was closed mid-sign-out) signs out the same way. A correct entry resets `failures` to 0. |
| Other ways out | "Forgot it? Sign out" (or "Not <name>? Sign out" while choosing) under the keypad |

The PIN is **local and not verified by the server**. That stays true until
device binding and PIN-per-shift unlock exist in the API (MASTER_SPEC C9).
Treat it as a screen lock, not an identity check.

Choosing a PIN calls `actions.startShift`. Entering the right PIN calls
`actions.resumeShift`. Both set `onDuty`, `guardName` (from `/me`),
`shiftStartedAt`, and the screen (`entry`).

### Accounts that aren't guards

- **Server.** `assertCanUseClient` in `backend/src/modules/auth/auth.service.ts` runs inside every successful sign-in when the device's `client` is `"gate"`. That covers login, activate, two-factor and forced change. A sign-in with a temporary password is refused *before* the temporary password is consumed, so a resident who opens the gate app by mistake keeps it for the resident app. It needs a live, unsuspended membership whose `userType` is `GUARD` or whose permissions include `gate.operate`. Otherwise it throws `SURFACE_NOT_ALLOWED` (403): "This account can't sign in to the gate app. Use the Sahaj resident app instead." The sign-in screens show that message as written, through [`splitError`](../../mobile-app/apps/gate-app/src/api/errors.ts).
- **Client.** [`guardMembership(me)`](../../mobile-app/apps/gate-app/src/api/guard.ts) picks the first `GUARD` membership, or else the first membership with `gate.operate`. That lets a supervisor cover a shift. If `/me` later has neither, for example after a membership change arrives through `me.changed`, `SessionGate` shows `NotAGuard`. `useGuard()` gives the shell `{ me, membership, societyId }` and throws outside a guard tree.

The gate works on **one** society: the membership `guardMembership` picks. There is no society switcher.

### Shell, tabs and header

[`GateShell.tsx`](../../mobile-app/apps/gate-app/src/features/shell/GateShell.tsx)
renders four things:

- `GuardHeader`;
- whichever screen `state.screen` names;
- `TabBar`;
- the overlays: `ResultSheet` when there is a verdict, `ParcelSheet` when a parcel is being logged, and `ToastStack`.

| Element | Behaviour |
|---|---|
| [`GuardHeader`](../../mobile-app/apps/gate-app/src/features/shell/GuardHeader.tsx) | Initials, guard name, then "<society> · since <time>" from [`shiftLine`](../../mobile-app/apps/gate-app/src/features/signin/shiftLine.ts). An OFFLINE pill when offline. The **door icon** ("Lock the handset") calls `actions.lock()`, which goes back to the PIN and keeps the API session. The red **triangle** opens the alert screen. |
| [`TabBar`](../../mobile-app/apps/gate-app/src/features/shell/TabBar.tsx) | Entry · Staff · Log · Parcels · More. Parcels shows a badge with the held-parcel count. More shows a badge with the unread office-notice count. There is deliberately no "Verify" tab. |
| Tab-root screens | `entry`, `staff`, `log`, `parcels`, `more` |
| Drill-downs | `walkin`, `alert`, `plate`, `handover`, `notices`, `notice` |

Navigation is two actions in [`state/actions.ts`](../../mobile-app/apps/gate-app/src/state/actions.ts):

- `go(screen)` records `cameFrom`, but only when moving from a tab root into a drill-down.
- `goBack()` returns to `cameFrom`. If `cameFrom` is itself a drill-down, it goes to `more` instead.

`NoticeScreen`'s back control always goes to `notices`. There is no navigation
stack beyond `cameFrom`.

**Android back button.** [`useHardwareBack`](../../mobile-app/apps/gate-app/src/features/shell/useHardwareBack.ts),
mounted with the shell, maps `BackHandler`'s `hardwareBackPress` onto that
state. Each press undoes one thing, innermost first, doing what the on-screen
control does:

| On screen | Back does |
|---|---|
| An open sheet (verdict, parcel) | Closes it |
| `notice` | `go("notices")` |
| Any other drill-down | `goBack()` |
| Staff, Log, Parcels, More | `go("entry")` |
| Entry | Not handled, so Android leaves the app |

On the PIN and sign-in screens nothing is registered and Android's default
applies (the app goes to the background).

**Lock** (`actions.lock`) clears every timer and resets what is in flight:

- `onDuty`, the toasts, the typed code, the verdict;
- the parcel sheet, the walk-in stage, the alert hold;
- the screen (back to `entry`) and `noticeId`.

**End shift** (`actions.endShift`, called by `SessionGate` on sign-out) does
all of that and also clears `guardName`, `shiftStartedAt`, `handoverDone` and
`handoverNote`.

### Local state vs server data

| Kind | Where it lives | Survives |
|---|---|---|
| Session tokens | Keychain / `localStorage` (`chs.gate.session`) | Restarts, until sign-out or expiry |
| Duty PIN | Keychain / `localStorage` (`chs.gate.dutyPin.<userId>`) | Restarts, until the next password sign-in or sign-out |
| Server data: `/me`, vehicles, notices, the society profile | React Query cache (`staleTime` 30 s, `gcTime` 5 min, two retries for retryable errors; the society profile is kept fresh for an hour) | Memory only; cleared on sign-out |
| Handset state: screen, code, verdict, entries, parcels, staff, alerts, walk-in, handover, toasts, activity notes | `GateProvider`: one `useReducer` ([`types.ts`](../../mobile-app/apps/gate-app/src/state/types.ts)) seeded from [`initialState.ts`](../../mobile-app/apps/gate-app/src/state/initialState.ts) and [`mock/gateSeed.ts`](../../mobile-app/apps/gate-app/src/mock/gateSeed.ts) | Memory only; **an app restart resets it to the seed** |

The reducer takes two action shapes. `SET` merges a patch. `UPDATE` runs an
updater on the latest state, so timers that fire close together can't
overwrite each other. Values such as inside count, held parcels and staff on
site are always computed in [`selectors.ts`](../../mobile-app/apps/gate-app/src/state/selectors.ts),
never stored. `GateProvider` clears every timer when it unmounts.

`AppGateState` omits the shared `GateState`'s `pin`, `pinError` and `offline`:
the shift screen keeps its own digits, and the offline flag comes from
`useOffline()`. It narrows `walkinStage` to `"form" | "waiting"`, because
nothing can tell the handset that a resident approved (see
[4.5](#45-mock-driven-features-as-they-behave-today)).

### Realtime

`ApiProvider` mounts `RealtimeSync`. It connects the socket while signed in and
disconnects otherwise. For each server event it invalidates the queries that
[`packages/contract/src/events.ts`](../../packages/contract/src/events.ts)
lists. After a reconnect it invalidates everything. `session.revoked` for all
sessions expires this one. `me.changed` and `account.suspended` refresh `/me`.

A guard's socket joins these rooms: its user, its session, and each society it
belongs to. It joins a society's admin room only for an `ADMIN` membership,
and a unit room only when it has a unit. That determines what reaches the gate:

- `notices.changed` is sent to the society room on publish, and to the user's room on their own read or acknowledgement. **It reaches the guard.**
- `members.changed`, which invalidates `members.vehicles`, is sent to the whole society room whenever a vehicle is added, changed or removed. **It reaches the guard**, so an open plate lookup refreshes on its own.

### Offline indicator

[`useOffline()`](../../mobile-app/apps/gate-app/src/hooks/useOffline.ts) reads
`expo-network`'s `useNetworkState()`. It reports offline when `isConnected` is
false or `isInternetReachable === false`, and online while the state is still
unknown. The OFFLINE pill shows in `GuardHeader` and on `ShiftScreen`. It
reflects only the device's network. It doesn't track the realtime socket and
blocks nothing. Requests that fail offline surface through each screen's
`LoadError`.

### Theming

- **Colours.** [`src/theme/index.ts`](../../mobile-app/apps/gate-app/src/theme/index.ts) uses `getGateColors("dark")` from `@sahaj/shared` ([`tokens/colors.ts`](../../mobile-app/packages/shared/src/tokens/colors.ts)). The gate is dark in both of its palettes, the app always uses the darker one, and there is no theme switch. Tokens: `bg #06100D`, `card #0D1B18`, `card2 #132824`, `line #1B3630`, `ink #EAF5F1`, `soft #8FB0A6`, `dim #6A8B81`, `go #19B888`, `goInk #04231B`, `stop #E04A3C`, `hold #E8A33D`. `withAlpha(hex, a)` builds the tinted fills.
- **Colour meaning.** go (green) means allowed or OK. hold (amber) means waiting or needs attention. stop (red) means refused or emergency.
- **Type.** [`src/theme/fonts.ts`](../../mobile-app/apps/gate-app/src/theme/fonts.ts) loads Figtree 400–800, IBM Plex Mono 400–700 and Noto Sans Devanagari 400–700. The root layout waits for them before it renders anything. `fontFamilyFor(family, weight)` picks the exact per-weight family name that native text needs. `GateText` takes a `variant` from the shared `typeScale`.
- **Motion.** [`src/motion/reveal.ts`](../../mobile-app/apps/gate-app/src/motion/reveal.ts) and [`easing.ts`](../../mobile-app/apps/gate-app/src/motion/easing.ts) implement `RevealItem`: a fade plus a short travel and scale, per tier (`screenBlock` 10 px / 0.985, the others 18 px / 0.965). There is **no per-index stagger**. Everything in a tier plays together, and reduced motion turns it into a plain appearance. See [LOADING_AND_MOTION.md](../LOADING_AND_MOTION.md). Loading indicators appear only while a request is actually in flight. `whenRequestSettles` in `actions.ts` resolves on the next tick, so mock verification adds no delay.

### Components

All of these are in [`src/components`](../../mobile-app/apps/gate-app/src/components).

| Component | Use |
|---|---|
| `GateText` | Text styled from the shared type scale |
| `GateButton` | Variants `primary`, `secondary`, `outline`, `dangerOutline`, `disabled`. Takes `loading`, and `pulsing` (the Allow-in ring). Size and radius are passed per call site. |
| `GateCard` | Card with an optional 3 px coloured left edge and optional `onPress` |
| `GateInput` | Text field on `card2`; its border turns go on focus. `mono` for flat numbers and plates. |
| `DigitBoxes`, `Keypad` | The four-box display and the 3×4 keypad (C in red, ← for backspace), shared by the PIN and visitor codes |
| `BottomSheet` | Slide-up sheet over a fading scrim, used for the verdict and for parcels |
| `ToastStack` | Bottom toasts, up to `MAX_TOASTS = 3`, each on its own timer. `ok`, `warn` and `bad` map to go, hold and stop. Ordinary toasts last 2.8 s and let touches through. An **urgent** toast (`toast(msg, kind, { urgent: true })`: an emergency notice or push, or an alert the guard just recorded) has a white ring, a larger icon and an "EMERGENCY · TAP TO DISMISS" kicker, stays up for 8 s, and a tap dismisses it (`actions.dismissToast`). |
| `StatusPill`, `FilterPill`, `EmptyState`, `LoadError`, `Skeleton`, `Spinner` | Status labels, filter row, dashed empty state, error with retry, dim loading placeholder, ring spinner (unused since the walk-in stopped pretending to wait) |
| `ScreenHeader` | A back chevron and title for drill-downs |
| `AnimatedPressable`, `RevealItem` | Eased press scale, and entrance motion |
| `Icon`, `Dot`, `iconPaths` | 24×24 line icons taken from the prototype, plus a few new ones: `lock`, `eye`, `eyeOff`, `notice`, `phone` |

---

## 4. Features

### 4.1 Sign-in and shift unlock

Covered in [section 3](#handset-sign-in-and-the-duty-pin). The screens, in order:

1. Mobile
2. Create password, password, not registered, or locked
3. Forced change, or two-factor, when the server asks for one
4. Shift screen: "Start your shift" (choose and confirm a PIN) or "Handset locked" (enter the PIN)
5. Shell, opening on Entry

Starting a shift shows the toast "Signed in. Shift started at <time>."
Unlocking shows "Handset unlocked."

Endpoints: `auth.lookup`, `auth.activate`, `auth.login`,
`auth.verifyTwoFactor`, `auth.forcedChange`, `auth.refresh` (automatic),
`auth.logout`, `me.get`. All are `common`.

### 4.2 Plate lookup (`members.vehicles`)

This is the only endpoint with surface `gate`. The code is
[`PlateLookupScreen.tsx`](../../mobile-app/apps/gate-app/src/features/plate/PlateLookupScreen.tsx),
reached from More, then Plate lookup.

| | |
|---|---|
| Endpoint | `members.vehicles`, `GET /societies/:societyId/vehicles`. Access: society, needing any of `members.manage`, `gate.operate`, `gate.manage`. Surface `gate`. |
| Query | Under two characters: `{ limit: 50 }`, the register unfiltered. Two or more: `{ plate, limit: 50 }`. |
| Input handling | The field upper-cases as you type. `normalizePlate` strips spaces and dashes. The query waits for a 220 ms pause in typing; that spaces requests out without delaying results. The server matches `plate` as a substring (`contains`). |
| While loading | Three skeleton cards on the first load. After that the previous result stays at 60% opacity (`keepPreviousData`) and the label reads "Searching…". |
| Result card | The plate formatted `MH 12 KJ 4471` (`formatPlate`), a `SLOT <code>` pill when there is a parking slot, then owner name · unit · make or type · colour. The `Vehicle` schema has **no phone field**. |
| Labels | "N matches" (with "+" when there is another page), "Keep typing — two characters or more", "First N registered vehicles · type to search", "N plates registered" |
| Empty or error | No match: "Not a registered plate. Treat it as a walk-in and ask the flat." Empty register: "No vehicles registered". Error: `LoadError` with Retry. |
| Paging | Only the first page of 50 is shown; `nextCursor` just adds the "+" |
| Realtime | `members.changed` on any vehicle change in the society invalidates `members.vehicles` (see [Realtime](#realtime)) |

The typed query lives in `GateProvider` state (`plateQuery`), so it survives
switching tabs. It is not cleared on lock.

### 4.3 Notices from the office

The code is in [`src/features/notices`](../../mobile-app/apps/gate-app/src/features/notices).
The screens are reached from More, then From the office, or from a push tap.

**Feed.** `useOfficeNotices()` calls `useApiInfiniteQuery(notices.feed, { societyId, limit: 30 })`.
That endpoint is `GET /societies/:societyId/my/notices`, surface `common`,
returning pinned notices first and then newest. The shell's tab badge and the
notices screen share the one cached query. `unread` counts notices where
`mine !== null && !mine.read`.

| Card element | Rule |
|---|---|
| Left edge | stop for `EMERGENCY`, go for unread, none otherwise |
| Pill | `EMERGENCY` (stop); otherwise `CONFIRM READ` (hold) when `ackRequired` and not yet acknowledged; otherwise `NEW` (go) when unread |
| Meta line | Category label · "Pinned" · relative publish time |
| Paging | "Show older notices" when `hasNextPage` |
| States | Skeletons on the first load. `LoadError` only when nothing is cached; with cached items an error keeps the list. Empty: "Nothing from the office". |

**Detail.** [`NoticeScreen.tsx`](../../mobile-app/apps/gate-app/src/features/notices/NoticeScreen.tsx)
works like this:

- It loads `notices.get` (`GET …/notices/:noticeId`, `common`). The server returns a notice only to its recipients or to holders of `notices.publish`. Anyone else gets "not found".
- On load, if `mine` exists and isn't read, it calls `notices.markRead` once. A failure resets the guard, so the next open tries again.
- When `ackRequired` is set and the guard is a recipient, it shows **I have read this**, which calls `notices.acknowledge`. Success shows the toast "Marked as read. The office can see you confirmed it." and the panel changes to "You confirmed you read this". This acknowledgement is the society's proof of service.
- A `SUPERSEDED` notice shows an amber banner, with "Open the new notice" when `supersededById` is set.
- Emergency styling: a stop-coloured category pill and a 3 px stop left border on the body.
- The body text is selectable.

Both mutations invalidate `notices.feed` and `notices.get`.

**Arrivals.** `useNoticeArrivals(seen)` is mounted once, by the shell.

1. It records the ids from the session's first successful feed load as already seen.
2. Any later id that is unread raises a toast. An emergency shows "Emergency: <title>" as an urgent stop-red toast (8 s, tap to dismiss). Anything else shows "From the office: <title>" in go.
3. New ids arrive through `notices.changed` over realtime, which refetches the feed.

The `seen` set belongs to `SignedInHandset`, which stays mounted while the
handset is locked; the shell doesn't. So a notice that arrives while locked is
still new when the shell remounts on unlock: realtime marked the feed stale,
the remount refetches it, and the toast appears after "Handset unlocked."

A push received in the foreground is handled by `SignedInHandset` too (see
[section 5](#5-push-notifications)). A notice push only invalidates the feed,
so it never produces a second toast.

**Guards and financial notices.** The server's audience resolver
(`resolveAudience` in `backend/src/modules/notifications/notices.service.ts`)
skips GUARD users for `FINANCIAL` notices, whatever the audience says. A guard
is never a recipient, so a financial notice never appears in the feed or opens
in detail. The app's `NOTICE_CATEGORY_LABEL` has an "Accounts" label only
because the table covers every category.

### 4.4 Handover and sign-out

This is mostly local. The code is
[`HandoverScreen.tsx`](../../mobile-app/apps/gate-app/src/features/handover/HandoverScreen.tsx),
reached from More, then Shift handover.

- Four counts, all computed from local state: movements logged (`entries.length`), still inside, parcels held, staff on site.
- A free-text "Note for the next guard" (`handoverNote`).
- **Hand over the shift** calls `completeHandover(state)`. It sets `handoverDone` and shows the toast "Shift handed over on this handset." Nothing is sent anywhere.
- The receiving guard's name comes from one selector, `receivingGuard(state)` in [`selectors.ts`](../../mobile-app/apps/gate-app/src/state/selectors.ts): the first guard in the `guards` fixture (`@sahaj/shared`) whose name isn't `state.guardName`. The screen and the action's activity note both read it.
- After handover the screen shows "Handed to <name>" with "Recorded on this handset only. Nothing was sent, and your note is cleared when you sign out, so tell <name> in person.", and a **Sign out of the handset** button.

Sign-out is real. More has **End shift and sign out**, and handover has its
own button. Both call `useSignOut()` in `SessionGate`, which does this:

1. `unregisterPush()`: calls `notifications.unregisterDevice` with the FCM token, then deletes the token locally. Errors are ignored.
2. `controller.logout()`: calls `auth.logout` with the refresh token, then clears the stored tokens even if the server can't be reached.
3. Session status becomes `signedOut`, so `SessionGate` clears the query cache, ends the shift and deletes the PIN.

A second tap, or the fifth wrong PIN landing at the same moment, doesn't start a second logout.

The next guard signs in with their own number.

### 4.5 Mock-driven features (as they behave today)

None of these call the API. They read fixtures from `@sahaj/shared` (such as
`visitorPasses`, `staff`, `guards` and `vehicleOwnerForUnit`) and from
[`src/mock/gateSeed.ts`](../../mobile-app/apps/gate-app/src/mock/gateSeed.ts).
They write only to `GateProvider` state. Each action also adds a line to
`state.log`, an activity trail capped at 14 entries that no screen shows.

**Entry, visitor codes** ([`EntryScreen.tsx`](../../mobile-app/apps/gate-app/src/features/entry/EntryScreen.tsx), [`ResultSheet.tsx`](../../mobile-app/apps/gate-app/src/features/entry/ResultSheet.tsx), [`state/verify.ts`](../../mobile-app/apps/gate-app/src/state/verify.ts))

- **Input.** The keypad fills four digits. Verify is enabled at four; tapping it earlier gives the warning toast "Four digits are needed."
- **Lookup.** `verifyCode(code)` searches the shared `visitorPasses` fixture:
  - no match gives **unknown**;
  - a pass whose state is `expired` or `cancelled`, or whose `validUntil` has passed, gives **expired**;
  - anything else gives **valid**.
- **Verdict sheet:**
  - *Valid*: rows for visitor, flat, host (from `vehicleOwnerForUnit`, or "Resident of <unit>"), purpose and validity. **Allow in** (pulsing) or **Turn away**.
  - *Expired*: amber, with **Try another code** or **Call the flat instead**.
  - *Unknown*: red, "Do not let this person in on the code alone", with the same two buttons.
- **Allow in / Turn away.** Adds an `EntryLogRow` (`inside` or `turned_away`), shows a toast ("… allowed in and logged. <unit> isn't notified from the gate yet." or "… turned away. Logged with a reason.") and switches to the Log tab. "Call the flat instead" closes the sheet and shows an instruction, not a claim: "Ring the flat on the intercom before letting anyone in."
- **"Expected in the next hour".** Lists every fixture pass not in state `expired` or `cancelled`; there is no time filter. Tapping one fills its code and verifies it.
- **Walk-in link.** "No code? Log a walk-in" opens the walk-in screen.

**Walk-in visitors** ([`WalkinScreen.tsx`](../../mobile-app/apps/gate-app/src/features/walkin/WalkinScreen.tsx))

1. **Form.** Name, flat (upper-cased) and purpose (Guest, Delivery, Cab, Service or Broker). **Ask the resident** needs a name and a flat.
2. **Waiting for the flat's answer.** A phone icon and "Ring <flat> and ask": the handset can't reach the resident yet, so the guard calls the flat on the intercom or phone and records the answer. There is no spinner and no timer; nobody is admitted unless the guard taps an answer:
   - **Resident approved · allow in** adds an `inside` walk-in row (note "walk-in, flat approved by phone");
   - **Resident refused · turn away** adds a `turned_away` row ("walk-in, flat refused by phone");
   - **Cancel the request** returns to the form.

   Either answer resets the form and opens the Log tab. `motionDurationsMs.walkinPing` is no longer read.

**Log** ([`LogScreen.tsx`](../../mobile-app/apps/gate-app/src/features/log/LogScreen.tsx))

- "Today at the gate": the inside count and total movements.
- Filters: All, Inside, Turned away.
- Cards carry a coloured edge and status pill.
- **Mark exit** on an `inside` row sets `exited` and `exitedAt`.
- Seeded with four rows (`START_ENTRIES`).

**Parcels** ([`ParcelsScreen.tsx`](../../mobile-app/apps/gate-app/src/features/parcels/ParcelsScreen.tsx), [`ParcelSheet.tsx`](../../mobile-app/apps/gate-app/src/features/parcels/ParcelSheet.tsx))

- **Header.** Held count and total.
- **Log a new parcel.** Opens a sheet with the flat number, the flat's standing delivery preference from `UNIT_DELIVERY_PREFS` when there is one, and a courier chip (Blue Dart, Amazon, Flipkart, Swiggy, Zomato or Other).
- **Save parcel.** Needs a flat and shows an inline error without one. It adds a `held` parcel and shows the toast "Parcel for <unit> logged. The resident isn't notified from the gate yet."
- **Handed to resident.** Marks a parcel `delivered`.
- The Parcels tab badge is the held count. Seeded with three parcels.

**Staff attendance** ([`StaffScreen.tsx`](../../mobile-app/apps/gate-app/src/features/staff/StaffScreen.tsx))

- The shared `staff` fixture, with filters All, Inside, Out.
- Each card shows role, pass number, flats served, and an "In 7:05am" or "Left 11:20am" label.
- **Mark in / Mark out** flips `staffInside[passNo]` and stamps `staffSince`.
- The initial status comes from `STAFF_SEED_STATUS`.

**Alerts** ([`AlertScreen.tsx`](../../mobile-app/apps/gate-app/src/features/alert/AlertScreen.tsx))

- **Opening it.** From the header triangle or from More.
- **The warning.** Above everything, a stop-tinted panel: "This does not call anyone yet". An alert raised here is recorded on this handset only and nobody is notified, so the guard should phone for help first. When `society.get` returns a `contactPhone`, the panel has **Call the society office · <number>**, which opens `tel:` (if the handset can't place calls, a toast says "Dial <number>"). Without a number (still loading, an error, or none on file) it tells the guard to phone the committee secretary or their security supervisor. The shell requests the society profile on mount, so the number is normally cached before the screen opens.
- **Kind.** Medical, Fire, Security or Other.
- **Hold to confirm.** A large button you hold for `motionDurationsMs.holdToConfirm` (2 s); its second line reads "Two seconds. Recorded on this handset only." and, while held, "2 seconds to go" / "1 second to go". Progress is computed from elapsed wall-clock time on a 60 ms interval, so a throttled frame can't stall it. Letting go early cancels.
- **When the hold completes.** A `GateAlert` is added to "Recent alerts", with the note "Recorded on this handset only. Nobody was notified.", and an urgent toast (8 s, tap to dismiss) says "<kind> alert recorded on this handset only. Phone the society office now."
- **Recent alerts.** An alert's dot is red for its first 10 minutes, then green. The list is seeded with one old Medical alert.

---

## 5. Push notifications

The code is [`src/push/push.ts`](../../mobile-app/apps/gate-app/src/push/push.ts).
Delivery goes through Firebase Cloud Messaging via React Native Firebase.
Server-side behaviour is in [NOTIFICATIONS.md](../NOTIFICATIONS.md).

| Topic | Behaviour |
|---|---|
| Availability | `enabled` requires a platform other than web **and** `expo.extra.pushEnabled`, which is true only when a Firebase config file was present at prebuild. `@react-native-firebase/messaging` is `require`d lazily, and any failure there means no push. Every exported function then returns `"unavailable"` or does nothing. |
| Registration timing | `SignedInHandset` calls `registerForPush("<os> gate handset")` on mount, once per user id and society. That is right after sign-in, and on every launch with a restored session, **before** the PIN is entered. It is never awaited. It isn't called for a `NotAGuard` account. |
| Registration steps | 1. Create the Android channels. 2. Ask permission: the runtime `POST_NOTIFICATIONS` prompt on Android 13+, then Firebase `requestPermission`, where authorised or provisional counts as granted. 3. `getToken`. 4. `notifications.registerDevice` with `{ token, app: "gate", platform, deviceName }`. 5. Follow `onTokenRefresh` and re-register rotated tokens. |
| Android channels | `default` ("Updates", default importance) and `emergency` ("Emergencies": max importance, `bypassDnd`, vibration `[0,400,200,400]`, public on the lock screen) |
| Emergency push | For `EMERGENCY` notifications the server sets `urgent`. That means FCM priority `high`, `channelId: "emergency"`, a 1 h TTL, `apns-priority: 10`, and `interruption-level: time-sensitive` on iOS. Emergency push also ignores quiet hours. |
| Background / killed | The OS shows the `notification` payload by itself. A no-op background handler is registered. |
| Tap routing | `onPushOpened` listens to `onNotificationOpenedApp` and also checks `getInitialNotification`, which covers a cold start. `routeOf` accepts `data.route` only when it starts with `/`. `actions.openRoute` maps `/notices/<id>` to the notice detail; any other route opens the notices list. |
| Tap while locked | `SignedInHandset` keeps the route in `pendingRoute` and opens it only once `state.onDuty` is true, so a notification can't get past the PIN. |
| Foreground | The OS doesn't show these. `SignedInHandset` subscribes `onForegroundPush` for the whole signed-in session, locked or not. With `data.noticeId` it invalidates `notices.feed`; the arrival toast then comes from the feed, straight away on duty or after unlock. Any other push is toasted with its title, urgent when `data.category` is `EMERGENCY`. While the handset is locked those are held (the last three) and shown right after the PIN is entered, so nothing appears on the lock screen and nothing is lost. |
| Payload the server sends for a notice | `data: { route: "/notices/<id>", noticeId, noticeCategory, notificationId, category, societyId, unread }` |
| Sign-out | `unregisterPush()` calls `notifications.unregisterDevice` (only while the session still has tokens), then `deleteToken`, so the next account gets a fresh token. Concurrent calls share one run, and a call after the token is already deleted does nothing. |
| Session ended by itself | Expired, revoked or refresh rejected: `SessionGate`'s session listener calls `unregisterPush()`, and so does a launch whose stored session the server refuses. The server can no longer be told, so the token is deleted on the phone only; FCM refuses it from then on and the server prunes it on its next send. |
| Web | No push. `isPushAvailable()` is false and nothing is requested. |

---

## 6. Security model

**What a guard can reach, and why.** Every society endpoint in the contract
has a `surface`: `gate`, `resident`, `admin` or `common`. When none is
declared, it defaults to `admin` if every listed permission is an admin one,
and `common` otherwise. `authorizeSociety` in
`backend/src/core/http/authenticate.ts` refuses a `GUARD` membership on any
endpoint whose surface is not `gate` or `common`. The error is
`SURFACE_NOT_ALLOWED`, "This isn't available on the gate app." This applies
whatever permissions an admin has toggled on (MASTER_SPEC A1.2; see
[ARCHITECTURE.md](../ARCHITECTURE.md#access-control-master_spec-a1)). Normal
permission checks still apply on top: a guard holds only `gate.operate`.

| The gate app calls | Surface | Why a guard may |
|---|---|---|
| `auth.*`, `me.get` | common | Sign-in and identity |
| `notifications.registerDevice`, `notifications.unregisterDevice` | common (authenticated, not society-scoped) | Push to this phone |
| `members.vehicles` | **gate** | Needs `gate.operate` (or `members.manage` / `gate.manage`) |
| `notices.feed`, `notices.get`, `notices.markRead`, `notices.acknowledge` | common | The guard's own notices; `get` only for a recipient |
| `society.get` | common | Any member of the society; tax and registration ids blanked for a guard |

Every other `gate` or `common` society endpoint either needs a permission a
guard doesn't hold (for example `structure.units` and the report endpoints) or
isn't called by this app. The only `gate`-surface endpoint in the contract
today is `members.vehicles`.

**What a guard never sees:**

- **Phone numbers.** The `Vehicle` schema returned by `members.vehicles` has no phone field. The plate card shows owner name, unit, make, colour and slot. MASTER_SPEC C9 plans masked calling instead of real numbers. Mock screens take no numbers from the server.
- **Financial notices.** The audience resolver drops GUARD users from `FINANCIAL` notices, so they are never recipients, and `notices.get` returns "not found" to anyone who is neither a recipient nor a holder of `notices.publish`.
- **Society tax and registration ids.** `society.get` (surface `common`) nulls `pan`, `tan`, `gstin`, `registrationNumber` and `registrationDate` for a GUARD membership (`backend/src/modules/society/society.routes.ts`). The gate app calls it only for the office's `contactPhone` on the alert screen ([`api/society.ts`](../../mobile-app/apps/gate-app/src/api/society.ts)); it takes the society name from `/me`.
- **Billing, payments and member registers.** These are `resident` or `admin` surface, so a guard is refused them.

**On the handset:**

- The shell (and with it every visitor code) is mounted only when on duty.
- Lock clears everything in flight.
- A push tap waits for the PIN.
- Sign-out, five wrong PINs and an expired or revoked session all clear the query cache, the PIN and the push token.
- The PIN is a local screen lock, not authentication (see [section 3](#handset-sign-in-and-the-duty-pin)).

---

## 7. Key flows

### Start of shift

1. The guard opens the app. `SessionGate` restores stored tokens with `me.get`. With none stored, it shows the mobile step.
2. The guard enters their mobile number and password: `auth.lookup`, then `auth.login` with `client: "gate"`. The server checks the account is a guard (otherwise `SURFACE_NOT_ALLOWED`) and returns tokens and `/me`.
3. `SessionGate` sees a password sign-in, deletes any old PIN, and mounts `SignedInHandset`. Push registration starts in the background.
4. `ShiftScreen` shows "Start your shift". The guard chooses a four-digit PIN and confirms it. The app saves `{ pin, failures: 0, startedAt }` and calls `startShift`.
5. The shell mounts on Entry. The header reads "<society> · since <time>". The notices feed loads, and the More badge shows the unread count.

If the app restarts mid-shift, steps 2–4 collapse to "Handset locked" and the
PIN. The restored session keeps the PIN and the shift start time.

### Looking up a plate

1. More, then Plate lookup. The register loads unfiltered (the first 50).
2. The guard types `4471`. After a 220 ms pause the app calls `GET …/vehicles?plate=4471&limit=50`, keeping the old list dimmed until the result arrives.
3. A match shows `MH 12 KJ 4471 · SLOT …` with owner and unit. No match shows "Not a registered plate. Treat it as a walk-in and ask the flat."
4. The back control returns to More.

### Receiving an emergency notice

1. The office publishes an `EMERGENCY` notice. The server fixes the recipients, emits `notices.changed` to the society room, and sends push on the `emergency` channel. That push ignores quiet hours and DND on Android.
2. What the guard sees depends on the handset's state:
   - **App in the background or killed:** the OS shows the notification. A tap opens the app. If the handset is locked, the route waits for the PIN, then the notice opens.
   - **App open and on duty:** realtime (or the foreground push) refetches the feed. `useNoticeArrivals` toasts "Emergency: <title>" in red, and the More badge goes up.
   - **App open but locked:** nothing shows on the lock screen. Realtime (or the foreground push) marks the feed stale; when the guard enters the PIN, the shell remounts, refetches, and toasts "Emergency: <title>" after "Handset unlocked."
3. The detail screen shows the red pill and edge and records the read. If acknowledgement is required, **I have read this** records proof of service.

### End of shift

1. More, then Shift handover. The guard reviews the local counts, writes a note, and taps **Hand over the shift**. This is local only, and the screen says so: the guard tells the next guard in person.
2. **Sign out of the handset** (or More, then End shift and sign out) unregisters push, calls `auth.logout`, and clears the tokens.
3. `SessionGate` clears the query cache, ends the shift, deletes the PIN, and shows the mobile step for the next guard.

Tapping the door icon instead only locks the handset. The same guard gets back
in with the PIN.

---

## 8. Still on mock data, and what C9 adds

| Today (fixture / local) | MASTER_SPEC C9 target |
|---|---|
| 4-digit codes checked against `visitorPasses` in `@sahaj/shared` | Pre-approved passes: scan a QR or key a **6-digit** code, auto-verified with no resident interruption; `visitor_passes`, `gate_entries` |
| Walk-in: the guard rings the flat and records the answer (approved or refused); nothing is sent | Walk-in: type, mobile (returning visitors auto-filled), name, photo, unit, purpose, vehicle, then a push to the occupants with **Allow / Deny / Call**, a 45 s timeout, a guard call option, a 2 min society fallback rule |
| "Call the flat" is a toast | **Masked calling** through a proxy number; real numbers never shown |
| Entry log, parcels, staff, alerts in memory, reset on restart | Server tables (`gate_entries`, `parcels`, `sos_alerts`, …) plus an **offline store** (residents, units, staff, active passes, blacklist) with entries queued under local UUIDs, conflict-safe sync on reconnect, **24 h autonomy**, and the guard's local timestamp kept alongside the server's sync time |
| Duty PIN checked on the device only; one handset, no gate identity | **Device binding** to a gate, **PIN unlock per guard shift**, remote deregister from admin (`gates`, `gate_devices`, `guard_shifts`) |
| Handover stays on the device; the receiving guard comes from a fixture | Guard roster and shift records; shift handover |
| Alerts are recorded on the handset only; the screen says nobody is notified and offers the office's number | SOS screen with siren, flat details and resident contacts; incident logging with photos |
| Parcels: courier, flat, standing preference, handed over | Delivery with OTP handover option, a photo, resident notification, unclaimed reminder |
| — | Cab and service-provider entries, overstay alerts, group guest passes, move-in and move-out permits, blacklist alerts, patrol checkpoints, auto-exit at day end, announcements from templates |

Two things already work the way C9 intends: plate lookup against the real
register, and notices reaching guards, with no financial ones.

---

## 9. File map

```
mobile-app/apps/gate-app/
├── app.json, app.config.ts        Expo config; identifiers, Firebase switch, apiOrigin, pushEnabled
├── metro.config.js                Monorepo resolution: watches ../../packages; bare imports from packages/* resolve as this app's
├── package.json                   Deps incl. @chs/api-client, @chs/contract (file:), RN Firebase, expo-secure-store, expo-network
└── src/
    ├── app/
    │   ├── _layout.tsx            Providers, fonts, status bar
    │   └── index.tsx              The only route → SessionGate
    ├── api/
    │   ├── client.ts              apiClient, realtime, session (client "gate"), token store, queryClient + focus/online wiring
    │   ├── guard.ts               guardMembership, useGuard, groupMobile, normalizePlate, formatPlate
    │   ├── society.ts             useSocietyPhone (society.get → contactPhone, for the alert screen)
    │   └── errors.ts              splitError: field errors vs message
    ├── push/push.ts               FCM: channels, permission, register/unregister, tap and foreground hooks
    ├── state/
    │   ├── GateProvider.tsx       Context + reducer + timer cleanup
    │   ├── actions.ts             Every handset action (shift, navigation, entry, log, staff, walk-in, parcels, alerts, handover, toasts)
    │   ├── types.ts               AppGateState, AppScreen, reducer
    │   ├── initialState.ts        Seeds from mock/gateSeed and @sahaj/shared
    │   ├── selectors.ts           Derived counts and filters
    │   └── verify.ts              Mock code verification
    ├── features/
    │   ├── auth/                  SessionGate (root switch, sign-out, NotAGuard, forced change, 2FA), SignInFlow, authUi
    │   ├── signin/                ShiftScreen (duty PIN), shiftPin (storage), shiftLine
    │   ├── shell/                 GateShell, GuardHeader, TabBar, useHardwareBack (Android back button)
    │   ├── plate/                 PlateLookupScreen (members.vehicles)
    │   ├── notices/               useOfficeNotices + useNoticeArrivals, NoticesScreen, NoticeScreen
    │   ├── more/                  MoreScreen
    │   ├── handover/              HandoverScreen
    │   ├── entry/                 EntryScreen, ExpectedPassRow, ResultSheet   (mock)
    │   ├── walkin/                WalkinScreen                                (mock)
    │   ├── log/                   LogScreen, LogEntryCard                     (mock)
    │   ├── parcels/               ParcelsScreen, ParcelCard, ParcelSheet      (mock)
    │   ├── staff/                 StaffScreen, StaffCard                      (mock)
    │   └── alert/                 AlertScreen                                 (mock)
    ├── components/                See section 3, Components
    ├── hooks/useOffline.ts        expo-network → OFFLINE pill
    ├── motion/                    reveal.ts (tiers), easing.ts
    ├── theme/                     index.ts (colors, textStyle, withAlpha), fonts.ts
    ├── mock/gateSeed.ts           Seed entries, parcels, alerts, staff status, delivery prefs, couriers, purposes
    └── utils/                     time.ts (stamp, relativeLabel, …), gate.ts (hostForUnit, passValidityLabel, alertDotColor)
```

Outside the app:

- Endpoints: [`packages/contract/src/endpoints`](../../packages/contract/src/endpoints) (`members.ts`, `notices.ts`, `notifications.ts`, `auth.ts`), with surfaces defined in [`define.ts`](../../packages/contract/src/define.ts)
- Realtime event map: [`events.ts`](../../packages/contract/src/events.ts)
- Hooks: [`packages/api-client/src/react.tsx`](../../packages/api-client/src/react.tsx)
- Session: [`session.ts`](../../packages/api-client/src/session.ts)
- Server enforcement: `backend/src/core/http/authenticate.ts` (surface) and `backend/src/modules/auth/auth.service.ts` (`assertCanUseClient`)

---

## 10. Known gaps

The list is taken from the code as it stands now.

**Duty PIN and session**

- The PIN is local and stored as-is (not hashed), in the keychain on a phone and in `localStorage` on the web. It isn't bound to a device or a gate.
- A launch without network stops at "Can't reach Sahaj" (`restore()` stays `unknown`), even when a session and PIN are stored. There is no offline start and no 24 h autonomy.
- A stored session refused at launch leaves that guard's duty PIN in storage (the user id is unknown by then) until the next password sign-in clears it. It can't unlock anything: there is no session to unlock.
- When the session ends by itself, the server can't be told to drop this phone's device token (the tokens are already gone). The token is deleted on the phone, so FCM refuses it and the server prunes it on its next send, but until then the server still lists it.
- `X-Client: gate` is sent on every request, but the backend doesn't read it. The refusal relies on `client: "gate"` in the sign-in body.

**Navigation and push**

- Single route; the only "stack" is `cameFrom`, one level deep. The Android back button follows it (see [Shell, tabs and header](#shell-tabs-and-header)); on the sign-in steps it isn't intercepted, so it backgrounds the app rather than stepping back.
- A notice that arrives while the handset is locked before the shift's first unlock isn't toasted: the first feed load is the baseline. The More badge counts it.
- Held foreground pushes (non-notice, while locked) live in memory: at most the last three, and they are lost if the app is killed before unlock.

**Realtime and data**

- Plate lookup shows only the first 50 results.
- `networkMode: "always"` means a mutation tapped while offline fails (with its error) rather than waiting to be sent when the signal returns.

**Local state**

- All local gate state (entries, parcels, staff, alerts, handover) lives in memory and resets to the seed on every app restart.
- `state.log` (the activity trail) is written by nearly every action and shown nowhere.

**Copy and mock behaviour**

- Nothing in the mock half notifies anyone (MASTER_SPEC C9): allow-in, parcels, walk-ins, alerts and handover are recorded on this handset only, and the copy says so. The guard rings the flat for a walk-in and phones the office for an alert.
- "Expected in the next hour" isn't filtered by time. Codes are 4 digits; C9 specifies 6.
- The receiving guard at handover comes from the prototype's `guards` fixture, not a roster.

**Stale comments and docs**

- `mobile-web.sh`'s banner says "There is no backend… sign-in… is a mock".
- `scripts/README.md` lists notices as fixtures.

**Housekeeping**

- There is no i18n. All copy is inline English, although the Devanagari font is loaded.
- Some colours are hard-coded rather than taken from tokens (`#F7B5AE`, `#3A2C10`, `#F3D9A5`, `rgba(25,184,136,…)`).
- Unused npm dependencies, left in place because the lockfile is shared: `@react-navigation/bottom-tabs` and `@react-navigation/native-stack` are never imported. `@react-navigation/native`, `react-native-screens`, `react-native-gesture-handler` and `expo-linking` aren't imported by the app either, but expo-router expects them, so they stay.
- `motionDurationsMs.walkinPing` in `@sahaj/shared` is no longer read by the gate.
- No `eas.json` is checked in.
