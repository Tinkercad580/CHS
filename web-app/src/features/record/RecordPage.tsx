import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminStore } from "../../store/AdminStore";
import { mergedRows } from "../../lib/rows";
import { deriveRecord } from "../../lib/recordDerive";
import { numFrom } from "../../lib/format";
import { DotPill } from "../../components/Pill";
import { DataFormModal } from "../../components/DataFormModal";
import { QuickModal } from "../../components/QuickModal";
import type { EditTarget } from "../../lib/formLogic";
import type { QuickSpec, RecordActionKind } from "../../lib/types";
import { LIST_COLS, QUICK_BLURB, QUICK_PH, QUICK_SEED } from "../../mock/record";

const actionColors: Record<RecordActionKind, { bg: string; fg: string; bd: string }> = {
  primary: { bg: "var(--accent,#0E6B5C)", fg: "#ffffff", bd: "0" },
  ghost: { bg: "var(--surface,#fff)", fg: "var(--ink,#0F1A17)", bd: "1px solid var(--border-strong,#CCD6D2)" },
  warn: { bg: "var(--warn-wash,#FDF3E7)", fg: "var(--warn-ink,#8F4A0A)", bd: "1px solid var(--warn-border,#F5DFBE)" },
};

/**
 * The full-page record view for any row on any generic screen (README, "A
 * record opens as a full page, not a side drawer"). RECORD[pageKey] (or the
 * fallback) supplies the raw context; deriveRecord() merges any runtime
 * recAdd rows into it and recomputes every count from the merged result —
 * the derivation discipline the README spends most of its length on.
 */
