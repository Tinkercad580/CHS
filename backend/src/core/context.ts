import { AsyncLocalStorage } from "node:async_hooks";
import type { Permission, Role, UserType } from "@chs/contract";

/** Who is calling, resolved from the access token. */
export interface Actor {
  userId: string;
  sessionId: string;
  name: string;
  isPlatformAdmin: boolean;
  /** Restricted tokens exist only to complete a forced password change. */
  restricted: boolean;
}

/** The caller's standing in the society named by the path. */
export interface SocietyScope {
  societyId: string;
  societyUserId: string;
  role: Role;
  userType: UserType;
  permissions: ReadonlySet<Permission>;
  /** The unit on the caller's access record. Units they own or rent come from `actingUnitIds`. */
  unitId: string | null;
}

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  actor: Actor | null;
  society: SocietyScope | null;
  /** The permission that let this request through, recorded on audit rows. */
  permissionUsed: Permission | null;
  /** Events raised during the request, published only once it succeeds (after commit). */
  pendingEvents: import("./events").DomainEvent[];
  /** Work to start only once the request has succeeded (notifications, emails). */
  afterCommit: (() => Promise<void>)[];
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Run `fn` after the current request or job succeeds — never for one that
 * fails, and never before its transaction has committed. Outside a request it
 * runs straight away.
 */
export function afterCommit(fn: () => Promise<void>): void {
  const ctx = storage.getStore();
  if (ctx) ctx.afterCommit.push(fn);
  else void fn().catch(() => undefined);
}

/** Start queued after-commit work; failures are logged, never thrown at the caller. */
export function runAfterCommit(ctx: RequestContext, onError: (err: unknown) => void): void {
  for (const fn of ctx.afterCommit.splice(0)) void fn().catch(onError);
}

/** A context for work that runs outside a request — jobs, seeds, tests. */
export function systemContext(requestId = "system"): RequestContext {
  return { requestId, ip: null, userAgent: null, actor: null, society: null, permissionUsed: null, pendingEvents: [], afterCommit: [] };
}
