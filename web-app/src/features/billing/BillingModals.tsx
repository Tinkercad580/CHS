import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { useApiMutation } from "@chs/api-client/react";
import { api, type BillRecord } from "@chs/contract";
import { splitUnitLabels, useUnitsResolver } from "../../api/units";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { FormError, TextField } from "../../components/FormFields";
import { Blurb, ConfirmModal, FieldPair, Form, Note } from "../../components/Kit";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { inr, periodLabel, rupeesToPaise, todayIso } from "../../lib/money";

/**
 * Generate a draft run for a period. The server computes every bill and
 * returns the preview; the admin lands on it to review before publishing.
 * A period that already has a run is refused with that run's id, and the
 * error offers to open it.
 */
export function GenerateRunModal({ societyId, suggest, onClose }: { societyId: string; suggest: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useAdminStore();
  const create = useApiMutation(api.billing.createRun);
  const [period, setPeriod] = useState(suggest);
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);

  const submit = async () => {
    if (create.isPending) return;
    setField({});
    setFormError(null);
    setExisting(null);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      setField({ period: "Choose the month to bill." });
      return;
    }
    try {
      const run = await create.mutateAsync({ params: { societyId }, body: { period, billDate: billDate || undefined, dueDate: dueDate || undefined } });
      toast(`${periodLabel(run.period)}: ${run.billCount} draft bills computed. Review before publishing.`, "ok");
      onClose();
      navigate(`/billing/runs/${run.id}`);
    } catch (err) {
      const split = splitError(err, ["period", "billDate", "dueDate"]);
      setField(split.field);
      setFormError(split.form);
      const details = err instanceof ApiError ? (err.details as { runId?: string } | undefined) : undefined;
      if (err instanceof ApiError && err.code === "CONFLICT" && details?.runId) setExisting(details.runId);
    }
  };

  return (
    <ModalShell onClose={create.isPending ? () => undefined : onClose} maxWidth={500}>
      <ModalHeader title="Generate bills" onClose={onClose} />
      <Blurb>Computes a draft bill for every unit from the charge heads and rates in force for the month. Nothing is sent until you publish.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Period" req type="month" autoFocus value={period} onChange={setPeriod} error={field.period} hint={period ? periodLabel(period) : "The month being billed"} />
          <FieldPair>
            <TextField label="Bill date" type="date" value={billDate} onChange={setBillDate} error={field.billDate} hint="Defaults to the 1st" />
            <TextField label="Due date" type="date" value={dueDate} onChange={setDueDate} error={field.dueDate} hint="Defaults to billing setup" />
          </FieldPair>
          <FormError message={formError} />
          {existing && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/billing/runs/${existing}`);
              }}
              className="press-scale focus-ring"
              style={{ alignSelf: "flex-start", height: 34, padding: "0 13px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer" }}
            >
              Open that run
            </button>
          )}
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={create.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={create.isPending} busyLabel="Computing bills…">
            Generate
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

interface LineDraft {
  label: string;
  amount: string;
}

/**
 * A supplementary bill — a repair contribution, a penalty, an NOC fee — to
 * one unit or a list of them. The endpoint is idempotent and
 * `useApiMutation` keeps the same Idempotency-Key for the same form input
 * until it succeeds, so pressing the button again after a dropped
 * connection is replayed by the server instead of billing twice.
 */
export function AdhocBillModal({ societyId, unitLabel, onClose }: { societyId: string; unitLabel?: string; onClose: () => void }) {
  const { toast } = useAdminStore();
  const adhoc = useApiMutation(api.billing.adhocBills);
  const resolve = useUnitsResolver(societyId);
  const [units, setUnits] = useState(unitLabel ?? "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => {
    const d = new Date(`${todayIso()}T00:00:00`);
    d.setDate(d.getDate() + 15);
    return d.toLocaleDateString("en-CA");
  });
  const [lines, setLines] = useState<LineDraft[]>([{ label: "", amount: "" }]);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const busy = resolving || adhoc.isPending;

  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((cur) => cur.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (busy) return;
    const errs: Record<string, string> = {};
    const labels = splitUnitLabels(units);
    if (!labels.length) errs.unitIds = "Enter at least one unit, for example A-0101.";
    const body = lines.map((l, i) => {
      const paise = rupeesToPaise(l.amount);
      if (l.label.trim().length < 2) errs[`lines.${i}.label`] = "Say what this is for.";
      if (!paise) errs[`lines.${i}.amountPaise`] = "Enter an amount in rupees.";
      return { label: l.label.trim(), amountPaise: paise ?? 0 };
    });
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setResolving(true);
    try {
      const { found, missing } = await resolve(labels);
      if (missing.length) {
        setField({ unitIds: `Not a unit in this society: ${missing.join(", ")}.` });
        return;
      }
      setResolving(false);
      const res = await adhoc.mutateAsync({ params: { societyId }, body: { unitIds: found.map((u) => u.id), title: title.trim(), dueDate: due, lines: body } });
      toast(`${res.created} supplementary bill${res.created === 1 ? "" : "s"} issued.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["unitIds", "title", "dueDate", ...lines.flatMap((_, i) => [`lines.${i}.label`, `lines.${i}.amountPaise`])]);
      setField(split.field);
      setFormError(split.form);
    } finally {
      setResolving(false);
    }
  };

  const total = lines.reduce((s, l) => s + (rupeesToPaise(l.amount) ?? 0), 0);
  const count = splitUnitLabels(units).length;

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={560}>
      <ModalHeader title={unitLabel ? `Add charge · ${unitLabel}` : "Supplementary bill"} onClose={onClose} />
      <Blurb>A bill outside the monthly run — a repair contribution, a penalty, an NOC fee. It is numbered and posted to each unit's ledger at once, and the resident is notified.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!unitLabel && (
            <TextField label="Units" req mono multiline autoFocus value={units} onChange={(v) => setUnits(v.toUpperCase())} placeholder="A-0101, A-0102" error={field.unitIds} hint="Separate units with commas or spaces" />
          )}
          <TextField label="Title" req autoFocus={Boolean(unitLabel)} value={title} onChange={setTitle} placeholder="Terrace waterproofing contribution" error={field.title} />
          {lines.map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) auto", gap: 10, alignItems: "start" }}>
              <TextField label={lines.length > 1 ? `Line ${i + 1}` : "Line"} req value={l.label} onChange={(v) => setLine(i, { label: v })} placeholder="Contribution" error={field[`lines.${i}.label`]} />
              <TextField label="Amount" req mono inputMode="decimal" value={l.amount} onChange={(v) => setLine(i, { amount: v.replace(/[^0-9.]/g, "") })} placeholder="0.00" error={field[`lines.${i}.amountPaise`]} />
              <button
                type="button"
                title="Remove line"
                aria-label={`Remove line ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}
                className="press-scale focus-ring"
                style={{ marginTop: 26, width: 40, height: 46, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 11, background: "var(--surface,#fff)", cursor: lines.length === 1 ? "default" : "pointer", opacity: lines.length === 1 ? 0.4 : 1, color: "var(--ink-soft,#5A6B66)" }}
              >
                ×
              </button>
            </div>
          ))}
          {lines.length < 20 && (
            <button type="button" onClick={() => setLines((cur) => [...cur, { label: "", amount: "" }])} className="focus-ring" style={{ alignSelf: "flex-start", border: 0, background: "transparent", padding: 0, font: "600 13px/1.3 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)", cursor: "pointer" }}>
              + Add a line
            </button>
          )}
          <TextField label="Due date" req type="date" value={due} onChange={setDue} error={field.dueDate} />
          {total > 0 && (
            <Note kind="info">
              {inr(total)} per unit{count > 1 ? ` × ${count} units = ${inr(total * count)}` : ""}
            </Note>
          )}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel={resolving ? "Checking units…" : "Issuing…"}>
            Issue bill{count > 1 ? "s" : ""}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** A credit note — a waiver or a correction — against a unit, optionally tied to one bill. The reason is recorded on the ledger line. */
export function CreditNoteModal({ societyId, unit, bill, onClose }: { societyId: string; unit: { id: string; label: string }; bill?: Pick<BillRecord, "id" | "number" | "balancePaise">; onClose: () => void }) {
  const { toast } = useAdminStore();
  const credit = useApiMutation(api.billing.creditNote);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (credit.isPending) return;
    const paise = rupeesToPaise(amount);
    const errs: Record<string, string> = {};
    if (!paise) errs.amountPaise = "Enter the amount to credit, in rupees.";
    if (reason.trim().length < 5) errs.reason = "Say why — it is printed on the ledger.";
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length || !paise) return;
    try {
      const cn = await credit.mutateAsync({ params: { societyId, unitId: unit.id }, body: { amountPaise: paise, reason: reason.trim(), billId: bill?.id ?? null } });
      toast(`Credit note ${cn.number} for ${inr(cn.amountPaise)} issued to ${unit.label}.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["amountPaise", "reason", "billId"]);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={credit.isPending ? () => undefined : onClose} maxWidth={500}>
      <ModalHeader title={`Credit note · ${unit.label}`} onClose={onClose} />
      <Blurb>
        Reduces what the unit owes — a waiver the committee approved, or a correction.{bill?.number ? ` It is set against bill ${bill.number}.` : ""} It cannot be deleted afterwards.
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Amount" req mono autoFocus inputMode="decimal" value={amount} onChange={(v) => setAmount(v.replace(/[^0-9.]/g, ""))} placeholder="0.00" error={field.amountPaise} hint={bill && bill.balancePaise > 0 ? `${inr(bill.balancePaise)} is unpaid on this bill` : "In rupees"} />
          <TextField label="Reason" req multiline value={reason} onChange={setReason} placeholder="Interest waived — committee resolution 14 Sep" error={field.reason} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={credit.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={credit.isPending} busyLabel="Issuing…">
            Issue credit note
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** Cancelling reverses the bill in the ledger; it is only offered while nothing has been paid against it. */
export function CancelBillModal({ societyId, bill, onClose }: { societyId: string; bill: BillRecord; onClose: () => void }) {
  const { toast } = useAdminStore();
  const cancel = useApiMutation(api.billing.cancelBill);
  const [reason, setReason] = useState("");
  const [field, setField] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (cancel.isPending) return;
    if (reason.trim().length < 5) {
      setField("Give the reason, in at least a few words.");
      return;
    }
    setField(undefined);
    setError(null);
    try {
      await cancel.mutateAsync({ params: { societyId, billId: bill.id }, body: { reason: reason.trim() } });
      toast(`Bill ${bill.number ?? ""} cancelled and reversed in the ledger.`, "warn");
      onClose();
    } catch (err) {
      const split = splitError(err, ["reason"]);
      setField(split.field.reason);
      setError(split.form);
    }
  };

  return (
    <ConfirmModal
      title={`Cancel bill ${bill.number ?? ""}?`}
      body={`${inr(bill.totalPaise)} for ${bill.unitLabel} is reversed in the ledger. The bill stays on record as cancelled; issue a corrected one afterwards if needed.`}
      confirm="Cancel bill"
      busyLabel="Cancelling…"
      cancelLabel="Keep bill"
      tone="bad"
      busy={cancel.isPending}
      error={error}
      reason={{ label: "Reason", value: reason, onChange: setReason, error: field, placeholder: "Wrong carpet area used" }}
      onConfirm={() => void submit()}
      onClose={onClose}
    />
  );
}
