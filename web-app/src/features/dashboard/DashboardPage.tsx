import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CHART_MONTHS, FUND_BALANCES, GATE_TODAY, NEEDS_ATTENTION, TOP_DEFAULTERS } from "../../mock/dashboard";
import { PANELS } from "../../mock/panels";
import { PanelModal } from "../../components/PanelModal";
import { useConsoleMe } from "../../api/society";

const card: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: 18 };

/** The society-wide overview: collection snapshot, six-month billed-vs-
 * collected chart, attention list, top defaulters, fund balances and the
 * gate's live snapshot (README section 2, "dashboard stat cards"). */
export function DashboardPage() {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  // The greeting is the one line here that is about the signed-in person, not the mock society figures.
  const firstName = useConsoleMe().name.split(/\s+/)[0];
  const [hour] = useState(() => new Date().getHours());
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>{greeting}, {firstName}</h1>
          <p style={{ margin: 0, font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>11 September 2026 · September bills published 4 days ago</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setExportOpen(true)} className="press-scale" style={secondaryBtn}>Export</button>
          <button type="button" onClick={() => navigate("/billing")} className="press-scale" style={primaryBtn}>New bill run</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 14 }}>
        <div className="hover-lift theme-transition" style={{ ...card }}>
          <Label>Billed · September</Label>
          <BigNum>₹16,46,000</BigNum>
          <Note>248 bills · 0 exceptions open</Note>
        </div>
        <div className="hover-lift theme-transition" style={{ ...card }}>
          <Label>Collected</Label>
          <BigNum color="var(--ok,#167A3C)">₹12,84,600</BigNum>
          <div style={{ marginTop: 9, height: 5, borderRadius: 3, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "78%", background: "#167A3C", transformOrigin: "left", animation: "grow .8s cubic-bezier(.2,.7,.3,1)" }} />
          </div>
          <Note style={{ marginTop: 7 }}>78% collection efficiency</Note>
        </div>
        <div className="hover-lift theme-transition" style={{ ...card }}>
          <Label>Outstanding</Label>
          <BigNum color="var(--bad,#C0342B)">₹3,61,400</BigNum>
          <div style={{ marginTop: 11, display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            <div style={{ flex: 44, background: "var(--accent-200,#C9E4DC)" }} />
            <div style={{ flex: 26, background: "#6FB3A1" }} />
            <div style={{ flex: 18, background: "#B45309" }} />
            <div style={{ flex: 12, background: "#C0342B" }} />
          </div>
          <Note style={{ marginTop: 7 }}>31 units · ₹43,400 over 90 days</Note>
        </div>
        <div className="hover-lift theme-transition" style={{ ...card }}>
          <Label>Compliance score</Label>
          <div style={{ font: "700 25px/1 Figtree, sans-serif", letterSpacing: "-.022em" }}>
            92<span style={{ font: "600 15px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>/100</span>
          </div>
          <div style={{ marginTop: 9, display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={badge("var(--warn-wash,#FDF3E7)", "var(--warn-ink,#8F4A0A)")}>2 due in 30d</span>
            <span style={badge("var(--ok-wash,#E8F5EC)", "var(--ok-ink,#14663A)")}>0 overdue</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Billed vs collected</div>
            <div style={{ font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Last 6 months</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 132 }}>
            {CHART_MONTHS.map((c) => (
              <div key={c.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: 110 }}>
                  <div style={{ flex: 1, height: `${c.hBill}%`, background: "var(--accent-200,#C9E4DC)", borderRadius: "4px 4px 0 0", transformOrigin: "bottom", animation: "riseBar .6s cubic-bezier(.2,.7,.3,1)" }} />
                  <div style={{ flex: 1, height: `${c.hColl}%`, background: "#0E6B5C", borderRadius: "4px 4px 0 0", transformOrigin: "bottom", animation: "riseBar .8s cubic-bezier(.2,.7,.3,1)" }} />
                </div>
                <div style={{ font: "500 11px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{c.m}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 16, font: "500 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            <Legend color="var(--accent-200,#C9E4DC)" label="Billed" />
            <Legend color="#0E6B5C" label="Collected" />
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Needs your attention</div>
            <span style={badge("var(--bad-wash,#FCEDEC)", "var(--bad-ink,#9B2B22)")}>{NEEDS_ATTENTION.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {NEEDS_ATTENTION.map((a, i) => (
              <div key={a.title} className="row-hover" style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < NEEDS_ATTENTION.length - 1 ? "1px solid var(--border-soft,#F1F4F3)" : "none", cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.dot, flex: "none", marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{a.title}</div>
                  <div style={{ marginTop: 2, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{a.meta}</div>
                </div>
                <span style={{ font: "600 12.5px/1.4 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)", alignSelf: "center" }}>{a.cta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Top defaulters</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {TOP_DEFAULTERS.map((d) => (
              <div key={d.unit} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ font: "600 13.5px/1.3 Figtree, sans-serif" }}>
                    {d.unit} · {d.name}
                  </div>
                  <div style={{ marginTop: 2, font: "400 12px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{d.meta}</div>
                </div>
                <span style={{ font: "700 14px/1 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", color: d.fg }}>{d.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Fund balances</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {FUND_BALANCES.map((f) => (
              <div key={f.name}>
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 13px/1.3 Figtree, sans-serif", marginBottom: 6 }}>
                  <span>{f.name}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{f.amount}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${f.pct}%`, background: f.color, transformOrigin: "left", animation: "grow .7s cubic-bezier(.2,.7,.3,1)" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft,#F1F4F3)", font: "400 12px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            Withdrawals require a general body resolution reference.
          </div>
        </div>

        <div style={card}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Today at the gate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {GATE_TODAY.map((g) => (
              <div key={g.label}>
                <div style={{ font: "700 22px/1 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{g.value}</div>
                <div style={{ marginTop: 4, font: "400 12px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{g.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 10, background: "var(--ok-wash,#E8F5EC)", font: "600 12.5px/1.4 Figtree, sans-serif", color: "var(--ok-ink,#14663A)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#167A3C" }} />
            Gate device online · synced 40s ago
          </div>
        </div>
      </div>

      {exportOpen && <PanelModal panel={PANELS.dash} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", marginBottom: 11 }}>{children}</div>;
}
function BigNum({ children, color }: { children: ReactNode; color?: string }) {
  return <div style={{ font: "700 25px/1 Figtree, sans-serif", letterSpacing: "-.022em", fontVariantNumeric: "tabular-nums", color }}>{children}</div>;
}
function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ marginTop: 9, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", ...style }}>{children}</div>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}
function badge(bg: string, fg: string): CSSProperties {
  return { padding: "2px 8px", borderRadius: 999, background: bg, color: fg, font: "600 11.5px/1.5 Figtree, sans-serif" };
}

const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
