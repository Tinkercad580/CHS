/**
 * Calendar dates (DB `date` columns) travel as "YYYY-MM-DD" and are held as a
 * UTC-midnight Date in memory, so no timezone can move them a day. Instants
 * (`timestamptz`) travel as ISO strings with offset.
 */

export function toIsoDate(d: Date): string;
export function toIsoDate(d: Date | null | undefined): string | null;
export function toIsoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function fromIsoDate(s: string): Date;
export function fromIsoDate(s: string | null | undefined): Date | null;
export function fromIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date ${s}`);
  return d;
}

export function toIso(d: Date): string;
export function toIso(d: Date | null | undefined): string | null;
export function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** Today in India, as a calendar date. */
export function todayIst(now = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return fromIsoDate(ist.toISOString().slice(0, 10));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Financial year label for a date, e.g. "2026-27" for FY starting April. */
export function financialYear(d: Date, fyStartMonth = 4): string {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() + 1 >= fyStartMonth ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
