import { useState } from "react";
import { useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type PaymentRecord } from "@chs/contract";
import { useUnitLookup } from "../../api/units";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { FormError, PickField, TextField } from "../../components/FormFields";
import { Blurb, FieldPair, Form, Note } from "../../components/Kit";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { inr, paiseToInput, rupeesToPaise, todayIso } from "../../lib/money";

type Mode = "CASH" | "CHEQUE" | "UPI" | "NEFT" | "IMPS" | "RTGS" | "OTHER";

const MODES: { value: Mode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
  { value: "NEFT", label: "NEFT" },
  { value: "IMPS", label: "IMPS" },
  { value: "RTGS", label: "RTGS" },
  { value: "OTHER", label: "Other" },
];

const FIELDS = ["unitId", "amountPaise", "mode", "date", "instrumentNo", "instrumentDate", "bankName", "remarks"];

/**
 * The design's "Receive payment" / "Record receipt" form, on `payments.record`.
 *
 * Cash, UPI and bank transfers are received at once and a receipt is issued;
 * a cheque is recorded as pending and only counts once it is cleared
 * (MASTER_SPEC C5). When the unit is known — opened from its record or a bill
 * — it is fixed and its dues are the suggested amount; from the collections
 * desk the admin types the unit and sees whose it is and what they owe
 * before saving.
 *
 * `payments.record` is idempotent, and `useApiMutation` sends the same
 * Idempotency-Key for the same form input until it succeeds: pressing
 * "Record" again after a timeout replays the first request on the server
 * rather than recording the receipt twice.
 */
