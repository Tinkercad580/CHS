import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiInfiniteQuery, useApiQuery } from "@chs/api-client/react";
import { api, type BillRecord, type SocietyMembership } from "@chs/contract";
import { holds } from "../../api/society";
import { useBack } from "../../lib/nav";
import { CardHead, DataTable, RetryButton } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle, rowBorder } from "../../lib/uiStyles";
import { formatDate, formatDateTime } from "../../lib/apiFormat";
import { inr, periodLabel } from "../../lib/money";
import { BILL_STATE, BUCKET_LABEL, MODE_LABEL, paymentPill } from "../../lib/moneyLabels";
import type { PillKind } from "../../lib/types";
import { failed, loading, ready, type LoadState } from "../../lib/loadState";
import { RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard, type RecordAction } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";
import { RecordPaymentModal } from "../payments/RecordPaymentModal";
import { BillingGuard } from "./BillingShell";
import { CancelBillModal, CreditNoteModal } from "./BillingModals";

type Modal = "pay" | "credit" | "cancel" | null;

/**
 * One bill (`billing.bill`): the head-wise lines with the basis the engine
 * printed for each, the totals, and the receipts allocated against it.
 * Cancel is offered only while nothing has been paid; payments and credit
 * notes post against the unit.
 */
export function BillRecordPage({ billId }: { billId: string }) {
  return <BillingGuard>{(s) => <BillRecordLoader society={s} billId={billId} />}</BillingGuard>;
}

function BillRecordLoader({ society, billId }: { society: SocietyMembership; billId: string }) {
  const back = useBack("/billing/bills");
  const bill = useApiQuery(api.billing.bill, { params: { societyId: society.societyId, billId } });
  const state = toLoadState(bill);
  if (state.status === "loading") return <RecordSkeleton />;
  if (state.status === "error") {
    const missing = bill.error instanceof ApiError && bill.error.code === "NOT_FOUND";
    return (
      <RecordMessage
        title={missing ? "This bill could not be found" : state.message}
        body={missing ? "It may belong to another society, or it was a draft that has been discarded." : "Nothing was changed."}
        onBack={back}
        action={missing ? undefined : <RetryButton onClick={state.retry} />}
      />
    );
  }
  return <BillView society={society} bill={state.data} onBack={back} />;
}

const LINE_COLS = [
  { label: "Head", align: "left" as const },
  { label: "Basis", align: "left" as const },
  { label: "Amount", align: "right" as const },
];

