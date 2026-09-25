import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type BillRecord, type FamilyMember, type Ledger, type Pet, type SocietyMembership, type UnitOverview, type Vehicle } from "@chs/contract";
import { holds, useCurrentSociety, userTypeLabel } from "../../api/society";
import { NoSociety } from "../../components/NoSociety";
import { ConfirmModal, RetryButton } from "../../components/Kit";
import { enumLabel, formatDate, formatMobile } from "../../lib/apiFormat";
import type { PillKind } from "../../lib/types";
import { inr, nextPeriod, todayIso } from "../../lib/money";
import { useAdminStore } from "../../store/AdminStore";
import { RecordAlertCard, RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard, type RecordAction } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";
import { AddMemberModal, EndTenancyModal, FamilyModal, OccupancyModal, PetModal, TenancyModal, VehicleModal } from "./MemberModals";
import { RecordPaymentModal } from "../payments/RecordPaymentModal";
import { AdhocBillModal } from "../billing/BillingModals";
import { UnitChargeModal } from "../billing/HeadModals";

/**
 * A unit's record from `members.unitOverview` — owners, occupancy, tenancy,
 * household, vehicles, parking, nominees and app logins on one screen, in the
 * design's member-record layout.
 *
 * Money comes from billing: the ledger gives what is outstanding and what
 * was paid this financial year, the unit's bills fill the design's ledger
 * section, manual heads' amounts are set here, and payments are received
 * from here. The helpdesk, bookings and gate sections have no API yet and
 * are left out.
 *
 * With members.manage the register is edited in place: occupancy from a
 * date, the tenancy (record, edit, end), family, vehicles and pets. The
 * server applies an admin's change directly; only residents' requests go
 * through the approvals queue.
 */
