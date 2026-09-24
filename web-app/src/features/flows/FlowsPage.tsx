import { FLOWS, TAGS } from "../../mock/flows";

/** The "User flows" screen — the eight journeys the product lives or dies
 * on, each step naming the surface it happens on and every branch that
 * stops the flow (README section 2, "flows"). */
export function FlowsPage() {
  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>User workflows</h1>
      <p style={{ margin: "0 0 24px", maxWidth: "66ch", font: "400 14.5px/1.6 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
        The eight journeys the product lives or dies on. Each step names the surface it happens on — admin web, resident app or gate app — and every branch that stops the flow.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {FLOWS.map((f) => {
          const tag = TAGS[f.tag];
          return (
            <div key={f.name} className="theme-transition" style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 9px", borderRadius: 6, background: tag.bg, color: tag.fg, font: "700 10.5px/1.6 Figtree, sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>{f.surface}</span>
                <span style={{ font: "700 16px/1.3 Figtree, sans-serif", letterSpacing: "-.012em" }}>{f.name}</span>
                <span style={{ marginLeft: "auto", font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{f.note}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
                {f.steps.map((s, i) => (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      minWidth: 130,
                      background: i === 0 ? "var(--accent-wash,#E6F2EF)" : "var(--canvas,#F7F9F8)",
                      border: `1px solid ${i === 0 ? "var(--accent-200,#C9E4DC)" : "var(--subtle,#EDF1EF)"}`,
                      borderRadius: 11,
                      padding: "11px 13px",
                    }}
                  >
                    <div style={{ font: "600 10px/1 'IBM Plex Mono',monospace", letterSpacing: ".08em", color: i === 0 ? "#0E6B5C" : "var(--ink-muted,#8A9995)", marginBottom: 6 }}>{String(i + 1).padStart(2, "0")}</div>
                    <div style={{ font: "600 13px/1.4 Figtree, sans-serif" }}>{s}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 13, display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "var(--warn-wash,#FDF3E7)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warn,#B45309)" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "none", marginTop: 1 }}>
                  <path d="M12 3.5 22 20H2Z" />
                  <path d="M12 10v4M12 17h.01" />
                </svg>
                <span style={{ font: "500 12.5px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#7C3D06)" }}>{f.guard}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
