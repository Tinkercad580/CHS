import type { z } from "zod";
import type { Permission } from "./permissions";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Who may call an endpoint.
 *
 * - `public`        no token (login, health).
 * - `authenticated` any signed-in user, not tied to a society (`/me`).
 * - `society`       the path carries `:societyId`; the caller must hold an
 *                   active membership there and, if `permission` is given, at
 *                   least one of the listed permissions.
 * - `platform`      platform super-admins only.
 */
export type Access =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "society"; permission?: Permission | readonly Permission[] }
  | { kind: "platform" };

/**
 * Which app surfaces may call it. A GUARD's token is refused everywhere except
 * `gate` and `common` endpoints regardless of which permissions an admin
 * toggled on — MASTER_SPEC A1.2: guards are hard-restricted, not just
 * permission-restricted.
 */
export type Surface = "common" | "gate" | "resident" | "admin";

export interface EndpointConfig<
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  Q extends z.ZodType | undefined = z.ZodType | undefined,
  B extends z.ZodType | undefined = z.ZodType | undefined,
  R extends z.ZodType = z.ZodType,
> {
  method: M;
  path: P;
  summary: string;
  access: Access;
  query?: Q;
  body?: B;
  response: R;
  /** Defaults to "admin" for society endpoints with an admin permission, "common" otherwise. */
  surface?: Surface;
  /** Endpoint ids whose cached reads are stale once this succeeds. */
  invalidates?: readonly string[];
  /** Accept and honour an `Idempotency-Key` header. Required on money-moving POSTs. */
  idempotent?: boolean;
  /** Callable with the restricted token issued after a temporary-password login. */
  allowRestricted?: boolean;
  /** Stricter rate-limit bucket. */
  rateLimit?: "auth" | "sensitive";
}

export interface Endpoint<
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  Q extends z.ZodType | undefined = z.ZodType | undefined,
  B extends z.ZodType | undefined = z.ZodType | undefined,
  R extends z.ZodType = z.ZodType,
> extends EndpointConfig<M, P, Q, B, R> {
  /** Dotted id, e.g. "users.list". Assigned by `defineApi`. */
  id: string;
  // Required here (optional in the config) so `E["body"]` is exactly the
  // schema or `undefined`, never `Schema | undefined`.
  query: Q;
  body: B;
}

export function endpoint<
  const M extends HttpMethod,
  const P extends string,
  R extends z.ZodType,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
>(config: EndpointConfig<M, P, Q, B, R>): Endpoint<M, P, Q, B, R> {
  return { ...config, query: config.query as Q, body: config.body as B, id: "" };
}

type Group = { [key: string]: Endpoint | Group };

/** Walks the tree once and stamps each endpoint with its dotted id. */
export function defineApi<T extends Group>(tree: T, prefix = ""): T {
  for (const [key, value] of Object.entries(tree)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (isEndpoint(value)) value.id = id;
    else defineApi(value, id);
  }
  return tree;
}

export function isEndpoint(value: unknown): value is Endpoint {
  return typeof value === "object" && value !== null && "method" in value && "path" in value && "response" in value;
}

export function flattenApi(tree: Group): Endpoint[] {
  const out: Endpoint[] = [];
  for (const value of Object.values(tree)) {
    if (isEndpoint(value)) out.push(value);
    else out.push(...flattenApi(value));
  }
  return out;
}

// ─── Type-level helpers shared by the server binding and the client ─────────

type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type PathParamNames<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? Param | PathParamNames<`/${Rest}`>
  : P extends `${string}:${infer Param}`
    ? Param
    : never;

export type PathParams<P extends string> = { [K in PathParamNames<P>]: string };

type ParamsPart<P extends string> = [PathParamNames<P>] extends [never] ? {} : { params: PathParams<P> };
type QueryPart<Q> = Q extends z.ZodType ? { query?: z.input<Q> } : {};
type BodyPart<B> = B extends z.ZodType ? { body: z.input<B> } : {};

/** What a client passes to call an endpoint. */
export type EndpointInput<E extends Endpoint> = Simplify<
  ParamsPart<E["path"]> & QueryPart<E["query"]> & BodyPart<E["body"]>
>;

/** What a client gets back — the parsed `data` of the envelope. */
export type EndpointOutput<E extends Endpoint> = z.output<E["response"]>;

/** What a server handler receives after validation. */
export interface EndpointRequest<E extends Endpoint> {
  params: PathParams<E["path"]>;
  query: E["query"] extends z.ZodType ? z.output<E["query"]> : Record<string, never>;
  body: E["body"] extends z.ZodType ? z.output<E["body"]> : undefined;
}

export function buildPath(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(value);
  });
}