export function RecordPage() {
  const { pageKey = "", rowKey = "" } = useParams();
  const navigate = useNavigate();
  const { state, dispatch, toast } = useAdminStore();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [quick, setQuick] = useState<QuickSpec | null>(null);

  const all = useMemo(() => mergedRows(pageKey, state.added, state.edits), [pageKey, state.added, state.edits]);
  const row = all.find((r) => r.a === decodeURIComponent(rowKey));

  const key = row ? `${pageKey}/${row.a}` : "";
  const rec = useMemo(() => (row ? deriveRecord(pageKey, row, state.recAdd[key] ?? {}) : null), [pageKey, row, state.recAdd, key]);

  if (!row || !rec) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft,#5A6B66)" }}>
        This record could not be found. It may have been renamed or removed.
      </div>
    );
  }

  const name = rec.name;

  const openEdit = () => {
    const idx = (state.added[pageKey] ?? []).findIndex((x) => x === row || (x.a === row.a && x.b === row.b));
    setEditing({ page: pageKey, seed: row._seed, isNew: Boolean(row.isNew), idx, orig: row });
  };

  const receive = () => {
    const owed = numFrom(row.e);
    setQuick({
      title: "Receive payment",
      blurb: `Posts to the ledger and reduces what ${name} owes. A receipt is issued on save.`,
      cta: "Receive",
      fields: [
        { k: "amt", label: "Amount", kind: "money", req: true, ph: owed.toFixed(2) },
        { k: "via", label: "Method", kind: "pick", opts: ["Cash", "Cheque", "NEFT", "UPI"], req: true },
        { k: "ref", label: "Reference", ph: "Cheque or UTR number" },
      ],
      seed: { amt: owed.toFixed(2), via: "UPI" },
      save: (v) => {
        const paid = Number(v.amt) || 0;
        const left = Math.max(0, owed - paid);
        const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const upd = left === 0 ? { e: "₹0.00", pill: "Clear", k: "ok" as const } : { e: fmt(left), pill: "Due", k: "warn" as const };
        dispatch({ type: "patchActive", page: pageKey, row, upd });
        const per = state.recAdd[key] ?? {};
        let budget = paid;
        const kept = (per.Ledger ?? []).filter((z) => {
          if (!/due|overdue|unpaid/i.test(String(z[2]))) return true;
          const amt = numFrom(z[1]);
          if (budget >= amt) {
            budget -= amt;
            return false;
          }
          return true;
        });
        dispatch({ type: "setRecAddSection", key, heading: "Ledger", rows: [["Payment received · " + v.via, fmt(paid), "paid", "Today"]].concat(kept) });
        setQuick(null);
        toast(`${fmt(paid)} received from ${name}. ${left === 0 ? "Account is now clear." : fmt(left) + " still outstanding."}`, "ok");
      },
    });
  };

  const runAction = (label: string) => {
    if (label === "Edit") {
      openEdit();
      return;
    }
    if (label === "Lock account") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Locked 15 min", k: "bad" } });
      toast(`${name} locked. They cannot sign in for 15 minutes.`, "warn");
      return;
    }
    if (label === "Unlock") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Active", k: "ok" } });
      toast(`${name} unlocked.`, "ok");
      return;
    }
    if (label === "Reset password") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Reset sent", k: "info" } });
      toast(`Reset link sent to ${row.a}.`, "ok");
      return;
    }
    if (label === "Send invite") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Invite sent", k: "info" } });
      toast(`Invite sent to ${row.a}. It expires in 7 days.`, "ok");
      return;
    }
    if (label === "Resend invite") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Invite sent", k: "info" } });
      toast(`Invite resent to ${row.a}.`, "ok");
      return;
    }
    if (label === "Make inactive") {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Inactive", k: "info" } });
      toast(`${name} marked inactive. App access is withdrawn.`, "warn");
      return;
    }
    if (label === "Change template") {
      const current = String(row.c || "Owner");
      const cased = current.charAt(0).toUpperCase() + current.slice(1).toLowerCase();
      setQuick({
        title: "Change permission template",
        blurb: "What this user can see changes the moment you save. Their open sessions are refreshed.",
        cta: "Apply template",
        fields: [{ k: "t", label: "Template", kind: "pick", opts: ["Owner", "Tenant", "Accountant", "Guard", "Committee", "Read only"], req: true }],
        seed: { t: cased },
        save: (v) => {
          dispatch({ type: "patchActive", page: pageKey, row, upd: { c: v.t.toUpperCase() } });
          setQuick(null);
          toast(`${name} moved to the ${v.t} template.`, "ok");
        },
      });
      return;
    }
    if (label === "App access") {
      setQuick({
        title: `App access · ${name}`,
        blurb: "Grant or withdraw the login for this unit. Withdrawing signs out every device immediately.",
        cta: "Apply",
        fields: [{ k: "g", label: "Access", kind: "pick", opts: ["Grant", "Withdraw"], req: true }],
        seed: { g: "Grant" },
        save: (v) => {
          setQuick(null);
          toast(v.g === "Grant" ? `Login issued for ${name}.` : "Access withdrawn. All devices signed out.", v.g === "Grant" ? "ok" : "warn");
        },
      });
      return;
    }
    if (label === "Send statement") {
      setQuick({
        title: "Send statement",
        blurb: "A PDF of this unit's ledger for the current financial year.",
        cta: "Send",
        fields: [
          { k: "how", label: "Send by", kind: "pick", opts: ["Email", "WhatsApp", "Both"], req: true },
          { k: "period", label: "Period", kind: "pick", opts: ["This FY", "Last 6 months", "All time"], req: true },
        ],
        seed: { how: "Email", period: "This FY" },
        save: (v) => {
          setQuick(null);
          toast(`Statement (${v.period.toLowerCase()}) sent to ${name} by ${v.how.toLowerCase()}.`, "ok");
        },
      });
      return;
    }
    if (label === "Record payment") {
      receive();
      return;
    }
    toast(`${label} · ${name}`, "ok");
  };

  const alertAct = () => {
    if (!rec.alert) return;
    if (/Never signed in/.test(String(row.pill)) || !numFrom(row.e)) {
      dispatch({ type: "patchActive", page: pageKey, row, upd: { pill: "Invite sent", k: "info" } });
      toast(`Invite resent to ${row.a}. It expires in 7 days.`, "ok");
      return;
    }
    receive();
  };

  const openSectionAdd = (heading: string, action: string) => {
    const labels = LIST_COLS[heading] ?? ["Name", "Detail", "State"];
    const phs = QUICK_PH[heading] ?? [];
    const seeds = QUICK_SEED[heading] ?? [];
    setQuick({
      title: `${action} · ${heading.toLowerCase()}`,
      blurb: QUICK_BLURB[heading] ?? `Added to this record straight away. In the built product it also writes to ${heading.toLowerCase()} society-wide.`,
      cta: action,
      fields: labels.map((l, n) => ({ k: `f${n}`, label: l, req: n < 2, ph: phs[n] ?? "" })),
      seed: seeds.reduce<Record<string, string>>((o, v, n) => ({ ...o, [`f${n}`]: v }), {}),
      save: (v) => {
        const rowOut = labels.map((_, n) => v[`f${n}`] || "—");
        if (heading === "Ledger") {
          const amt = numFrom(rowOut[1]);
          const owed = numFrom(row.e);
          const next = /paid/i.test(rowOut[2]) ? Math.max(0, owed - amt) : owed + amt;
          const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
          dispatch({
            type: "patchActive",
            page: pageKey,
            row,
            upd: next === 0 ? { e: "₹0.00", pill: "Clear", k: "ok" } : { e: fmt(next), pill: "Due", k: "warn" },
          });
        }
        dispatch({ type: "pushRecAdd", key, heading, row: rowOut });
        setQuick(null);
        toast(`${rowOut[0]} added to ${heading.toLowerCase()}.`, "ok");
      },
    });
  };

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(`/${pageKey}`)}
            title="Back"
            style={{ width: 36, height: 36, flex: "none", border: "1px solid var(--border,#E3E9E6)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <span style={{ width: 54, height: 54, flex: "none", borderRadius: "50%", background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 20px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>
            {rec.initial}
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ font: "700 25px/1.2 Figtree, sans-serif", letterSpacing: "-.026em", marginBottom: 7 }}>{name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ font: "500 12.5px/1 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{rec.code}</span>
              {rec.meta.map((m) => (
                <span key={m} style={{ font: "400 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{m}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {rec.chips.map(([label, kind], i) => (
                <DotPill key={label + i} label={label} kind={kind} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "none" }}>
            {rec.actions.map(([label, kind]) => {
              const c = actionColors[kind];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => runAction(label)}
                  style={{ height: 40, padding: "0 15px", border: c.bd, borderRadius: 10, background: c.bg, color: c.fg, font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(208px,1fr))", gap: 1, background: "var(--border,#E3E9E6)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, overflow: "hidden" }}>
        {rec.tiles.map((t) => (
          <div key={t.label} style={{ background: "var(--surface,#fff)", padding: "18px 20px 17px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 13, minHeight: 26 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.accent, flex: "none", marginTop: 4 }} />
              <span style={{ font: "600 10.5px/1.25 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)" }}>{t.label}</span>
            </div>
            <div style={{ font: "600 24px/1.15 Figtree, sans-serif", letterSpacing: "-.028em", marginBottom: 7, color: t.valueFg, fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
            <div style={{ font: "400 12px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {rec.alert && (
        <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--bad-border,#F6D9D6)", borderTop: "3px solid var(--bad,#C0342B)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--bad-ink,#9B2B22)", marginBottom: 9 }}>{rec.alert.label}</div>
            <div style={{ font: "700 26px/1.1 Figtree, sans-serif", letterSpacing: "-.026em", marginBottom: 5 }}>{rec.alert.value}</div>
            <div style={{ font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{rec.alert.sub}</div>
          </div>
          <button type="button" onClick={alertAct} style={{ height: 42, padding: "0 18px", border: 0, borderRadius: 11, background: "var(--bad,#C0342B)", color: "#fff", font: "600 14px/1 Figtree, sans-serif", cursor: "pointer", flex: "none", whiteSpace: "nowrap" }}>
            {rec.alert.cta}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: rec.grid, gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {rec.left.map((s) => (
            <SectionCard key={s.h} s={s} onAdd={() => openSectionAdd(s.h, s.action)} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {rec.right.map((s) => (
            <SectionCard key={s.h} s={s} onAdd={() => openSectionAdd(s.h, s.action)} />
          ))}
        </div>
      </div>

      {editing && <DataFormModal pageKey={pageKey} editing={editing} onClose={() => setEditing(null)} />}
      {quick && <QuickModal spec={quick} onClose={() => setQuick(null)} />}
    </div>
  );
}

function SectionCard({ s, onAdd }: { s: ReturnType<typeof deriveRecord>["left"][number]; onAdd: () => void }) {
  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 15.5px/1.25 Figtree, sans-serif", letterSpacing: "-.012em" }}>{s.h}</div>
          <div style={{ marginTop: 3, font: "400 12px/1.35 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{s.sub}</div>
        </div>
        {s.hasAction && (
          <button type="button" onClick={onAdd} style={{ height: 34, padding: "0 13px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer", flex: "none", whiteSpace: "nowrap" }}>
            {s.action}
          </button>
        )}
      </div>

      {s.type === "table" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                {s.headLabels.map((h, i) => (
                  <th key={h} style={{ padding: "9px 18px", textAlign: i === 1 || i === 3 ? "right" : "left", font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((x, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
                  <td style={{ padding: "12px 18px", font: "600 13px/1.4 Figtree, sans-serif" }}>{x.a}</td>
                  <td style={{ padding: "12px 18px", textAlign: "right", font: "600 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{x.b}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <DotPill label={x.c} kind={x.pillKind} />
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "right", font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{x.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.type === "people" && (
        <div>
          {s.rows.map((x, i) => (
            <div key={i} style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: "var(--subtle,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#4A5B56)" }}>{x.mark}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13.5px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{x.b}</div>
              </div>
              <span style={{ flex: "none", font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)", whiteSpace: "nowrap" }}>{x.d}</span>
            </div>
          ))}
        </div>
      )}

      {s.type === "grid" && (
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "18px 16px" }}>
          {s.rows.map((x, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              <div style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)", marginBottom: 7 }}>{x.a}</div>
              <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{x.b}</div>
            </div>
          ))}
        </div>
      )}

      {s.type === "list" && (
        <div>
          {s.rows.length === 0 && <div style={{ padding: "18px 18px", font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>Nothing here yet.</div>}
          {s.rows.map((x, i) => (
            <div key={i} style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{x.b}</div>
              </div>
              <span style={{ flex: "none", padding: "3px 9px", borderRadius: 7, background: "var(--subtle,#EDF1EF)", font: "600 11.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#4A5B56)", whiteSpace: "nowrap" }}>{x.d}</span>
            </div>
          ))}
        </div>
      )}

      {s.type === "trail" && (
        <div style={{ padding: "16px 18px" }}>
          {s.rows.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", width: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: i === 0 ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)", flex: "none", marginTop: 4 }} />
                <span style={{ flex: 1, width: 1.5, background: "var(--border,#E3E9E6)", minHeight: 12 }} />
              </div>
              <div style={{ flex: 1, paddingBottom: 14, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 11.5px/1.3 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>{x.b}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