export function UnitRecordPage({ unitId }: { unitId: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Members & units" />;
  return <UnitRecord society={society} unitId={unitId} />;
}

function UnitRecord({ society, unitId }: { society: SocietyMembership; unitId: string }) {
  const societyId = society.societyId;
  const navigate = useNavigate();
  const back = () => navigate("/members");
  const overview = useApiQuery(api.members.unitOverview, { params: { societyId, unitId } });
  const state = toLoadState(overview);

  if (state.status === "loading") return <RecordSkeleton />;
  if (state.status === "error") {
    const missing = overview.error instanceof ApiError && overview.error.code === "NOT_FOUND";
    return (
      <RecordMessage
        title={missing ? "This unit could not be found" : state.message}
        body={missing ? "It may belong to another society, or the link is out of date." : "Nothing was changed."}
        onBack={back}
        action={
          missing ? undefined : <RetryButton onClick={state.retry} />
        }
      />
    );
  }
  return <UnitRecordView society={society} data={state.data} onBack={back} />;
}


const KIND: Record<string, string> = { PRIMARY: "Primary owner", CO_OWNER: "Co-owner", ASSOCIATE: "Associate member" };

function paise(p: number | null): string {
  return p === null ? "Not recorded" : inr(p);
}

/** Received this financial year (April to March): payments credited, leaving out receipts since cancelled. */
function paidThisFy(ledger: Ledger): { paid: number; count: number } {
  const [y, m] = todayIso().split("-").map(Number);
  const fyStart = `${m >= 4 ? y : y - 1}-04-01`;
  const reversed = new Set(ledger.entries.filter((e) => e.kind === "REVERSAL" && e.refType === "payment").map((e) => e.refId));
  let paid = 0;
  let count = 0;
  for (const e of ledger.entries) {
    if (e.date < fyStart || e.kind !== "PAYMENT" || reversed.has(e.refId)) continue;
    paid += e.creditPaise;
    count++;
  }
  return { paid, count };
}

/** The design's ledger rows say due / paid / overdue; words chosen so the shared status matcher colours them right. */
const BILL_WORD: Record<BillRecord["paymentState"], string> = { DRAFT: "draft", UNPAID: "due", PARTLY_PAID: "balance due", PAID: "paid", OVERDUE: "overdue", CANCELLED: "cancelled" };

type Modal =
  | { kind: "member" | "pay" | "charge" | "occupancy" | "tenancy" | "editTenancy" | "endTenancy" | "family" | "vehicle" | "pet" | "unitCharge" }
  | { kind: "removeFamily"; row: FamilyMember }
  | { kind: "removeVehicle"; row: Vehicle }
  | { kind: "removePet"; row: Pet }
  | null;

function UnitRecordView({ society, data, onBack }: { society: SocietyMembership; data: UnitOverview; onBack: () => void }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [modal, setModal] = useState<Modal>(null);
  const open = (kind: Exclude<NonNullable<Modal>, { row: unknown }>["kind"]) => () => setModal({ kind });
  const close = () => setModal(null);
  const canBills = holds(society, "billing.generate", "billing.publish", "payments.record", "accounts.manage");
  const canPay = holds(society, "payments.record");
  // The register's writes (occupancy, tenancy, family, vehicles, pets, members) need members.manage.
  const canManage = holds(society, "members.manage");
  // Manual heads' per-unit amounts: billing.unitCharges / createUnitCharge.
  const canCharges = holds(society, "billing.generate", "society.configure");
  const ledger = useApiQuery(api.billing.ledger, { params: { societyId, unitId: data.unit.id } });
  const bills = useApiQuery(api.billing.bills, { params: { societyId }, query: { unitId: data.unit.id, limit: 12 } }, { enabled: canBills });
  const unitCharges = useApiQuery(api.billing.unitCharges, { params: { societyId }, query: { unitId: data.unit.id } }, { enabled: canCharges });
  const heads = useApiQuery(api.billing.heads, { params: { societyId } }, { enabled: canCharges });
  const runs = useApiQuery(api.billing.runs, { params: { societyId } }, { enabled: canCharges && holds(society, "billing.generate", "billing.publish") });
  const due = ledger.data?.balancePaise ?? 0;
  const { unit, currentMembers, pastMembers, occupancy, occupancyHistory, activeTenancy, pastTenancies, family, vehicles, pets, parkingSlots, nominees, appUsers } = data;
  const primary = currentMembers.find((m) => m.kind === "PRIMARY") ?? currentMembers[0] ?? null;
  const name = primary?.person.name ?? unit.label;
  const occ = occupancy ? enumLabel(occupancy.status) : "Not recorded";
  const since = primary?.admissionDate ?? null;
  const area = unit.carpetAreaSqft === null ? null : `${unit.carpetAreaSqft.toLocaleString("en-IN")} sq ft`;

  const chips: [string, PillKind][] = [
    [occupancy ? occ : "Occupancy not recorded", occupancy ? "info" : "warn"],
    ...(activeTenancy ? ([[`Tenant · ${activeTenancy.tenant.name}`, "info"]] as [string, PillKind][]) : []),
    ...(!primary ? ([["No owner recorded", "warn"]] as [string, PillKind][]) : []),
    ...(area ? [] : ([["Carpet area missing", "warn"]] as [string, PillKind][])),
    ...(due > 0 ? ([[`${inr(due)} outstanding`, "bad"]] as [string, PillKind][]) : []),
  ];

  const muted = "var(--ink-muted,#8A9995)";
  const openBills = (bills.data?.items ?? []).filter((b) => b.balancePaise > 0 && b.status === "PUBLISHED");
  const oldest = openBills.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  const tiles = [
    tile("Occupancy", occ, occupancy ? `Since ${formatDate(occupancy.effectiveFrom)}` : "Record it to bill non-occupancy correctly", occupancy ? "var(--accent,#0E6B5C)" : "var(--warn,#B45309)"),
    tile("Carpet area", area ?? "Not on file", area ? `${unit.waterInlets} water inlet${unit.waterInlets === 1 ? "" : "s"} · ${unit.liftServed ? "lift served" : "no lift"}` : "Needed for billing", area ? "var(--info,#1D4ED8)" : "var(--warn,#B45309)"),
    ledger.data
      ? (() => {
          const fy = paidThisFy(ledger.data);
          return tile("Paid this FY", inr(fy.paid), fy.count ? `${fy.count} payment${fy.count === 1 ? "" : "s"} since 1 April` : "Nothing received this year", "var(--ok,#167A3C)");
        })()
      : tile("Paid this FY", "—", ledger.isError ? "Could not load the ledger" : "Loading…", muted),
    ledger.data
      ? tile("Outstanding", due > 0 ? inr(due) : "Nil", due > 0 ? (oldest ? `Due ${formatDate(oldest.dueDate)}` : "Owed by the unit") : ledger.data.advancePaise > 0 ? `${inr(ledger.data.advancePaise)} in advance` : "Nothing due", due > 0 ? "var(--bad,#C0342B)" : muted)
      : tile("Outstanding", "—", ledger.isError ? "Could not load the ledger" : "Loading…", muted),
  ];

  const settled = (bills.data?.items ?? []).filter((b) => b.paymentState === "PAID").length;
  const ledgerSection = section({
    h: "Ledger",
    sub: bills.data ? `${openBills.length} unpaid · ${settled} settled${bills.data.nextCursor ? ` · latest ${bills.data.items.length}` : ""}` : "Latest bills",
    action: holds(society, "billing.publish") ? "Add charge" : undefined,
    type: "table",
    head: ["Entry", "Amount", "Status", "When"],
    rows: (bills.data?.items ?? []).map((b) => [b.title, inr(b.balancePaise > 0 && b.paidPaise > 0 ? b.balancePaise : b.totalPaise), BILL_WORD[b.paymentState], formatDate(b.billDate)]),
    empty: "No bills yet for this unit.",
  });

  const actions: RecordAction[] = [
    ...(canPay ? [{ label: "Record payment", kind: "primary" as const, onClick: open("pay") }] : []),
    { label: "Unit ledger", kind: "ghost", onClick: () => navigate(`/billing/ledger/${unit.id}`) },
    ...(canManage ? [{ label: "Add member", kind: "ghost" as const, onClick: open("member") }] : []),
  ];

  const household = section({
    h: "Household",
    sub: `${currentMembers.length} member${currentMembers.length === 1 ? "" : "s"}${activeTenancy ? " · 1 tenant" : ""}${family.length ? ` · ${family.length} family` : ""}`,
    action: canManage ? "Add member" : undefined,
    type: "people",
    rows: [
      ...currentMembers.map((m) => [m.person.name, [KIND[m.kind] ?? enumLabel(m.kind), m.shareCertificateNo].filter(Boolean).join(" · "), m.person.mobile ? `+91 ${formatMobile(m.person.mobile)}` : "No mobile"]),
      ...(activeTenancy ? [[activeTenancy.tenant.name, `Tenant · until ${formatDate(activeTenancy.endDate)}`, activeTenancy.tenant.mobile ? `+91 ${formatMobile(activeTenancy.tenant.mobile)}` : "No mobile"]] : []),
      ...family.map((f) => [f.name, f.relation, f.mobile ? `+91 ${formatMobile(f.mobile)}` : f.dateOfBirth ? `Born ${formatDate(f.dateOfBirth)}` : "—"]),
    ],
    empty: "No one recorded for this unit yet.",
  });
  // Family rows follow the members and the tenant; only they can be removed here (a member is ceased, a tenancy ended).
  const familyStart = currentMembers.length + (activeTenancy ? 1 : 0);

  const tenancy = activeTenancy
    ? section({
        h: "Tenancy",
        sub: `${formatDate(activeTenancy.startDate)} – ${formatDate(activeTenancy.endDate)}`,
        type: "grid",
        rows: [
          ["Tenant", activeTenancy.tenant.name],
          ["Mobile", activeTenancy.tenant.mobile ? formatMobile(activeTenancy.tenant.mobile) : "—"],
          ["Monthly rent", paise(activeTenancy.monthlyRentPaise)],
          ["Deposit", paise(activeTenancy.depositPaise)],
          ["Bills paid by", activeTenancy.billPayer === "TENANT" ? "Tenant" : "Owner"],
          ["Allowed occupants", activeTenancy.allowedOccupants === null ? "—" : String(activeTenancy.allowedOccupants)],
          ["Police intimation", activeTenancy.policeIntimationRef ?? "Not recorded"],
          ["Ends", formatDate(activeTenancy.endDate)],
        ],
      })
    : canManage
      ? section({ h: "Tenancy", sub: "No tenant recorded", action: "Add tenant", type: "list", rows: [], empty: "Record a tenancy when the unit is let out. The unit becomes tenanted from its start date." })
      : null;

  const history = section({
    h: "Occupancy history",
    sub: "Dated, never overwritten",
    action: canManage ? "Change occupancy" : undefined,
    type: "trail",
    rows: occupancyHistory.map((o) => [enumLabel(o.status) + (o.note ? ` · ${o.note}` : ""), `${formatDate(o.effectiveFrom)} – ${o.effectiveTo ? formatDate(o.effectiveTo) : "now"}`]),
    empty: "No occupancy recorded.",
  });

  const past = pastMembers.length
    ? section({
        h: "Past members",
        sub: `${pastMembers.length} ceased`,
        type: "people",
        rows: pastMembers.map((m) => [m.person.name, KIND[m.kind] ?? enumLabel(m.kind), `${formatDate(m.admissionDate)} – ${formatDate(m.cessationDate)}`]),
      })
    : null;

  const pastTenancySection = pastTenancies.length
    ? section({
        h: "Past tenancies",
        sub: `${pastTenancies.length} ended`,
        type: "people",
        rows: pastTenancies.map((t) => [t.tenant.name, [t.monthlyRentPaise !== null ? `${inr(t.monthlyRentPaise)} a month` : null, t.billPayer === "TENANT" ? "tenant paid bills" : null].filter(Boolean).join(" · ") || "Tenant", `${formatDate(t.startDate)} – ${formatDate(t.endedOn ?? t.endDate)}`]),
      })
    : null;

  const profile = section({
    h: "Profile details",
    type: "grid",
    rows: [
      ["Unit", unit.label],
      ["Building", unit.buildingName.length <= 2 ? `Building ${unit.buildingName}` : unit.buildingName],
      ["Member since", since ? formatDate(since) : "—"],
      ["Occupancy", activeTenancy ? `${occ} · ${activeTenancy.tenant.name}` : occ],
      ["Share certificate", primary?.shareCertificateNo ?? unit.shareCertificateNo ?? "Not on file"],
      ["Carpet area", area ?? "Not on file"],
      ["Parking slots", parkingSlots.length ? parkingSlots.map((p) => p.code).join(", ") : "None allotted"],
      ["Floor · type", `${unit.floor} · ${enumLabel(unit.type)}`],
    ],
  });

  const vehicleSection = section({
    h: "Vehicles",
    sub: vehicles.length ? `${vehicles.length} registered` : "None registered",
    action: canManage ? "Add vehicle" : undefined,
    type: "list",
    rows: vehicles.map((v) => [v.plate, [v.make, v.colour?.toLowerCase(), v.ownerName].filter(Boolean).join(" · ") || enumLabel(v.type), v.parkingSlotCode ?? v.stickerNo ?? enumLabel(v.type)]),
    empty: "No vehicle registered. The gate cannot recognise this unit's cars.",
  });

  const petSection =
    pets.length || canManage
      ? section({
          h: "Pets",
          sub: pets.length ? `${pets.length} registered` : "None registered",
          action: canManage ? "Add pet" : undefined,
          type: "list",
          rows: pets.map((p) => [p.name, [p.species, p.breed].filter(Boolean).join(" · "), p.vaccinatedUntil ? `Vaccinated to ${formatDate(p.vaccinatedUntil)}` : "Vaccination not recorded"]),
          empty: "No pet registered.",
        })
      : null;

  const today = todayIso();
  const liveCharges = (unitCharges.data ?? []).filter((c) => !c.effectiveTo || c.effectiveTo > today).sort((a, b) => a.headName.localeCompare(b.headName) || b.effectiveFrom.localeCompare(a.effectiveFrom));
  // What the next run bills: each head's latest amount that has not ended (the list is sorted newest first per head).
  const nextRun = liveCharges.filter((c, i) => liveCharges.findIndex((x) => x.headId === c.headId) === i).reduce((sum, c) => sum + c.amountPaise, 0);
  const manualHeads = (heads.data ?? []).filter((h) => h.method === "MANUAL" && h.active);
  const lastPublished = runs.data?.find((r) => r.status === "PUBLISHED") ?? null;
  const chargesSection = section({
    h: "Manual charges",
    sub: unitCharges.data ? (liveCharges.length ? `${inr(nextRun)} a month on manual heads` : "No manual head is billed to this unit") : "Per-unit amounts",
    action: manualHeads.length ? "Set amount" : undefined,
    type: "list",
    rows: liveCharges.map((c) => [c.headName, [`From ${formatDate(c.effectiveFrom)}`, c.effectiveTo ? `until ${formatDate(c.effectiveTo)}` : null, c.note].filter(Boolean).join(" · "), inr(c.amountPaise)]),
    empty: heads.data && !manualHeads.length ? "The society has no active manual head. Add one in Billing › Charge heads." : "Nothing set. Manual heads bill only the units given an amount here.",
  });

  const usersSection = section({
    h: "App users",
    sub: appUsers.length ? `${appUsers.length} with a login` : "Nobody from this unit has a login",
    type: "list",
    rows: appUsers.map((u) => [u.name, userTypeLabel(u.userType), u.status === "INVITED" ? "Password not set" : enumLabel(u.status)]),
  });

  const nomineeSection = section({
    h: "Nominees",
    sub: nominees.length ? `${nominees.length} nominated` : "None nominated",
    type: "list",
    rows: nominees.map((n) => [n.name, n.relation, `${(n.shareBps / 100).toLocaleString("en-IN")}%`]),
  });

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <RecordHeaderCard
        initial={name[0]?.toUpperCase() ?? "?"}
        name={name}
        code={unit.label}
        meta={[...(primary?.person.mobile ? [`+91 ${formatMobile(primary.person.mobile)}`] : []), since ? `Joined ${formatDate(since)}` : "No owner recorded"]}
        chips={chips}
        actions={actions}
        onBack={onBack}
      />

      <RecordTiles tiles={tiles} />

      {due > 0 && canPay && (
        <RecordAlertCard
          alert={{ label: "Outstanding", value: inr(due), sub: oldest ? `Oldest unpaid bill due ${formatDate(oldest.dueDate)}${oldest.paymentState === "OVERDUE" ? " · overdue, interest applies" : ""}` : "Owed by the unit", cta: `Receive ${inr(due)}` }}
          onAct={open("pay")}
        />
      )}

      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <>
            {canBills && <SectionCard s={ledgerSection} load={toLoadState(bills)} onAdd={open("charge")} />}
            <SectionCard
              s={household}
              onAdd={open("member")}
              actions={canManage ? [{ label: "Add family", onClick: open("family") }] : undefined}
              rowAction={canManage ? (i) => (i >= familyStart ? { label: "Remove", tone: "bad", onClick: () => setModal({ kind: "removeFamily", row: family[i - familyStart] }) } : null) : undefined}
            />
            {tenancy && (
              <SectionCard
                s={tenancy}
                onAdd={open("tenancy")}
                actions={
                  activeTenancy && canManage
                    ? [
                        { label: "Edit", onClick: open("editTenancy") },
                        { label: "End tenancy", tone: "bad", onClick: open("endTenancy") },
                      ]
                    : undefined
                }
              />
            )}
            <SectionCard s={history} onAdd={open("occupancy")} />
            {pastTenancySection && <SectionCard s={pastTenancySection} />}
            {past && <SectionCard s={past} />}
          </>
        }
        right={
          <>
            <SectionCard s={profile} />
            {canCharges && <SectionCard s={chargesSection} load={toLoadState(unitCharges)} onAdd={open("unitCharge")} />}
            <SectionCard s={vehicleSection} onAdd={open("vehicle")} rowAction={canManage ? (i) => ({ label: "Remove", tone: "bad", onClick: () => setModal({ kind: "removeVehicle", row: vehicles[i] }) }) : undefined} />
            {petSection && <SectionCard s={petSection} onAdd={open("pet")} rowAction={canManage ? (i) => ({ label: "Remove", tone: "bad", onClick: () => setModal({ kind: "removePet", row: pets[i] }) }) : undefined} />}
            <SectionCard s={usersSection} />
            <SectionCard s={nomineeSection} />
          </>
        }
      />

      {modal?.kind === "member" && <AddMemberModal societyId={societyId} unitLabel={unit.label} onClose={close} />}
      {modal?.kind === "pay" && <RecordPaymentModal societyId={societyId} unit={{ id: unit.id, label: unit.label, owner: primary?.person.name ?? null }} suggestPaise={due} onClose={close} />}
      {modal?.kind === "charge" && <AdhocBillModal societyId={societyId} unitLabel={unit.label} onClose={close} />}
      {modal?.kind === "occupancy" && <OccupancyModal societyId={societyId} unit={unit} current={occupancy} onClose={close} />}
      {modal?.kind === "tenancy" && <TenancyModal societyId={societyId} unit={unit} onClose={close} />}
      {modal?.kind === "editTenancy" && activeTenancy && <TenancyModal societyId={societyId} unit={unit} tenancy={activeTenancy} onClose={close} />}
      {modal?.kind === "endTenancy" && activeTenancy && <EndTenancyModal societyId={societyId} tenancy={activeTenancy} onClose={close} />}
      {modal?.kind === "family" && <FamilyModal societyId={societyId} unit={unit} onClose={close} />}
      {modal?.kind === "vehicle" && <VehicleModal societyId={societyId} unit={unit} slots={parkingSlots} onClose={close} />}
      {modal?.kind === "pet" && <PetModal societyId={societyId} unit={unit} onClose={close} />}
      {modal?.kind === "unitCharge" && (
        <UnitChargeModal societyId={societyId} heads={manualHeads} unit={{ id: unit.id, label: unit.label }} earliest={lastPublished ? `${nextPeriod(lastPublished.period)}-01` : undefined} onClose={close} />
      )}
      {(modal?.kind === "removeFamily" || modal?.kind === "removeVehicle" || modal?.kind === "removePet") && <RemoveConfirm societyId={societyId} unitLabel={unit.label} modal={modal} onClose={close} />}
    </div>
  );
}

