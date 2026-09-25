import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type BankAccount, type Building, type ParkingSlot, type SocietyMembership } from "@chs/contract";
import { holds } from "../../api/society";
import { useUnitLookup } from "../../api/units";
import { CardButton, CardHead, ConfirmModal, DataTable, FieldPair, Form, Note, Blurb } from "../../components/Kit";
import { CheckField, FormError, PickField, SelectField, TextField } from "../../components/FormFields";
import { ImportModal } from "../../components/ImportModal";
import { GhostButton, ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { Pill } from "../../components/Pill";
import { splitError } from "../../lib/apiErrors";
import { enumLabel, formatDate } from "../../lib/apiFormat";
import { inr, inrShort, paiseToInput, rupeesToPaise } from "../../lib/money";
import { amountCell, cardStyle, cellStyle, monoCell, rowBorder } from "../../lib/uiStyles";
import { primaryBtnStyle, secondaryBtnStyle } from "../../lib/tableKit";
import { useAdminStore } from "../../store/AdminStore";

/**
 * Setup's registers: bank accounts (`society.bankAccounts` and its writes),
 * buildings (`structure.buildings`), laying out and importing units
 * (`structure.bulkCreateUnits`, `structure.importUnits`) and parking slots
 * (`structure.parking`, `createParkingSlot`, `allotParkingSlot`). Lists
 * refetch through the contract's `invalidates` and the `structure.changed`
 * and `banks.changed` events, so another admin's change shows up here too.
 */

type Fields = Record<string, string>;

function fieldsFrom(err: unknown, keys: string[]): { field: Fields; form: string | null } {
  const split = splitError(err, keys);
  return { field: split.field, form: split.form };
}

function localIssues(issues: { path: PropertyKey[]; message: string }[]): Fields {
  const out: Fields = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

const buildingName = (name: string) => (name.length <= 2 ? `Building ${name}` : name);

// ─── Bank accounts ──────────────────────────────────────────────────────────

const BANK_COLS = [{ label: "Bank" }, { label: "Account" }, { label: "Type" }, { label: "Purpose" }, { label: "Opening balance", align: "right" as const }, { label: "Status", align: "right" as const }];

export function BanksTab({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const canEdit = holds(society, "society.configure");
  const banks = useApiQuery(api.society.bankAccounts, { params: { societyId } });
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const cols = canEdit ? [...BANK_COLS, { label: "" }] : BANK_COLS;

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHead
        title="Bank accounts"
        sub="Where collections are banked. Account numbers are shown masked; the full number is never sent back after it is saved."
        right={
          canEdit ? (
            <button type="button" onClick={() => setEditing("new")} className="press-scale focus-ring" style={primaryBtnStyle}>
              Add bank account
            </button>
          ) : undefined
        }
      />
      <DataTable<BankAccount>
        cols={cols}
        rows={toLoadState(banks)}
        skeletonRows={3}
        minWidth={860}
        empty="No bank account yet. The society needs one before it can go live."
        renderRow={(b) => (
          <tr key={b.id} style={rowBorder}>
            <td style={cellStyle()}>
              <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{b.bankName}</div>
              <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{b.accountName}</div>
            </td>
            <td style={cellStyle("left", monoCell)}>
              {b.accountNumberMasked}
              <div style={{ marginTop: 2, color: "var(--ink-soft,#5A6B66)" }}>{b.ifsc}</div>
            </td>
            <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{enumLabel(b.type)}</td>
            <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>
              {enumLabel(b.purpose)}
              {b.vanPrefix && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif" }}>Virtual accounts {b.vanPrefix}…</div>}
            </td>
            <td style={cellStyle("right", amountCell)}>
              {inr(b.openingBalancePaise)}
              <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{b.openingBalanceDate ? `as of ${formatDate(b.openingBalanceDate)}` : "No date"}</div>
            </td>
            <td style={cellStyle("right")}>
              <Pill label={b.active ? "Active" : "Closed"} kind={b.active ? "ok" : "mute"} />
            </td>
            {canEdit && (
              <td style={cellStyle("right")}>
                <CardButton onClick={() => setEditing(b)}>Edit</CardButton>
              </td>
            )}
          </tr>
        )}
      />
      {editing && <BankModal societyId={societyId} account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BankModal({ societyId, account, onClose }: { societyId: string; account: BankAccount | null; onClose: () => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.society.createBankAccount);
  const update = useApiMutation(api.society.updateBankAccount);
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [number, setNumber] = useState("");
  const [ifsc, setIfsc] = useState(account?.ifsc ?? "");
  const [type, setType] = useState<BankAccount["type"]>(account?.type ?? "SAVINGS");
  const [purpose, setPurpose] = useState<BankAccount["purpose"]>(account?.purpose ?? "OPERATIONS");
  const [opening, setOpening] = useState(account ? paiseToInput(account.openingBalancePaise) : "");
  const [openingDate, setOpeningDate] = useState(account?.openingBalanceDate ?? "");
  const [van, setVan] = useState(account?.vanPrefix ?? "");
  const [active, setActive] = useState(account?.active ?? true);
  const [field, setField] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (busy) return;
    setFormError(null);
    const paise = opening.trim() ? rupeesToPaise(opening) : 0;
    const common = { bankName, accountName, ifsc: ifsc.toUpperCase(), type, purpose, openingBalancePaise: paise ?? 0, openingBalanceDate: openingDate || null, vanPrefix: van.trim() || null };
    const parsed = account ? schemas.society.UpdateBankAccountBody.safeParse({ ...common, active }) : schemas.society.CreateBankAccountBody.safeParse({ ...common, accountNumber: number.replace(/\s/g, "") });
    const local = parsed.success ? {} : localIssues(parsed.error.issues);
    if (paise === null) local.openingBalancePaise = "Enter the balance in rupees, for example 1842310.";
    setField(local);
    if (Object.keys(local).length || !parsed.success) return;
    try {
      if (account) {
        await update.mutateAsync({ params: { societyId, accountId: account.id }, body: { ...common, active } });
        toast(`${bankName.trim()} account updated.`, "ok");
      } else {
        const b = await create.mutateAsync({ params: { societyId }, body: { ...common, accountNumber: number.replace(/\s/g, "") } });
        toast(`${b.bankName} ${b.accountNumberMasked.slice(-4)} added.`, "ok");
      }
      onClose();
    } catch (err) {
      const r = fieldsFrom(err, ["bankName", "accountName", "accountNumber", "ifsc", "type", "purpose", "openingBalancePaise", "openingBalanceDate", "vanPrefix"]);
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={580}>
      <ModalHeader title={account ? `Edit · ${account.bankName} ${account.accountNumberMasked.slice(-4)}` : "Add bank account"} onClose={onClose} />
      <Blurb>{account ? "The account number cannot be changed. A different account is added as a new one, and this one closed." : "The full account number is stored once and shown masked from then on."}</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldPair>
            <TextField label="Bank" req value={bankName} onChange={setBankName} error={field.bankName} autoFocus placeholder="Cosmos Co-operative Bank" />
            <TextField label="IFSC" req mono value={ifsc} onChange={(v) => setIfsc(v.toUpperCase())} error={field.ifsc} placeholder="COSB0000041" />
          </FieldPair>
          <TextField label="Account name" req value={accountName} onChange={setAccountName} error={field.accountName} placeholder="Shanti Vihar Co-operative Housing Society Ltd" />
          {!account && <TextField label="Account number" req mono inputMode="numeric" value={number} onChange={(v) => setNumber(v.replace(/[^\d\s]/g, ""))} error={field.accountNumber} autoComplete="off" />}
          <PickField label="Type" req value={type} options={schemas.society.BANK_ACCOUNT_TYPES.map((t) => ({ value: t, label: enumLabel(t) }))} onPick={setType} error={field.type} />
          <PickField label="Purpose" req value={purpose} options={schemas.society.BANK_PURPOSES.map((p) => ({ value: p, label: p === "SINKING" ? "Sinking fund" : p === "REPAIR" ? "Repair fund" : enumLabel(p) }))} onPick={setPurpose} error={field.purpose} />
          <FieldPair>
            <TextField label="Opening balance (₹)" mono inputMode="decimal" value={opening} onChange={setOpening} error={field.openingBalancePaise} placeholder="0" />
            <TextField label="As of" type="date" value={openingDate} onChange={setOpeningDate} error={field.openingBalanceDate} />
          </FieldPair>
          <TextField label="Virtual account prefix" mono value={van} onChange={setVan} error={field.vanPrefix} hint="For per-unit virtual account numbers, if the bank issues them" />
          {account && <CheckField label="Account is in use" hint="Untick when the account is closed. It stays on record." checked={active} onChange={setActive} />}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Saving…">
            {account ? "Save account" : "Add account"}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

// ─── Buildings and units ────────────────────────────────────────────────────

const BUILDING_COLS = [{ label: "Building" }, { label: "Floors", align: "right" as const }, { label: "Lift" }, { label: "Built" }, { label: "Construction cost", align: "right" as const }, { label: "Units", align: "right" as const }];

export function BuildingsTab({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const [modal, setModal] = useState<{ kind: "building"; building: Building | null } | { kind: "bulk" } | { kind: "import" } | null>(null);
  const list = buildings.data ?? [];
  const missingCost = list.filter((b) => b.constructionCostPaise === null);
  const importUnits = useApiMutation(api.structure.importUnits);
  const { toast } = useAdminStore();

  return (
    <>
      {missingCost.length > 0 && (
        <Note kind="warn" style={{ marginBottom: 14 }}>
          {missingCost.map((b) => buildingName(b.name)).join(", ")} {missingCost.length === 1 ? "has" : "have"} no construction cost. Sinking and repair fund heads are computed from it and cannot be billed without it.
        </Note>
      )}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHead
          title="Buildings"
          sub={buildings.data ? `${list.length} building${list.length === 1 ? "" : "s"} · ${list.reduce((s, b) => s + b.unitCount, 0)} units` : "Wings and towers, with the facts billing needs"}
          right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setModal({ kind: "import" })} className="press-scale focus-ring" style={secondaryBtnStyle}>
                Import units
              </button>
              <button type="button" onClick={() => setModal({ kind: "bulk" })} disabled={!list.length} className="press-scale focus-ring" style={{ ...secondaryBtnStyle, opacity: list.length ? 1 : 0.55 }}>
                Lay out units
              </button>
              <button type="button" onClick={() => setModal({ kind: "building", building: null })} className="press-scale focus-ring" style={primaryBtnStyle}>
                Add building
              </button>
            </div>
          }
        />
        <DataTable<Building>
          cols={[...BUILDING_COLS, { label: "" }]}
          rows={toLoadState(buildings)}
          skeletonRows={4}
          minWidth={820}
          empty="No buildings yet. Add each wing or tower, then lay out its units."
          renderRow={(b) => (
            <tr key={b.id} style={rowBorder}>
              <td style={cellStyle()}>
                <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{buildingName(b.name)}</div>
                {b.wing && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Wing {b.wing}</div>}
              </td>
              <td style={cellStyle("right", amountCell)}>{b.floorCount}</td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{b.liftPresent ? "Lift" : "No lift"}</td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{b.constructionYear ?? "—"}</td>
              <td style={cellStyle("right", { ...amountCell, color: b.constructionCostPaise === null ? "var(--warn,#B45309)" : undefined })}>{b.constructionCostPaise === null ? "Not entered" : inrShort(b.constructionCostPaise)}</td>
              <td style={cellStyle("right", amountCell)}>{b.unitCount}</td>
              <td style={cellStyle("right")}>
                <CardButton onClick={() => setModal({ kind: "building", building: b })}>Edit</CardButton>
              </td>
            </tr>
          )}
        />
        {list.length > 0 && (
          <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            Units, owners and occupancy are kept in{" "}
            <button type="button" onClick={() => navigate("/members")} className="focus-ring" style={{ border: 0, padding: 0, background: "none", color: "var(--accent-ink,#0A5749)", font: "600 13px/1.4 Figtree, sans-serif", cursor: "pointer" }}>
              Members &amp; units
            </button>
            .
          </div>
        )}
      </div>

      {modal?.kind === "building" && <BuildingModal societyId={societyId} building={modal.building} onClose={() => setModal(null)} />}
      {modal?.kind === "bulk" && <BulkUnitsModal societyId={societyId} buildings={list} onClose={() => setModal(null)} />}
      {modal?.kind === "import" && (
        <ImportModal
          title="Import units"
          noun="unit"
          blurb="Add many units at once from a spreadsheet. The file is checked first and nothing is saved until you confirm. Buildings must already exist; a unit that already exists is reported, not overwritten."
          columns={[
            { name: "building", required: true, hint: "The building's name exactly as above, for example A" },
            { name: "number", required: true, hint: "The flat number within the building, for example 1204" },
            { name: "floor", required: true, hint: "A whole number; 0 for the ground floor, negative for basements" },
            { name: "type", hint: "Residential (default), commercial, shop, office or parking only" },
            { name: "carpet_area", hint: "Square feet — billing needs it for area-based heads" },
            { name: "built_up_area", hint: "Square feet" },
            { name: "water_inlets", hint: "Defaults to 1" },
            { name: "share_certificate", hint: "Certificate number, if known" },
          ]}
          run={async (body) => {
            const r = await importUnits.mutateAsync({ params: { societyId }, body });
            if (!r.dryRun && r.created) toast(`${r.created} unit${r.created === 1 ? "" : "s"} imported.`, "ok");
            return r;
          }}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function BuildingModal({ societyId, building, onClose }: { societyId: string; building: Building | null; onClose: () => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.structure.createBuilding);
  const update = useApiMutation(api.structure.updateBuilding);
  const [name, setName] = useState(building?.name ?? "");
  const [wing, setWing] = useState(building?.wing ?? "");
  const [floors, setFloors] = useState(building ? String(building.floorCount) : "");
  const [lift, setLift] = useState(building?.liftPresent ?? true);
  const [year, setYear] = useState(building?.constructionYear ? String(building.constructionYear) : "");
  const [cost, setCost] = useState(building?.constructionCostPaise != null ? paiseToInput(building.constructionCostPaise) : "");
  const [field, setField] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (busy) return;
    setFormError(null);
    const costPaise = cost.trim() ? rupeesToPaise(cost) : null;
    const body = {
      name,
      wing: wing.trim() || null,
      floorCount: floors.trim() ? Number(floors) : Number.NaN,
      liftPresent: lift,
      constructionYear: year.trim() ? Number(year) : null,
      constructionCostPaise: costPaise,
    };
    const parsed = schemas.structure.CreateBuildingBody.safeParse(body);
    const local = parsed.success ? {} : localIssues(parsed.error.issues);
    if (local.floorCount) local.floorCount = "Enter the number of floors, 0 to 200.";
    if (local.constructionYear) local.constructionYear = "A year between 1900 and 2100.";
    if (cost.trim() && costPaise === null) local.constructionCostPaise = "Enter the cost in rupees, for example 60000000.";
    setField(local);
    if (Object.keys(local).length || !parsed.success) return;
    try {
      if (building) {
        await update.mutateAsync({ params: { societyId, buildingId: building.id }, body: parsed.data });
        toast(`${buildingName(parsed.data.name)} updated.`, "ok");
      } else {
        const b = await create.mutateAsync({ params: { societyId }, body: parsed.data });
        toast(`${buildingName(b.name)} added. Lay out its units next.`, "ok");
      }
      onClose();
    } catch (err) {
      const r = fieldsFrom(err, ["name", "wing", "floorCount", "liftPresent", "constructionYear", "constructionCostPaise"]);
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={540}>
      <ModalHeader title={building ? `Edit ${buildingName(building.name)}` : "Add building"} onClose={onClose} />
      <Blurb>The lift decides which units pay lift charges; the construction cost is the base for sinking and repair fund contributions.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldPair>
            <TextField label="Name" req value={name} onChange={setName} error={field.name} autoFocus placeholder="A" hint="Unit labels read Name-Number, for example A-1204" />
            <TextField label="Wing" value={wing} onChange={setWing} error={field.wing} />
          </FieldPair>
          <FieldPair>
            <TextField label="Floors" req mono inputMode="numeric" value={floors} onChange={(v) => setFloors(v.replace(/\D/g, ""))} error={field.floorCount} placeholder="13" />
            <TextField label="Year built" mono inputMode="numeric" value={year} onChange={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))} error={field.constructionYear} placeholder="2004" />
          </FieldPair>
          <TextField label="Construction cost (₹)" mono inputMode="decimal" value={cost} onChange={setCost} error={field.constructionCostPaise} placeholder="60000000" hint={building?.constructionCostPaise != null ? `Now ${inr(building.constructionCostPaise, { whole: true })}` : "Needed before sinking and repair fund heads can bill"} />
          <CheckField label="The building has a lift" checked={lift} onChange={setLift} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Saving…">
            {building ? "Save building" : "Add building"}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** The unit number the server will make: `{floor}` is the floor (G for the ground floor), `{n}` the 1-based position, zero-padded to 2. */
function unitNumber(pattern: string, floor: number, n: number): string {
  return pattern.replaceAll("{floor}", floor === 0 ? "G" : String(floor)).replaceAll("{n}", String(n).padStart(2, "0"));
}

function BulkUnitsModal({ societyId, buildings, onClose }: { societyId: string; buildings: Building[]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const bulk = useApiMutation(api.structure.bulkCreateUnits);
  const [buildingId, setBuildingId] = useState(buildings.length === 1 ? buildings[0].id : "");
  const [fromFloor, setFromFloor] = useState("1");
  const [toFloor, setToFloor] = useState("");
  const [perFloor, setPerFloor] = useState("4");
  const [pattern, setPattern] = useState("{floor}{n}");
  const [type, setType] = useState<(typeof schemas.structure.UNIT_TYPES)[number]>("RESIDENTIAL");
  const [area, setArea] = useState("");
  const [inlets, setInlets] = useState("1");
  const [field, setField] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const b = buildings.find((x) => x.id === buildingId) ?? null;
  const from = Number(fromFloor);
  const to = Number(toFloor);
  const per = Number(perFloor);
  const valid = fromFloor.trim() !== "" && toFloor.trim() !== "" && Number.isInteger(from) && Number.isInteger(to) && to >= from && Number.isInteger(per) && per >= 1 && per <= 50 && pattern.includes("{n}");
  const count = valid ? (to - from + 1) * per : 0;
  const preview = valid && b ? [unitNumber(pattern, from, 1), unitNumber(pattern, from, Math.min(2, per)), "…", unitNumber(pattern, to, per)].filter((x, i, a) => a.indexOf(x) === i).map((x) => (x === "…" ? x : `${b.name}-${x}`)) : [];

  const submit = async () => {
    if (bulk.isPending) return;
    setFormError(null);
    const parsed = schemas.structure.BulkCreateUnitsBody.safeParse({
      buildingId,
      fromFloor: fromFloor.trim() ? from : Number.NaN,
      toFloor: toFloor.trim() ? to : Number.NaN,
      unitsPerFloor: perFloor.trim() ? per : Number.NaN,
      numberPattern: pattern,
      type,
      carpetAreaSqft: area.trim() ? Number(area) : null,
      waterInlets: inlets.trim() ? Number(inlets) : 1,
    });
    const local = parsed.success ? {} : localIssues(parsed.error.issues);
    if (!buildingId) local.buildingId = "Choose the building.";
    if (local.fromFloor || local.toFloor) local.toFloor = local.toFloor ?? "Floors are whole numbers from -5 to 200.";
    if (valid === false && !local.toFloor && fromFloor.trim() && toFloor.trim() && to < from) local.toFloor = "The last floor must not be below the first.";
    if (!pattern.includes("{n}")) local.numberPattern = "The pattern must include {n}.";
    setField(local);
    if (Object.keys(local).length || !parsed.success) return;
    try {
      const r = await bulk.mutateAsync({ params: { societyId }, body: parsed.data });
      setResult(r);
      toast(`${r.created} unit${r.created === 1 ? "" : "s"} added to ${b ? buildingName(b.name) : "the building"}.`, "ok");
    } catch (err) {
      const r = fieldsFrom(err, ["buildingId", "fromFloor", "toFloor", "unitsPerFloor", "numberPattern", "type", "carpetAreaSqft", "waterInlets"]);
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={bulk.isPending ? () => undefined : onClose} maxWidth={600}>
      <ModalHeader title="Lay out units" onClose={onClose} />
      {result ? (
        <>
          <Note kind="ok">
            {result.created} unit{result.created === 1 ? "" : "s"} created.
            {result.skipped.length ? ` ${result.skipped.length} already existed and were left as they were: ${result.skipped.slice(0, 12).join(", ")}${result.skipped.length > 12 ? "…" : ""}.` : ""}
          </Note>
          <ModalFooter>
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </ModalFooter>
        </>
      ) : (
        <>
          <Blurb>Create a building's units floor by floor. Units that already exist are skipped, so running it again for more floors is safe.</Blurb>
          <Form onSubmit={() => void submit()}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SelectField label="Building" req value={buildingId} placeholder="Choose a building" options={buildings.map((x) => ({ value: x.id, label: `${buildingName(x.name)} · ${x.floorCount} floors` }))} onChange={setBuildingId} error={field.buildingId} />
              <FieldPair>
                <TextField label="From floor" req mono inputMode="numeric" value={fromFloor} onChange={(v) => setFromFloor(v.replace(/[^\d-]/g, ""))} error={field.fromFloor} hint="0 is the ground floor" />
                <TextField label="To floor" req mono inputMode="numeric" value={toFloor} onChange={(v) => setToFloor(v.replace(/[^\d-]/g, ""))} error={field.toFloor} placeholder={b ? String(b.floorCount) : ""} />
                <TextField label="Units a floor" req mono inputMode="numeric" value={perFloor} onChange={(v) => setPerFloor(v.replace(/\D/g, ""))} error={field.unitsPerFloor} />
              </FieldPair>
              <TextField label="Number pattern" req mono value={pattern} onChange={setPattern} error={field.numberPattern} hint="{floor} is the floor (G for ground), {n} the unit on it as 01, 02…" />
              <PickField label="Type" req value={type} options={schemas.structure.UNIT_TYPES.map((t) => ({ value: t, label: enumLabel(t) }))} onPick={setType} error={field.type} />
              <FieldPair>
                <TextField label="Carpet area (sq ft)" mono inputMode="decimal" value={area} onChange={(v) => setArea(v.replace(/[^\d.]/g, ""))} error={field.carpetAreaSqft} hint="Same for every unit; edit individual units later" />
                <TextField label="Water inlets" mono inputMode="numeric" value={inlets} onChange={(v) => setInlets(v.replace(/\D/g, ""))} error={field.waterInlets} />
              </FieldPair>
              {preview.length > 0 && (
                <Note kind={count > 2000 ? "bad" : "info"}>
                  {count > 2000 ? `${count} units is more than the 2,000 allowed at once.` : `${count} unit${count === 1 ? "" : "s"}: ${preview.join(", ")}`}
                </Note>
              )}
              <FormError message={formError} />
            </div>
            <ModalFooter>
              <GhostButton onClick={onClose} disabled={bulk.isPending}>
                Cancel
              </GhostButton>
              <PrimaryButton type="submit" busy={bulk.isPending} busyLabel="Creating units…" disabled={count > 2000}>
                {count ? `Create ${count} unit${count === 1 ? "" : "s"}` : "Create units"}
              </PrimaryButton>
            </ModalFooter>
          </Form>
        </>
      )}
    </ModalShell>
  );
}

// ─── Parking ────────────────────────────────────────────────────────────────

const PARKING_LABEL: Record<ParkingSlot["type"], string> = { CAR_COVERED: "Car · covered", CAR_OPEN: "Car · open", CAR_STILT: "Car · stilt", TWO_WHEELER: "Two-wheeler", VISITOR: "Visitor" };

export function ParkingTab({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const canCreate = holds(society, "society.configure");
  const canAllot = holds(society, "members.manage");
  const slots = useApiQuery(api.structure.parking, { params: { societyId } });
  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const [modal, setModal] = useState<{ kind: "create" } | { kind: "allot"; slot: ParkingSlot } | { kind: "free"; slot: ParkingSlot } | null>(null);
  const bName = new Map((buildings.data ?? []).map((b) => [b.id, buildingName(b.name)]));
  const list = slots.data ?? [];
  const allotted = list.filter((s) => s.unitId).length;

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHead
        title="Parking slots"
        sub={slots.data ? `${list.length} slot${list.length === 1 ? "" : "s"} · ${allotted} allotted · ${list.length - allotted} free` : "The slot register, and which unit each is allotted to"}
        right={
          canCreate ? (
            <button type="button" onClick={() => setModal({ kind: "create" })} className="press-scale focus-ring" style={primaryBtnStyle}>
              Add slot
            </button>
          ) : undefined
        }
      />
      <DataTable<ParkingSlot>
        cols={[{ label: "Slot" }, { label: "Type" }, { label: "Building" }, { label: "Allotted to" }, { label: "", align: "right" }]}
        rows={toLoadState(slots)}
        skeletonRows={5}
        minWidth={640}
        empty="No parking slots recorded."
        renderRow={(s) => (
          <tr key={s.id} style={rowBorder}>
            <td style={cellStyle("left", monoCell)}>{s.code}</td>
            <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{PARKING_LABEL[s.type]}</td>
            <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{s.buildingId ? (bName.get(s.buildingId) ?? "—") : "Common"}</td>
            <td style={cellStyle()}>
              {s.unitId ? (
                <button type="button" onClick={() => navigate(`/members/record/${s.unitId}`)} className="focus-ring" style={{ border: 0, padding: 0, background: "none", color: "var(--accent-ink,#0A5749)", font: "500 13px/1.4 'IBM Plex Mono',monospace", cursor: "pointer" }}>
                  {s.unitLabel}
                </button>
              ) : (
                <Pill label={s.type === "VISITOR" ? "Visitors" : "Free"} kind="mute" />
              )}
            </td>
            <td style={cellStyle("right")}>
              {canAllot && s.type !== "VISITOR" && (
                <div style={{ display: "inline-flex", gap: 6 }}>
                  <CardButton onClick={() => setModal({ kind: "allot", slot: s })}>{s.unitId ? "Re-allot" : "Allot"}</CardButton>
                  {s.unitId && (
                    <CardButton tone="bad" onClick={() => setModal({ kind: "free", slot: s })}>
                      Free
                    </CardButton>
                  )}
                </div>
              )}
            </td>
          </tr>
        )}
      />
      {modal?.kind === "create" && <SlotModal societyId={societyId} buildings={buildings.data ?? []} onClose={() => setModal(null)} />}
      {modal?.kind === "allot" && <AllotModal societyId={societyId} slot={modal.slot} onClose={() => setModal(null)} />}
      {modal?.kind === "free" && <FreeSlotConfirm societyId={societyId} slot={modal.slot} onClose={() => setModal(null)} />}
    </div>
  );
}

function SlotModal({ societyId, buildings, onClose }: { societyId: string; buildings: Building[]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.structure.createParkingSlot);
  const [code, setCode] = useState("");
  const [type, setType] = useState<ParkingSlot["type"]>("CAR_STILT");
  const [buildingId, setBuildingId] = useState("");
  const [field, setField] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (create.isPending) return;
    setFormError(null);
    const parsed = schemas.structure.CreateParkingSlotBody.safeParse({ code, type, buildingId: buildingId || null });
    if (!parsed.success) {
      setField(localIssues(parsed.error.issues));
      return;
    }
    setField({});
    try {
      const s = await create.mutateAsync({ params: { societyId }, body: parsed.data });
      toast(`Slot ${s.code} added.`, "ok");
      onClose();
    } catch (err) {
      const r = fieldsFrom(err, ["code", "type", "buildingId"]);
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={create.isPending ? () => undefined : onClose} maxWidth={520}>
      <ModalHeader title="Add parking slot" onClose={onClose} />
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
          <TextField label="Slot code" req mono value={code} onChange={(v) => setCode(v.toUpperCase())} error={field.code} autoFocus placeholder="P-A-14" />
          <PickField label="Type" req value={type} options={schemas.structure.PARKING_TYPES.map((t) => ({ value: t, label: PARKING_LABEL[t] }))} onPick={setType} error={field.type} />
          <SelectField label="Building" value={buildingId} options={[{ value: "", label: "Common area" }, ...buildings.map((b) => ({ value: b.id, label: buildingName(b.name) }))]} onChange={setBuildingId} error={field.buildingId} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={create.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={create.isPending} busyLabel="Adding…">
            Add slot
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

function AllotModal({ societyId, slot, onClose }: { societyId: string; slot: ParkingSlot; onClose: () => void }) {
  const { toast } = useAdminStore();
  const allot = useApiMutation(api.structure.allotParkingSlot);
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lookup = useUnitLookup(societyId, unit);
  const unitNote = lookup.status === "found" ? `${lookup.unit.label} · ${lookup.unit.primaryOwnerName ?? "no owner recorded"}` : lookup.status === "missing" ? `No unit "${lookup.label}" in this society.` : lookup.status === "error" ? lookup.message : lookup.status === "searching" ? "Looking up the unit…" : undefined;

  const submit = async () => {
    if (allot.isPending || lookup.status !== "found") return;
    setError(null);
    try {
      const s = await allot.mutateAsync({ params: { societyId, slotId: slot.id }, body: { unitId: lookup.unit.id } });
      toast(`${s.code} allotted to ${s.unitLabel ?? lookup.unit.label}.`, "ok");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <ModalShell onClose={allot.isPending ? () => undefined : onClose} maxWidth={480}>
      <ModalHeader title={`Allot ${slot.code}`} onClose={onClose} />
      <Blurb>{slot.unitLabel ? `Now allotted to ${slot.unitLabel}. Allotting it to another unit moves it.` : `${PARKING_LABEL[slot.type]}, currently free.`}</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Unit" req mono value={unit} onChange={(v) => setUnit(v.toUpperCase())} autoFocus placeholder="A-1204" autoComplete="off" hint={lookup.status === "found" || lookup.status === "searching" ? unitNote : undefined} error={lookup.status === "missing" || lookup.status === "error" ? unitNote : undefined} />
          <FormError message={error} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={allot.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={allot.isPending} busyLabel="Allotting…" disabled={lookup.status !== "found"}>
            Allot slot
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

function FreeSlotConfirm({ societyId, slot, onClose }: { societyId: string; slot: ParkingSlot; onClose: () => void }) {
  const { toast } = useAdminStore();
  const allot = useApiMutation(api.structure.allotParkingSlot);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmModal
      title={`Free ${slot.code}?`}
      body={`It is taken away from ${slot.unitLabel ?? "the unit"}, and any vehicle registered to it loses its slot.`}
      confirm="Free slot"
      busyLabel="Freeing…"
      tone="bad"
      busy={allot.isPending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        setError(null);
        allot.mutate(
          { params: { societyId, slotId: slot.id }, body: { unitId: null } },
          {
            onSuccess: (s) => {
              toast(`${s.code} is free.`, "ok");
              onClose();
            },
            onError: (e) => setError(e.message),
          },
        );
      }}
    />
  );
}
