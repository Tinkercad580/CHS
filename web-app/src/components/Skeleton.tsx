import type { CSSProperties } from "react";

/**
 * Loading placeholders, shown only while data is genuinely in flight.
 *
 * Shape over spinner: a skeleton that matches the layout it stands in for lets
 * the eye settle where the content will be, and the table does not jump when it
 * arrives. That only pays off when there is a real wait — for anything already
 * in memory the right placeholder is none at all.
 *
 * Deliberately quiet: one flat bar in --subtle with a slow sheen crossing it.
 * No pulsing, no per-row entrance, nothing that reads as decoration. It should
 * be obvious that the screen is working and otherwise unremarkable.
 */
export function Skeleton({ width = "100%", height = 14, radius = 6, style }: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: CSSProperties;
}) {
  return <div className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Stacked bars for a paragraph or a stacked field list. */
export function SkeletonText({ lines = 3, width = "100%" }: { lines?: number; width?: number | string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        // The last line runs short, the way a real paragraph does.
        <Skeleton key={i} width={i === lines - 1 ? "60%" : width} />
      ))}
    </div>
  );
}

/**
 * Placeholder rows for a table, matching its real column count and alignment so
 * the header stays put and nothing reflows when the data lands.
 */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: { align?: "left" | "right" }[] }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
          {cols.map((col, c) => (
            <td key={c} style={{ padding: "13px 16px" }}>
              <Skeleton
                width={col.align === "right" ? "55%" : "80%"}
                style={col.align === "right" ? { marginLeft: "auto" } : undefined}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