export function RecordPaymentModal({
  societyId,
  unit,
  suggestPaise,
  onClose,
  onRecorded,
}: {
  societyId: string;
  unit?: { id: string; label: string; owner?: string | null };
  suggestPaise?: number;
  onClose: () => void;
  onRecorded?: (p: PaymentRecord) => void;
}) {
  const { toast } = useAdminStore();
  const record = useApiMutation(api.payments.record);
  const [unitText, setUnitText] = useState(unit?.label ?? "");
  const [amount, setAmount] = useState(suggestPaise && suggestPaise > 0 ? paiseToInput(suggestPaise) : "");
  const [mode, setMode] = useState<Mode>("CASH");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [amountTouched, setAmountTouched] = useState(Boolean(suggestPaise));

  const lookup = useUnitLookup(societyId, unit ? "" : unitText);
  const unitId = unit?.id ?? (lookup.status === "found" ? lookup.unit.id : null);
  const ledger = useApiQuery(api.billing.ledger, { params: { societyId, unitId: unitId ?? "" } }, { enabled: Boolean(unitId) });
  const due = ledger.data?.balancePaise ?? null;

  // The amount follows the dues of the unit just found, until the admin types their own.
  const [seededFor, setSeededFor] = useState<string | null>(unit?.id ?? null);
  if (!amountTouched && unitId && due !== null && seededFor !== unitId) {
    setSeededFor(unitId);
    setAmount(due > 0 ? paiseToInput(due) : "");
  }

  const cheque = mode === "CHEQUE";
  const cash = mode === "CASH";

  const submit = async () => {
    if (record.isPending) return;
    const errs: Record<string, string> = {};
    if (!unitId) errs.unitId = lookup.status === "missing" ? `No unit "${lookup.label}" in this society.` : "Enter the unit, for example B-0702.";
    const paise = rupeesToPaise(amount);
    if (!paise) errs.amountPaise = "Enter the amount received in rupees, for example 7259 or 7259.50.";
    if (!cash && !reference.trim()) errs.instrumentNo = cheque ? "Enter the cheque number." : "Enter the UTR or transaction reference.";
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length || !unitId || !paise) return;
    try {
      const p = await record.mutateAsync({
        params: { societyId },
        body: {
          unitId,
          amountPaise: paise,
          mode,
          date,
          instrumentNo: cash ? null : reference.trim(),
          instrumentDate: cheque && chequeDate ? chequeDate : null,
          bankName: cheque && bank.trim() ? bank.trim() : null,
          remarks: remarks.trim() || null,
        },
      });
      const label = unit?.label ?? (lookup.status === "found" ? lookup.unit.label : "");
      toast(
        p.status === "PENDING"
          ? `Cheque for ${inr(p.amountPaise)} from ${label} recorded. It counts once cleared.`
          : `Receipt ${p.receipt?.number ?? ""} issued: ${inr(p.amountPaise)} from ${label}.`,
        "ok",
      );
      onRecorded?.(p);
      onClose();
    } catch (err) {
      const split = splitError(err, FIELDS);
      setField(split.field);
      setFormError(split.form);
    }
  };

  const owner = unit?.owner ?? (lookup.status === "found" ? lookup.unit.primaryOwnerName : null);
  const unitHint =
    unit || lookup.status === "found"
      ? [owner ?? "Owner not recorded", due === null ? (ledger.isError ? "dues could not be loaded" : "checking dues…") : due > 0 ? `owes ${inr(due)}` : due < 0 ? `${inr(-due)} in advance` : "nothing due"].join(" · ")
      : lookup.status === "searching"
        ? "Looking up the unit…"
        : lookup.status === "missing"
          ? `No unit "${lookup.label}" in this society.`
          : lookup.status === "error"
            ? lookup.message
            : "Type the unit as it is on the bill.";

  const typed = rupeesToPaise(amount);
  const title = unit ? `Receive payment · ${unit.label}` : "Record receipt";

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <ModalHeader title={title} onClose={onClose} />
      <Blurb>
        {unit && owner
          ? `Posts to the ledger and reduces what ${owner} owes. A receipt is issued on save.`
          : "For cash, cheque or a bank transfer received at the office. It posts to the unit's ledger and a receipt is issued on save."}
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!unit && (
            <TextField
              label="Unit"
              req
              mono
              autoFocus
              autoComplete="off"
              value={unitText}
              onChange={(v) => setUnitText(v.toUpperCase())}
              placeholder="B-0702"
              error={field.unitId ?? (lookup.status === "missing" && unitText.trim().length >= 4 ? unitHint : undefined)}
              hint={unitHint}
            />
          )}
          {unit && <Note kind="info">{unitHint}</Note>}
          <TextField
            label="Amount"
            req
            mono
            inputMode="decimal"
            autoFocus={Boolean(unit)}
            value={amount}
            onChange={(v) => {
              setAmountTouched(true);
              setAmount(v.replace(/[^0-9.]/g, ""));
            }}
            placeholder="0.00"
            error={field.amountPaise}
            hint={due !== null && due > 0 && typed !== null && typed > due ? `More than is due — ${inr(typed - due)} will be held as advance.` : "In rupees"}
          />
          <PickField label="Method" req value={mode} options={MODES} onPick={setMode} error={field.mode} />
          <FieldPair>
            <TextField label={cheque ? "Received on" : "Date"} req type="date" value={date} onChange={setDate} error={field.date} />
            {!cash && (
              <TextField
                label={cheque ? "Cheque number" : "Reference"}
                req
                mono
                autoComplete="off"
                value={reference}
                onChange={setReference}
                placeholder={cheque ? "004128" : "UTR 402318776214"}
                error={field.instrumentNo}
              />
            )}
          </FieldPair>
          {cheque && (
            <FieldPair>
              <TextField label="Bank" value={bank} onChange={setBank} placeholder="HDFC Bank" error={field.bankName} />
              <TextField label="Cheque date" type="date" value={chequeDate} onChange={setChequeDate} error={field.instrumentDate} />
            </FieldPair>
          )}
          {cheque && <Note kind="warn">A cheque stays pending until you mark it cleared. The dues do not change until then.</Note>}
          <TextField label="Remarks" value={remarks} onChange={setRemarks} placeholder="Counter receipt 44" error={field.remarks} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={record.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={record.isPending} busyLabel="Recording…">
            {cheque ? "Record cheque" : "Receive"}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}
