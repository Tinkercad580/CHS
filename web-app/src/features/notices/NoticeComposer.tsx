import { useState } from "react";
import { useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type Audience, type NoticeRecord } from "@chs/contract";
import { splitUnitLabels, useUnitsResolver } from "../../api/units";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { CheckField, FormError, PickField, SelectField, TextField } from "../../components/FormFields";
import { Blurb, FieldPair, Form, Note } from "../../components/Kit";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { formatDate } from "../../lib/apiFormat";
import { NOTICE_CATEGORY_LABEL } from "../../lib/moneyLabels";

type Category = NoticeRecord["category"];
type AudienceKind = Audience["kind"];

const AUDIENCES: { value: AudienceKind; label: string }[] = [
  { value: "ALL", label: "Everyone" },
  { value: "OWNERS", label: "Owners" },
  { value: "TENANTS", label: "Tenants" },
  { value: "RESIDENTS", label: "Residents" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMINS", label: "Committee" },
  { value: "BUILDINGS", label: "Buildings" },
  { value: "UNITS", label: "Units" },
];

const FIELDS = ["title", "body", "category", "audience", "audience.buildingIds", "audience.unitIds", "channels", "expiresAt", "emergencyReason", "supersedesId"];

/** A datetime-local value ("2026-10-01T18:00") as the ISO instant the API takes, in the browser's zone. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Draft or edit a notice (`notices.create` / `notices.update`). Publishing is
 * a separate, confirmed step on the notice's record, because it fixes the
 * recipient list and sends.
 *
 * `corrects` starts a correction: the old notice's text is the starting
 * point and `supersedesId` is set, so publishing marks the old one
 * SUPERSEDED and recipients see the correction in its place.
 */
export function NoticeComposer({
  societyId,
  draft,
  corrects,
  onClose,
  onSaved,
}: {
  societyId: string;
  draft?: NoticeRecord;
  corrects?: NoticeRecord;
  onClose: () => void;
  onSaved: (n: NoticeRecord) => void;
}) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.notices.create);
  const update = useApiMutation(api.notices.update);
  const resolve = useUnitsResolver(societyId);
  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const published = useApiQuery(api.notices.list, { params: { societyId }, query: { status: "PUBLISHED", limit: 100 } });
  const start = draft ?? corrects;

  const [title, setTitle] = useState(corrects ? `Correction: ${corrects.title}` : (draft?.title ?? ""));
  const [body, setBody] = useState(start?.body ?? "");
  const [category, setCategory] = useState<Category>(start?.category ?? "GENERAL");
  const [kind, setKind] = useState<AudienceKind>(start?.audience.kind ?? "ALL");
  const [buildingIds, setBuildingIds] = useState<string[]>(start?.audience.kind === "BUILDINGS" ? start.audience.buildingIds : []);
  const [unitText, setUnitText] = useState("");
  const [push, setPush] = useState(start ? start.channels.includes("push") : true);
  const [email, setEmail] = useState(start ? start.channels.includes("email") : false);
  const [ack, setAck] = useState(start?.ackRequired ?? false);
  const [pinned, setPinned] = useState(start?.pinned ?? false);
  const [expires, setExpires] = useState(toLocal(start?.expiresAt ?? null));
  const [reason, setReason] = useState(start?.emergencyReason ?? "");
  const [supersedesId, setSupersedesId] = useState(corrects?.id ?? draft?.supersedesId ?? "");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const busy = create.isPending || update.isPending || resolving;
  const keptUnits = start?.audience.kind === "UNITS" ? start.audience.unitIds : null;

  const submit = async () => {
    if (busy) return;
    const errs: Record<string, string> = {};
    if (title.trim().length < 3) errs.title = "Give the notice a title.";
    if (body.trim().length < 3) errs.body = "Write the notice.";
    if (kind === "BUILDINGS" && !buildingIds.length) errs["audience.buildingIds"] = "Choose at least one building.";
    if (kind === "UNITS" && !splitUnitLabels(unitText).length && !keptUnits) errs["audience.unitIds"] = "Enter the units, for example A-0101, B-0702.";
    if (category === "EMERGENCY" && reason.trim().length < 5) errs.emergencyReason = "Say why this is an emergency — it bypasses quiet hours and is logged.";
    setField(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;

    let audience: Audience;
    if (kind === "BUILDINGS") audience = { kind, buildingIds };
    else if (kind === "UNITS") {
      const labels = splitUnitLabels(unitText);
      if (labels.length) {
        setResolving(true);
        try {
          const { found, missing } = await resolve(labels);
          if (missing.length) {
            setField({ "audience.unitIds": `Not a unit in this society: ${missing.join(", ")}.` });
            return;
          }
          audience = { kind, unitIds: found.map((u) => u.id) };
        } catch (err) {
          setFormError(splitError(err, []).form);
          return;
        } finally {
          setResolving(false);
        }
      } else audience = { kind, unitIds: keptUnits ?? [] };
    } else audience = { kind } as Audience;

    const input = {
      title: title.trim(),
      body: body.trim(),
      category,
      audience,
      ackRequired: ack,
      pinned,
      channels: [...(push ? (["push"] as const) : []), ...(email ? (["email"] as const) : [])],
      expiresAt: toIso(expires),
      emergencyReason: category === "EMERGENCY" ? reason.trim() : null,
      supersedesId: supersedesId || null,
    };
    try {
      const n = draft ? await update.mutateAsync({ params: { societyId, noticeId: draft.id }, body: input }) : await create.mutateAsync({ params: { societyId }, body: input });
      toast(draft ? "Draft saved." : "Draft saved. Review it and publish when ready.", "ok");
      onSaved(n);
    } catch (err) {
      const split = splitError(err, FIELDS);
      setField(split.field);
      setFormError(split.form);
    }
  };

  const bList = buildings.data ?? [];
  const correctable = (published.data?.items ?? []).filter((n) => !n.supersededById || n.id === supersedesId);
  const emergency = category === "EMERGENCY";

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={660}>
      <ModalHeader title={draft ? "Edit draft notice" : corrects ? "Correct a notice" : "Compose notice"} onClose={onClose} />
      <Blurb>
        {corrects
          ? `Publishing this marks "${corrects.title}" as superseded; recipients see the correction in its place.`
          : "Saved as a draft first. Publishing fixes the recipient list and sends it; the delivery and acknowledgement report is the society's proof of service."}
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Title" req autoFocus value={title} onChange={setTitle} maxLength={160} placeholder="Water supply off Thursday, 10am to 4pm" error={field.title} />
          <TextField label="Notice" req multiline rows={7} value={body} onChange={setBody} maxLength={20000} placeholder="What is happening, when, and what residents should do." error={field.body} />
          <SelectField<Category>
            label="Category"
            req
            value={category}
            options={schemas.notifications.NOTICE_CATEGORIES.map((c) => ({ value: c, label: NOTICE_CATEGORY_LABEL[c] ?? c }))}
            onChange={setCategory}
            error={field.category}
          />
          {emergency && (
            <TextField
              label="Emergency reason"
              req
              value={reason}
              onChange={setReason}
              placeholder="Gas leak reported in B wing basement"
              error={field.emergencyReason}
              hint="Emergency notices bypass quiet hours. The reason is logged against your name."
            />
          )}
          <PickField<AudienceKind> label="Send to" req value={kind} options={AUDIENCES} onPick={setKind} error={field.audience} />
          {kind === "BUILDINGS" && (
            <div role="group" aria-label="Buildings">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {buildings.isPending && <span style={{ font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Loading buildings…</span>}
                {bList.map((b) => {
                  const on = buildingIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setBuildingIds((cur) => (on ? cur.filter((x) => x !== b.id) : [...cur, b.id]))}
                      className="press-scale focus-ring"
                      style={{ height: 36, padding: "0 13px", borderRadius: 999, border: `1px solid ${on ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, background: on ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)", color: on ? "#fff" : "var(--ink-soft,#4A5B56)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" }}
                    >
                      {b.name.length <= 2 ? `Building ${b.name}` : b.name} · {b.unitCount}
                    </button>
                  );
                })}
              </div>
              {field["audience.buildingIds"] && <div style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{field["audience.buildingIds"]}</div>}
            </div>
          )}
          {kind === "UNITS" && (
            <TextField
              label="Units"
              req={!keptUnits}
              mono
              multiline
              value={unitText}
              onChange={(v) => setUnitText(v.toUpperCase())}
              placeholder="A-0101, B-0702"
              error={field["audience.unitIds"]}
              hint={keptUnits ? `${keptUnits.length} unit${keptUnits.length === 1 ? "" : "s"} chosen already; enter units here to replace them` : "Separate units with commas or spaces"}
            />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            <CheckField label="Push notification" hint="To the resident and gate apps" checked={push} onChange={setPush} />
            <CheckField label="Email" hint="To recipients with an email on file" checked={email} onChange={setEmail} />
            <CheckField label="Acknowledgement required" hint="Recipients confirm they have read it" checked={ack} onChange={setAck} />
            <CheckField label="Pin to the top" hint="Stays first in residents' notices" checked={pinned} onChange={setPinned} />
          </div>
          {!push && !email && <Note kind="info">With no channel ticked, the notice is only in the apps' notice list.</Note>}
          <FieldPair>
            <TextField label="Expires" type="datetime-local" value={expires} onChange={setExpires} error={field.expiresAt} hint="Drops off residents' lists after this" />
            <SelectField
              label="Corrects an earlier notice"
              value={supersedesId}
              options={[{ value: "", label: "No — this is a new notice" }, ...correctable.map((n) => ({ value: n.id, label: `${n.title} · ${formatDate(n.publishedAt)}` }))]}
              onChange={setSupersedesId}
              error={field.supersedesId}
            />
          </FieldPair>
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel={resolving ? "Checking units…" : "Saving…"}>
            Save draft
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}
