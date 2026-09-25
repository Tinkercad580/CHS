import { useState } from "react";
import { useApiMutation } from "@chs/api-client/react";
import { api, schemas, type ApportionmentMethod, type ChargeCategory, type ChargeHead } from "@chs/contract";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { CheckField, FormError, PickField, SelectField, TextField } from "../../components/FormFields";
import { Blurb, FieldPair, Form, Note } from "../../components/Kit";
import { useAdminStore } from "../../store/AdminStore";
import { useUnitResolver } from "../../api/units";
import { splitError } from "../../lib/apiErrors";
import { formatDate } from "../../lib/apiFormat";
import { RATE_FIELD_UNIT, inr, rateFromInput, rateKind, rateLabel, rateToInput, rupeesToPaise, paiseToInput, todayIso, wireRateUnit } from "../../lib/money";
import { CATEGORY_LABEL, METHOD_LABEL, needsResolution } from "../../lib/moneyLabels";

const { ALLOWED_METHODS, CHARGE_CATEGORIES } = schemas.billing;

/** "Terrace repair levy" -> "TERRACE_REPAIR" — a suggestion the admin can change; the server enforces 2–20 of A–Z, 0–9, _. */
function codeFrom(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20)
    .replace(/_+$/, "");
}

/**
 * Add a charge head. The category comes first because it decides everything
 * else: the apportionment methods offered are exactly the ones Rule
 * 106C-12(3) allows for it (`ALLOWED_METHODS`), a percentage head needs the
 * head it is a percentage of, and a general-body head needs its resolution.
 * The rate is set next, in its own dated step.
 */
