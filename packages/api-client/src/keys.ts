import type { Endpoint } from "@chs/contract";

/**
 * React Query key for a read: `[endpointId, params, query]`. Invalidating by
 * `[endpointId]` alone clears every cached page and filter of that endpoint,
 * which is what the contract's `invalidates` lists mean.
 */
export function queryKey(endpoint: Endpoint, input?: { params?: unknown; query?: unknown }): readonly unknown[] {
  return [endpoint.id, input?.params ?? {}, input?.query ?? {}];
}
