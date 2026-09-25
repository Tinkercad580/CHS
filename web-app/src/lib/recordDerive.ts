import type { PillKind, RecordContext, RecordSection, RecordTile, Row } from "./types";
import { RECORD, recordFallback } from "../mock/record";
import { PAGES } from "../mock/pages";
import { markFrom, numFrom, stateKind } from "./format";

export interface DerivedRow {
  a: string;
  b: string;
  c: string;
  d: string;
  mark: string;
  isFirst: boolean;
  pillKind: PillKind;
}

export interface DerivedSection {
  h: string;
  sub: string;
  action: string;
  hasAction: boolean;
  headLabels: string[];
  type: RecordSection["type"];
  rows: DerivedRow[];
  /** When set, an empty section says this instead of rendering an empty table. */
  empty?: string;
}

export interface DerivedRecord {
  kind: string;
  name: string;
  code: string;
  initial: string;
  meta: string[];
  chips: [string, PillKind][];
  actions: [string, "primary" | "ghost" | "warn"][];
  tiles: (RecordTile & { valueFg: string })[];
  alert: RecordContext["alert"];
  left: DerivedSection[];
  right: DerivedSection[];
  grid: string;
}

function money(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

/**
 * Builds the record-page view model for one row: merges any runtime
 * `recAdd` rows into each section FIRST, then derives every tile and
 * section-summary count from the merged result — never from the seed data
 * alone (README, "Count the rows you rendered, not the rows you seeded").
 */
export function deriveRecord(
  pageKey: string,
  row: Row,
  recAddForUnit: Record<string, string[][]>,
): DerivedRecord {
  const addedLedger = recAddForUnit.Ledger ?? [];
  const carve = addedLedger
    .filter((z) => /due|overdue|unpaid/i.test(String(z[2])))
    .reduce((t, z) => t + numFrom(z[1]), 0);

  const builder = RECORD[pageKey];
  const ctx = builder ? builder(carve ? { ...row, _carve: carve } : row) : recordFallback(row, PAGES[pageKey]?.cols ?? PAGES.members.cols);

  const name = row.b && row.b !== "—" ? row.b : row.a;

  const sect = (x: RecordSection): DerivedSection => {
    const headLabels = x.head && x.head.length ? x.head : ["Name", "Detail", "State"];
    const merged = (recAddForUnit[x.h] ?? []).concat(x.rows);
    return {
      h: x.h,
      sub: x.sub ?? "",
      action: x.action ?? "",
      hasAction: Boolean(x.action),
      headLabels,
      type: x.type,
      rows: merged.map((r, i) => ({
        a: r[0] ?? "",
        b: r[1] ?? "",
        c: r[2] ?? "",
        d: r[3] ?? r[2] ?? "",
        mark: markFrom(r[0] ?? ""),
        isFirst: i === 0,
        pillKind: stateKind(String(r[2] ?? "")),
      })),
    };
  };

  const leftS = ctx.left.map(sect);
  const rightS = ctx.right.map(sect);
  const find = (h: string) => leftS.concat(rightS).find((z) => z.h === h);

  const led = find("Ledger");
  const unpaid = led ? led.rows.filter((z) => /due|overdue|unpaid/i.test(z.c)) : [];
  const settled = led ? led.rows.filter((z) => /paid/i.test(z.c)) : [];
  const paidSum = settled.reduce((t, z) => t + numFrom(z.b), 0);
  const help = find("Helpdesk");
  const openT = help ? help.rows.filter((z) => !/resolved|closed/i.test(z.c)).length : 0;
  const bk = find("Amenity bookings");
  const upcoming = bk ? bk.rows.filter((z) => /confirmed/i.test(z.c)).length : 0;
  const vp = find("Visitor passes") ?? find("Gate activity");

  if (led) led.sub = unpaid.length ? `${unpaid.length} unpaid · ${settled.length} settled this FY` : `All ${settled.length} entries settled this FY`;
  if (help) help.sub = help.rows.length ? (openT ? `${openT} open · ${help.rows.length - openT} resolved` : "Nothing open") : help.sub;
  if (bk) bk.sub = bk.rows.length ? (upcoming ? `${upcoming} upcoming · ${bk.rows.length - upcoming} past` : "None upcoming") : bk.sub;
  if (vp && vp.rows.length) vp.sub = `${vp.rows.length} issued`;

  const recount = (t: RecordTile): RecordTile => {
    if (t.label === "Open tickets" && help && help.rows.length) return { ...t, value: String(openT), sub: `${help.rows.length - openT} resolved` };
    if (t.label === "Amenity bookings" && bk && bk.rows.length) return { ...t, value: String(upcoming), sub: upcoming ? "Upcoming this month" : "None upcoming" };
    if (t.label === "Visitor passes" && vp && vp.rows.length) return { ...t, value: String(vp.rows.length), sub: "Issued for this unit" };
    if (t.label === "Paid this FY" && led) return { ...t, value: money(paidSum), sub: `${settled.length} of ${led.rows.length} entries settled` };
    if (t.label === "Outstanding" && led) {
      const tot = unpaid.reduce((x, z) => x + numFrom(z.b), 0);
      return { ...t, value: tot ? money(tot) : "Nil", sub: tot ? "Due 17 Sep" : "Nothing due" };
    }
    return t;
  };

  return {
    kind: ctx.kind,
    name,
    code: ctx.code,
    initial: name[0]?.toUpperCase() ?? "?",
    meta: ctx.meta,
    chips: ctx.chips,
    actions: ctx.actions,
    tiles: ctx.tiles.map(recount).map((t) => ({ ...t, valueFg: /--bad|--warn/.test(t.accent) ? t.accent : "var(--ink,#0F1A17)" })),
    alert: ctx.alert,
    left: leftS,
    right: rightS,
    grid: ctx.left.length ? "minmax(0,1.45fr) minmax(0,1fr)" : "minmax(0,1fr)",
  };
}
