import type { PanelSpec } from "../lib/types";
import { panelCellIsFlag } from "../mock/panels";
import { ModalShell, GhostButton, PrimaryButton } from "./ModalShell";
import { useAdminStore } from "../store/AdminStore";
import { listRowStyle } from "../lib/motion";

/**
 * Secondary-action result panel (README, "Secondary actions open a result
 * panel, not a toast"): a real three-column table of outcomes, a summary
 * line, and either an action button or a plain Close for read-only
 * references. Cells flagging a problem render in --bad-ink.
 */
export function PanelModal({ panel, onClose }: { panel: PanelSpec; onClose: () => void }) {
  const { toast } = useAdminStore();
  const isAction = Boolean(panel.done);

  const act = () => {
    onClose();
    if (panel.done) toast(panel.done, "ok");
  };

  return (
    <ModalShell onClose={onClose} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(92vh - 52px)" }}>
        <div style={{ flex: "none", paddingBottom: 18, borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 20px/1.25 Figtree, sans-serif", letterSpacing: "-.02em", marginBottom: 5 }}>{panel.title}</div>
            <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{panel.sub}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{ width: 32, height: 32, flex: "none", border: 0, borderRadius: 9, background: "var(--canvas,#F7F9F8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round">
              <path d="M17 7 7 17M7 7l10 10" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                {panel.head.map((h, i) => (
                  <th key={h} style={{ padding: "10px 26px", textAlign: i === 2 ? "right" : "left", font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panel.rows.map((r, i) => {
                const flag = panelCellIsFlag(r.c);
                return (
                  <tr key={i} className="row-hover" style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)", ...listRowStyle(i) }}>
                    <td style={{ padding: "12px 26px", font: "600 13.5px/1.4 Figtree, sans-serif", whiteSpace: "nowrap" }}>{r.a}</td>
                    <td style={{ padding: "12px 26px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.b}</td>
                    <td style={{ padding: "12px 26px", textAlign: "right", font: "500 13.5px/1.4 Figtree, sans-serif", color: flag === "bad" ? "var(--bad-ink,#9B2B22)" : flag === "warn" ? "var(--warn-ink,#8F4A0A)" : "var(--ink,#0F1A17)" }}>{r.c}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ flex: "none", paddingTop: 16, borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 180, font: "400 12.5px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{panel.foot}</span>
          {isAction && <GhostButton onClick={onClose}>Cancel</GhostButton>}
          <PrimaryButton onClick={act}>{panel.cta}</PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}