/**
 * Taking a family member, vehicle or pet off the unit. The server keeps the
 * row (soft delete) for the audit trail, but it disappears from the gate's
 * lookup and the resident app at once, so it is confirmed first.
 */
function RemoveConfirm({
  societyId,
  unitLabel,
  modal,
  onClose,
}: {
  societyId: string;
  unitLabel: string;
  modal: Extract<NonNullable<Modal>, { row: unknown }>;
  onClose: () => void;
}) {
  const { toast } = useAdminStore();
  const family = useApiMutation(api.members.removeFamily);
  const vehicle = useApiMutation(api.members.removeVehicle);
  const pet = useApiMutation(api.members.removePet);
  const [error, setError] = useState<string | null>(null);
  const busy = family.isPending || vehicle.isPending || pet.isPending;
  const what = modal.kind === "removeFamily" ? modal.row.name : modal.kind === "removeVehicle" ? modal.row.plate : modal.row.name;
  const body =
    modal.kind === "removeVehicle"
      ? `${what} comes off ${unitLabel}'s record, and the gate will no longer recognise it as a resident's vehicle.`
      : modal.kind === "removeFamily"
        ? `${what} comes off ${unitLabel}'s household. The gate will no longer list them as living here.`
        : `${what} comes off ${unitLabel}'s pet register.`;

  const run = async () => {
    setError(null);
    try {
      if (modal.kind === "removeFamily") await family.mutateAsync({ params: { societyId, familyMemberId: modal.row.id } });
      else if (modal.kind === "removeVehicle") await vehicle.mutateAsync({ params: { societyId, vehicleId: modal.row.id } });
      else await pet.mutateAsync({ params: { societyId, petId: modal.row.id } });
      toast(`${what} removed from ${unitLabel}.`, "ok");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return <ConfirmModal title={`Remove ${what}?`} body={body} confirm="Remove" busyLabel="Removing…" tone="bad" busy={busy} error={error} onConfirm={() => void run()} onClose={onClose} />;
}