function BillView({ society, bill, onBack }: { society: SocietyMembership; bill: BillRecord; onBack: () => void }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [modal, setModal] = useState<Modal>(null);
  const canPay = holds(society, "payments.record");
  const canPublish = holds(society, "billing.publish");
  const canPayments = holds(society, "payments.record", "accounts.manage", "billing.publish");
  // Every payment of the unit, page by page (200 at a time), then the ones with an allocation to this
  // bill. The list has no bill filter, and a bill can be paid long after it was issued, so stopping at
  // the latest page would miss older receipts on a unit with a long history.
  const payments = useApiInfiniteQuery(api.payments.list, { params: { societyId }, query: { unitId: bill.unitId, limit: 200 } }, { enabled: canPayments });
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError: paymentsFailed } = payments;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !paymentsFailed) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, paymentsFailed, fetchNextPage]);
  const paymentsLoad: LoadState<null> =
    payments.status === "error" ? failed(payments.error.message, () => void payments.refetch()) : payments.status === "pending" || hasNextPage ? loading() : ready(null);
  const against = payments.items.filter((p) => p.allocations.some((a) => a.billId === bill.id));

  const st = BILL_STATE[bill.paymentState];
  const published = bill.status === "PUBLISHED";
  const unpaid = published && bill.paidPaise === 0;

  const actions: RecordAction[] = [];
  if (published && bill.balancePaise > 0 && canPay) actions.push({ label: "Record payment", kind: "primary", onClick: () => setModal("pay") });
  actions.push({ label: "Unit ledger", kind: "ghost", onClick: () => navigate(`/billing/ledger/${bill.unitId}`) });
  if (published && canPublish) actions.push({ label: "Credit note", kind: "ghost", onClick: () => setModal("credit") });
  if (unpaid && canPublish) actions.push({ label: "Cancel bill", kind: "warn", onClick: () => setModal("cancel") });

  const chips: [string, PillKind][] = [
    [st.label, st.kind],
    ...(bill.kind === "SUPPLEMENTARY" ? ([["Supplementary", "info"]] as [string, PillKind][]) : []),
    [`FY ${bill.fy}`, "mute"],
  ];

  const overdue = bill.paymentState === "OVERDUE";
  const tiles = [
    tile("Bill total", inr(bill.totalPaise), `${inr(bill.principalPaise)} charges${bill.interestPaise ? ` · ${inr(bill.interestPaise)} interest` : ""}${bill.gstPaise ? ` · ${inr(bill.gstPaise)} GST` : ""}`, "var(--accent,#0E6B5C)"),
    tile("Paid", inr(bill.paidPaise), against.length ? `${against.length} receipt${against.length === 1 ? "" : "s"}` : bill.paidPaise ? "From advance or credit" : "Nothing received yet", "var(--ok,#167A3C)"),
    tile("Balance", bill.balancePaise > 0 ? inr(bill.balancePaise) : "Nil", bill.status === "CANCELLED" ? "Cancelled" : bill.balancePaise > 0 ? `Due ${formatDate(bill.dueDate)}` : "Settled", bill.balancePaise > 0 ? (overdue ? "var(--bad,#C0342B)" : "var(--warn,#B45309)") : "var(--ink-muted,#8A9995)"),
    tile("Arrears carried", bill.arrearsPaise ? inr(bill.arrearsPaise) : "None", "Unpaid from earlier bills, shown for reference", bill.arrearsPaise ? "var(--warn,#B45309)" : "var(--ink-muted,#8A9995)"),
  ];

  const details = section({
    h: "Bill details",
    type: "grid",
    rows: [
      ["Bill no.", bill.number ?? "Not numbered (draft)"],
      ["Unit", bill.unitLabel],
      ["Payer", bill.payerName ?? "—"],
      ["Period", periodLabel(bill.period)],
      ["Bill date", formatDate(bill.billDate)],
      ["Due date", formatDate(bill.dueDate)],
      ["Published", bill.publishedAt ? formatDateTime(bill.publishedAt) : "—"],
      ["Kind", bill.kind === "SUPPLEMENTARY" ? "Supplementary" : "Regular"],
      ...(bill.cancelReason ? [["Cancelled because", bill.cancelReason]] : []),
    ],
  });

  const receipts = section({
    h: "Receipts against this bill",
    sub: against.length ? `${against.length} payment${against.length === 1 ? "" : "s"}` : "None yet",
    type: "list",
    rows: against.map((p) => {
      const share = p.allocations.filter((a) => a.billId === bill.id).reduce((s, a) => s + a.amountPaise, 0);
      const buckets = [...new Set(p.allocations.filter((a) => a.billId === bill.id).map((a) => BUCKET_LABEL[a.bucket]))].join(" + ");
      return [p.receipt?.number ?? "No receipt yet", `${inr(share)} to ${buckets.toLowerCase()} · ${MODE_LABEL[p.mode]} · ${formatDate(p.paidAt ?? p.createdAt)}`, paymentPill(p).label];
    }),
    empty: canPayments ? "No payment has been allocated to this bill." : "Receipts need the payments.record permission.",
  });

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <RecordHeaderCard
        initial="₹"
        name={bill.title}
        code={bill.number ?? "Draft"}
        meta={[`Unit ${bill.unitLabel}`, ...(bill.payerName ? [bill.payerName] : []), `Due ${formatDate(bill.dueDate)}`]}
        chips={chips}
        actions={actions}
        onBack={onBack}
      />
      <RecordTiles tiles={tiles} />
      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <CardHead title="Head-wise breakup" sub="Each line shows how it was worked out" />
            <DataTable
              cols={LINE_COLS}
              rows={{ status: "ready", data: bill.lines }}
              minWidth={480}
              empty="This bill has no lines."
              renderRow={(l, i) => (
                <tr key={`${l.code}-${i}`} style={rowBorder}>
                  <td style={cellStyle("left")}>
                    <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{l.label}</div>
                    <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-muted,#8A9995)" }}>{l.method ?? l.kind}</div>
                  </td>
                  <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", font: "400 12.5px/1.45 Figtree, sans-serif" })}>
                    {l.basis}
                    {l.ruleRef && <div style={{ marginTop: 2, color: "var(--ink-muted,#8A9995)", font: "400 11.5px/1.4 Figtree, sans-serif" }}>{l.ruleRef}</div>}
                  </td>
                  <td style={cellStyle("right", amountCell)}>{inr(l.amountPaise)}</td>
                </tr>
              )}
              foot={
                <>
                  <TotalRow label="Bill total" value={inr(bill.totalPaise)} strong />
                  {bill.paidPaise > 0 && <TotalRow label="Paid" value={`− ${inr(bill.paidPaise)}`} />}
                  {bill.paidPaise > 0 && <TotalRow label="Balance" value={inr(bill.balancePaise)} strong />}
                </>
              }
            />
          </div>
        }
        right={
          <>
            <SectionCard s={details} />
            <SectionCard s={receipts} load={canPayments ? paymentsLoad : undefined} rowAction={(i) => ({ label: "Open", onClick: () => navigate(`/payments/record/${against[i].id}`) })} />
          </>
        }
      />

      {modal === "pay" && <RecordPaymentModal societyId={societyId} unit={{ id: bill.unitId, label: bill.unitLabel, owner: bill.payerName }} suggestPaise={bill.balancePaise} onClose={() => setModal(null)} />}
      {modal === "credit" && <CreditNoteModal societyId={societyId} unit={{ id: bill.unitId, label: bill.unitLabel }} bill={bill} onClose={() => setModal(null)} />}
      {modal === "cancel" && <CancelBillModal societyId={societyId} bill={bill} onClose={() => setModal(null)} />}
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr style={{ borderTop: "1px solid var(--border-soft,#EDF1EF)", background: strong ? "var(--canvas,#F7F9F8)" : undefined }}>
      <td colSpan={2} style={cellStyle("left", { font: `${strong ? 700 : 500} 13.5px/1.4 Figtree, sans-serif` })}>
        {label}
      </td>
      <td style={cellStyle("right", { ...amountCell, fontWeight: strong ? 700 : 600 })}>{value}</td>
    </tr>
  );
}
