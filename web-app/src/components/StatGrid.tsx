import type { StatSpec } from "../lib/types";

/** The row of 4 stat cards at the top of every generic page and the
 * dashboard, sized `repeat(auto-fit,minmax(190px,1fr))` as in the prototype. */
export function StatGrid({ stats }: { stats: StatSpec[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", marginBottom: 10 }}>{s.label}</div>
          <div style={{ font: "700 22px/1 Figtree, sans-serif", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: s.fg ?? "var(--ink,#0F1A17)" }}>{s.value}</div>
          <div style={{ marginTop: 8, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{s.note}</div>
        </div>
      ))}
    </div>
  );
}
