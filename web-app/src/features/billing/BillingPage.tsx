import { useState, type CSSProperties } from "react";
import { BILLING_EXCEPTIONS, BILL_RUN_STEPS, CHARGE_HEADS, WING_VARIANCE } from "../../mock/billing";
import { PANELS } from "../../mock/panels";
import { PanelModal } from "../../components/PanelModal";
import { ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { useAdminStore } from "../../store/AdminStore";

const card: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15 };

/**
 * The Billing bill-run screen — one of the three screens the README calls
 * out as sitting outside the generic template (Billing's Recompute needs
 * its own wiring; publish needs its own confirm dialog).
 */
export function BillingPage() {
  const { toast } = useAdminStore();
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <span style={{ font: "400 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Billing</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2.2" strokeLinecap="round">
              <path d="m9 5 7 7-7 7" />
            </svg>
            <span style={{ font: "600 12.5px/1 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)" }}>Bill run</span>
          </div>
          <h1 style={{ margin: 0, font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>October 2026 · draft</h1>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setRecomputeOpen(true)} className="press-scale" style={secondaryBtn}>Recompute</button>
          <button type="button" onClick={() => setPublishOpen(true)} className="press-scale" style={primaryBtn}>Publish 248 bills</button>
        </div>
      </div>

      <div style={{ display: "flex", background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, padding: 5, marginBottom: 16, overflowX: "auto" }}>
        {BILL_RUN_STEPS.map((step, i) => {
          const done = i < 2;
          const active = i === 2;
          return (
            <div key={step} style={{ flex: 1, minWidth: 120, display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderRadius: 10, background: done || active ? "var(--accent-wash,#E6F2EF)" : "transparent" }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  flex: "none",
                  borderRadius: "50%",
                  background: done ? "#0E6B5C" : active ? "#0E6B5C" : "var(--subtle,#EDF1EF)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "700 11px/1 Figtree, sans-serif",
                  color: active ? "#fff" : "var(--ink-soft,#5A6B66)",
                }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4.5 12.5 5 5 10-11" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span style={{ font: "600 13px/1.3 Figtree, sans-serif", color: done ? "var(--accent-ink,#0A5749)" : active ? "#fff" : "var(--ink-soft,#5A6B66)" }}>{step}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Head-wise totals</span>
            <span style={{ font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Apportionment basis</span>
          </div>
          {CHARGE_HEADS.map((h) => (
            <div key={h.name} className="row-hover" style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{h.name}</div>
                <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)" }}>{h.method}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{h.total}</div>
                <div style={{ marginTop: 2, font: "400 11.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{h.units}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "var(--canvas,#F7F9F8)" }}>
            <span style={{ font: "700 14px/1.3 Figtree, sans-serif" }}>Total billed</span>
            <span style={{ font: "700 17px/1.3 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>₹16,46,000.00</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Variance vs September</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {WING_VARIANCE.map((w) => (
                <div key={w.wing} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 110, flex: "none", font: "500 13px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{w.wing}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w.pct}%`, background: w.color, transformOrigin: "left", animation: "grow .6s cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                  <span style={{ font: "600 12.5px/1 Figtree, sans-serif", color: w.fg, width: 48, textAlign: "right" }}>{w.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 9, alignItems: "flex-start", padding: "11px 13px", borderRadius: 11, background: "var(--warn-wash,#FDF3E7)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warn,#B45309)" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "none", marginTop: 1 }}>
                <path d="M12 3.5 22 20H2Z" />
                <path d="M12 10v4M12 17h.01" />
              </svg>
              <span style={{ font: "500 12.5px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#7C3D06)" }}>
                Wing B is up 7.4% — the new lift was commissioned on 12 Aug and lift charges now apply to all 84 flats in that building.
              </span>
            </div>
          </div>

          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <span style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Exceptions</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--bad-wash,#FCEDEC)", color: "var(--bad-ink,#9B2B22)", font: "700 11px/1.6 Figtree, sans-serif" }}>{BILLING_EXCEPTIONS.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {BILLING_EXCEPTIONS.map((ex) => (
                <div key={ex.title} className="hover-lift-sm" style={{ padding: "12px 13px", border: "1px solid var(--warn-border,#F5DFBE)", background: "var(--warn-wash,#FDF9F3)", borderRadius: 11 }}>
                  <div style={{ font: "600 13px/1.4 Figtree, sans-serif", color: "var(--warn-ink,#7C3D06)" }}>{ex.title}</div>
                  <div style={{ marginTop: 3, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#8F4A0A)" }}>{ex.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {recomputeOpen && <PanelModal panel={PANELS.billing} onClose={() => setRecomputeOpen(false)} />}
      {publishOpen && (
        <ModalShell onClose={() => setPublishOpen(false)} maxWidth={460} zIndex={90}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--warn-wash,#FDF3E7)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warn,#B45309)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 22 20H2Z" />
              <path d="M12 10v4M12 17h.01" />
            </svg>
          </div>
          <div style={{ font: "700 20px/1.3 Figtree, sans-serif", letterSpacing: "-.015em", marginBottom: 10 }}>Publish 248 bills for October?</div>
          <div style={{ font: "400 14.5px/1.6 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>
            Published bills cannot be edited. Two exceptions are still open and those units will be skipped.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <GhostButton onClick={() => setPublishOpen(false)}>Review exceptions</GhostButton>
            <PrimaryButton
              onClick={() => {
                setPublishOpen(false);
                toast("246 bills published. 2 units held on exceptions.", "ok");
              }}
            >
              Publish 246
            </PrimaryButton>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
