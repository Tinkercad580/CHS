import { useState, type ReactNode } from "react";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type BillingConfig, type Society, type SocietyMembership, type SocietySettings } from "@chs/contract";
import { holds } from "../../api/society";
import { CardHead, FieldPair, Form, Note } from "../../components/Kit";
import { CheckField, FormError, PickField, SelectField, TextField } from "../../components/FormFields";
import { DataBoundary } from "../../components/DataBoundary";
import { PrimaryButton } from "../../components/ModalShell";
import { SkeletonText } from "../../components/Skeleton";
import { splitError } from "../../lib/apiErrors";
import { enumLabel, formatDate, formatDateTime } from "../../lib/apiFormat";
import { periodLabel } from "../../lib/money";
import { cardStyle } from "../../lib/uiStyles";
import { useAdminStore } from "../../store/AdminStore";

/**
 * Setup's forms: the society profile (`society.update`), its settings
 * (`society.updateSettings`) and billing configuration
 * (`society.updateBillingConfig`). Each sends only the fields the admin
 * changed, so two admins editing different fields do not undo each other,
 * and each shows the server's messages as written — the interest-rate cap
 * and the general-body resolution rule in particular are the server's to
 * state, not the console's.
 */

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" }) }));

function Card({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 14 }}>
      <CardHead title={title} sub={sub} />
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 14 }}>
      <CardHead title={title} sub="Loading…" />
      <div style={{ padding: 20 }} aria-busy="true">
        <SkeletonText lines={6} />
      </div>
    </div>
  );
}

function SaveRow({ busy, dirty, error, note }: { busy: boolean; dirty: boolean; error: string | null; note?: ReactNode }) {
  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <FormError message={error} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {note && <span style={{ flex: 1, minWidth: 200, font: "400 12.5px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{note}</span>}
        <PrimaryButton type="submit" busy={busy} busyLabel="Saving…" disabled={!dirty}>
          Save changes
        </PrimaryButton>
      </div>
    </div>
  );
}

/** Only the keys whose value differs from what the server has. */
function changed<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(after) as (keyof T)[]) if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) out[k] = after[k];
  return out;
}

const nul = (s: string) => (s.trim() ? s.trim() : null);

// ─── Profile and settings ───────────────────────────────────────────────────

