/**
 * How a screen describes data it did not compute itself. Mirrors
 * web-app/src/lib/loadState.ts — the two apps do not share a package, so the
 * contract is duplicated deliberately and should be changed in both places.
 *
 * Screens backed by the API get the same shape from `toLoadState(query)` in
 * `@chs/api-client/react`, where `loading` lasts exactly as long as the request.
 * These helpers are for data that is still local: a fixture wraps itself in
 * `ready(...)` and the loading branch is never taken. Nothing here simulates a
 * delay, and nothing should: a skeleton describes a real wait, it does not
 * create one.
 */
export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string; retry?: () => void };

/** Data already in hand — what a local fixture always is. */
export function ready<T>(data: T): LoadState<T> {
  return { status: "ready", data };
}

export function loading<T>(): LoadState<T> {
  return { status: "loading" };
}

export function failed<T>(message: string, retry?: () => void): LoadState<T> {
  return { status: "error", message, retry };
}
