import { useState, type CSSProperties } from "react";
import { COMPLIANCE_ITEMS } from "../../mock/compliance";
import { PANELS } from "../../mock/panels";
import { PanelModal } from "../../components/PanelModal";

/** Compliance calendar — statutory obligations with a regulatory-update
 * banner and an "Apply fix" action (README section 2, "compliance"). */
export function CompliancePage() {
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>Compliance calendar</h1>
          <p style={{ margin: 0, font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Maharashtra CHS obligations · score 92/100 · 0 overdue</p>
        </div>
        <button type="button" onClick={() => setRegistrarOpen(true)} style={primaryBtn}>Registrar report</button>
      </div>

      <div style={{ background: "var(--info-wash,#EAF0FE)", border: "1px solid var(--info-border,#C7D7FB)", borderRadius: 14, padding: "15px 18px", display: "flex", gap: 12, marginBottom: 16 }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--info,#1D4ED8)" strokeWidth="2" strokeLinecap="round" style={{ flex: "none", marginTop: 1 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 14px/1.35 Figtree, sans-serif", color: "var(--info-ink,#12327A)" }}>Regulatory update · Chapter XI-B, Rule 106C-12</div>
          <div style={{ marginTop: 4, font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--info-ink,#2B4A9E)" }}>
            Effective 30 June 2026. Your non-occupancy head is still computed on total maintenance. The rule bases it on service charges only.
          </div>
        </div>
        <button type="button" onClick={() => setFixOpen(true)} style={{ alignSelf: "center", flex: "none", height: 34, padding: "0 14px", border: 0, borderRadius: 9, background: "#1D4ED8", color: "#fff", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
          Apply fix
        </button>
      </div>

      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
        {COMPLIANCE_ITEMS.map((c, i) => (
          <div key={c.item} style={{ padding: "14px 20px", borderBottom: i < COMPLIANCE_ITEMS.length - 1 ? "1px solid var(--border-soft,#F1F4F3)" : "none", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", flex: "none", background: c.dot }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{c.item}</div>
              <div style={{ marginTop: 3, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{c.rule}</div>
            </div>
            <div style={{ flex: "none", textAlign: "right", minWidth: 120 }}>
              <div style={{ font: "600 13px/1.4 Figtree, sans-serif" }}>{c.due}</div>
              <div style={{ marginTop: 3, font: "500 11.5px/1.4 Figtree, sans-serif", color: c.stateFg }}>{c.state}</div>
            </div>
            <span style={{ flex: "none", padding: "4px 11px", borderRadius: 8, background: "var(--subtle,#F1F4F3)", font: "600 12px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#3D4A46)", cursor: "pointer" }}>{c.action}</span>
          </div>
        ))}
      </div>

      {registrarOpen && <PanelModal panel={PANELS.registrar} onClose={() => setRegistrarOpen(false)} />}
      {fixOpen && <PanelModal panel={PANELS.complyFix} onClose={() => setFixOpen(false)} />}
    </div>
  );
}

const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
