import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminStore } from "../../store/AdminStore";
import { mergedRows } from "../../lib/rows";
import { deriveRecord } from "../../lib/recordDerive";
import { numFrom } from "../../lib/format";
import { DataFormModal } from "../../components/DataFormModal";
import { QuickModal } from "../../components/QuickModal";
import type { EditTarget } from "../../lib/formLogic";
import type { QuickSpec } from "../../lib/types";
import { LIST_COLS, QUICK_BLURB, QUICK_PH, QUICK_SEED } from "../../mock/record";
import { RecordAlertCard, RecordColumns, RecordHeaderCard, RecordTiles, SectionCard } from "./RecordView";

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
      <RecordHeaderCard
        initial={rec.initial}
        name={name}
        code={rec.code}
        meta={rec.meta}
        chips={rec.chips}
        actions={rec.actions.map(([label, kind]) => ({ label, kind, onClick: () => runAction(label) }))}
        onBack={() => navigate(`/${pageKey}`)}
      />

      <RecordTiles tiles={rec.tiles} />

      {rec.alert && <RecordAlertCard alert={rec.alert} onAct={alertAct} />}

      <RecordColumns
        grid={rec.grid}
        left={rec.left.map((s) => (
          <SectionCard key={s.h} s={s} onAdd={() => openSectionAdd(s.h, s.action)} />
        ))}
        right={rec.right.map((s) => (
          <SectionCard key={s.h} s={s} onAdd={() => openSectionAdd(s.h, s.action)} />
        ))}
      />

      {editing && <DataFormModal pageKey={pageKey} editing={editing} onClose={() => setEditing(null)} />}
      {quick && <QuickModal spec={quick} onClose={() => setQuick(null)} />}
    </div>
  );
}
