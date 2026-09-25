import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type Approval, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { LiveStatGrid, PageHeader, PagerButtons, type Chip } from "../../components/ApiTable";
import { DataTable, Note } from "../../components/Kit";
import { FormError, TextField } from "../../components/FormFields";
import { GhostButton, ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { enumLabel, formatDate, formatDateTime, formatMobile, formatWhen } from "../../lib/apiFormat";
import { inr } from "../../lib/money";
import { cardStyle, cellStyle, monoCell } from "../../lib/uiStyles";
import { rowProps, useCursorPager } from "../../lib/tableKit";
import { useAdminStore } from "../../store/AdminStore";
import { MembersTabs } from "./MembersPage";

type Status = Approval["status"];
const PAGE_SIZE = 25;

const COLS = [
  { label: "Request", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Requested by", align: "left" as const },
  { label: "Details", align: "left" as const },
  { label: "Received", align: "left" as const },
  { label: "Status", align: "right" as const },
];

const KIND_LABEL: Record<Approval["kind"], string> = {
  FAMILY_ADD: "Add family member",
  VEHICLE_ADD: "Register vehicle",
  PET_ADD: "Register pet",
  TENANT_ADD: "Record tenant",
  PROFILE_CHANGE: "Profile change",
  DATA_CORRECTION: "Correction",
};

const STATUS_PILL: Record<Status, { label: string; kind: "warn" | "ok" | "mute" }> = {
  PENDING: { label: "Pending", kind: "warn" },
  APPROVED: { label: "Approved", kind: "ok" },
  REJECTED: { label: "Rejected", kind: "mute" },
};

/**
 * The approvals queue (`members.approvals`): what residents asked for from
 * the app — a family member, a vehicle, a pet, a tenant, a correction to
 * their record — waiting for the office. Approving applies the request as
 * sent (the server creates the family member, vehicle, pet or tenancy);
 * rejecting records the decision and the note, which the resident sees.
 *
 * It sits beside the unit register under Members & units, because every
 * request is about a unit and is decided with the unit in mind.
 */
export function ApprovalsPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Members & units" />;
  if (!holds(society, "members.manage")) return <NoAccess title="Approvals" need="members.manage" />;
  return <Approvals key={society.societyId} society={society} />;
}

function Approvals({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const [status, setStatus] = useState<Status>("PENDING");
  const [open, setOpen] = useState<Approval | null>(null);
  const paging = useCursorPager(status);

  const list = useApiQuery(api.members.approvals, { params: { societyId }, query: { status, cursor: paging.cursor, limit: PAGE_SIZE } }, { placeholderData: keepPreviousData });
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(list.data?.nextCursor);
  }, [list.data?.nextCursor, list.isPlaceholderData, learn]);

  // One-row reads for the stat cards: only `total` is used.
  const pending = useApiQuery(api.members.approvals, { params: { societyId }, query: { status: "PENDING", limit: 1 } });
  const approved = useApiQuery(api.members.approvals, { params: { societyId }, query: { status: "APPROVED", limit: 1 } });
  const rejected = useApiQuery(api.members.approvals, { params: { societyId }, query: { status: "REJECTED", limit: 1 } });
  const count = (q: typeof pending) => (q.data ? String(q.data.total ?? `${q.data.items.length}${q.data.nextCursor ? "+" : ""}`) : q.isError ? "—" : null);
  const oldest = status === "PENDING" && !list.isPlaceholderData && paging.pageNo === 1 ? (list.data?.items[0] ?? null) : null;
  const stats = [
    { label: "Waiting", value: count(pending), note: !pending.data?.total ? "Nothing waiting on you" : oldest ? `Oldest from ${formatWhen(oldest.createdAt)}` : "Tenancy, family, vehicle and pet requests", fg: pending.data?.total ? "var(--warn,#B45309)" : undefined },
    { label: "Approved", value: count(approved), note: "Applied to the unit as requested" },
    { label: "Rejected", value: count(rejected), note: "The resident sees your note" },
  ];

  const chips: Chip[] = (["PENDING", "APPROVED", "REJECTED"] as const).map((s) => ({ label: STATUS_PILL[s].label, active: status === s, onClick: () => setStatus(s) }));
  const state = toLoadState(list);
  const rows = state.status === "ready" ? { status: "ready" as const, data: state.data.items } : state;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? null;
  const first = (paging.pageNo - 1) * PAGE_SIZE + 1;
  const footer = list.status !== "success" ? " " : items.length === 0 ? "No requests" : `Showing ${first}–${first + items.length - 1}${total !== null ? ` of ${total}` : ""} request${total === 1 ? "" : "s"}`;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title="Members & units" sub="Requests residents raised from the app. Approving applies them to the unit exactly as sent; rejecting records your note, which the resident sees." />
      <MembersTabs canApprove />
      <LiveStatGrid stats={stats} />
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick}
              aria-pressed={c.active}
              className="press-scale focus-ring"
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 999,
                border: `1px solid ${c.active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`,
                background: c.active ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)",
                color: c.active ? "#ffffff" : "var(--ink-soft,#4A5B56)",
                font: "600 12.5px/1 Figtree, sans-serif",
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <DataTable<Approval>
          cols={COLS}
          rows={rows}
          skeletonRows={6}
          minWidth={900}
          empty={status === "PENDING" ? "Nothing waiting. Requests residents raise from the app appear here." : `No ${STATUS_PILL[status].label.toLowerCase()} requests yet.`}
          renderRow={(a) => (
            <tr key={a.id} {...rowProps(() => setOpen(a))}>
              <td style={cellStyle("left")}>
                <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{KIND_LABEL[a.kind]}</div>
                <div style={{ marginTop: 2, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{a.summary}</div>
              </td>
              <td style={cellStyle("left", monoCell)}>{a.unitLabel ?? "—"}</td>
              <td style={cellStyle("left")}>{a.requestedByName}</td>
              <td style={cellStyle("left", { font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", maxWidth: 280 })}>
                {payloadFacts(a)
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ") || "—"}
              </td>
              <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{formatWhen(a.createdAt)}</td>
              <td style={cellStyle("right")}>
                {a.status === "PENDING" ? (
                  <span style={{ font: "600 12.5px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)", whiteSpace: "nowrap" }}>Review →</span>
                ) : (
                  <>
                    <Pill label={STATUS_PILL[a.status].label} kind={STATUS_PILL[a.status].kind} />
                    {a.decidedByName && <div style={{ marginTop: 4, font: "400 11.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{`${a.decidedByName} · ${formatDate(a.decidedAt)}`}</div>}
                  </>
                )}
              </td>
            </tr>
          )}
        />
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{footer}</span>
          <PagerButtons pager={paging.pager(Boolean(list.data?.nextCursor))} />
        </div>
      </div>

      {open && <DecideModal societyId={societyId} approval={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const isoDate = (v: unknown) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? formatDate(s) : s;
};
const money = (v: unknown) => (typeof v === "number" ? inr(v) : null);
const mobile = (v: unknown) => {
  const s = str(v);
  return s ? formatMobile(s) : null;
};

/**
 * The request as the resident sent it, as label/value pairs. The payload is
 * the body of the endpoint the request stands in for (FamilyMemberInput,
 * VehicleInput, PetInput, CreateTenancyBody), so each kind reads its own
 * fields; anything unexpected is listed as it came.
 */
function payloadFacts(a: Approval): [string, string][] {
  const p = a.payload;
  const out: [string, string | null][] = [];
  switch (a.kind) {
    case "FAMILY_ADD":
      out.push(["Name", str(p.name)], ["Relation", str(p.relation)], ["Mobile", mobile(p.mobile)], ["Born", isoDate(p.dateOfBirth)]);
      break;
    case "VEHICLE_ADD":
      out.push(
        ["Plate", str(p.plate)],
        ["Type", p.type ? enumLabel(str(p.type)) : null],
        ["Make", str(p.make)],
        ["Colour", str(p.colour)],
        ["Owner", str(p.ownerName)],
        ["Sticker", str(p.stickerNo)],
        ["Parking slot", p.parkingSlotId ? "Asked for one of the unit's slots" : null],
      );
      break;
    case "PET_ADD":
      out.push(["Name", str(p.name)], ["Species", str(p.species)], ["Breed", str(p.breed)], ["Vaccinated until", isoDate(p.vaccinatedUntil)]);
      break;
    case "TENANT_ADD": {
      const t = obj(p.tenant);
      out.push(
        ["Tenant", str(t.name)],
        ["Mobile", mobile(t.mobile)],
        ["Email", str(t.email)],
        ["From", isoDate(p.startDate)],
        ["To", isoDate(p.endDate)],
        ["Rent", money(p.monthlyRentPaise)],
        ["Deposit", money(p.depositPaise)],
        ["Police intimation", str(p.policeIntimationRef)],
        ["Allowed occupants", str(p.allowedOccupants)],
        ["Bills paid by", p.billPayer ? enumLabel(str(p.billPayer)) : null],
        ["App login", p.createLogin === true ? "Requested" : null],
      );
      break;
    }
    case "DATA_CORRECTION":
      out.push(["Message", str(p.message)]);
      break;
    default:
      for (const [k, v] of Object.entries(p)) out.push([enumLabel(k.replace(/([a-z])([A-Z])/g, "$1_$2")), str(v) ?? (typeof v === "object" && v !== null ? JSON.stringify(v) : null)]);
  }
  return out.filter((x): x is [string, string] => x[1] !== null);
}

/** What approving will do, said before the admin confirms. */
function effectOf(a: Approval): string {
  const unit = a.unitLabel ?? "the unit";
  switch (a.kind) {
    case "FAMILY_ADD":
      return `${str(a.payload.name) ?? "They"} will be added to ${unit}'s household.`;
    case "VEHICLE_ADD":
      return `${str(a.payload.plate) ?? "The vehicle"} will be registered to ${unit}, and the gate will recognise it at once.`;
    case "PET_ADD":
      return `${str(a.payload.name) ?? "The pet"} will be added to ${unit}'s pet register.`;
    case "TENANT_ADD":
      return `The tenancy will be recorded and ${unit} becomes tenanted from its start date${a.payload.createLogin === true ? "; the tenant gets an app login" : ""}.`;
    default:
      return "Nothing is changed automatically — approving records that the office has acted on it. Make the change on the unit's record yourself.";
  }
}

/**
 * One request: everything the resident sent, then approve or reject with an
 * optional note. Either way there is a confirm step, because a decision is
 * final and approval changes the register. If another admin decided first
 * the server answers CONFLICT, which is shown as it says, and the queue is
 * refreshed.
 */
function DecideModal({ societyId, approval: a, onClose }: { societyId: string; approval: Approval; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useAdminStore();
  const queryClient = useQueryClient();
  const decide = useApiMutation(api.members.decideApproval);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const facts = payloadFacts(a);
  const busy = decide.isPending;

  const run = async (decision: "APPROVED" | "REJECTED") => {
    setError(null);
    try {
      const r = await decide.mutateAsync({ params: { societyId, approvalId: a.id }, body: { decision, note: note.trim() || null } });
      toast(r.status === "APPROVED" ? `Approved. ${KIND_LABEL[r.kind]} applied${r.unitLabel ? ` to ${r.unitLabel}` : ""}.` : `Rejected. ${r.requestedByName} will see your note.`, r.status === "APPROVED" ? "ok" : "warn");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setConflict(true);
        // Someone else decided it; the queue on screen is out of date.
        void queryClient.invalidateQueries({ queryKey: ["members.approvals"] });
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setConfirm(null);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={580}>
      <ModalHeader title={KIND_LABEL[a.kind]} onClose={onClose} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 16px" }}>
        <Pill label={STATUS_PILL[a.status].label} kind={STATUS_PILL[a.status].kind} />
        {a.unitLabel && <Pill label={a.unitLabel} kind="info" />}
      </div>
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>
        {a.requestedByName} asked on {formatDateTime(a.createdAt)}: <strong style={{ color: "var(--ink,#0F1A17)" }}>{a.summary}</strong>
      </div>
      {facts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "14px 16px", padding: 16, border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, marginBottom: 16 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ minWidth: 0, gridColumn: k === "Message" ? "1 / -1" : undefined }}>
              <div style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)", marginBottom: 6 }}>{k}</div>
              <div style={{ font: "600 13.5px/1.45 Figtree, sans-serif", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {a.status !== "PENDING" ? (
        <>
          <Note kind={a.status === "APPROVED" ? "ok" : "mute"}>
            {STATUS_PILL[a.status].label} by {a.decidedByName ?? "an administrator"} on {formatDateTime(a.decidedAt)}.{a.decisionNote ? ` Note: “${a.decisionNote}”` : ""}
          </Note>
          <ModalFooter>
            {a.unitId && <GhostButton onClick={() => navigate(`/members/record/${a.unitId}`)}>Open unit</GhostButton>}
            <PrimaryButton onClick={onClose}>Close</PrimaryButton>
          </ModalFooter>
        </>
      ) : conflict ? (
        <>
          <FormError message={error} />
          <ModalFooter>
            <PrimaryButton onClick={onClose}>Back to the queue</PrimaryButton>
          </ModalFooter>
        </>
      ) : confirm ? (
        <>
          <Note kind={confirm === "APPROVED" ? "info" : "warn"} style={{ marginBottom: 4 }}>
            {confirm === "APPROVED" ? effectOf(a) : `The request is closed and ${a.requestedByName} is told it was rejected${note.trim() ? ", with your note" : ""}.`} A decision cannot be undone.
          </Note>
          <ModalFooter>
            <GhostButton onClick={() => setConfirm(null)} disabled={busy}>
              Back
            </GhostButton>
            <PrimaryButton tone={confirm === "REJECTED" ? "bad" : "accent"} busy={busy} busyLabel={confirm === "APPROVED" ? "Approving…" : "Rejecting…"} onClick={() => void run(confirm)}>
              {confirm === "APPROVED" ? "Approve request" : "Reject request"}
            </PrimaryButton>
          </ModalFooter>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <TextField label="Note to the resident" multiline rows={2} maxLength={300} value={note} onChange={setNote} placeholder="Registered; collect the sticker from the office" />
            <FormError message={error} />
          </div>
          <ModalFooter>
            {a.unitId && <GhostButton onClick={() => navigate(`/members/record/${a.unitId}`)}>Open unit</GhostButton>}
            <GhostButton onClick={() => setConfirm("REJECTED")}>Reject</GhostButton>
            <PrimaryButton onClick={() => setConfirm("APPROVED")}>Approve</PrimaryButton>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
}