export function CreateHeadModal({ societyId, heads, onClose, onCreated }: { societyId: string; heads: ChargeHead[]; onClose: () => void; onCreated: (h: ChargeHead) => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.billing.createHead);
  const [category, setCategory] = useState<ChargeCategory | "">("");
  const [method, setMethod] = useState<ApportionmentMethod | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [baseHeadId, setBaseHeadId] = useState("");
  const [gst, setGst] = useState(false);
  const [meetingRef, setMeetingRef] = useState("");
  const [resolvedOn, setResolvedOn] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const allowed = category ? ALLOWED_METHODS[category] : [];
  const pickCategory = (c: ChargeCategory) => {
    setCategory(c);
    const m = ALLOWED_METHODS[c];
    setMethod(m.length === 1 ? m[0] : null);
    if (!name.trim()) setName(CATEGORY_LABEL[c]);
    if (!codeTouched && !name.trim()) setCode(codeFrom(CATEGORY_LABEL[c]));
    setBaseHeadId("");
  };
  // Non-occupancy is a percentage of service charges only (Rule 106C-12); other percentage heads can be of any non-percentage head.
  const bases = heads.filter((h) => h.method !== "PERCENT_OF_HEAD" && h.active && (category !== "NON_OCCUPANCY" || h.category === "SERVICE"));
  const wantsResolution = category ? needsResolution(category) : false;

  const submit = async () => {
    if (create.isPending) return;
    const errs: Record<string, string> = {};
    if (!category) errs.category = "Choose what kind of charge this is.";
    if (!method) errs.method = "Choose how it is shared out.";
    if (name.trim().length < 2) errs.name = "Give the head the name printed on the bill.";
    if (!/^[A-Z0-9_]{2,20}$/.test(code)) errs.code = "2–20 capital letters, digits or underscores.";
    if (method === "PERCENT_OF_HEAD" && !baseHeadId) errs.baseHeadId = "Choose the head this is a percentage of.";
    if (category === "GB_APPROVED_OTHER" && (!meetingRef.trim() || !resolvedOn)) errs["resolution.meetingRef"] = "Give the general body resolution that approved it.";
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length || !category || !method) return;
    try {
      const h = await create.mutateAsync({
        params: { societyId },
        body: {
          code,
          name: name.trim(),
          category,
          method,
          gstApplicable: gst,
          baseHeadId: method === "PERCENT_OF_HEAD" ? baseHeadId : null,
          resolution: meetingRef.trim() && resolvedOn ? { meetingRef: meetingRef.trim(), resolvedOn } : null,
        },
      });
      toast(`${h.name} added.${h.method === "MANUAL" ? "" : " Set its rate next."}`, "ok");
      onCreated(h);
    } catch (err) {
      const split = splitError(err, ["code", "name", "category", "method", "baseHeadId", "resolution.meetingRef", "resolution.resolvedOn"]);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={create.isPending ? () => undefined : onClose} maxWidth={580}>
      <ModalHeader title="Add charge head" onClose={onClose} />
      <Blurb>The category decides how the charge may be shared out, under Rule 106C-12(3) — only the permitted methods are offered.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SelectField<ChargeCategory>
            label="Category"
            req
            value={category}
            placeholder="Choose a category"
            options={CHARGE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            onChange={pickCategory}
            error={field.category}
          />
          {category && (
            <PickField<ApportionmentMethod>
              label="Apportionment"
              req
              value={method}
              options={allowed.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
              onPick={setMethod}
              error={field.method}
            />
          )}
          {method && <Note kind="info">{allowed.length === 1 ? `${CATEGORY_LABEL[category as ChargeCategory]} can only be shared ${METHOD_LABEL[method].toLowerCase()}. ` : ""}The rate is entered in {RATE_FIELD_UNIT[method]}.</Note>}
          <FieldPair>
            <TextField
              label="Name on the bill"
              req
              value={name}
              onChange={(v) => {
                setName(v);
                if (!codeTouched) setCode(codeFrom(v));
              }}
              placeholder="Service charges"
              error={field.name}
            />
            <TextField
              label="Code"
              req
              mono
              value={code}
              onChange={(v) => {
                setCodeTouched(true);
                setCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20));
              }}
              placeholder="SVC"
              error={field.code}
              hint="Printed on the head-wise breakup"
            />
          </FieldPair>
          {method === "PERCENT_OF_HEAD" && (
            <SelectField
              label="Percentage of"
              req
              value={baseHeadId}
              placeholder={bases.length ? "Choose the base head" : "No eligible head yet"}
              options={bases.map((h) => ({ value: h.id, label: `${h.name} (${h.code})` }))}
              onChange={setBaseHeadId}
              error={field.baseHeadId}
              hint={category === "NON_OCCUPANCY" ? "Non-occupancy is charged on service charges only, never on total maintenance" : undefined}
            />
          )}
          {wantsResolution && (
            <FieldPair>
              <TextField label="Resolution" req={category === "GB_APPROVED_OTHER"} value={meetingRef} onChange={setMeetingRef} placeholder="AGM 2026, resolution 4" error={field["resolution.meetingRef"]} />
              <TextField label="Resolved on" req={category === "GB_APPROVED_OTHER"} type="date" value={resolvedOn} onChange={setResolvedOn} error={field["resolution.resolvedOn"]} />
            </FieldPair>
          )}
          {wantsResolution && category !== "GB_APPROVED_OTHER" && <Note kind="warn">Fund rates are fixed by the general body. The resolution is asked for again with each rate.</Note>}
          <CheckField label="GST applies" hint="Added on the bill when the member's monthly charges cross the GST threshold" checked={gst} onChange={setGst} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={create.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={create.isPending} busyLabel="Adding…">
            Add head
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

const UNIT_TYPES = ["RESIDENTIAL", "COMMERCIAL", "SHOP", "OFFICE", "PARKING_ONLY"] as const;

/**
 * A new rate from a date. The admin types rupees or a percent; the wire gets
 * paise or basis points. The server's refusals — a date inside a published
 * period, a fund below its statutory minimum, non-occupancy over its cap, a
 * missing resolution — are shown exactly as it words them.
 */
export function SetRateModal({ societyId, head, earliest, onClose }: { societyId: string; head: ChargeHead; earliest: string; onClose: () => void }) {
  const { toast } = useAdminStore();
  const setRate = useApiMutation(api.billing.setRate);
  const kind = rateKind(head.method);
  const [rate, setRateText] = useState(head.currentRate ? rateToInput(head.method, head.currentRate.rate) : "");
  const [byType, setByType] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(head.currentRate?.rateByType ?? {}).map(([t, p]) => [t, paiseToInput(p)])));
  const [from, setFrom] = useState(earliest);
  const [meetingRef, setMeetingRef] = useState("");
  const [resolvedOn, setResolvedOn] = useState("");
  const [note, setNote] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const wantsResolution = needsResolution(head.category);
  // Echo what the typed number will be stored as, so 0.25 vs 25 is never a guess.
  const parsed = rate.trim() ? rateFromInput(head.method, rate) : null;
  const rateHint = parsed && "rate" in parsed ? `${rateLabel(head.method, parsed.rate)} · stored as ${parsed.rate} ${wireRateUnit(head.method).split(" ")[0].replace("basis", "basis points")}` : RATE_FIELD_UNIT[head.method];

  const submit = async () => {
    if (setRate.isPending) return;
    const errs: Record<string, string> = {};
    let wireRate = "0";
    let rateByType: Record<string, number> | null = null;
    if (kind === "byType") {
      rateByType = {};
      for (const t of UNIT_TYPES) {
        const raw = (byType[t] ?? "").trim();
        if (!raw) continue;
        const p = rupeesToPaise(raw);
        if (p === null) errs[`rateByType.${t}`] = "Enter rupees, for example 500.";
        else rateByType[t] = p;
      }
      if (!Object.keys(rateByType).length && !Object.keys(errs).length) errs.rateByType = "Give the monthly amount for at least one unit type.";
    } else {
      const r = rateFromInput(head.method, rate);
      if ("error" in r) errs.rate = r.error;
      else wireRate = r.rate;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) errs.effectiveFrom = "Choose the date the rate starts.";
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    try {
      const h = await setRate.mutateAsync({
        params: { societyId, headId: head.id },
        body: {
          rate: wireRate,
          rateByType,
          effectiveFrom: from,
          resolution: meetingRef.trim() && resolvedOn ? { meetingRef: meetingRef.trim(), resolvedOn } : null,
          note: note.trim() || null,
        },
      });
      toast(`${h.name}: ${rateLabel(h.method, wireRate, rateByType)} from ${formatDate(from)}.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["rate", "rateByType", "effectiveFrom", "resolution.meetingRef", "resolution.resolvedOn", "note"]);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={setRate.isPending ? () => undefined : onClose} maxWidth={540}>
      <ModalHeader title={`New rate · ${head.name}`} onClose={onClose} />
      <Blurb>
        {head.currentRate ? `Now ${rateLabel(head.method, head.currentRate.rate, head.currentRate.rateByType)} since ${formatDate(head.currentRate.effectiveFrom)}. ` : "No rate is set yet. "}
        The new rate applies to bills for periods from its start date; bills already published keep the old one.
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {kind === "byType" ? (
            <div>
              <FieldPair>
                {UNIT_TYPES.map((t) => (
                  <TextField
                    key={t}
                    label={t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ")}
                    mono
                    inputMode="decimal"
                    value={byType[t] ?? ""}
                    onChange={(v) => setByType((cur) => ({ ...cur, [t]: v.replace(/[^0-9.]/g, "") }))}
                    placeholder="0"
                    error={field[`rateByType.${t}`]}
                  />
                ))}
              </FieldPair>
              {field.rateByType && <div style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{field.rateByType}</div>}
            </div>
          ) : (
            <TextField
              label={kind === "percent" ? "Rate (%)" : "Rate (₹)"}
              req
              mono
              autoFocus
              inputMode="decimal"
              value={rate}
              onChange={(v) => setRateText(v.replace(/[^0-9.]/g, ""))}
              placeholder={kind === "percent" ? "0.25" : "1800"}
              error={field.rate}
              hint={rateHint}
            />
          )}
          <TextField label="Starts on" req type="date" value={from} onChange={setFrom} error={field.effectiveFrom} hint={`The earliest allowed is ${formatDate(earliest)}, after the last published period`} />
          {wantsResolution && (
            <FieldPair>
              <TextField label="Resolution" req value={meetingRef} onChange={setMeetingRef} placeholder="AGM 2026, resolution 4" error={field["resolution.meetingRef"]} />
              <TextField label="Resolved on" req type="date" value={resolvedOn} onChange={setResolvedOn} error={field["resolution.resolvedOn"]} />
            </FieldPair>
          )}
          <TextField label="Note" value={note} onChange={setNote} placeholder="Why the rate changed" error={field.note} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={setRate.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={setRate.isPending} busyLabel="Saving…">
            Set rate
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * Rename a head (`billing.updateHead` with `name` / `nameMr`). The code, the
 * category and the method stay: they are what published bills were computed
 * from, and a bill prints the name it was issued with.
 */
export function RenameHeadModal({ societyId, head, onClose }: { societyId: string; head: ChargeHead; onClose: () => void }) {
  const { toast } = useAdminStore();
  const update = useApiMutation(api.billing.updateHead);
  const [name, setName] = useState(head.name);
  const [nameMr, setNameMr] = useState(head.nameMr ?? "");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (update.isPending) return;
    setFormError(null);
    if (name.trim().length < 2) {
      setField({ name: "At least 2 characters." });
      return;
    }
    setField({});
    try {
      const h = await update.mutateAsync({ params: { societyId, headId: head.id }, body: { name: name.trim(), nameMr: nameMr.trim() || null } });
      toast(`Renamed to ${h.name}. Bills from the next run use the new name.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["name", "nameMr"]);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={update.isPending ? () => undefined : onClose} maxWidth={480}>
      <ModalHeader title="Rename head" onClose={onClose} />
      <Blurb>
        The code <strong>{head.code}</strong>, category and method stay as they are. Bills already published keep the name they were issued with.
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Name" req value={name} onChange={setName} error={field.name} autoFocus maxLength={80} />
          <TextField label="Name in Marathi" value={nameMr} onChange={setNameMr} error={field.nameMr} maxLength={80} hint="Printed on Marathi bills when set" />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={update.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={update.isPending} busyLabel="Saving…" disabled={name.trim() === head.name && nameMr.trim() === (head.nameMr ?? "")}>
            Save name
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * A unit's amount for a MANUAL head (`billing.createUnitCharge`) — a
 * parking fee, a signage charge. The amount applies from a date; the server
 * closes the unit's previous amount for that head the day it starts, so the
 * history reads as a series of dated amounts, never an overwrite.
 *
 * Opened from a head (pick the unit) or from a unit (pick the head).
 */
export function UnitChargeModal({
  societyId,
  heads,
  head,
  unit,
  earliest,
  onClose,
}: {
  societyId: string;
  /** The manual heads to choose from when opened from a unit. */
  heads?: ChargeHead[];
  head?: ChargeHead;
  unit?: { id: string; label: string };
  earliest?: string;
  onClose: () => void;
}) {
  const { toast } = useAdminStore();
  const resolveUnit = useUnitResolver(societyId);
  const create = useApiMutation(api.billing.createUnitCharge);
  const [unitText, setUnitText] = useState(unit?.label ?? "");
  const [headId, setHeadId] = useState(head?.id ?? (heads?.length === 1 ? heads[0].id : ""));
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(() => (earliest && earliest > todayIso() ? earliest : todayIso().slice(0, 8) + "01"));
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const chosen = head ?? heads?.find((h) => h.id === headId) ?? null;

  const submit = async () => {
    if (busy) return;
    setFormError(null);
    const local: Record<string, string> = {};
    const paise = rupeesToPaise(amount);
    if (!unit && !unitText.trim()) local.unit = "Enter the unit, for example A-1204.";
    if (!chosen) local.head = "Choose the manual head.";
    if (paise === null) local.amount = "Enter the monthly amount in rupees, for example 500.";
    if (!from) local.from = "Enter the date the amount starts.";
    if (to && from && to <= from) local.to = "Must be after the start date.";
    setField(local);
    if (Object.keys(local).length || paise === null || !chosen) return;
    setBusy(true);
    try {
      let target = unit ?? null;
      if (!target) {
        const found = await resolveUnit(unitText);
        if (!found || found === "missing") {
          setField({ unit: `No unit "${unitText.trim().toUpperCase()}" in this society.` });
          return;
        }
        target = { id: found.id, label: found.label };
      }
      const r = await create.mutateAsync({ params: { societyId }, body: { unitId: target.id, headId: chosen.id, amountPaise: paise, effectiveFrom: from, effectiveTo: to || null, note: note.trim() || null } });
      toast(`${r.headName}: ${inr(r.amountPaise)} a month for ${r.unitLabel} from ${formatDate(r.effectiveFrom)}.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["unitId", "headId", "amountPaise", "effectiveFrom", "effectiveTo", "note"]);
      setField({ unit: split.field.unitId, head: split.field.headId, amount: split.field.amountPaise, from: split.field.effectiveFrom, to: split.field.effectiveTo, note: split.field.note });
      setFormError(split.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={540}>
      <ModalHeader title={head ? `Unit amount · ${head.name}` : `Manual charge · ${unit?.label ?? ""}`} onClose={onClose} />
      <Blurb>A manual head is billed at the amount set on each unit, from its start date. A new amount replaces the unit's previous one from that date; earlier bills are unaffected.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!unit && <TextField label="Unit" req mono value={unitText} onChange={(v) => setUnitText(v.toUpperCase())} error={field.unit} placeholder="A-1204" autoFocus autoComplete="off" />}
          {!head && (
            <SelectField
              label="Head"
              req
              value={headId}
              placeholder={heads?.length ? "Choose a manual head" : "No active manual heads"}
              options={(heads ?? []).map((h) => ({ value: h.id, label: `${h.name} · ${h.code}` }))}
              onChange={setHeadId}
              error={field.head}
            />
          )}
          <TextField label="Amount a month (₹)" req mono inputMode="decimal" value={amount} onChange={setAmount} error={field.amount} placeholder="500" autoFocus={Boolean(unit)} />
          <FieldPair>
            <TextField label="From" req type="date" value={from} onChange={setFrom} error={field.from} hint={earliest ? `Periods before ${formatDate(earliest)} are published` : undefined} />
            <TextField label="Until" type="date" value={to} onChange={setTo} error={field.to} hint="Leave empty to keep billing it" />
          </FieldPair>
          <TextField label="Note" value={note} onChange={setNote} error={field.note} placeholder="Second parking slot, P-A-14" maxLength={300} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Saving…">
            Save amount
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}
