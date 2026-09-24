/**
 * How a screen describes data it did not compute itself. Mirrors
 * web-app/src/lib/loadState.ts — the two apps do not share a package, so the
 * contract is duplicated deliberately and should be changed in both places.
 *
 * There is no backend yet, so every screen wraps its fixture in `ready(...)`
 * and the loading branch is never taken. When the API arrives the wait becomes
 * whatever the network actually costs. Nothing here simulates a delay, and
 * nothing should: a skeleton describes a real wait, it does not create one.
 */
export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string; retry?: () => void };

/** Data already in hand — the only state produced until the API exists. */
export function ready<T>(data: T): LoadState<T> {
  return { status: "ready", data };
}

export function loading<T>(): LoadState<T> {
  return { status: "loading" };
}

export function failed<T>(message: string, retry?: () => void): LoadState<T> {
  return { status: "error", message, retry };
}
