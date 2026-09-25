# The API

Base path `/api/v1`. **Every endpoint with its access rule and inputs:
[api/ENDPOINTS.md](api/ENDPOINTS.md)** (generated from the contract). Live
reference: `http://localhost:4100/api/docs` (OpenAPI: `/api/v1/openapi.json`).
The source of truth is `packages/contract/src/endpoints/` — this page is how to
use and extend it.

## Wire conventions (MASTER_SPEC E3)

- **Success** → `200 { "data": …, "meta": { "requestId": "…" } }`.
- **Failure** → `{ "error": { "code", "message", "details", "requestId" } }`.
  The status is fixed per code (`packages/contract/src/errors.ts`). Branch on
  `code`; show `message` — it's written for the person using the app.
  `VALIDATION_FAILED` details are zod issues (`path`, `message`); the client's
  `ApiError.fieldErrors` turns them into `{ "tenant.mobile": "…" }`.
- **Auth** → `Authorization: Bearer <access token>`. On `401` the client
  refreshes once (single-flight) and retries.
- **Lists** → `{ items, nextCursor }`; pass `?cursor=<nextCursor>&limit=`.
  `q` searches where the endpoint supports it.
- **Money** → integer paise. **Dates** → `YYYY-MM-DD`. **Instants** → ISO 8601
  with offset.
- **Idempotency** → endpoints marked `idempotent` accept `Idempotency-Key`; a
  repeat with the same key and body replays the first response
  (`Idempotent-Replay: true`), a different body is `IDEMPOTENCY_KEY_REUSED`.
  The client sends one automatically.
- **Request id** → send `x-request-id` to correlate; it's echoed and logged.
- **Rate limits** → `RateLimit-*` headers; `429 RATE_LIMITED` with `Retry-After`.

## Using it from an app

```tsx
import { api } from "@chs/contract";
import { useApiQuery, useApiMutation, toLoadState } from "@chs/api-client/react";

function Users({ societyId }: { societyId: string }) {
  const users = useApiQuery(api.users.list, { params: { societyId }, query: { q: "anita" } });
  const suspend = useApiMutation(api.users.suspend);

  // LoadState<T> is what every screen renders (docs/LOADING_AND_MOTION.md):
  // loading lasts exactly as long as the request, error offers retry.
  const state = toLoadState(users);

  suspend.mutate({ params: { societyId, userId }, body: { reason: "Moved out" } });
  // → on success users.list and users.get refetch, because the contract says so;
  //   other admins' screens refetch too, via the users.changed realtime event.
}
```

Outside React: `apiClient.users.list({ params: { societyId } })` returns a
typed promise. Each app creates its client once in `src/api/client.ts`.

Signing in is `SessionController` — screens call `lookup`, `activate`, `login`,
`verifyTwoFactor`, `forcedChange`, `logout` and render `useSession().status`;
none of them touch tokens.

## Adding an endpoint

1. **Contract** — add the schemas to `packages/contract/src/schemas/<area>.ts`
   and the entry to `endpoints/<area>.ts` (a new area is also registered in `endpoints.ts`): method, path, summary, access (with the
   permission), `surface` if it isn't obvious, `invalidates` for writes,
   `idempotent` if it moves money. If it changes data other screens show, add
   or extend a realtime event in `events.ts`.
2. **Service** — the rule, in `backend/src/modules/<area>/<area>.service.ts`:
   scope every query by `scope.societyId`, write inside `transaction()`, call
   `audit()` in the same transaction, `events.emit()` what changed.
3. **Binding** — one line in `<area>.routes.ts`: `handle(api.area.thing, ({ params, query, body }, { society, actor }) => svc.thing(…))`.
   The server won't start until every contract entry is bound.
4. **Tests** — integration test in `backend/test/integration`; if it's a
   legal rule, a compliance test in `backend/test/compliance`. The
   cross-tenant test picks the new endpoint up by itself.
5. **Docs** — `npm run docs -w backend` regenerates [api/ENDPOINTS.md](api/ENDPOINTS.md);
   update the module doc in [modules/](modules/).

## Endpoint map (v1)

| area | endpoints |
|---|---|
| `auth` | lookup · activate · login · 2fa/verify · refresh · logout · forced-change |
| `me` | get · update · password · sessions · revoke session · logout-all · 2fa setup/enable/disable |
| `users` | list · get · create · update · temp-password · unlock · suspend · reactivate · logout-all · sessions · auth-events · import · permission templates |
| `society` | profile · settings · onboarding · go-live · billing config · bank accounts · statutory config · audit log |
| `structure` | buildings · units (list, create, bulk layout, update, import) · parking slots (list, create, allot) |
| `members` | register · unit overview (360) · memberships (admit, cease, nominees) · occupancy · tenancies (create, update, end) · family · vehicles (incl. gate plate lookup) · pets · approvals (queue, decide) · my home · corrections · directory |
| `notifications` | register/unregister phone · inbox · unread count · mark read · preferences · test send |
| `notices` | list · my feed · get · draft · edit draft · publish · delete draft · read · acknowledge · proof-of-service report |
| `billing` | charge heads · rates (effective-dated) · simulate · unit charges · bill runs (generate, preview, recompute, publish, discard) · bills · cancel · supplementary bills · ledger · credit notes · my dues · my bills |
| `payments` | start online payment · dummy checkout · my payments · get · collections · record cash/cheque/transfer · cheque clear/bounce · cancel receipt · gateway webhook |
| `reports` | dashboard · run a report · email a report (Excel/CSV) |
| `platform` | societies (list, onboard with first admin) |
| `health` | liveness + dependency checks (database, queue, push, email) |

Not built yet: accounting, recovery, helpdesk, gate & visitors, meetings,
documents, requests, amenities, vendors, compliance calendar. Billing runs on
statutory values that are still marked unverified — see
`docs/compliance/RULES_REGISTER.md` before billing a real society.
