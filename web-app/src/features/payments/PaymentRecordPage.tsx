import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type PaymentRecord, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { CardHead, ConfirmModal, DataTable, RetryButton } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle, rowBorder } from "../../lib/uiStyles";
import { formatDate, formatDateTime } from "../../lib/apiFormat";
import { inr } from "../../lib/money";
import { BUCKET_LABEL, MODE_LABEL, paymentPill } from "../../lib/moneyLabels";
import { useBack } from "../../lib/nav";
import { rowProps } from "../../lib/tableKit";
import type { PillKind } from "../../lib/types";
import { splitError } from "../../lib/apiErrors";
import { useAdminStore } from "../../store/AdminStore";
import { RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard, type RecordAction } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";

type Modal = "clear" | "bounce" | "cancel" | null;

/**
 * One payment (`payments.get`): its receipt, how it was allocated — interest
 * first, then the oldest bills, the rest held as advance — and the actions
 * its state allows: clear or bounce a cheque, cancel a receipt.
 */
export function PaymentRecordPage({ paymentId }: { paymentId: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Payments & reconciliation" />;
  if (!holds(society, "payments.record", "accounts.manage", "billing.publish")) return <NoAccess title="Payments & reconciliation" need="payments.record" />;
  return <PaymentLoader society={society} paymentId={paymentId} />;
}

function PaymentLoader({ society, paymentId }: { society: SocietyMembership; paymentId: string }) {
  const back = useBack("/payments");
  const q = useApiQuery(api.payments.get, { params: { societyId: society.societyId, paymentId } });
  const state = toLoadState(q);
  if (state.status === "loading") return <RecordSkeleton />;
  if (state.status === "error") {
    const missing = q.error instanceof ApiError && q.error.code === "NOT_FOUND";
    return <RecordMessage title={missing ? "This payment could not be found" : state.message} body={missing ? "It may belong to another society." : "Nothing was changed."} onBack={back} action={missing ? undefined : <RetryButton onClick={state.retry} />} />;
  }
  return <PaymentView society={society} p={state.data} onBack={back} />;
}

function PaymentView({ society, p, onBack }: { society: SocietyMembership; p: PaymentRecord; onBack: () => void }) {
  const navigate = useNavigate();
  const { toast } = useAdminStore();
  const societyId = society.societyId;
  const params = { societyId, paymentId: p.id };
  const [modal, setModal] = useState<Modal>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const cheque = useApiMutation(api.payments.chequeAction);
  const cancel = useApiMutation(api.payments.cancelReceipt);
  const canRecord = holds(society, "payments.record");

  const pill = paymentPill(p);
  const pendingCheque = p.status === "PENDING" && p.mode === "CHEQUE";
  const cancellable = p.status === "SUCCESS" && p.receipt?.status === "ISSUED";

  const close = () => {
    setModal(null);
    setReason("");
    setReasonError(undefined);
    setError(null);
  };

  const doCheque = async (action: "clear" | "bounce") => {
    setError(null);
    try {
      const r = await cheque.mutateAsync({ params, body: { action, reason: reason.trim() || undefined } });
      toast(action === "clear" ? `Cheque cleared. Receipt ${r.receipt?.number ?? ""} issued.` : "Cheque marked bounced. The dues are unchanged.", action === "clear" ? "ok" : "warn");
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };
  const doCancel = async () => {
    if (reason.trim().length < 5) {
      setReasonError("Give the reason, in at least a few words.");
      return;
    }
    setReasonError(undefined);
    setError(null);
    try {
      await cancel.mutateAsync({ params, body: { reason: reason.trim() } });
      toast(`Receipt ${p.receipt?.number ?? ""} cancelled. ${inr(p.amountPaise)} is due again from ${p.unitLabel}.`, "warn");
      close();
    } catch (err) {
      const split = splitError(err, ["reason"]);
      setReasonError(split.field.reason);
      setError(split.form);
    }
  };

  const actions: RecordAction[] = [];
  if (pendingCheque && canRecord) {
    actions.push({ label: "Mark cleared", kind: "primary", onClick: () => setModal("clear") });
    actions.push({ label: "Mark bounced", kind: "warn", onClick: () => setModal("bounce") });
  }
  actions.push({ label: "Unit ledger", kind: "ghost", onClick: () => navigate(`/billing/ledger/${p.unitId}`) });
  if (cancellable && canRecord) actions.push({ label: "Cancel receipt", kind: "warn", onClick: () => setModal("cancel") });

  const chips: [string, PillKind][] = [
    [pill.label, pill.kind],
    [MODE_LABEL[p.mode], "info"],
    ...(p.receipt?.status === "CANCELLED" ? ([["Receipt cancelled", "bad"]] as [string, PillKind][]) : []),
  ];

  const billCount = new Set(p.allocations.filter((a) => a.billId).map((a) => a.billId)).size;
  const toBills = p.allocations.filter((a) => a.bucket !== "ADVANCE").reduce((s, a) => s + a.amountPaise, 0);
  const advance = p.allocations.filter((a) => a.bucket === "ADVANCE").reduce((s, a) => s + a.amountPaise, 0);
  const tiles = [
    tile("Amount", inr(p.amountPaise), `${MODE_LABEL[p.mode]}${p.instrumentNo ? ` · ${p.instrumentNo}` : ""}`, "var(--accent,#0E6B5C)"),
    tile("Against bills", inr(toBills), billCount ? `${billCount} bill${billCount === 1 ? "" : "s"}` : "No bill yet", "var(--ok,#167A3C)"),
    tile("Held as advance", inr(advance), advance ? "Set against the next bill" : "Nothing left over", "var(--info,#1D4ED8)"),
    tile("Status", pill.label, p.status === "PENDING" ? "Counts once cleared" : p.failureReason ?? (p.paidAt ? `Paid ${formatDate(p.paidAt)}` : `Recorded ${formatDate(p.createdAt)}`), pill.kind === "bad" ? "var(--bad,#C0342B)" : pill.kind === "warn" ? "var(--warn,#B45309)" : "var(--ink-muted,#8A9995)"),
  ];

  const details = section({
    h: "Payment details",
    type: "grid",
    rows: [
      ["Receipt no.", p.receipt?.number ?? (p.status === "PENDING" ? "Issued when cleared" : "—")],
      ["Unit", p.unitLabel],
      ["Mode", MODE_LABEL[p.mode]],
      ["Reference", p.instrumentNo ?? "—"],
      ["Bank", p.bankName ?? "—"],
      ["Paid on", p.paidAt ? formatDate(p.paidAt) : "—"],
      ["Recorded", formatDateTime(p.createdAt)],
      ["Gateway", p.gateway ?? "Office"],
      ...(p.remarks ? [["Remarks", p.remarks]] : []),
      ...(p.failureReason ? [["Failure", p.failureReason]] : []),
      ...(p.receipt?.cancelReason ? [["Cancelled because", p.receipt.cancelReason]] : []),
    ],
  });

  const busy = cheque.isPending || cancel.isPending;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <RecordHeaderCard
        initial="₹"
        name={`${inr(p.amountPaise)} from ${p.unitLabel}`}
        code={p.receipt?.number ?? "No receipt yet"}
        meta={[MODE_LABEL[p.mode], formatDate(p.paidAt ?? p.createdAt), ...(p.instrumentNo ? [p.instrumentNo] : [])]}
        chips={chips}
        actions={actions}
        onBack={onBack}
      />
      <RecordTiles tiles={tiles} />
      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <CardHead title="Allocation" sub="Interest first, then the oldest bills; anything over is held as advance" />
            <DataTable
              cols={[{ label: "Bill" }, { label: "Towards" }, { label: "Amount", align: "right" }]}
              rows={{ status: "ready", data: p.allocations }}
              minWidth={420}
              empty={p.status === "PENDING" ? "Allocated when the cheque clears." : p.status === "REVERSED" ? "The allocation was reversed when the receipt was cancelled." : "Nothing allocated."}
              renderRow={(a, i) => {
                const props = a.billId ? rowProps(() => navigate(`/billing/bills/${a.billId}`)) : { style: rowBorder };
                return (
                  <tr key={`${a.billId}-${a.bucket}-${i}`} {...props}>
                    <td style={cellStyle("left", { font: "500 12.5px/1.4 'IBM Plex Mono',monospace" })}>{a.billNumber ?? (a.bucket === "ADVANCE" ? "Advance" : "—")}</td>
                    <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{BUCKET_LABEL[a.bucket]}</td>
                    <td style={cellStyle("right", amountCell)}>{inr(a.amountPaise)}</td>
                  </tr>
                );
              }}
            />
          </div>
        }
        right={<SectionCard s={details} />}
      />

      {modal === "clear" && (
        <ConfirmModal
          title={`Mark cheque ${p.instrumentNo ?? ""} cleared?`}
          body={`${inr(p.amountPaise)} is credited to ${p.unitLabel}, set against its dues, and a receipt is issued.`}
          confirm="Mark cleared"
          busyLabel="Clearing…"
          busy={busy}
          error={error}
          onConfirm={() => void doCheque("clear")}
          onClose={close}
        />
      )}
      {modal === "bounce" && (
        <ConfirmModal
          title={`Mark cheque ${p.instrumentNo ?? ""} bounced?`}
          body={`Nothing is credited. ${p.unitLabel} still owes what it did before.`}
          confirm="Mark bounced"
          busyLabel="Saving…"
          tone="bad"
          busy={busy}
          error={error}
          reason={{ label: "Reason", value: reason, onChange: setReason, placeholder: "Insufficient funds", optional: true }}
          onConfirm={() => void doCheque("bounce")}
          onClose={close}
        />
      )}
      {modal === "cancel" && (
        <ConfirmModal
          title={`Cancel receipt ${p.receipt?.number ?? ""}?`}
          body={`The payment is reversed in the ledger — not deleted — and ${inr(p.amountPaise)} is due again from ${p.unitLabel}. The receipt stays on record as cancelled.`}
          confirm="Cancel receipt"
          busyLabel="Cancelling…"
          cancelLabel="Keep receipt"
          tone="bad"
          busy={busy}
          error={error}
          reason={{ label: "Reason", value: reason, onChange: setReason, error: reasonError, placeholder: "Entered against the wrong unit" }}
          onConfirm={() => void doCancel()}
          onClose={close}
        />
      )}
    </div>
  );
}
