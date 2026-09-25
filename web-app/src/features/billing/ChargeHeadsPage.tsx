import { useState } from "react";
import { useApiMutation, toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type ChargeHead, type SocietyMembership } from "@chs/contract";
import type { z } from "zod";
import { holds } from "../../api/society";
import { LiveStatGrid } from "../../components/ApiTable";
import { DataTable, Note } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle, monoCell, rowBorder } from "../../lib/uiStyles";
import { GhostButton, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { Pill } from "../../components/Pill";
import { SkeletonText } from "../../components/Skeleton";
import { TextField } from "../../components/FormFields";
import { formatDate } from "../../lib/apiFormat";
import { ready, type LoadState } from "../../lib/loadState";
import { inr, nextPeriod, rateLabel, todayIso } from "../../lib/money";
import { CATEGORY_LABEL, METHOD_LABEL, isFund } from "../../lib/moneyLabels";
import { primaryBtnStyle, rowProps } from "../../lib/tableKit";
import { useAdminStore } from "../../store/AdminStore";
import { BillingGuard, BillingHeader } from "./BillingShell";
import { HEADS_PERMS } from "./billingAccess";
import { CreateHeadModal, RenameHeadModal, SetRateModal, UnitChargeModal } from "./HeadModals";

const COLS = [
  { label: "Code", align: "left" as const },
  { label: "Head", align: "left" as const },
  { label: "Apportionment", align: "left" as const },
  { label: "Current rate", align: "left" as const },
  { label: "Since", align: "left" as const },
  { label: "Status", align: "right" as const },
];

/**
 * Charge heads with their rate history (`billing.heads`). A head's category
 * fixes how it may be apportioned (Rule 106C-12); rates are dated and never
 * reach back into a published period. Opening a head shows its history,
 * sets a new rate and simulates what each unit would pay.
 */
export function ChargeHeadsPage() {
  return <BillingGuard need={HEADS_PERMS}>{(s) => <Heads society={s} />}</BillingGuard>;
}

function Heads({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const canEdit = holds(society, "billing.generate", "society.configure");
  const heads = useApiQuery(api.billing.heads, { params: { societyId } });
  const runs = useApiQuery(api.billing.runs, { params: { societyId } }, { enabled: holds(society, "billing.generate", "billing.publish") });
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rateFor, setRateFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  // Adding a unit amount replaces the head's panel, and closing it returns there.
  const [amountFor, setAmountFor] = useState<string | null>(null);

  const list = heads.data ?? [];
  const lastPublished = runs.data?.find((r) => r.status === "PUBLISHED") ?? null;
  // A new rate can start on the first day after the last published period.
  const earliest = lastPublished ? `${nextPeriod(lastPublished.period)}-01` : todayIso().slice(0, 8) + "01";
  const byId = new Map(list.map((h) => [h.id, h]));
  const openHead = open ? (byId.get(open) ?? null) : null;
  const rateHead = rateFor ? (byId.get(rateFor) ?? null) : null;
  const renameHead = renameFor ? (byId.get(renameFor) ?? null) : null;
  const amountHead = amountFor ? (byId.get(amountFor) ?? null) : null;

  const settled = heads.status !== "pending";
  const v = (x: string) => (!settled ? null : heads.isError ? "—" : x);
  const active = list.filter((h) => h.active);
  const stats = [
    { label: "Active heads", value: v(String(active.length)), note: `${list.length - active.length} retired` },
    { label: "Fund heads", value: v(String(active.filter((h) => isFund(h.category)).length)), note: "Rates set by the general body" },
    { label: "Without a rate", value: v(String(active.filter((h) => !h.currentRate && h.method !== "MANUAL").length)), note: "Not billed until a rate is set", fg: active.some((h) => !h.currentRate && h.method !== "MANUAL") ? "var(--warn,#B45309)" : undefined },
    { label: "Rates can start", value: runs.data || !lastPublished ? formatDate(earliest) : null, note: lastPublished ? `Bills to ${formatDate(lastPublished.periodEnd)} are published` : "No period published yet" },
  ];

  return (
    <>
      <BillingHeader
        sub="What each unit is charged, and how it is shared out. The category decides the allowed method under Rule 106C-12; every rate is dated, so a published bill never changes."
        actions={
          canEdit ? (
            <button type="button" onClick={() => setCreating(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
              Add charge head
            </button>
          ) : undefined
        }
      />
      <LiveStatGrid stats={stats} />
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <DataTable<ChargeHead>
          cols={COLS}
          rows={toLoadState(heads)}
          skeletonRows={8}
          minWidth={760}
          empty="No charge heads yet. Add service charges first — most other heads are shared out alongside it."
          renderRow={(h) => (
            <tr key={h.id} {...rowProps(() => setOpen(h.id))}>
              <td style={cellStyle("left", monoCell)}>{h.code}</td>
              <td style={cellStyle()}>
                <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{h.name}</div>
                {/* The category is worth a line only when the name does not already say it. */}
                {(() => {
                  const sub = [
                    CATEGORY_LABEL[h.category] !== h.name ? CATEGORY_LABEL[h.category] : null,
                    h.baseHeadId && byId.get(h.baseHeadId) ? `of ${byId.get(h.baseHeadId)?.name}` : null,
                    h.gstApplicable ? "GST" : null,
                  ].filter(Boolean);
                  return sub.length ? <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{sub.join(" · ")}</div> : null;
                })()}
              </td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>
                <div>{METHOD_LABEL[h.method]}</div>
                <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-muted,#8A9995)" }}>{h.method}</div>
              </td>
              <td style={cellStyle("left", { font: "600 13.5px/1.4 Figtree, sans-serif", color: h.currentRate || h.method === "MANUAL" ? undefined : "var(--warn,#B45309)" })}>
                {h.method === "MANUAL" ? "Set per unit" : rateLabel(h.method, h.currentRate?.rate ?? null, h.currentRate?.rateByType)}
                {h.rates.length > 1 && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{h.rates.length} rates on record</div>}
              </td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" })}>{h.currentRate ? formatDate(h.currentRate.effectiveFrom) : "—"}</td>
              <td style={cellStyle("right")}>
                <Pill label={h.active ? (upcoming(h) ? "Rate change due" : "Active") : "Retired"} kind={h.active ? (upcoming(h) ? "info" : "ok") : "mute"} />
              </td>
            </tr>
          )}
        />
      </div>

      {openHead && (
        <HeadModal
          societyId={societyId}
          head={openHead}
          base={openHead.baseHeadId ? (byId.get(openHead.baseHeadId) ?? null) : null}
          canEdit={canEdit}
          onAddAmount={() => {
            setAmountFor(openHead.id);
            setOpen(null);
          }}
          onRename={() => {
            setRenameFor(openHead.id);
            setOpen(null);
          }}
          onSetRate={() => {
            setRateFor(openHead.id);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {creating && (
        <CreateHeadModal
          societyId={societyId}
          heads={list}
          onClose={() => setCreating(false)}
          onCreated={(h) => {
            setCreating(false);
            if (h.method !== "MANUAL") setRateFor(h.id);
          }}
        />
      )}
      {rateHead && <SetRateModal societyId={societyId} head={rateHead} earliest={earliest} onClose={() => setRateFor(null)} />}
      {renameHead && (
        <RenameHeadModal
          societyId={societyId}
          head={renameHead}
          onClose={() => {
            setRenameFor(null);
            setOpen(renameHead.id);
          }}
        />
      )}
      {amountHead && (
        <UnitChargeModal
          societyId={societyId}
          head={amountHead}
          earliest={earliest}
          onClose={() => {
            setAmountFor(null);
            setOpen(amountHead.id);
          }}
        />
      )}
    </>
  );
}

/** A rate already set for a later date than today. */
function upcoming(h: ChargeHead): boolean {
  const today = todayIso();
  return h.rates.some((r) => r.effectiveFrom > today);
}

/** One head: what it is, its dated rates, and a simulation of the next bill's amounts. */
function HeadModal({
  societyId,
  head,
  base,
  canEdit,
  onAddAmount,
  onRename,
  onSetRate,
  onClose,
}: {
  societyId: string;
  head: ChargeHead;
  base: ChargeHead | null;
  canEdit: boolean;
  onAddAmount: () => void;
  onRename: () => void;
  onSetRate: () => void;
  onClose: () => void;
}) {
  const { toast } = useAdminStore();
  const [simulating, setSimulating] = useState(false);
  const update = useApiMutation(api.billing.updateHead);
  const toggle = () =>
    update.mutate(
      { params: { societyId, headId: head.id }, body: { active: !head.active } },
      { onSuccess: (h) => toast(h.active ? `${h.name} is billed again from the next run.` : `${h.name} retired. It is left out of the next run.`, h.active ? "ok" : "warn"), onError: (e) => toast(e.message, "warn") },
    );
  const today = todayIso();

  return (
    <ModalShell onClose={onClose} maxWidth={660}>
      <ModalHeader title={head.name} onClose={onClose} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 18px" }}>
        <Pill label={head.code} kind="mute" />
        <Pill label={CATEGORY_LABEL[head.category]} kind="info" />
        <Pill label={head.active ? "Active" : "Retired"} kind={head.active ? "ok" : "mute"} />
        {head.gstApplicable && <Pill label="GST applies" kind="warn" />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "14px 16px", marginBottom: 18 }}>
        <Fact k="Apportionment" v={METHOD_LABEL[head.method]} />
        <Fact k="Current rate" v={head.method === "MANUAL" ? "Set per unit" : rateLabel(head.method, head.currentRate?.rate ?? null, head.currentRate?.rateByType)} />
        {base && <Fact k="Percentage of" v={base.name} />}
        {head.currentRate?.resolution && <Fact k="Resolution" v={`${head.currentRate.resolution.meetingRef} · ${formatDate(head.currentRate.resolution.resolvedOn)}`} />}
        {Object.keys(head.filters).length > 0 && <Fact k="Applies to" v={filterText(head.filters)} />}
      </div>

      {/* A manual head has no rates: its amounts are set per unit, below. */}
      {head.method !== "MANUAL" && (
        <>
          <div style={{ font: "600 13.5px/1.3 Figtree, sans-serif", marginBottom: 8 }}>Rate history</div>
          <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
            <DataTable
              cols={[{ label: "From" }, { label: "To" }, { label: "Rate" }, { label: "Authority" }]}
              rows={{ status: "ready", data: head.rates }}
              minWidth={480}
              empty="No rate yet — this head is not billed until one is set."
              renderRow={(r) => {
                const current = r.id === head.currentRate?.id;
                const future = r.effectiveFrom > today;
                return (
                  <tr key={r.id} style={rowBorder}>
                    <td style={cellStyle("left", { whiteSpace: "nowrap" })}>{formatDate(r.effectiveFrom)}</td>
                    <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{r.effectiveTo ? formatDate(r.effectiveTo) : "open"}</td>
                    <td style={cellStyle("left", { font: "600 13px/1.4 Figtree, sans-serif" })}>
                      {rateLabel(head.method, r.rate, r.rateByType)} {current && <Pill label="Current" kind="ok" style={{ marginLeft: 6 }} />}
                      {future && <Pill label="Upcoming" kind="info" style={{ marginLeft: 6 }} />}
                    </td>
                    <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", font: "400 12.5px/1.4 Figtree, sans-serif" })}>{[r.resolution ? r.resolution.meetingRef : null, r.note].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                );
              }}
            />
          </div>
        </>
      )}

      {head.method === "MANUAL" && <UnitAmounts societyId={societyId} head={head} canEdit={canEdit} onAdd={onAddAmount} />}

      {simulating && <Simulation societyId={societyId} head={head} />}

      <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {canEdit && <GhostButton onClick={onRename}>Rename</GhostButton>}
        {canEdit && (
          <GhostButton onClick={toggle} disabled={update.isPending}>
            {update.isPending ? "Saving…" : head.active ? "Retire head" : "Reactivate"}
          </GhostButton>
        )}
        {!simulating && head.method !== "MANUAL" && <GhostButton onClick={() => setSimulating(true)}>Simulate</GhostButton>}
        {canEdit && head.method !== "MANUAL" && <PrimaryButton onClick={onSetRate}>Set new rate</PrimaryButton>}
      </div>
    </ModalShell>
  );
}

type UnitChargeRow = z.infer<typeof schemas.billing.UnitCharge>;

/** A manual head's per-unit amounts (`billing.unitCharges` for the head), newest first, with the dated history. */
function UnitAmounts({ societyId, head, canEdit, onAdd }: { societyId: string; head: ChargeHead; canEdit: boolean; onAdd: () => void }) {
  const charges = useApiQuery(api.billing.unitCharges, { params: { societyId }, query: { headId: head.id } });
  const today = todayIso();
  const state = toLoadState(charges);
  const rows: LoadState<UnitChargeRow[]> = state.status === "ready" ? ready(state.data.slice().sort((a, b) => a.unitLabel.localeCompare(b.unitLabel) || b.effectiveFrom.localeCompare(a.effectiveFrom))) : state;
  // Each unit's latest amount that has not ended — what the next run bills it, whether it started already or starts later.
  const latest = new Map<string, UnitChargeRow>();
  for (const c of charges.data ?? []) {
    if (c.effectiveTo && c.effectiveTo <= today) continue;
    const cur = latest.get(c.unitId);
    if (!cur || c.effectiveFrom > cur.effectiveFrom) latest.set(c.unitId, c);
  }
  const live = [...latest.values()];
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, font: "600 13.5px/1.3 Figtree, sans-serif" }}>
          Unit amounts
          {charges.data && (
            <span style={{ marginLeft: 8, font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
              {live.length} unit{live.length === 1 ? "" : "s"} · {inr(live.reduce((s, c) => s + c.amountPaise, 0))} a month
            </span>
          )}
        </div>
        {canEdit && head.active && <GhostButton onClick={onAdd}>Add unit amount</GhostButton>}
      </div>
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
        <DataTable
          cols={[{ label: "Unit" }, { label: "From" }, { label: "Until" }, { label: "Amount", align: "right" }]}
          rows={rows}
          skeletonRows={3}
          minWidth={460}
          empty="No unit has an amount for this head, so it bills nothing yet."
          renderRow={(c) => (
            <tr key={c.id} style={rowBorder}>
              <td style={cellStyle("left", monoCell)}>
                {c.unitLabel}
                {c.note && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "normal" }}>{c.note}</div>}
              </td>
              <td style={cellStyle("left", { whiteSpace: "nowrap" })}>{formatDate(c.effectiveFrom)}</td>
              <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{c.effectiveTo ? formatDate(c.effectiveTo) : "open"}</td>
              <td style={cellStyle("right", amountCell)}>{inr(c.amountPaise)}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)", marginBottom: 6 }}>{k}</div>
      <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", overflowWrap: "anywhere" }}>{v}</div>
    </div>
  );
}

function filterText(f: ChargeHead["filters"]): string {
  const parts: string[] = [];
  if (f.unitTypes?.length) parts.push(f.unitTypes.map((t) => t.toLowerCase().replace(/_/g, " ")).join(", "));
  if (f.occupancy?.length) parts.push(f.occupancy.map((t) => t.toLowerCase().replace(/_/g, " ")).join(", "));
  if (f.buildingIds?.length) parts.push(`${f.buildingIds.length} building${f.buildingIds.length === 1 ? "" : "s"}`);
  if (f.floorMin !== undefined || f.floorMax !== undefined) parts.push(`floors ${f.floorMin ?? "any"}–${f.floorMax ?? "any"}`);
  return parts.join(" · ") || "All units";
}

type SimRow = z.infer<typeof schemas.billing.SimulationRow>;

/** `billing.simulate`: what each unit would be billed for this head in one month, as of a date. */
function Simulation({ societyId, head }: { societyId: string; head: ChargeHead }) {
  const [asOf, setAsOf] = useState(todayIso());
  const [q, setQ] = useState("");
  const sim = useApiQuery(api.billing.simulate, { params: { societyId, headId: head.id }, query: { asOf: /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : undefined } });
  const state = toLoadState(sim);
  const want = q.trim().toUpperCase();
  const rows: LoadState<SimRow[]> = state.status === "ready" ? ready(want ? state.data.rows.filter((r) => r.unitLabel.toUpperCase().includes(want)) : state.data.rows) : state;

  return (
    <div style={{ borderTop: "1px solid var(--border-soft,#EDF1EF)", paddingTop: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 160px" }}>
          <TextField label="As of" type="date" value={asOf} onChange={setAsOf} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <TextField label="Find unit" mono value={q} onChange={(x) => setQ(x.toUpperCase())} placeholder="B-07" />
        </div>
      </div>
      {sim.data && (
        <Note kind="info" style={{ marginBottom: 12 }}>
          {inr(sim.data.totalPaise)} a month across {sim.data.units} unit{sim.data.units === 1 ? "" : "s"}, at the rates in force on {formatDate(sim.data.asOf)}.
        </Note>
      )}
      {sim.isPending && (
        <div style={{ marginBottom: 12 }}>
          <SkeletonText lines={1} />
        </div>
      )}
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
        <DataTable
          cols={[{ label: "Unit" }, { label: "Basis" }, { label: "Amount", align: "right" }]}
          rows={rows}
          minWidth={420}
          empty={q ? `No unit matches "${q}".` : "No unit is billed for this head on that date."}
          renderRow={(r) => (
            <tr key={r.unitId} style={rowBorder}>
              <td style={cellStyle("left", monoCell)}>{r.unitLabel}</td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", font: "400 12.5px/1.4 Figtree, sans-serif" })}>{r.basis}</td>
              <td style={cellStyle("right", amountCell)}>{inr(r.amountPaise)}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
