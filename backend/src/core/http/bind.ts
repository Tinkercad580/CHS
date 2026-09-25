import { createHash } from "node:crypto";
import {
  api,
  flattenApi,
  type Endpoint,
  type EndpointOutput,
  type EndpointRequest,
} from "@chs/contract";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { Actor, RequestContext, SocietyScope } from "../context";
import { runWithContext } from "../context";
import { Prisma, prisma } from "../db";
import { AppError } from "../errors";
import { events } from "../events";
import { authenticate, authorizeSociety } from "./authenticate";
import { rateLimit } from "./rate-limit";

/** What a handler gets besides its validated input. */
export interface HandlerContext {
  readonly ctx: RequestContext;
  /** The caller. Throws on a public endpoint, where there is none. */
  readonly actor: Actor;
  /** The caller's standing in the path's society. Throws outside society endpoints. */
  readonly society: SocietyScope;
  readonly req: Request;
  readonly res: Response;
}

export type Handler<E extends Endpoint> = (
  input: EndpointRequest<E>,
  hc: HandlerContext,
) => Promise<EndpointOutput<E> | z.input<E["response"]>> | EndpointOutput<E> | z.input<E["response"]>;

export interface Binding {
  endpoint: Endpoint;
  handler: Handler<Endpoint>;
}

/** Pair a contract endpoint with its implementation. */
export function handle<E extends Endpoint>(endpoint: E, handler: Handler<E>): Binding {
  return { endpoint, handler: handler as unknown as Handler<Endpoint> };
}

const PathId = z.uuid();

function parseParams(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    // Every `…Id` segment is a UUID. A malformed one can't name anything, so it is a 404, not a 400.
    if (k.endsWith("Id") && !PathId.safeParse(v).success) throw new AppError("NOT_FOUND", "Not found.");
    out[k] = v;
  }
  return out;
}

function hashRequest(req: Request): string {
  return createHash("sha256").update(JSON.stringify({ p: req.params, q: req.query, b: req.body ?? null })).digest("hex");
}

function makeHandler(binding: Binding) {
  const { endpoint, handler } = binding;
  return async (req: Request, res: Response, next: NextFunction) => {
    const ctx: RequestContext = {
      requestId: String(res.getHeader("x-request-id") ?? ""),
      ip: req.ip ?? null,
      userAgent: req.header("user-agent") ?? null,
      actor: null,
      society: null,
      permissionUsed: null,
      pendingEvents: [],
    };
    try {
      await runWithContext(ctx, async () => {
        ctx.actor = await authenticate(req, endpoint);
        if (endpoint.access.kind === "platform" && !ctx.actor?.isPlatformAdmin) {
          throw new AppError("FORBIDDEN", "Platform administrators only.");
        }

        const params = parseParams(req.params as Record<string, string>);
        if (endpoint.access.kind === "society") {
          if (!params.societyId) throw new Error(`${endpoint.id}: society endpoint without :societyId`);
          const { scope, permissionUsed } = await authorizeSociety(ctx.actor!, params.societyId, endpoint);
          ctx.society = scope;
          ctx.permissionUsed = permissionUsed;
        }

        const query = endpoint.query ? endpoint.query.parse(req.query) : {};
        const body = endpoint.body ? endpoint.body.parse(req.body ?? {}) : undefined;

        // Idempotency: a retried POST with the same key replays the first
        // response instead of performing the action twice.
        const idemKey = endpoint.idempotent ? req.header("idempotency-key")?.slice(0, 100) : undefined;
        const requestHash = idemKey ? hashRequest(req) : "";
        if (idemKey && ctx.actor) {
          const prior = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId: ctx.actor.userId, key: idemKey } } });
          if (prior) {
            if (prior.requestHash !== requestHash || prior.endpointId !== endpoint.id) {
              throw new AppError("IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different request.");
            }
            res.setHeader("Idempotent-Replay", "true");
            res.status(prior.statusCode).json(prior.response);
            return;
          }
        }

        const hc: HandlerContext = {
          ctx,
          req,
          res,
          get actor() {
            if (!ctx.actor) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
            return ctx.actor;
          },
          get society() {
            if (!ctx.society) throw new Error(`${endpoint.id}: no society scope on this endpoint`);
            return ctx.society;
          },
        };

        const result = await handler({ params, query, body } as EndpointRequest<Endpoint>, hc);
        // Parsing the output strips any field the contract doesn't declare, so
        // a handler can never leak a column by returning a raw row.
        const data = endpoint.response.parse(result);
        const payload = { data, meta: { requestId: ctx.requestId } };

        if (idemKey && ctx.actor) {
          await prisma.idempotencyKey
            .create({
              data: {
                key: idemKey,
                userId: ctx.actor.userId,
                endpointId: endpoint.id,
                requestHash,
                statusCode: 200,
                response: payload as unknown as Prisma.InputJsonValue,
              },
            })
            .catch(() => undefined);
        }

        res.json(payload);
      });
      events.flush(ctx.pendingEvents);
    } catch (err) {
      ctx.pendingEvents.length = 0;
      next(err);
    }
  };
}

/**
 * Mount every binding on a router. Refuses to start if an endpoint in the
 * contract has no handler, or a handler is bound twice — the contract and the
 * server can't silently disagree about what the API is.
 */
export function mountApi(bindings: Binding[]): Router {
  const router = Router();
  const declared = flattenApi(api as never);
  const byId = new Map<string, Binding>();
  for (const b of bindings) {
    if (byId.has(b.endpoint.id)) throw new Error(`Endpoint ${b.endpoint.id} is bound twice`);
    byId.set(b.endpoint.id, b);
  }
  const missing = declared.filter((e) => !byId.has(e.id)).map((e) => e.id);
  if (missing.length) throw new Error(`Endpoints in the contract with no handler: ${missing.join(", ")}`);

  // Static segments before parameters, so `/units/bulk` isn't captured by `/units/:unitId`.
  const ordered = [...byId.values()].sort((a, b) => specificity(b.endpoint.path) - specificity(a.endpoint.path));
  for (const b of ordered) {
    const method = b.endpoint.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
    router[method](b.endpoint.path, rateLimit(b.endpoint.rateLimit ?? "default"), makeHandler(b));
  }
  return router;
}

function specificity(path: string): number {
  return path.split("/").reduce((s, seg) => s * 2 + (seg.startsWith(":") ? 0 : 1), 1);
}
