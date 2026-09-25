import { useMemo, useState } from "react";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type SocietyMembership, type StatutoryConfigEntry } from "@chs/contract";
import { holds } from "../../api/society";
import { CardHead, DataTable, FieldPair, Form, Note, Blurb } from "../../components/Kit";
import { FormError, SelectField, TextField } from "../../components/FormFields";
import { GhostButton, ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { Pill } from "../../components/Pill";
import { splitError } from "../../lib/apiErrors";
import { formatDate } from "../../lib/apiFormat";
import { ready, type LoadState } from "../../lib/loadState";
import { inr, todayIso } from "../../lib/money";
import { cardStyle, cellStyle, monoCell, rowBorder } from "../../lib/uiStyles";
import { primaryBtnStyle, rowProps } from "../../lib/tableKit";
import type { PillKind } from "../../lib/types";
import { useAdminStore } from "../../store/AdminStore";

/**
 * What each key controls, for the design's "Setting" column. The server owns
 * the keys, their units and which ones a society may override (and within
 * what bound); this is only their plain-English names. A key missing here
 * is shown by its code.
 */
const SETTING: Record<string, string> = {
  interest_cap_percent: "Interest on defaults — statutory cap",
  non_occupancy_percent: "Non-occupancy charge",
  non_occupancy_base: "Non-occupancy charge — computed on",
  sinking_fund_min_percent: "Sinking fund — minimum",
  repair_fund_min_percent: "Repair fund — minimum",
  education_fund_min_amount_paise: "Education fund — minimum",
  gst_rate_percent: "GST rate",
  gst_member_threshold_paise: "GST — member threshold",
  gst_turnover_threshold_paise: "GST — turnover threshold",
  transfer_premium_cap_paise: "Transfer premium — cap",
  agm_notice_days: "AGM notice period",
  sgm_notice_days: "SGM notice period",
  agm_deadline_rule: "AGM deadline",
  audit_deadline_rule: "Audit deadline",
  quorum_rule: "Quorum",
  structural_audit_intervals: "Structural audit",
  fire_audit_frequency: "Fire audit",
  visitor_data_retention_days: "Visitor data retention",
};

/** "750000" paise -> "₹7,500"; "14" clear days -> "14 clear days"; rules read as words. */
function valueText(e: StatutoryConfigEntry): string {
  if (e.key.endsWith("_paise") && /^\d+$/.test(e.value)) return `${inr(Number(e.value), { whole: true })}${e.unit ? ` ${e.unit.replace(/^paise\s*/, "")}` : ""}`.trim();
  if (e.unit === "rule") return e.value.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  if (e.unit?.startsWith("%")) return `${e.value}${e.unit}`;
  return e.unit ? `${e.value} ${e.unit}` : e.value;
}

function stateOf(e: StatutoryConfigEntry): { label: string; kind: PillKind } {
  if (e.scope === "SOCIETY") return { label: "Society override", kind: "info" };
  if (e.verifiedOn) return { label: "Verified", kind: "ok" };
  return { label: "Not verified", kind: "warn" };
}

function sourceText(e: StatutoryConfigEntry): string {
  if (e.resolution) return `${e.resolution.meetingRef} · ${formatDate(e.resolution.resolvedOn)}`;
  return e.ruleCitation ?? e.sourceReference ?? "—";
}

interface KeyRow {
  key: string;
  current: StatutoryConfigEntry | null;
  upcoming: StatutoryConfigEntry | null;
  history: StatutoryConfigEntry[];
}

/** One row per key: the value in force today (a society's own row wins over the platform's), anything scheduled, and every row on record. */
function byKey(rows: StatutoryConfigEntry[], today: string): KeyRow[] {
  const groups = new Map<string, StatutoryConfigEntry[]>();
  for (const r of rows) groups.set(r.key, [...(groups.get(r.key) ?? []), r]);
  return [...groups.entries()]
    .map(([key, all]) => {
      const live = all.filter((r) => r.effectiveFrom <= today && (!r.effectiveTo || r.effectiveTo > today));
      const current = live.find((r) => r.scope === "SOCIETY") ?? live.find((r) => r.scope === "PLATFORM") ?? null;
      const upcoming = all.filter((r) => r.effectiveFrom > today).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ?? null;
      return { key, current, upcoming, history: all.slice().sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

const COLS = [{ label: "Key" }, { label: "Setting" }, { label: "Value" }, { label: "Source" }, { label: "Effective from" }, { label: "State", align: "right" as const }];

/**
 * The statutory parameters billing and compliance read (`society.statutoryConfig`),
 * in the design's table: key, what it controls, the value in force, where
 * it comes from, since when, and whether it has been verified. A society
 * with compliance.manage can add its own dated value for a key the law lets
 * it set (`society.setStatutoryConfig`); the server says which and within
 * what bound, and refuses the rest in its own words.
 */
export function StatutoryTab({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const canSet = holds(society, "compliance.manage");
  const cfg = useApiQuery(api.society.statutoryConfig, { params: { societyId } });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<KeyRow | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const today = todayIso();

  const all = useMemo(() => (cfg.data ? byKey(cfg.data, today) : []), [cfg.data, today]);
  const want = q.trim().toLowerCase();
  const state = toLoadState(cfg);
  const rows: LoadState<KeyRow[]> = state.status === "ready" ? ready(want ? all.filter((r) => r.key.includes(want) || (SETTING[r.key] ?? "").toLowerCase().includes(want)) : all) : state;
  const unverified = all.filter((r) => r.current && r.current.scope === "PLATFORM" && !r.current.verifiedOn).length;
  const overrides = all.filter((r) => r.current?.scope === "SOCIETY").length;

  return (
    <>
      {unverified > 0 && (
        <Note kind="warn" style={{ marginBottom: 14 }}>
          {unverified} of {all.length} platform value{unverified === 1 ? " has" : "s have"} not been verified against the primary source. Billing uses them as they are.
        </Note>
      )}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHead
          title="Statutory config"
          sub={cfg.data ? `${all.length} keys · ${overrides} set by the society · the rest are platform defaults` : "The legal parameters billing and compliance read, as of today"}
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a setting"
                aria-label="Search a setting"
                className="auth-input"
                style={{ height: 36, width: 200, padding: "0 12px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", color: "var(--ink,#0F1A17)", font: "400 13.5px/1 Figtree, sans-serif", outline: "none" }}
              />
              {canSet && (
                <button type="button" onClick={() => setAdding("")} className="press-scale focus-ring" style={primaryBtnStyle}>
                  Add society value
                </button>
              )}
            </div>
          }
        />
        <DataTable<KeyRow>
          cols={COLS}
          rows={rows}
          skeletonRows={8}
          minWidth={900}
          empty={want ? `No setting matches "${q.trim()}".` : "No statutory parameters are configured."}
          renderRow={(r) => {
            const e = r.current;
            const st = e ? stateOf(e) : { label: "No value today", kind: "bad" as PillKind };
            return (
              <tr key={r.key} {...rowProps(() => setOpen(r))}>
                <td style={cellStyle("left", monoCell)}>{r.key}</td>
                <td style={cellStyle("left", { font: "600 13.5px/1.4 Figtree, sans-serif" })}>{SETTING[r.key] ?? r.key}</td>
                <td style={cellStyle("left")}>
                  {e ? valueText(e) : "—"}
                  {r.upcoming && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--info-ink,#12327A)" }}>{`${valueText(r.upcoming)} from ${formatDate(r.upcoming.effectiveFrom)}`}</div>}
                </td>
                <td style={cellStyle("left", { font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", maxWidth: 260 })}>{e ? sourceText(e) : "—"}</td>
                <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{e ? formatDate(e.effectiveFrom) : "—"}</td>
                <td style={cellStyle("right")}>
                  <Pill label={st.label} kind={st.kind} />
                </td>
              </tr>
            );
          }}
        />
      </div>

      {open && (
        <KeyModal
          row={open}
          canSet={canSet}
          onAdd={() => {
            setAdding(open.key);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {adding !== null && <OverrideModal societyId={societyId} keys={all.map((r) => r.key)} initialKey={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function KeyModal({ row, canSet, onAdd, onClose }: { row: KeyRow; canSet: boolean; onAdd: () => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} maxWidth={680}>
      <ModalHeader title={SETTING[row.key] ?? row.key} onClose={onClose} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 16px" }}>
        <Pill label={row.key} kind="mute" />
        {row.current && <Pill label={stateOf(row.current).label} kind={stateOf(row.current).kind} />}
      </div>
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>
        {row.current ? (
          <>
            In force today: <strong style={{ color: "var(--ink,#0F1A17)" }}>{valueText(row.current)}</strong>, since {formatDate(row.current.effectiveFrom)}.{row.current.sourceReference ? ` ${row.current.sourceReference}.` : ""}
          </>
        ) : (
          "No value is in force today."
        )}
      </div>
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden" }}>
        <DataTable
          cols={[{ label: "From" }, { label: "To" }, { label: "Value" }, { label: "Set by" }, { label: "Source" }]}
          rows={{ status: "ready", data: row.history }}
          minWidth={560}
          empty=""
          renderRow={(e) => (
            <tr key={e.id} style={rowBorder}>
              <td style={cellStyle("left", { whiteSpace: "nowrap" })}>{formatDate(e.effectiveFrom)}</td>
              <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{e.effectiveTo ? formatDate(e.effectiveTo) : "open"}</td>
              <td style={cellStyle("left", { font: "600 13px/1.4 Figtree, sans-serif" })}>{valueText(e)}</td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{e.scope === "SOCIETY" ? "Society" : "Platform"}</td>
              <td style={cellStyle("left", { font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" })}>
                {sourceText(e)}
                {e.verifiedOn && <div style={{ marginTop: 2 }}>Verified {formatDate(e.verifiedOn)}</div>}
              </td>
            </tr>
          )}
        />
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Close</GhostButton>
        {canSet && <PrimaryButton onClick={onAdd}>Set society value</PrimaryButton>}
      </ModalFooter>
    </ModalShell>
  );
}

/**
 * A dated society value for one key. Whether the society may set it at all,
 * and within what bound of the platform value, is the server's rule; its
 * refusal ("fixed by law", "can't be below …", "needs a resolution") is shown
 * as it words it.
 */
function OverrideModal({ societyId, keys, initialKey, onClose }: { societyId: string; keys: string[]; initialKey: string; onClose: () => void }) {
  const { toast } = useAdminStore();
  const set = useApiMutation(api.society.setStatutoryConfig);
  const [key, setKey] = useState(initialKey);
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(todayIso);
  const [meeting, setMeeting] = useState("");
  const [resolvedOn, setResolvedOn] = useState("");
  const [note, setNote] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (set.isPending) return;
    setFormError(null);
    const local: Record<string, string> = {};
    if (!key) local.key = "Choose the setting.";
    if (!value.trim()) local.value = "Enter the value.";
    if (!from) local.effectiveFrom = "Enter the date it applies from.";
    if ((meeting.trim() || resolvedOn) && !(meeting.trim() && resolvedOn)) local.resolution = "Give both the meeting and the date, or neither.";
    setField(local);
    if (Object.keys(local).length) return;
    try {
      const e = await set.mutateAsync({
        params: { societyId },
        body: { key, value: value.trim(), effectiveFrom: from, resolution: meeting.trim() ? { meetingRef: meeting.trim(), resolvedOn } : null, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      toast(`${SETTING[e.key] ?? e.key} set to ${valueText(e)} from ${formatDate(e.effectiveFrom)}.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["key", "value", "effectiveFrom", "resolution", "resolution.meetingRef", "resolution.resolvedOn", "note"]);
      setField({ ...split.field, resolution: split.field.resolution ?? split.field["resolution.meetingRef"] ?? split.field["resolution.resolvedOn"] });
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={set.isPending ? () => undefined : onClose} maxWidth={560}>
      <ModalHeader title="Set a society value" onClose={onClose} />
      <Blurb>The society's own value for a statutory setting, from a date. Values fixed by law cannot be changed, and others only within the bound the law allows; some need the general body's resolution.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SelectField label="Setting" req value={key} placeholder="Choose a setting" options={keys.map((k) => ({ value: k, label: `${SETTING[k] ?? k} · ${k}` }))} onChange={setKey} error={field.key} />
          <FieldPair>
            <TextField label="Value" req mono value={value} onChange={setValue} error={field.value} autoFocus={Boolean(initialKey)} hint={key.endsWith("_paise") ? "In paise: ₹75 is 7500" : key.endsWith("_percent") ? "A percent, for example 10" : undefined} />
            <TextField label="From" req type="date" value={from} onChange={setFrom} error={field.effectiveFrom} />
          </FieldPair>
          <FieldPair>
            <TextField label="Resolution" value={meeting} onChange={setMeeting} error={field.resolution} placeholder="AGM 2026, resolution 4" />
            <TextField label="Passed on" type="date" value={resolvedOn} onChange={setResolvedOn} />
          </FieldPair>
          <TextField label="Note" value={note} onChange={setNote} error={field.note} maxLength={300} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={set.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={set.isPending} busyLabel="Saving…">
            Save value
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}
