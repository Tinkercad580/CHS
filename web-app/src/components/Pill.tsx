import type { CSSProperties } from "react";
import type { PillKind } from "../lib/types";
import { PILL_TOKENS } from "../lib/format";

/** The small status pill used across every table, drawer and record page. */
export function Pill({ label, kind, style }: { label: string; kind: PillKind; style?: CSSProperties }) {
  const t = PILL_TOKENS[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        font: "600 11.5px/1.5 Figtree, sans-serif",
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

/** Pill with a leading dot — used on record-page chip rows. */
export function DotPill({ label, kind }: { label: string; kind: PillKind }) {
  const t = PILL_TOKENS[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        borderRadius: 999,
        background: t.bg,
        font: "600 11.5px/1.5 Figtree, sans-serif",
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.fg }} />
      {label}
    </span>
  );
}