export function ProfileTab({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const profile = useApiQuery(api.society.get, { params: { societyId } });
  const settings = useApiQuery(api.society.settings, { params: { societyId } });
  return (
    <>
      <DataBoundary state={toLoadState(profile)} skeleton={<CardSkeleton title="Society profile" />}>
        {(p) => <ProfileForm societyId={societyId} data={p} />}
      </DataBoundary>
      <DataBoundary state={toLoadState(settings)} skeleton={<CardSkeleton title="Settings" />}>
        {(s) => <SettingsForm societyId={societyId} data={s} />}
      </DataBoundary>
    </>
  );
}

type ProfileDraft = {
  name: string;
  type: Society["type"];
  registrationNumber: string | null;
  registrationDate: string | null;
  addressLine: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  registrarOffice: string | null;
  pan: string | null;
  tan: string | null;
  gstin: string | null;
  gstRegistered: boolean;
  fyStartMonth: number;
  contactEmail: string | null;
  contactPhone: string | null;
};

function fromSociety(s: Society): ProfileDraft {
  return {
    name: s.name,
    type: s.type,
    registrationNumber: s.registrationNumber,
    registrationDate: s.registrationDate,
    addressLine: s.addressLine,
    city: s.city,
    district: s.district,
    pincode: s.pincode,
    registrarOffice: s.registrarOffice,
    pan: s.pan,
    tan: s.tan,
    gstin: s.gstin,
    gstRegistered: s.gstRegistered,
    fyStartMonth: s.fyStartMonth,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
  };
}

const PROFILE_FIELDS: (keyof ProfileDraft)[] = [
  "name",
  "type",
  "registrationNumber",
  "registrationDate",
  "addressLine",
  "city",
  "district",
  "pincode",
  "registrarOffice",
  "pan",
  "tan",
  "gstin",
  "gstRegistered",
  "fyStartMonth",
  "contactEmail",
  "contactPhone",
];

function ProfileForm({ societyId, data }: { societyId: string; data: Society }) {
  const { toast } = useAdminStore();
  const save = useApiMutation(api.society.update);
  const [base, setBase] = useState(() => fromSociety(data));
  const [d, setD] = useState(base);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const text = (k: keyof ProfileDraft) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const set = (k: keyof ProfileDraft) => (v: string) => setD((cur) => ({ ...cur, [k]: v }));

  // Text fields are held as typed; blanks become null and codes are upper-cased only when sent.
  const normal = (x: ProfileDraft): ProfileDraft => ({
    ...x,
    name: x.name.trim(),
    registrationNumber: nul(x.registrationNumber ?? ""),
    registrationDate: nul(x.registrationDate ?? ""),
    addressLine: nul(x.addressLine ?? ""),
    city: nul(x.city ?? ""),
    district: nul(x.district ?? ""),
    pincode: nul(x.pincode ?? ""),
    registrarOffice: nul(x.registrarOffice ?? ""),
    pan: nul(x.pan ?? "")?.toUpperCase() ?? null,
    tan: nul(x.tan ?? "")?.toUpperCase() ?? null,
    gstin: nul(x.gstin ?? "")?.toUpperCase() ?? null,
    contactEmail: nul(x.contactEmail ?? ""),
    contactPhone: nul(x.contactPhone ?? ""),
  });
  const body = changed(base, normal(d));
  const dirty = Object.keys(body).length > 0;

  const submit = async () => {
    if (save.isPending || !dirty) return;
    setFormError(null);
    const parsed = schemas.society.UpdateSocietyBody.safeParse(body);
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      setField(local);
      return;
    }
    setField({});
    try {
      const s = await save.mutateAsync({ params: { societyId }, body: parsed.data });
      const next = fromSociety(s);
      setBase(next);
      setD(next);
      toast("Society profile saved.", "ok");
    } catch (err) {
      const split = splitError(err, PROFILE_FIELDS);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <Card title="Society profile" sub={`Code ${data.code} · created ${formatDate(data.createdAt)}. Printed on bills, receipts and notices.`}>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Name" req value={d.name} onChange={set("name")} error={field.name} maxLength={150} />
          <PickField label="Type" req value={d.type} options={schemas.society.SOCIETY_TYPES.map((t) => ({ value: t, label: t === "SOCIETY_CHS" ? "Co-operative housing society" : t === "SOCIETY_AOA" ? "Apartment owners' association" : "Unregistered" }))} onPick={(v) => setD((c) => ({ ...c, type: v }))} error={field.type} />
          <FieldPair>
            <TextField label="Registration number" mono value={text("registrationNumber")} onChange={set("registrationNumber")} error={field.registrationNumber} />
            <TextField label="Registered on" type="date" value={text("registrationDate")} onChange={set("registrationDate")} error={field.registrationDate} />
          </FieldPair>
          <TextField label="Registrar's office" value={text("registrarOffice")} onChange={set("registrarOffice")} error={field.registrarOffice} placeholder="Deputy Registrar, Co-operative Societies, Pune City (4)" />
          <TextField label="Address" value={text("addressLine")} onChange={set("addressLine")} error={field.addressLine} />
          <FieldPair>
            <TextField label="City" value={text("city")} onChange={set("city")} error={field.city} />
            <TextField label="District" value={text("district")} onChange={set("district")} error={field.district} />
            <TextField label="PIN code" mono inputMode="numeric" value={text("pincode")} onChange={(v) => set("pincode")(v.replace(/\D/g, "").slice(0, 6))} error={field.pincode} />
          </FieldPair>
          <FieldPair>
            <TextField label="PAN" mono value={text("pan")} onChange={(v) => set("pan")(v.toUpperCase())} error={field.pan} placeholder="AAAAS1234C" />
            <TextField label="TAN" mono value={text("tan")} onChange={(v) => set("tan")(v.toUpperCase())} error={field.tan} />
            <TextField label="GSTIN" mono value={text("gstin")} onChange={(v) => set("gstin")(v.toUpperCase())} error={field.gstin} />
          </FieldPair>
          <CheckField label="Registered for GST" hint="GST is added to heads marked GST-applicable once a member's monthly charges cross the threshold." checked={d.gstRegistered} onChange={(v) => setD((c) => ({ ...c, gstRegistered: v }))} />
          <FieldPair>
            <SelectField label="Financial year starts" req value={String(d.fyStartMonth)} options={MONTHS} onChange={(v) => setD((c) => ({ ...c, fyStartMonth: Number(v) }))} error={field.fyStartMonth} />
            <TextField label="Office email" type="email" value={text("contactEmail")} onChange={set("contactEmail")} error={field.contactEmail} />
            <TextField label="Office phone" type="tel" mono value={text("contactPhone")} onChange={set("contactPhone")} error={field.contactPhone} />
          </FieldPair>
        </div>
        <SaveRow busy={save.isPending} dirty={dirty} error={formError} />
      </Form>
    </Card>
  );
}

function SettingsForm({ societyId, data }: { societyId: string; data: SocietySettings }) {
  const { toast } = useAdminStore();
  const save = useApiMutation(api.society.updateSettings);
  const [base, setBase] = useState(data);
  const [d, setD] = useState(data);
  const [nums, setNums] = useState({ visitorRetentionDays: String(data.visitorRetentionDays), tenantExpiryReminderDays: String(data.tenantExpiryReminderDays) });
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const next: SocietySettings = { ...d, visitorRetentionDays: Number(nums.visitorRetentionDays) || 0, tenantExpiryReminderDays: Number(nums.tenantExpiryReminderDays) || 0 };
  const body = changed(base, next);
  const dirty = Object.keys(body).length > 0;
  const toggleLang = (l: "en" | "mr", on: boolean) =>
    setD((c) => {
      const languages = on ? [...new Set([...c.languages, l])] : c.languages.filter((x) => x !== l);
      return { ...c, languages, defaultLanguage: languages.includes(c.defaultLanguage) ? c.defaultLanguage : (languages[0] ?? c.defaultLanguage) };
    });

  const submit = async () => {
    if (save.isPending || !dirty) return;
    setFormError(null);
    const parsed = schemas.society.UpdateSocietySettingsBody.safeParse(body);
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      if (local.languages) local.languages = "Keep at least one language.";
      setField(local);
      return;
    }
    setField({});
    try {
      const s = await save.mutateAsync({ params: { societyId }, body: parsed.data });
      setBase(s);
      setD(s);
      setNums({ visitorRetentionDays: String(s.visitorRetentionDays), tenantExpiryReminderDays: String(s.tenantExpiryReminderDays) });
      toast("Settings saved.", "ok");
    } catch (err) {
      const split = splitError(err, Object.keys(data));
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <Card title="Settings" sub="What residents see in the apps, and when the society's messages may reach them.">
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 10 }}>Languages</div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              <CheckField label="English" checked={d.languages.includes("en")} onChange={(v) => toggleLang("en", v)} />
              <CheckField label="Marathi" checked={d.languages.includes("mr")} onChange={(v) => toggleLang("mr", v)} />
            </div>
            {field.languages && <div style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{field.languages}</div>}
          </div>
          <PickField label="Default language" req value={d.defaultLanguage} options={d.languages.map((l) => ({ value: l, label: l === "en" ? "English" : "Marathi" }))} onPick={(v) => setD((c) => ({ ...c, defaultLanguage: v }))} error={field.defaultLanguage} />
          <FieldPair>
            <TextField label="Quiet hours from" req type="time" value={d.quietHoursStart} onChange={(v) => setD((c) => ({ ...c, quietHoursStart: v }))} error={field.quietHoursStart} hint="No push between these times, except emergencies" />
            <TextField label="Quiet hours until" req type="time" value={d.quietHoursEnd} onChange={(v) => setD((c) => ({ ...c, quietHoursEnd: v }))} error={field.quietHoursEnd} />
          </FieldPair>
          <FieldPair>
            <TextField label="Keep visitor records (days)" req mono inputMode="numeric" value={nums.visitorRetentionDays} onChange={(v) => setNums((c) => ({ ...c, visitorRetentionDays: v.replace(/\D/g, "") }))} error={field.visitorRetentionDays} hint="1 to 3650" />
            <TextField label="Remind before a tenancy ends (days)" req mono inputMode="numeric" value={nums.tenantExpiryReminderDays} onChange={(v) => setNums((c) => ({ ...c, tenantExpiryReminderDays: v.replace(/\D/g, "") }))} error={field.tenantExpiryReminderDays} hint="1 to 180" />
          </FieldPair>
          <CheckField label="Suspend a tenant's access when the tenancy ends" hint="Their app login stops working on the end date unless the tenancy is extended." checked={d.autoSuspendTenantOnExpiry} onChange={(v) => setD((c) => ({ ...c, autoSuspendTenantOnExpiry: v }))} />
          <CheckField label="Resident directory" hint="Residents can look each other up in the app, subject to each person's own visibility choice." checked={d.directoryEnabled} onChange={(v) => setD((c) => ({ ...c, directoryEnabled: v }))} />
          <CheckField label="Financial transparency" hint="Residents see the society's collection and expense summaries." checked={d.financialTransparency} onChange={(v) => setD((c) => ({ ...c, financialTransparency: v }))} />
          <CheckField label="Show the compliance summary to residents" checked={d.complianceSummaryVisible} onChange={(v) => setD((c) => ({ ...c, complianceSummaryVisible: v }))} />
        </div>
        <SaveRow busy={save.isPending} dirty={dirty} error={formError} />
      </Form>
    </Card>
  );
}

