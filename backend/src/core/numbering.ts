import { randomUUID } from "node:crypto";
import type { Prisma } from "./db";

/**
 * Gapless per-FY sequence numbers — bills, receipts, NOCs (MASTER_SPEC C4).
 *
 * The increment takes a row lock and must run inside the transaction that
 * uses the number. If that transaction rolls back, so does the increment, so
 * a number is never skipped.
 */
export async function nextNumber(tx: Prisma.TransactionClient, societyId: string, series: string, fy: string): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO numbering_series (id, society_id, series, fy, next_value, created_at, updated_at)
    VALUES (${randomUUID()}::uuid, ${societyId}::uuid, ${series}, ${fy}, 1, now(), now())
    ON CONFLICT (society_id, series, fy) DO NOTHING`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    UPDATE numbering_series SET next_value = next_value + 1, updated_at = now()
    WHERE society_id = ${societyId}::uuid AND series = ${series} AND fy = ${fy}
    RETURNING next_value - 1 AS value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`numbering: series ${series}/${fy} missing after upsert`);
  return Number(value);
}

/** Render a number format: `{CODE}/{FY}/{SEQ}` → "SVCHS/2026-27/000123". */
export function formatNumber(format: string, parts: { code: string; fy: string; seq: number }): string {
  return format
    .replaceAll("{CODE}", parts.code)
    .replaceAll("{FY}", parts.fy)
    .replaceAll("{SEQ}", String(parts.seq).padStart(6, "0"));
}
