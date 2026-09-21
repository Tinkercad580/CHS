import type { Row } from "./types";
import { PAGES } from "../mock/pages";

/**
 * Merges runtime-added rows and seed-row edits into one list, exactly as
 * `pg` does in the prototype: `added` rows are prepended, and each seed row
 * carries its position (`_seed`) so an edit can be written back by index —
 * an immutable key, unlike any displayed column (README, "The key must be
 * immutable and independent of any editable field").
 */
export function mergedRows(pageKey: string, added: Record<string, Row[]>, edits: Record<string, Record<number, Row>>): Row[] {
  const page = PAGES[pageKey];
  if (!page) return [];
  const overrides = edits[pageKey] ?? {};
  const seedRows: Row[] = page.rows.map((row, i) => (overrides[i] ? { ...overrides[i], _seed: i } : { ...row, _seed: i }));
  return (added[pageKey] ?? []).concat(seedRows);
}
