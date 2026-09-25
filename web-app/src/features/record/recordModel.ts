import type { DerivedRecord, DerivedSection } from "../../lib/recordDerive";
import { markFrom, stateKind } from "../../lib/format";
import type { RecordSection } from "../../lib/types";

/** View-model builders for records rendered with RecordView from API data. */

/** Tile value colour follows its accent only for warning and bad states, as deriveRecord does. */
export function tile(label: string, value: string, sub: string, accent: string): DerivedRecord["tiles"][number] {
  return { label, value, sub, accent, valueFg: /--bad|--warn/.test(accent) ? accent : "var(--ink,#0F1A17)" };
}

export const TWO_COLUMNS = "minmax(0,1.45fr) minmax(0,1fr)";

/** Builds a section view model from raw rows, the way deriveRecord does for mock records. */
export function section(x: RecordSection & { empty?: string }): DerivedSection {
  return {
    h: x.h,
    sub: x.sub ?? "",
    action: x.action ?? "",
    hasAction: Boolean(x.action),
    headLabels: x.head && x.head.length ? x.head : ["Name", "Detail", "State"],
    type: x.type,
    empty: x.empty,
    rows: x.rows.map((r, i) => ({
      a: r[0] ?? "",
      b: r[1] ?? "",
      c: r[2] ?? "",
      d: r[3] ?? r[2] ?? "",
      mark: markFrom(r[0] ?? ""),
      isFirst: i === 0,
      pillKind: stateKind(String(r[2] ?? "")),
    })),
  };
}

