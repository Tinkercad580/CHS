# Shared packages: `@chs/contract` and `@chs/api-client`

All three apps and the backend share the API through two packages in
`packages/`. Nothing else is shared across the web/mobile boundary. The
mobile apps additionally share UI and tokens through `@sahaj/shared`
(`mobile-app/packages/shared`).

## `@chs/contract` — the API, defined once

[packages/contract/src/](../packages/contract/src)

| File | Holds |
|---|---|
| `endpoints/*.ts` | every endpoint, one file per area; merged in `endpoints.ts` via `defineApi` |
| `schemas/*.ts` | zod schemas for inputs and outputs, per area |
| `define.ts` | `endpoint()`, `defineApi()`, `flattenApi()`, and the types that derive inputs/outputs from an endpoint |
| `permissions.ts` | permission strings, roles, user types, the default permission templates |
| `errors.ts` | error codes → HTTP status |
| `events.ts` | realtime events and the reads each invalidates |
| `types.ts` | wire types inferred from the schemas (`Me`, `BillRecord`, `PaymentRecord`, …) |

Rules:
- The contract depends only on zod. It must compile under every consumer's
  settings (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals`),
  so it uses no enums, only type-only imports, and no Node or DOM APIs.
- It ships TypeScript source (`exports` points at `src/index.ts`). Vite and Metro
  compile it, and tsup inlines it into the backend bundle.
- Import from the package root (`@chs/contract`), never from a deep path.
- Some business tables live here because both sides need them. For example,
  `schemas.billing.ALLOWED_METHODS` (Rule 106C-12 category → method) is used by
  the server to enforce the rule and by the admin console to build the form.

An endpoint looks like this:

```ts
createRun: endpoint({
  method: "POST",
  path: sp("/bill-runs"),                    // "/societies/:societyId/bill-runs", typed params
  summary: "Generate a draft run for a period and preview it",
  access: inSociety("billing.generate"),
  body: B.CreateBillRunBody,
  response: B.BillRunPreview,
  invalidates: ["billing.runs"],             // cached reads that go stale on success
}),
```

## `@chs/api-client` — the typed client

[packages/api-client/src/](../packages/api-client/src)

| Export | Does |
|---|---|
| `createApiClient({ baseUrl, tokens, onSessionExpired })` | Typed calls mirroring the contract (`client.billing.myDues({ params })`), or `client.call(endpoint, input)`. Adds the bearer token, refreshes it before expiry and once on a 401 (single-flight), sends `Idempotency-Key` on idempotent endpoints, times out a hung request after 20 s, and throws `ApiError`. |
| `ApiError` | `.code`, `.status`, `.message`, `.fieldErrors` (dotted path → message), `.retryable` |
| `SessionController` | The sign-in state machine: `restore`, `lookup`, `activate`, `login`, `verifyTwoFactor`, `forcedChange`, `refreshMe`, `logout`, `expire`. States: `unknown`, `signedOut`, `passwordChange`, `twoFactor`, `signedIn`. |
| `createRealtime({ origin, getAccessToken })` | The Socket.io client. Typed `on(event)`, `onAny`, `onState`. |
| Token stores | `localStorageTokenStore` (web), `asyncTokenStore` (wraps expo-secure-store on phones), `memoryTokenStore` |
| `queryKey(endpoint, input)` | `[endpointId, params, query]` |

From `@chs/api-client/react`:

| Hook / component | Does |
|---|---|
| `ApiProvider` | Provides the client, session, realtime and React Query. Mounts `RealtimeSync`, which connects the socket when signed in and invalidates on events. |
| `useApiQuery(endpoint, input, options)` | A cached, typed read |
| `useApiInfiniteQuery(endpoint, input)` | Cursor pages (`items` flattened) |
| `useApiMutation(endpoint, options)` | A typed write that invalidates the contract's `invalidates` on success, and refreshes `useMe()` when `me.get` is among them |
| `useSession()`, `useSessionController()`, `useMe()` | Session state and the signed-in user |
| `useRealtimeState()` | `idle` / `connecting` / `connected` / `disconnected` |
| `toLoadState(query)` | Maps a query to `LoadState<T>` (`loading` / `ready` / `error` with retry), the shape every screen renders |
| `createQueryClient()` | Defaults: 30 s stale time; retry only network/5xx/429, twice; mutations never retried |

Each app creates its client once, in `src/api/client.ts`.

## How the apps resolve the packages

The web and mobile apps keep their own `node_modules` and depend on the
packages with `file:` links. React and React Query must be single copies:
- **Vite** (`web-app/vite.config.ts`) uses `resolve.dedupe`;
- **Metro** (each app's `metro.config.js`) watches `packages/` and resolves
  every bare import made from inside it as if the app had made it.
