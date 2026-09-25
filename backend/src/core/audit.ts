import { currentContext } from "./context";
import { Prisma, type Tx } from "./db";

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  societyId?: string | null;
}

/** Strip fields that must never be persisted in an audit trail. */
const SECRET_KEYS = new Set(["passwordHash", "totpSecret", "totpPendingSecret", "refreshTokenHash", "previousHash", "accountNumber"]);

function sanitize(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (SECRET_KEYS.has(key)) return "[redacted]";
      if (typeof v === "bigint") return v.toString();
      return v;
    }),
  ) as Prisma.InputJsonValue;
}

/**
 * Write an audit row — MASTER_SPEC C19: actor, permission used, IP, device,
 * timestamp and before/after. Call it inside the same transaction as the
 * change so the two commit or roll back together.
 */
export async function audit(db: Tx, entry: AuditEntry): Promise<void> {
  const ctx = currentContext();
  await db.auditLog.create({
    data: {
      societyId: entry.societyId ?? ctx?.society?.societyId ?? null,
      actorId: ctx?.actor?.userId ?? null,
      actorName: ctx?.actor?.name ?? "system",
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      permission: ctx?.permissionUsed ?? null,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent?.slice(0, 300) ?? null,
      requestId: ctx?.requestId ?? null,
      before: sanitize(entry.before),
      after: sanitize(entry.after),
    },
  });
}
