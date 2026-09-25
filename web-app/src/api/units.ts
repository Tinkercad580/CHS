import { useApi, useApiQuery } from "@chs/api-client/react";
import { api, type Unit } from "@chs/contract";
import { useSettled } from "../lib/tableKit";

/**
 * People type "B-0702"; the API wants a unit id. Both helpers resolve a label
 * with the unit search the members list uses, and accept only an exact match
 * — "B-07" must never quietly pick B-0701.
 */

export type UnitLookup =
  | { status: "empty" }
  | { status: "searching" }
  | { status: "missing"; label: string }
  | { status: "error"; message: string }
  | { status: "found"; unit: Unit };

/** Live lookup while the admin types, so the form can show whose unit it is before they submit. */
export function useUnitLookup(societyId: string, text: string): UnitLookup {
  const want = useSettled(text.trim().toUpperCase(), 250);
  const typed = text.trim().toUpperCase();
  const enabled = want.length >= 2;
  const q = useApiQuery(api.structure.units, { params: { societyId }, query: { q: want, limit: 20 } }, { enabled });
  if (!typed) return { status: "empty" };
  // Still settling, or the request for the settled text is in flight.
  if (typed !== want || (enabled && q.isPending)) return { status: "searching" };
  if (!enabled) return { status: "missing", label: typed };
  if (q.isError) return { status: "error", message: q.error.message };
  const unit = q.data?.items.find((u) => u.label.toUpperCase() === want);
  return unit ? { status: "found", unit } : { status: "missing", label: want };
}

type Client = ReturnType<typeof useApi>;

async function findUnit(client: Client, societyId: string, label: string): Promise<Unit | null> {
  const page = await client.structure.units({ params: { societyId }, query: { q: label, limit: 20 } });
  return page.items.find((u) => u.label.toUpperCase() === label) ?? null;
}

/**
 * One label at submit time (add a member, a user, a unit charge): the unit,
 * `null` when the field was left empty, or "missing" when nothing matches.
 */
export function useUnitResolver(societyId: string) {
  const client = useApi();
  return async (label: string): Promise<Unit | null | "missing"> => {
    const want = label.trim().toUpperCase();
    if (!want) return null;
    return (await findUnit(client, societyId, want)) ?? "missing";
  };
}

/** One-shot resolution of many labels at submit time (a supplementary bill to several units). */
export function useUnitsResolver(societyId: string) {
  const client = useApi();
  return async (labels: string[]): Promise<{ found: Unit[]; missing: string[] }> => {
    const wanted = [...new Set(labels.map((l) => l.trim().toUpperCase()).filter(Boolean))];
    const results = await Promise.all(wanted.map(async (label) => ({ label, unit: await findUnit(client, societyId, label) })));
    return { found: results.flatMap((r) => (r.unit ? [r.unit] : [])), missing: results.filter((r) => !r.unit).map((r) => r.label) };
  };
}

/** "A-0101, A-0102 A-0103" -> ["A-0101", "A-0102", "A-0103"]. */
export function splitUnitLabels(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}
