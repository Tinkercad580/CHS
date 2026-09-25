import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";
import { Prisma, PrismaClient } from "../generated/prisma/client";

export { Prisma };
export type Db = PrismaClient;
/** A client or an open transaction — services accept either so callers can compose them. */
export type Tx = Prisma.TransactionClient | PrismaClient;

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX });

export const prisma = new PrismaClient({ adapter });

/**
 * Run `fn` in a transaction. Nested calls reuse the outer transaction rather
 * than opening a second one, so a service can be called on its own or from
 * inside another service's transaction.
 */
export async function transaction<T>(db: Tx, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  // Only the root client opens a transaction. A transaction client also exposes
  // `$transaction`, so presence of the method can't tell the two apart.
  if (db !== prisma) return fn(db as Prisma.TransactionClient);
  return prisma.$transaction(fn, { maxWait: 5_000, timeout: 15_000 });
}

export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  if (!field) return true;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}
