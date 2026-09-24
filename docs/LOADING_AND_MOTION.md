# Loading and motion

How the three apps show that they are working, and what they deliberately do not
animate. Read this before adding a spinner, a skeleton or an entrance effect.

## The rule

**A skeleton describes a real wait. It never creates one.**

There is no backend yet: every screen reads local fixtures, so nothing is
actually being fetched and no loading state should ever appear. When the API
arrives, the wait becomes whatever the network costs — measured, not assumed.

Nothing in this codebase may hold content behind a timer. An earlier version put
a 520ms skeleton in front of admin tables whose rows were already in memory,
which made a local app feel slower than it was.

## The contract

Screens describe data with `LoadState<T>`:

| Status | Meaning | What renders |
|---|---|---|
| `ready` | data in hand | the content, immediately |
| `loading` | a request is genuinely in flight | the skeleton for that layout |
| `error` | the request failed | the message and a retry |

- Web: `web-app/src/lib/loadState.ts`
- Mobile: `@sahaj/shared` → `packages/shared/src/utils/loadState.ts`

The two are duplicated on purpose — web-app is not part of the mobile workspace.
Change both together.

Today every call site uses `ready(...)`, so the loading and error branches are
unreachable and the cost at runtime is nothing. The value is that the wiring
already exists when the API lands.

`error` is a first-class branch, not an afterthought. A loading state that cannot
fail is the usual way this goes wrong: the request errors, nothing resolves, and
the placeholder sits there looking like a slow network. A wait the user cannot
escape is worse than an error they can retry. Web's `DataBoundary` renders all
three branches and carries the retry.

## Which indicator, where

| Situation | Show |
|---|---|
| Data already in memory | **Nothing.** Render it. |
| Request resolves fast | Nothing — a placeholder that flashes reads as a glitch |
| Request genuinely slow | Skeleton matching the layout, then one short fade on the container |
| An action the user triggered | Spinner **inside that button**, label carries the status |
| Background refresh | Nothing visible; keep showing the data you have |

Skeleton and spinner answer different questions and are never combined in one
place. A skeleton says *what is coming and where*; a button spinner says *your
click registered*.

### Components

| | Web | Mobile |
|---|---|---|
| Skeleton | `components/Skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonRows` | `resident-app/src/components/Skeleton.tsx`, `gate-app/src/components/Skeleton.tsx` |
| Spinner | `components/Spinner.tsx` | `gate-app/src/components/Spinner.tsx`, resident `Button` `loading` prop |
| Three-state wrapper | `components/DataBoundary.tsx` | — |

A skeleton must match the real layout — same column count, same alignment, same
row height — so the header stays put and nothing reflows when data lands. That
is the whole reason to prefer it over a spinner.

The gate skeleton is dimmer and slower than the resident one. It is read at
night, at a gate; a bright sweep in a dark palette is glare, not information.
Most gate data is local by architecture (24h offline autonomy), so it should
rarely appear at all.

## Entrance motion

**Per-item stagger is not used in the admin web.** `Admin Web.dc.html` has no
animated table rows, never uses `cardIn`, and its only `animation-delay` is the
reduced-motion reset. A staggered reveal is a first-run flourish, and the admin
console is opened every day by the same people — the last row of a list used to
wait 780ms, and screen blocks up to 900ms, for no information gain.

What the admin design does use on entry is a single short fade applied once to a
whole block: `fadeUp .26s cubic-bezier(.2,.7,.3,1)` — `web-app/src/lib/motion.ts`,
`blockStyle()`. It takes no index, because every block fades together.

**The mobile apps keep the fade but not the cascade.** `Resident Prototype.dc.html`
and `Gate Prototype.dc.html` both specify `cardIn` with per-index delays, and the
app used to reproduce those timings exactly. The delay is the part that makes a
list arrive one row at a time, so it is gone; the fade, travel and per-tier
duration remain. This is a deliberate, recorded deviation from the prototypes —
the same reasoning as the admin web, applied to screens people use daily.

The component is `RevealItem` (`tier`, no index) in both apps, over
`components/motion.ts` on resident and `motion/reveal.ts` on gate. It is not
called `StaggerItem` any more because it no longer staggers.

`motionDurationsMs` in `@sahaj/shared` still carries the stagger step, floor and
cap values. They are a faithful transcription of the README's table and are kept
as the record of what the design asked for; nothing reads them.

**Keep motion that is causal.** A drawer opening, a row you just added arriving,
a figure changing after you post a payment — that is feedback, and it tells the
user their action landed. Drop motion that is ambient: content animating merely
because it exists.

## Thresholds, when the API exists

Do not hardcode these as simulated delays. They govern when a *real* pending
request becomes visible.

- Under ~300ms in flight — show nothing. A flashed skeleton is worse than none.
- Past that — show the skeleton, and once shown hold it briefly so a response
  landing just after the threshold does not flicker.
- Measure before tuning. `MASTER_SPEC.md` E5 targets API p95 < 500ms, so a real
  share of requests will cross the threshold. The skeleton path is a normal code
  path, not a rare edge case.

Prefer removing the wait to decorating it: cache, and serve stale data while
revalidating. The fastest loading state is the one nobody sees.

## Reduced motion

Handled globally and needs no per-component code: `web-app/src/styles/tokens.css`
neutralises every animation and transition under `prefers-reduced-motion`, and
the mobile skeletons check `useReducedMotion()` and render a flat bar.
