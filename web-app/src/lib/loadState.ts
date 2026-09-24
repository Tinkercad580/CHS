/**
 * How every screen describes data it did not compute itself.
 *
 * There is no backend yet, so today every page wraps its local fixture in
 * `ready(...)` and the loading and error branches are never taken — the table
 * renders on the first paint, with nothing animating in front of it.
 *
 * The point of the type is that when the API lands, the wait becomes whatever
 * the network actually costs. Nothing here simulates a delay, and nothing
 * should: the previous implementation held a table behind a 520ms timer whether
 * or not anything was being fetched, which made a local app feel slower than it
 * was. A skeleton is a way to describe a real wait, never a way to create one.
 */
export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string; retry?: () => void };

/** Data already in hand — the only state any screen produces until the API exists. */
export function ready<T>(data: T): LoadState<T> {
  return { status: "ready", data };
}

export function loading<T>(): LoadState<T> {
  return { status: "loading" };
}

export function failed<T>(message: string, retry?: () => void): LoadState<T> {
  return { status: "error", message, retry };
}
