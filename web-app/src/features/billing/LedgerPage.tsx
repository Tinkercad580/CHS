import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type SocietyMembership } from "@chs/contract";
import type { z } from "zod";
import { holds } from "../../api/society";
import { LiveStatGrid } from "../../components/ApiTable";
import { CardHead, Crumbs, DataTable } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle } from "../../lib/uiStyles";
import { TextField } from "../../components/FormFields";
import { formatDate } from "../../lib/apiFormat";
import { inr } from "../../lib/money";
import { primaryBtnStyle, rowProps, secondaryBtnStyle } from "../../lib/tableKit";
import { RecordPaymentModal } from "../payments/RecordPaymentModal";
import { BillingGuard } from "./BillingShell";
import { AdhocBillModal, CreditNoteModal } from "./BillingModals";

type Entry = z.infer<typeof schemas.billing.LedgerEntry>;

const COLS = [
  { label: "Date", align: "left" as const },
  { label: "Particulars", align: "left" as const },
  { label: "Debit", align: "right" as const },
  { label: "Credit", align: "right" as const },
  { label: "Balance", align: "right" as const },
];

const KIND: Record<string, string> = { OPENING: "Opening balance", BILL: "Bill", PAYMENT: "Payment", CREDIT_NOTE: "Credit note", REVERSAL: "Reversal", ADVANCE_APPLIED: "Advance applied" };

/**
 * A unit's ledger with its running balance (`billing.ledger`): every bill,
 * payment, credit note and reversal, oldest first as a passbook reads.
 * Bills and payments open their own records.
 */
export function LedgerPage({ unitId }: { unitId: string }) {
  return <BillingGuard>{(s) => <UnitLedger society={s} unitId={unitId} />}</BillingGuard>;
}

function UnitLedger({ society, unitId }: { society: SocietyMembership; unitId: string }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modal, setModal] = useState<"pay" | "charge" | "credit" | null>(null);
  const valid = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const ledger = useApiQuery(api.billing.ledger, { params: { societyId, unitId }, query: { from: valid(from), to: valid(to) } });
  const state = toLoadState(ledger);
  const data = ledger.data;
  const label = data?.unitLabel ?? "Unit";

  if (state.status === "error" && ledger.error instanceof ApiError && ledger.error.code === "NOT_FOUND") {
    return (
      <div style={{ ...cardStyle, padding: 22 }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>This unit could not be found</div>
        <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 14 }}>It may belong to another society.</div>
        <button type="button" onClick={() => navigate("/members")} className="press-scale focus-ring" style={secondaryBtnStyle}>
          Members & units
        </button>
      </div>
    );
  }

  const due = data?.balancePaise ?? 0;
  const entries = data?.entries ?? [];
  const debits = entries.reduce((s, e) => s + e.debitPaise, 0);
  const credits = entries.reduce((s, e) => s + e.creditPaise, 0);
  const v = (x: string) => (data ? x : state.status === "error" ? "—" : null);
  const stats = [
    { label: "Balance due", value: v(due > 0 ? inr(due) : "Nil"), note: due > 0 ? "Owed by the unit" : "Nothing outstanding", fg: due > 0 ? "var(--bad,#C0342B)" : undefined },
    { label: "Advance", value: v(inr(data?.advancePaise ?? 0)), note: "Set against the next bills" },
    { label: "Billed", value: v(inr(debits)), note: from || to ? "In the dates shown" : "Since the first entry" },
    { label: "Received & credited", value: v(inr(credits)), note: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}` },
  ];

  const canPay = holds(society, "payments.record");
  const canPublish = holds(society, "billing.publish");

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <Crumbs items={[{ label: "Members & units", to: "/members" }, { label: label, to: `/members/record/${unitId}` }, { label: "Ledger" }]} />
          <h1 style={{ margin: 0, font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>Ledger · {label}</h1>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {canPublish && (
            <button type="button" onClick={() => setModal("credit")} disabled={!data} className="press-scale focus-ring" style={secondaryBtnStyle}>
              Credit note
            </button>
          )}
          {canPublish && (
            <button type="button" onClick={() => setModal("charge")} disabled={!data} className="press-scale focus-ring" style={secondaryBtnStyle}>
              Add charge
            </button>
          )}
          {canPay && (
            <button type="button" onClick={() => setModal("pay")} disabled={!data} className="press-scale focus-ring" style={primaryBtnStyle}>
              Record payment
            </button>
          )}
        </div>
      </div>

      <LiveStatGrid stats={stats} />

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHead
          title="Entries"
          sub="Debit is owed by the unit; credit is paid or waived"
          right={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ width: 170 }}>
                <TextField label="From" type="date" value={from} onChange={setFrom} />
              </div>
              <div style={{ width: 170 }}>
                <TextField label="To" type="date" value={to} onChange={setTo} />
              </div>
            </div>
          }
        />
        <DataTable<Entry>
          cols={COLS}
          rows={state.status === "ready" ? { status: "ready", data: state.data.entries } : state}
          skeletonRows={8}
          empty={from || to ? "No entries between those dates." : "Nothing has been billed or paid on this unit yet."}
          renderRow={(e) => {
            const to = e.refType === "bill" ? `/billing/bills/${e.refId}` : e.refType === "payment" ? `/payments/record/${e.refId}` : null;
            const props = to ? rowProps(() => navigate(to)) : { style: { borderTop: "1px solid var(--border-soft,#F1F4F3)" } };
            return (
              <tr key={e.id} {...props}>
                <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{formatDate(e.date)}</td>
                <td style={cellStyle()}>
                  <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{e.narration}</div>
                  <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>{KIND[e.kind] ?? e.kind}</div>
                </td>
                <td style={cellStyle("right", amountCell)}>{e.debitPaise ? inr(e.debitPaise) : ""}</td>
                <td style={cellStyle("right", { ...amountCell, color: "var(--ok,#167A3C)" })}>{e.creditPaise ? inr(e.creditPaise) : ""}</td>
                <td style={cellStyle("right", { ...amountCell, color: e.balancePaise > 0 ? "var(--ink,#0F1A17)" : "var(--ink-soft,#5A6B66)" })}>
                  {e.balancePaise < 0 ? `${inr(-e.balancePaise)} Cr` : inr(e.balancePaise)}
                </td>
              </tr>
            );
          }}
        />
      </div>

      {modal === "pay" && data && <RecordPaymentModal societyId={societyId} unit={{ id: unitId, label }} suggestPaise={due} onClose={() => setModal(null)} />}
      {modal === "charge" && data && <AdhocBillModal societyId={societyId} unitLabel={label} onClose={() => setModal(null)} />}
      {modal === "credit" && data && <CreditNoteModal societyId={societyId} unit={{ id: unitId, label }} onClose={() => setModal(null)} />}
    </div>
  );
}
