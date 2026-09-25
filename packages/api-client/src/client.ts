import {
  api,
  buildPath,
  type Api,
  type ApiErrorBody,
  type Endpoint,
  type EndpointInput,
  type EndpointOutput,
  type TokenPair,
} from "@chs/contract";
import { ApiError } from "./errors";
import type { TokenStore } from "./token-store";

export interface ApiClientOptions {
  /** Origin plus `/api/v1`, e.g. "https://api.example.in/api/v1". */
  baseUrl: string;
  tokens: TokenStore;
  /**
   * Abort a request that has had no response in this long. A cap on a hung
   * connection, not a wait: a fast response returns as soon as it arrives.
   */
  timeoutMs?: number;
  /** Called once when the refresh token is rejected — send the user to sign-in. */
  onSessionExpired?: () => void;
  /** Extra headers on every request (client name, app version). */
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface CallOptions {
  signal?: AbortSignal;
  /** Override the bearer token (the restricted token during a forced password change). */
  token?: string;
  idempotencyKey?: string;
}

type AnyInput = { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };

/** Mirrors the shape of `api`: `client.users.list(input)` → typed promise. */
export type ApiMethods<T> = {
  [K in keyof T]: T[K] extends Endpoint
    ? {} extends EndpointInput<T[K]>
      ? (input?: EndpointInput<T[K]>, opts?: CallOptions) => Promise<EndpointOutput<T[K]>>
      : (input: EndpointInput<T[K]>, opts?: CallOptions) => Promise<EndpointOutput<T[K]>>
    : ApiMethods<T[K]>;
};

export interface ApiClient extends ApiMethods<Api> {
  call<E extends Endpoint>(endpoint: E, input?: EndpointInput<E>, opts?: CallOptions): Promise<EndpointOutput<E>>;
  tokens: TokenStore;
  baseUrl: string;
}

function toQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function randomKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 20_000;
  let refreshing: Promise<TokenPair | null> | null = null;

  async function send(endpoint: Endpoint, input: AnyInput, opts: CallOptions, bearer: string | undefined): Promise<Response> {
    const url = options.baseUrl.replace(/\/$/, "") + buildPath(endpoint.path, input.params) + toQueryString(input.query);
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (input.body !== undefined) headers["Content-Type"] = "application/json";
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (endpoint.idempotent) headers["Idempotency-Key"] = opts.idempotencyKey ?? randomKey();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
    const onAbort = () => controller.abort(opts.signal?.reason);
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      return await doFetch(url, {
        method: endpoint.method,
        headers,
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      const timedOut = controller.signal.aborted;
      throw new ApiError({
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        status: 0,
        message: timedOut ? "The server took too long to respond." : "Could not reach the server. Check your connection.",
      });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function parse(res: Response): Promise<unknown> {
    const requestId = res.headers.get("x-request-id") ?? undefined;
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    if (res.ok) return (json as { data: unknown } | undefined)?.data;
    const body = json as ApiErrorBody | undefined;
    throw new ApiError({
      code: body?.error?.code ?? (res.status >= 500 ? "INTERNAL" : "BAD_REQUEST"),
      status: res.status,
      message: body?.error?.message ?? `Request failed (${res.status})`,
      details: body?.error?.details,
      requestId: body?.error?.requestId ?? requestId,
    });
  }

  /** One refresh at a time: concurrent 401s all wait on the same rotation. */
  function refresh(): Promise<TokenPair | null> {
    if (refreshing) return refreshing;
    const current = options.tokens.get();
    if (!current) return Promise.resolve(null);
    refreshing = (async () => {
      try {
        const res = await send(api.auth.refresh, { body: { refreshToken: current.refreshToken } }, {}, undefined);
        const tokens = (await parse(res)) as TokenPair;
        options.tokens.set(tokens);
        return tokens;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          options.tokens.set(null);
          options.onSessionExpired?.();
          return null;
        }
        throw err;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  function accessTokenIsStale(tokens: TokenPair): boolean {
    return Date.parse(tokens.accessTokenExpiresAt) - Date.now() < 10_000;
  }

  async function call<E extends Endpoint>(endpoint: E, input?: EndpointInput<E>, opts: CallOptions = {}): Promise<EndpointOutput<E>> {
    const anyInput = (input ?? {}) as AnyInput;
    const needsAuth = endpoint.access.kind !== "public";
    let bearer = opts.token;
    if (needsAuth && !bearer) {
      let tokens = options.tokens.get();
      if (tokens && accessTokenIsStale(tokens)) tokens = await refresh();
      bearer = tokens?.accessToken;
    }
    let res = await send(endpoint, anyInput, opts, bearer);
    if (res.status === 401 && needsAuth && !opts.token && options.tokens.get()) {
      const tokens = await refresh();
      if (tokens) res = await send(endpoint, anyInput, opts, tokens.accessToken);
    }
    return (await parse(res)) as EndpointOutput<E>;
  }

  function bind(tree: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tree)) {
      const v = value as Endpoint;
      out[key] = "method" in v && "path" in v ? (input?: unknown, opts?: CallOptions) => call(v, input as never, opts) : bind(value as Record<string, unknown>);
    }
    return out;
  }

  return Object.assign(bind(api as unknown as Record<string, unknown>), {
    call,
    tokens: options.tokens,
    baseUrl: options.baseUrl,
  }) as unknown as ApiClient;
}