// ─── Billing configuration ──────────────────────────────────────────────────

type Bucket = BillingConfig["allocationOrder"][number];
const BUCKET_TEXT: Record<Bucket, string> = { INTEREST: "Interest", ARREARS: "Arrears (older bills)", CURRENT: "Current bill" };

/** "12" / "10.5" -> basis points; null for anything else. Two decimals at most, no floats. */
function percentToBps(text: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac ? `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}` : String(whole);
}

export function BillingConfigTab({ society }: { society: SocietyMembership }) {
  const cfg = useApiQuery(api.society.billingConfig, { params: { societyId: society.societyId } });
  return (
    <DataBoundary state={toLoadState(cfg)} skeleton={<CardSkeleton title="Billing configuration" />}>
      {(c) => <BillingConfigForm societyId={society.societyId} data={c} canEdit={holds(society, "society.configure")} />}
    </DataBoundary>
  );
}

function BillingConfigForm({ societyId, data, canEdit }: { societyId: string; data: BillingConfig; canEdit: boolean }) {
  const { toast } = useAdminStore();
  const save = useApiMutation(api.society.updateBillingConfig);
  const [base, setBase] = useState(data);
  const [cycle, setCycle] = useState(data.cycle);
  const [genDay, setGenDay] = useState(String(data.generationDay));
  const [dueDay, setDueDay] = useState(String(data.dueDay));
  const [grace, setGrace] = useState(String(data.graceDays));
  const [rate, setRate] = useState(bpsToPercent(data.interestRateBps));
  const [meeting, setMeeting] = useState("");
  const [resolvedOn, setResolvedOn] = useState("");
  const [rounding, setRounding] = useState(data.roundingRule);
  const [billFmt, setBillFmt] = useState(data.billNumberFormat);
  const [receiptFmt, setReceiptFmt] = useState(data.receiptNumberFormat);
  const [partial, setPartial] = useState(data.allowPartialPayment);
  const [order, setOrder] = useState<Bucket[]>(data.allocationOrder);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const bps = percentToBps(rate);
  const rateChanged = bps !== null && bps !== base.interestRateBps;
  const next = {
    cycle,
    generationDay: Number(genDay),
    dueDay: Number(dueDay),
    graceDays: Number(grace),
    interestRateBps: bps ?? base.interestRateBps,
    roundingRule: rounding,
    billNumberFormat: billFmt.trim(),
    receiptNumberFormat: receiptFmt.trim(),
    allowPartialPayment: partial,
    allocationOrder: order,
  };
  const prev = {
    cycle: base.cycle,
    generationDay: base.generationDay,
    dueDay: base.dueDay,
    graceDays: base.graceDays,
    interestRateBps: base.interestRateBps,
    roundingRule: base.roundingRule,
    billNumberFormat: base.billNumberFormat,
    receiptNumberFormat: base.receiptNumberFormat,
    allowPartialPayment: base.allowPartialPayment,
    allocationOrder: base.allocationOrder,
  };
  const diff = changed(prev, next);
  const dirty = Object.keys(diff).length > 0 || bps === null;

  const move = (i: number, by: -1 | 1) =>
    setOrder((cur) => {
      const j = i + by;
      if (j < 0 || j >= cur.length) return cur;
      const out = cur.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const submit = async () => {
    if (save.isPending || !dirty) return;
    setFormError(null);
    const local: Record<string, string> = {};
    if (bps === null) local.interestRateBps = "Enter the yearly rate as a percent, for example 12 or 10.5.";
    for (const [k, v, lo, hi] of [
      ["generationDay", genDay, 1, 28],
      ["dueDay", dueDay, 1, 28],
      ["graceDays", grace, 0, 60],
    ] as const) {
      const n = Number(v);
      if (!v.trim() || !Number.isInteger(n) || n < lo || n > hi) local[k] = `A whole number from ${lo} to ${hi}.`;
    }
    // The resolution is sent only with a rate change, and then both parts are needed; the server
    // decides whether the change needs one at all, and says so (RESOLUTION_REQUIRED).
    const resolution = rateChanged && (meeting.trim() || resolvedOn) ? { meetingRef: meeting.trim(), resolvedOn } : null;
    if (resolution && !resolution.meetingRef) local["interestResolution.meetingRef"] = "Name the meeting and resolution.";
    if (resolution && !resolution.resolvedOn) local["interestResolution.resolvedOn"] = "Enter the date it was passed.";
    setField(local);
    if (Object.keys(local).length) return;
    try {
      const c = await save.mutateAsync({ params: { societyId }, body: { ...diff, ...(resolution ? { interestResolution: resolution } : {}) } });
      setBase(c);
      setMeeting("");
      setResolvedOn("");
      toast(`Billing configuration saved. It applies from ${c.effectiveFromPeriod ? periodLabel(c.effectiveFromPeriod) : "the next unbilled period"}.`, "ok");
    } catch (err) {
      const split = splitError(err, ["cycle", "generationDay", "dueDay", "graceDays", "interestRateBps", "interestResolution", "interestResolution.meetingRef", "interestResolution.resolvedOn", "roundingRule", "billNumberFormat", "receiptNumberFormat", "allocationOrder"]);
      setField(split.field);
      // INTEREST_RATE_EXCEEDS_CAP and RESOLUTION_REQUIRED are not validation failures, so they
      // arrive as the form message — shown exactly as the server words them.
      setFormError(split.field.interestResolution ?? split.form);
    }
  };

  return (
    <>
      {!canEdit && <Note kind="info" style={{ marginBottom: 14 }}>You can read the billing configuration. Changing it needs the society.configure permission.</Note>}
      <Card
        title="Billing configuration"
        sub={
          base.updatedAt
            ? `Last changed ${formatDateTime(base.updatedAt)}${base.effectiveFromPeriod ? ` · in force from ${periodLabel(base.effectiveFromPeriod)}` : ""}. A change applies from the next unbilled period; published bills never change.`
            : "Not configured yet. Bills cannot be generated until it is saved."
        }
      >
        <Form onSubmit={() => void submit()}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PickField label="Billing cycle" req value={cycle} options={schemas.society.BILLING_CYCLES.map((c) => ({ value: c, label: enumLabel(c) }))} onPick={setCycle} error={field.cycle} disabled={!canEdit} />
            <FieldPair>
              <TextField label="Bills dated on day" req mono inputMode="numeric" value={genDay} onChange={(v) => setGenDay(v.replace(/\D/g, ""))} error={field.generationDay} hint="1 to 28 of the month" disabled={!canEdit} />
              <TextField label="Due on day" req mono inputMode="numeric" value={dueDay} onChange={(v) => setDueDay(v.replace(/\D/g, ""))} error={field.dueDay} hint="1 to 28" disabled={!canEdit} />
              <TextField label="Grace days" req mono inputMode="numeric" value={grace} onChange={(v) => setGrace(v.replace(/\D/g, ""))} error={field.graceDays} hint="Before interest starts" disabled={!canEdit} />
            </FieldPair>

            <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border,#E3E9E6)", display: "flex", flexDirection: "column", gap: 14 }}>
              <TextField
                label="Interest on overdue dues (% a year, simple)"
                req
                mono
                inputMode="decimal"
                value={rate}
                onChange={(v) => setRate(v.replace(/[^\d.]/g, ""))}
                error={field.interestRateBps}
                hint={base.interestResolution ? `In force: ${bpsToPercent(base.interestRateBps)}% · ${base.interestResolution.meetingRef}, ${formatDate(base.interestResolution.resolvedOn)}` : `In force: ${bpsToPercent(base.interestRateBps)}%`}
                disabled={!canEdit}
              />
              {rateChanged && (
                <>
                  <Note kind="warn">The interest rate is a general body decision. Give the resolution that approved the new rate; the server refuses a rate above the statutory cap.</Note>
                  <FieldPair>
                    <TextField label="Meeting and resolution" value={meeting} onChange={setMeeting} error={field["interestResolution.meetingRef"]} placeholder="AGM 2026, resolution 7" />
                    <TextField label="Passed on" type="date" value={resolvedOn} onChange={setResolvedOn} error={field["interestResolution.resolvedOn"]} />
                  </FieldPair>
                </>
              )}
            </div>

            <PickField label="Rounding" req value={rounding} options={[
              { value: "NEAREST_RUPEE", label: "Nearest rupee" },
              { value: "UP_RUPEE", label: "Up to the rupee" },
              { value: "NONE", label: "No rounding" },
            ]} onPick={setRounding} error={field.roundingRule} disabled={!canEdit} />
            <FieldPair>
              <TextField label="Bill number format" req mono value={billFmt} onChange={setBillFmt} error={field.billNumberFormat} hint="{CODE}, {FY}, {SEQ} — must include {SEQ}" disabled={!canEdit} />
              <TextField label="Receipt number format" req mono value={receiptFmt} onChange={setReceiptFmt} error={field.receiptNumberFormat} hint="Must include {SEQ}" disabled={!canEdit} />
            </FieldPair>
            <CheckField label="Accept part payments" hint="A payment smaller than the dues is allocated in the order below; otherwise it is refused." checked={partial} onChange={setPartial} disabled={!canEdit} />
            <div>
              <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 10 }}>A payment settles, in order</div>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {order.map((b, i) => (
                  <li key={b} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 10 }}>
                    <span style={{ width: 20, font: "600 12.5px/1 'IBM Plex Mono',monospace", color: "var(--ink-muted,#8A9995)" }}>{i + 1}</span>
                    <span style={{ flex: 1, font: "600 13.5px/1.3 Figtree, sans-serif" }}>{BUCKET_TEXT[b]}</span>
                    {canEdit && (
                      <>
                        <OrderButton label={`Move ${BUCKET_TEXT[b]} up`} disabled={i === 0} onClick={() => move(i, -1)} up />
                        <OrderButton label={`Move ${BUCKET_TEXT[b]} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} />
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {field.allocationOrder && <div style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{field.allocationOrder}</div>}
            </div>
          </div>
          {canEdit && <SaveRow busy={save.isPending} dirty={dirty} error={formError} note="Changes apply from the next period that has not been billed." />}
        </Form>
      </Card>
    </>
  );
}

function OrderButton({ label, disabled, onClick, up }: { label: string; disabled: boolean; onClick: () => void; up?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="press-scale focus-ring" style={{ width: 30, height: 30, border: "1px solid var(--border,#E3E9E6)", borderRadius: 8, background: "var(--surface,#fff)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
      </svg>
    </button>
  );
}
