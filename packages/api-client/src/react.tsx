import { REALTIME_EVENTS, type Endpoint, type EndpointInput, type EndpointOutput } from "@chs/contract";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ApiClient } from "./client";
import { ApiError } from "./errors";
import { queryKey } from "./keys";
import type { ConnectionState, Realtime } from "./realtime";
import type { SessionController, SessionState } from "./session";

interface ApiContextValue {
  client: ApiClient;
  realtime: Realtime | null;
  session: SessionController;
}

const ApiContext = createContext<ApiContextValue | null>(null);

/** Query defaults: never retry a request the server understood and refused; retry a dropped one twice. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => err instanceof ApiError && err.retryable && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function ApiProvider(props: {
  client: ApiClient;
  session: SessionController;
  realtime?: Realtime | null;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => props.queryClient ?? createQueryClient());
  const value = useMemo(
    () => ({ client: props.client, session: props.session, realtime: props.realtime ?? null }),
    [props.client, props.session, props.realtime],
  );
  return (
    <ApiContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <RealtimeSync />
        {props.children}
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}

function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi* hooks must be used inside <ApiProvider>");
  return ctx;
}

export function useApi(): ApiClient {
  return useApiContext().client;
}

export function useSessionController(): SessionController {
  return useApiContext().session;
}

export function useSession(): SessionState {
  const session = useApiContext().session;
  return useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.state,
    () => session.state,
  );
}

/** The signed-in user; throws if called outside a signed-in tree. */
export function useMe() {
  const s = useSession();
  if (s.status !== "signedIn") throw new Error("useMe() needs a signed-in session");
  return s.me;
}

type QueryOpts<E extends Endpoint> = Omit<UseQueryOptions<EndpointOutput<E>, ApiError>, "queryKey" | "queryFn">;

/** A cached, typed read of one endpoint. */
export function useApiQuery<E extends Endpoint>(
  endpoint: E,
  ...args: {} extends EndpointInput<E>
    ? [input?: EndpointInput<E>, options?: QueryOpts<E>]
    : [input: EndpointInput<E>, options?: QueryOpts<E>]
): UseQueryResult<EndpointOutput<E>, ApiError> {
  const client = useApi();
  const [input, options] = args;
  return useQuery<EndpointOutput<E>, ApiError>({
    queryKey: queryKey(endpoint, input as never),
    queryFn: ({ signal }) => client.call(endpoint, input, { signal }),
    ...options,
  });
}

type PageOf<E extends Endpoint> = EndpointOutput<E> extends { items: (infer I)[]; nextCursor: string | null } ? I : never;

/** Cursor pagination for list endpoints (`{ items, nextCursor }`). */
export function useApiInfiniteQuery<E extends Endpoint>(endpoint: E, input: EndpointInput<E>, options?: { enabled?: boolean }) {
  const client = useApi();
  const query = useInfiniteQuery({
    queryKey: [...queryKey(endpoint, input as never), "infinite"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const i = input as { query?: Record<string, unknown> };
      return client.call(endpoint, { ...input, query: { ...i.query, cursor: pageParam } } as EndpointInput<E>, { signal }) as Promise<{
        items: PageOf<E>[];
        nextCursor: string | null;
      }>;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: options?.enabled,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return { ...query, items };
}

type MutationOpts<E extends Endpoint> = Omit<
  UseMutationOptions<EndpointOutput<E>, ApiError, EndpointInput<E>>,
  "mutationFn"
>;

/**
 * A typed write. On success it invalidates what the contract's `invalidates`
 * lists, so every screen showing that data refetches — callers don't wire
 * cache updates by hand.
 */
export function useApiMutation<E extends Endpoint>(endpoint: E, options?: MutationOpts<E>) {
  const client = useApi();
  const session = useSessionController();
  const queryClient = useQueryClient();
  return useMutation<EndpointOutput<E>, ApiError, EndpointInput<E>>({
    ...options,
    mutationFn: (input) => client.call(endpoint, input),
    onSuccess: async (...args) => {
      await Promise.all((endpoint.invalidates ?? []).map((id) => queryClient.invalidateQueries({ queryKey: [id] })));
      // useMe() reads the session, not the query cache; keep the two in step.
      if (endpoint.invalidates?.includes("me.get") && session.state.status === "signedIn") void session.refreshMe().catch(() => undefined);
      await options?.onSuccess?.(...args);
    },
  });
}

/** Mounted once by the provider: server events invalidate the reads they name. */
function RealtimeSync() {
  const { realtime, session } = useApiContext();
  const queryClient = useQueryClient();
  const state = useSession();

  useEffect(() => {
    if (!realtime) return;
    if (state.status === "signedIn") realtime.refreshAuth();
    else realtime.disconnect();
  }, [realtime, state.status]);

  useEffect(() => {
    if (!realtime) return;
    const offAny = realtime.onAny((event) => {
      for (const id of REALTIME_EVENTS[event].invalidates) void queryClient.invalidateQueries({ queryKey: [id] });
    });
    const offRevoked = realtime.on("session.revoked", (p) => {
      if (p.sessionId === null) session.expire();
    });
    // Profile, role or membership changed elsewhere: refresh what useMe() returns.
    const refreshMe = () => {
      if (session.state.status === "signedIn") void session.refreshMe().catch(() => undefined);
    };
    const offMe = realtime.on("me.changed", refreshMe);
    const offSuspended = realtime.on("account.suspended", refreshMe);
    // Reconnecting means events may have been missed; refetch what is on screen.
    let wasDisconnected = false;
    const offState = realtime.onState((s) => {
      if (s === "disconnected") wasDisconnected = true;
      if (s === "connected" && wasDisconnected) {
        wasDisconnected = false;
        void queryClient.invalidateQueries();
      }
    });
    return () => {
      offAny();
      offRevoked();
      offMe();
      offSuspended();
      offState();
    };
  }, [realtime, queryClient, session]);

  return null;
}

export function useRealtimeState(): ConnectionState {
  const { realtime } = useApiContext();
  return useSyncExternalStore(
    (cb) => realtime?.onState(cb) ?? (() => undefined),
    () => realtime?.state ?? "idle",
    () => "idle",
  );
}

/**
 * Bridges a query to the apps' `LoadState<T>` — the contract every screen
 * already renders (docs/LOADING_AND_MOTION.md). Loading lasts exactly as long
 * as the request; nothing here adds time.
 */
export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string; retry?: () => void };

export function toLoadState<T>(query: Pick<UseQueryResult<T, ApiError>, "status" | "data" | "error" | "refetch">): LoadState<T> {
  if (query.status === "success") return { status: "ready", data: query.data as T };
  if (query.status === "error")
    return { status: "error", message: query.error?.message ?? "Something went wrong.", retry: () => void query.refetch() };
  return { status: "loading" };
}
