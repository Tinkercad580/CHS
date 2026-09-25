import type { CSSProperties } from "react";

/** Inline style values shared by the money and governance screens' cards and tables (see components/Kit). */

export const cardStyle: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15 };

export const cellStyle = (align: "left" | "right" = "left", extra?: CSSProperties): CSSProperties => ({
  padding: "12px 16px",
  textAlign: align,
  font: "400 13.5px/1.4 Figtree, sans-serif",
  verticalAlign: "top",
  ...extra,
});

export const monoCell: CSSProperties = { font: "500 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" };
export const amountCell: CSSProperties = { font: "600 13.5px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

export const rowBorder: CSSProperties = { borderTop: "1px solid var(--border-soft,#F1F4F3)" };
