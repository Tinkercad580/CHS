import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type UnitOverview } from "@chs/contract";
import { useCurrentSociety, userTypeLabel } from "../../api/society";
import { NoSociety } from "../../components/NoSociety";
import { enumLabel, formatDate, formatMobile } from "../../lib/apiFormat";
import { money } from "../../lib/format";
import type { PillKind } from "../../lib/types";
import { RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";
import { AddMemberModal } from "./MemberModals";

/**
 * A unit's record from `members.unitOverview` — owners, occupancy, tenancy,
 * household, vehicles, parking, nominees and app logins on one screen, in the
 * design's member-record layout.
 *
 * The design's ledger, dues, helpdesk, bookings and gate sections have no API
 * yet. The money tiles say so with a dash; the other sections are left out.
 */
export function UnitRecordPage({ unitId }: { unitId: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Members & units" />;
  return <UnitRecord societyId={society.societyId} unitId={unitId} />;
}

function UnitRecord({ societyId, unitId }: { societyId: string; unitId: string }) {
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
          missing ? undefined : (
            <button type="button" onClick={state.retry} className="press-scale focus-ring" style={{ height: 34, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer" }}>
              Try again
            </button>
          )
        }
      />
    );
  }
  return <UnitRecordView societyId={societyId} data={state.data} onBack={back} />;
}

const KIND: Record<string, string> = { PRIMARY: "Primary owner", CO_OWNER: "Co-owner", ASSOCIATE: "Associate member" };

function paise(p: number | null): string {
  return p === null ? "Not recorded" : money(p / 100);
}

function UnitRecordView({ societyId, data, onBack }: { societyId: string; data: UnitOverview; onBack: () => void }) {
  const [adding, setAdding] = useState(false);
  const { unit, currentMembers, pastMembers, occupancy, occupancyHistory, activeTenancy, family, vehicles, pets, parkingSlots, nominees, appUsers } = data;
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
  ];

  const muted = "var(--ink-muted,#8A9995)";
  const tiles = [
    tile("Occupancy", occ, occupancy ? `Since ${formatDate(occupancy.effectiveFrom)}` : "Record it to bill non-occupancy correctly", occupancy ? "var(--accent,#0E6B5C)" : "var(--warn,#B45309)"),
    tile("Carpet area", area ?? "Not on file", area ? `${unit.waterInlets} water inlet${unit.waterInlets === 1 ? "" : "s"} · ${unit.liftServed ? "lift served" : "no lift"}` : "Needed for billing", area ? "var(--info,#1D4ED8)" : "var(--warn,#B45309)"),
    // Billing has no API yet; these stay empty rather than show a made-up figure.
    tile("Paid this FY", "—", "Billing is not live yet", muted),
    tile("Outstanding", "—", "Billing is not live yet", muted),
  ];

  const household = section({
    h: "Household",
    sub: `${currentMembers.length} member${currentMembers.length === 1 ? "" : "s"}${activeTenancy ? " · 1 tenant" : ""}${family.length ? ` · ${family.length} family` : ""}`,
    action: "Add member",
    type: "people",
    rows: [
      ...currentMembers.map((m) => [m.person.name, [KIND[m.kind] ?? enumLabel(m.kind), m.shareCertificateNo].filter(Boolean).join(" · "), m.person.mobile ? `+91 ${formatMobile(m.person.mobile)}` : "No mobile"]),
      ...(activeTenancy ? [[activeTenancy.tenant.name, `Tenant · until ${formatDate(activeTenancy.endDate)}`, activeTenancy.tenant.mobile ? `+91 ${formatMobile(activeTenancy.tenant.mobile)}` : "No mobile"]] : []),
      ...family.map((f) => [f.name, f.relation, f.mobile ? `+91 ${formatMobile(f.mobile)}` : f.dateOfBirth ? `Born ${formatDate(f.dateOfBirth)}` : "—"]),
    ],
    empty: "No one recorded for this unit yet.",
  });

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
    : null;

  const history = section({
    h: "Occupancy history",
    sub: "Dated, never overwritten",
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
    type: "list",
    rows: vehicles.map((v) => [v.plate, [v.make, v.colour?.toLowerCase(), v.ownerName].filter(Boolean).join(" · ") || enumLabel(v.type), v.parkingSlotCode ?? v.stickerNo ?? enumLabel(v.type)]),
  });

  const petSection = pets.length
    ? section({ h: "Pets", sub: `${pets.length} registered`, type: "list", rows: pets.map((p) => [p.name, [p.species, p.breed].filter(Boolean).join(" · "), p.vaccinatedUntil ? `Vaccinated to ${formatDate(p.vaccinatedUntil)}` : "Vaccination not recorded"]) })
    : null;

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
        actions={[{ label: "Add member", kind: "ghost", onClick: () => setAdding(true) }]}
        onBack={onBack}
      />

      <RecordTiles tiles={tiles} />

      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <>
            <SectionCard s={household} onAdd={() => setAdding(true)} />
            {tenancy && <SectionCard s={tenancy} />}
            <SectionCard s={history} />
            {past && <SectionCard s={past} />}
          </>
        }
        right={
          <>
            <SectionCard s={profile} />
            <SectionCard s={vehicleSection} />
            {petSection && <SectionCard s={petSection} />}
            <SectionCard s={usersSection} />
            <SectionCard s={nomineeSection} />
          </>
        }
      />

      {adding && <AddMemberModal societyId={societyId} unitLabel={unit.label} onClose={() => setAdding(false)} />}
    </div>
  );
}
