import { useState } from "react";
import { useApiMutation } from "@chs/api-client/react";
import { api, schemas, type Tenancy, type UnitOverview } from "@chs/contract";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { CheckField, FormError, PickField, SelectField, TextField } from "../../components/FormFields";
import { Blurb, FieldPair, Form, Note } from "../../components/Kit";
import { useUnitResolver } from "../../api/units";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { enumLabel, formatDate } from "../../lib/apiFormat";
import { paiseToInput, rupeesToPaise, todayIso } from "../../lib/money";

/**
 * The unit register's forms. Each is one API write: local checks first so
 * every problem shows at once, then the call, then the server's field
 * messages under their fields and anything else above the buttons, as
 * written. An admin with members.manage applies family, vehicle, pet and
 * tenancy changes directly — the server sends only residents' requests to
 * the approvals queue — so none of these waits on a decision.
 */

type Kind = (typeof schemas.members.MEMBERSHIP_KINDS)[number];
type OccupancyStatus = (typeof schemas.members.OCCUPANCY_STATUSES)[number];
type VehicleType = (typeof schemas.members.VEHICLE_TYPES)[number];
type BillPayer = (typeof schemas.members.BILL_PAYERS)[number];

/** Split a failure into field messages (wire path → form key) and the one above the buttons. */
function placed(err: unknown, map: Record<string, string>): { field: Record<string, string>; form: string | null } {
  const split = splitError(err, Object.keys(map));
  const field: Record<string, string> = {};
  for (const [wire, key] of Object.entries(map)) if (split.field[wire]) field[key] = split.field[wire];
  return { field, form: split.form };
}

/** An optional rupee field: "" is null, anything else must be a valid amount. */
function optionalPaise(text: string): number | null | "bad" {
  if (!text.trim()) return null;
  return rupeesToPaise(text) ?? "bad";
}

/**
 * Admit an owner, co-owner or associate member to a unit
 * (`members.addMembership`). A member is a register entry, not a login:
 * giving them the app is a separate step in Users & access.
 */
export function AddMemberModal({ societyId, unitLabel, onClose, onAdded }: { societyId: string; unitLabel?: string; onClose: () => void; onAdded?: (unitId: string) => void }) {
  const { toast } = useAdminStore();
  const resolveUnit = useUnitResolver(societyId);
  const add = useApiMutation(api.members.addMembership);
  const [unit, setUnit] = useState(unitLabel ?? "");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [kind, setKind] = useState<Kind>("PRIMARY");
  const [certificate, setCertificate] = useState("");
  const [admitted, setAdmitted] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setField({});
    setFormError(null);
    if (!unit.trim()) {
      setField({ unit: "Enter the unit, for example A-1206." });
      return;
    }
    setBusy(true);
    try {
      const found = await resolveUnit(unit);
      if (!found || found === "missing") {
        setField({ unit: `No unit "${unit.trim().toUpperCase()}" in this society.` });
        return;
      }
      await add.mutateAsync({
        params: { societyId, unitId: found.id },
        body: {
          person: { name, mobile: mobile.trim() || null },
          kind,
          shareCertificateNo: certificate.trim() || null,
          admissionDate: admitted,
        },
      });
      toast(`${name.trim()} added at ${found.label}.`, "ok");
      onClose();
      onAdded?.(found.id);
    } catch (err) {
      const r = placed(err, { "person.name": "name", "person.mobile": "mobile", kind: "kind", shareCertificateNo: "certificate", admissionDate: "admitted" });
      setField(r.field);
      setFormError(r.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={520}>
      <ModalHeader title="Add member" onClose={onClose} />
      <Blurb>A member of the society for this unit, as on the share certificate. App access is given separately, in Users &amp; access.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Unit" req mono value={unit} onChange={(v) => setUnit(v.toUpperCase())} error={field.unit} placeholder="A-1206" autoFocus={!unitLabel} autoComplete="off" />
          <TextField label="Full name" req value={name} onChange={setName} error={field.name} placeholder="Full name as on the share certificate" autoFocus={Boolean(unitLabel)} autoComplete="off" />
          <PickField
            label="Membership"
            req
            value={kind}
            options={schemas.members.MEMBERSHIP_KINDS.map((k) => ({ value: k, label: k === "PRIMARY" ? "Primary owner" : enumLabel(k) }))}
            onPick={setKind}
            error={field.kind}
          />
          <TextField label="Mobile" mono type="tel" inputMode="tel" value={mobile} onChange={(v) => setMobile(v.replace(/[^\d+\s-]/g, ""))} error={field.mobile} placeholder="98220 00000" autoComplete="off" />
          <TextField label="Share certificate" mono value={certificate} onChange={setCertificate} error={field.certificate} placeholder="SC/0412" autoComplete="off" />
          <TextField label="Admitted on" req type="date" value={admitted} onChange={setAdmitted} error={field.admitted} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Adding…">
            Add member
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * Record the unit's occupancy from a date (`members.setOccupancy`). It is
 * dated rather than overwritten because it drives the non-occupancy charge:
 * the previous status is closed the day before and stays in the history.
 */
export function OccupancyModal({ societyId, unit, current, onClose }: { societyId: string; unit: UnitOverview["unit"]; current: UnitOverview["occupancy"]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const save = useApiMutation(api.members.setOccupancy);
  const [status, setStatus] = useState<OccupancyStatus | null>(current?.status ?? null);
  const [from, setFrom] = useState(todayIso);
  const [note, setNote] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (save.isPending) return;
    setFormError(null);
    if (!status) {
      setField({ status: "Choose how the unit is occupied." });
      return;
    }
    setField({});
    try {
      const o = await save.mutateAsync({ params: { societyId, unitId: unit.id }, body: { status, effectiveFrom: from, note: note.trim() || null } });
      toast(`${unit.label} is ${enumLabel(o.status).toLowerCase()} from ${formatDate(o.effectiveFrom)}.`, "ok");
      onClose();
    } catch (err) {
      const r = placed(err, { status: "status", effectiveFrom: "from", note: "note" });
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={save.isPending ? () => undefined : onClose} maxWidth={540}>
      <ModalHeader title={`Occupancy · ${unit.label}`} onClose={onClose} />
      <Blurb>
        {current ? `Now ${enumLabel(current.status).toLowerCase()} since ${formatDate(current.effectiveFrom)}. ` : "No occupancy is recorded yet. "}
        The change applies from the date you give; earlier periods keep what was true then, so a published bill never changes.
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PickField label="Occupied as" req value={status} options={schemas.members.OCCUPANCY_STATUSES.map((s) => ({ value: s, label: enumLabel(s) }))} onPick={setStatus} error={field.status} />
          <TextField label="From" req type="date" value={from} onChange={setFrom} error={field.from} />
          <TextField label="Note" value={note} onChange={setNote} error={field.note} placeholder="Owner moved abroad; flat locked" maxLength={300} />
          {status === "TENANTED" && current?.status !== "TENANTED" && <Note kind="info">Recording a tenancy sets the unit to tenanted on its own. Use Add tenant in the Tenancy section to record the tenant as well.</Note>}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={save.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={save.isPending} busyLabel="Saving…">
            Save occupancy
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * Record a tenancy (`members.createTenancy`), or edit the active one
 * (`members.updateTenancy`: its end date, rent, deposit, police intimation,
 * occupants and who pays the bills). Rent and deposit are typed in rupees
 * and sent as paise.
 */
export function TenancyModal({ societyId, unit, tenancy, onClose }: { societyId: string; unit: UnitOverview["unit"]; tenancy?: Tenancy; onClose: () => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.members.createTenancy);
  const update = useApiMutation(api.members.updateTenancy);
  const editing = Boolean(tenancy);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState(tenancy?.endDate ?? "");
  const [rent, setRent] = useState(tenancy?.monthlyRentPaise != null ? paiseToInput(tenancy.monthlyRentPaise) : "");
  const [deposit, setDeposit] = useState(tenancy?.depositPaise != null ? paiseToInput(tenancy.depositPaise) : "");
  const [police, setPolice] = useState(tenancy?.policeIntimationRef ?? "");
  const [occupants, setOccupants] = useState(tenancy?.allowedOccupants != null ? String(tenancy.allowedOccupants) : "");
  const [payer, setPayer] = useState<BillPayer>(tenancy?.billPayer ?? "OWNER");
  const [login, setLogin] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (busy) return;
    setFormError(null);
    const local: Record<string, string> = {};
    const rentP = optionalPaise(rent);
    const depositP = optionalPaise(deposit);
    if (rentP === "bad") local.rent = "Enter the rent in rupees, for example 25000.";
    if (depositP === "bad") local.deposit = "Enter the deposit in rupees, for example 100000.";
    const occ = occupants.trim() ? Number(occupants) : null;
    if (occ !== null && (!Number.isInteger(occ) || occ < 1 || occ > 30)) local.occupants = "Between 1 and 30 people.";
    if (!end) local.end = "Enter the date the agreement ends.";
    if (!editing) {
      if (name.trim().length < 2) local.name = "Enter the tenant's full name.";
      if (!start) local.start = "Enter the date the tenancy starts.";
      if (start && end && end <= start) local.end = "End date must be after the start date.";
      if (login && !mobile.trim()) local.mobile = "An app login needs the tenant's mobile.";
    } else if (tenancy && end && end <= tenancy.startDate) local.end = `End date must be after ${formatDate(tenancy.startDate)}.`;
    setField(local);
    if (Object.keys(local).length || rentP === "bad" || depositP === "bad") return;
    const money = { monthlyRentPaise: rentP, depositPaise: depositP, policeIntimationRef: police.trim() || null, allowedOccupants: occ, billPayer: payer };
    try {
      if (tenancy) {
        await update.mutateAsync({ params: { societyId, tenancyId: tenancy.id }, body: { endDate: end, ...money } });
        toast(`Tenancy of ${tenancy.tenant.name} updated.`, "ok");
      } else {
        const r = await create.mutateAsync({
          params: { societyId, unitId: unit.id },
          body: { tenant: { name, mobile: mobile.trim() || null, email: email.trim() || null }, startDate: start, endDate: end, ...money, createLogin: login },
        });
        toast("approvalId" in r ? "Tenancy sent for approval." : `${name.trim()} recorded as tenant of ${unit.label}${login ? ". Their app login is ready" : ""}.`, "ok");
      }
      onClose();
    } catch (err) {
      const r = placed(err, {
        "tenant.name": "name",
        "tenant.mobile": "mobile",
        "tenant.email": "email",
        startDate: "start",
        endDate: "end",
        monthlyRentPaise: "rent",
        depositPaise: "deposit",
        policeIntimationRef: "police",
        allowedOccupants: "occupants",
      });
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={600}>
      <ModalHeader title={tenancy ? `Tenancy · ${tenancy.tenant.name}` : `Add tenant · ${unit.label}`} onClose={onClose} />
      <Blurb>
        {tenancy
          ? `Started ${formatDate(tenancy.startDate)}. Extend it by moving the end date; the tenant's app access follows the new date.`
          : "The unit becomes tenanted from the start date. The tenant's app access, if you create it, ends with the agreement."}
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!tenancy && (
            <>
              <TextField label="Tenant's full name" req value={name} onChange={setName} error={field.name} autoFocus autoComplete="off" />
              <FieldPair>
                <TextField label="Mobile" mono type="tel" inputMode="tel" value={mobile} onChange={(v) => setMobile(v.replace(/[^\d+\s-]/g, ""))} error={field.mobile} placeholder="98220 00000" autoComplete="off" />
                <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={field.email} autoComplete="off" />
              </FieldPair>
            </>
          )}
          <FieldPair>
            {!tenancy && <TextField label="Starts" req type="date" value={start} onChange={setStart} error={field.start} />}
            <TextField label="Ends" req type="date" value={end} onChange={setEnd} error={field.end} />
          </FieldPair>
          <FieldPair>
            <TextField label="Monthly rent (₹)" mono inputMode="decimal" value={rent} onChange={setRent} error={field.rent} placeholder="25000" />
            <TextField label="Deposit (₹)" mono inputMode="decimal" value={deposit} onChange={setDeposit} error={field.deposit} placeholder="100000" />
          </FieldPair>
          <FieldPair>
            <TextField label="Police intimation" mono value={police} onChange={setPolice} error={field.police} placeholder="PNE/TI/2026/0412" />
            <TextField label="Allowed occupants" mono inputMode="numeric" value={occupants} onChange={(v) => setOccupants(v.replace(/\D/g, ""))} error={field.occupants} placeholder="4" />
          </FieldPair>
          <PickField
            label="Bills paid by"
            req
            value={payer}
            options={[
              { value: "OWNER", label: "Owner" },
              { value: "TENANT", label: "Tenant" },
            ]}
            onPick={setPayer}
          />
          {!tenancy && <CheckField label="Give the tenant an app login" hint="Creates their login with the Tenant template. They set a password on first sign-in." checked={login} onChange={setLogin} />}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Saving…">
            {tenancy ? "Save tenancy" : "Record tenancy"}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * End the active tenancy on a date (`members.endTenancy`). The server
 * suspends the tenant's app access; the record stays in the unit's history.
 */
export function EndTenancyModal({ societyId, tenancy, onClose }: { societyId: string; tenancy: Tenancy; onClose: () => void }) {
  const { toast } = useAdminStore();
  const end = useApiMutation(api.members.endTenancy);
  const [on, setOn] = useState(todayIso);
  const [field, setField] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (end.isPending) return;
    setFormError(null);
    if (!on) {
      setField("Enter the date the tenant left.");
      return;
    }
    setField(undefined);
    try {
      await end.mutateAsync({ params: { societyId, tenancyId: tenancy.id }, body: { endedOn: on } });
      toast(`Tenancy of ${tenancy.tenant.name} ended on ${formatDate(on)}. Their app access is suspended.`, "warn");
      onClose();
    } catch (err) {
      const r = placed(err, { endedOn: "on" });
      setField(r.field.on);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={end.isPending ? () => undefined : onClose} maxWidth={480}>
      <ModalHeader title="End this tenancy?" onClose={onClose} />
      <Blurb>
        {tenancy.tenant.name}'s tenancy ends on the date below and their app access is suspended. It cannot be reopened — a returning tenant is recorded as a new tenancy. Record the unit's new occupancy afterwards.
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Ended on" req type="date" value={on} onChange={setOn} error={field} autoFocus />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={end.isPending}>
            Keep tenancy
          </GhostButton>
          <PrimaryButton type="submit" tone="bad" busy={end.isPending} busyLabel="Ending…">
            End tenancy
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** Add a family member living in the unit (`members.addFamily`). */
export function FamilyModal({ societyId, unit, onClose }: { societyId: string; unit: UnitOverview["unit"]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const add = useApiMutation(api.members.addFamily);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (add.isPending) return;
    setFormError(null);
    const parsed = schemas.members.FamilyMemberInput.safeParse({ name, relation, mobile: mobile.trim() || null, dateOfBirth: dob || null });
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      setField({ name: local.name, relation: local.relation, mobile: local.mobile, dob: local.dateOfBirth });
      return;
    }
    setField({});
    try {
      const r = await add.mutateAsync({ params: { societyId, unitId: unit.id }, body: parsed.data });
      toast("approvalId" in r ? "Sent for approval." : `${parsed.data.name} added to ${unit.label}.`, "ok");
      onClose();
    } catch (err) {
      const r = placed(err, { name: "name", relation: "relation", mobile: "mobile", dateOfBirth: "dob" });
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={add.isPending ? () => undefined : onClose} maxWidth={520}>
      <ModalHeader title={`Add family · ${unit.label}`} onClose={onClose} />
      <Blurb>Someone who lives in the unit with the member. The gate recognises them; they get no login of their own unless you add one in Users &amp; access.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Full name" req value={name} onChange={setName} error={field.name} autoFocus autoComplete="off" />
          <TextField label="Relation" req value={relation} onChange={setRelation} error={field.relation} placeholder="Daughter" autoComplete="off" />
          <FieldPair>
            <TextField label="Mobile" mono type="tel" inputMode="tel" value={mobile} onChange={(v) => setMobile(v.replace(/[^\d+\s-]/g, ""))} error={field.mobile} autoComplete="off" />
            <TextField label="Date of birth" type="date" value={dob} onChange={setDob} error={field.dob} />
          </FieldPair>
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={add.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={add.isPending} busyLabel="Adding…">
            Add family member
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** Register a vehicle to the unit (`members.addVehicle`); the gate's plate lookup sees it at once. */
export function VehicleModal({ societyId, unit, slots, onClose }: { societyId: string; unit: UnitOverview["unit"]; slots: UnitOverview["parkingSlots"]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const add = useApiMutation(api.members.addVehicle);
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<VehicleType>("CAR");
  const [make, setMake] = useState("");
  const [colour, setColour] = useState("");
  const [owner, setOwner] = useState("");
  const [slot, setSlot] = useState("");
  const [sticker, setSticker] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (add.isPending) return;
    setFormError(null);
    const parsed = schemas.members.VehicleInput.safeParse({
      plate,
      type,
      make: make.trim() || null,
      colour: colour.trim() || null,
      ownerName: owner.trim() || null,
      parkingSlotId: slot || null,
      stickerNo: sticker.trim() || null,
    });
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      setField(local);
      return;
    }
    setField({});
    try {
      const r = await add.mutateAsync({ params: { societyId, unitId: unit.id }, body: parsed.data });
      toast("approvalId" in r ? "Sent for approval." : `${r.plate} registered to ${unit.label}.`, "ok");
      onClose();
    } catch (err) {
      const r = placed(err, { plate: "plate", type: "type", make: "make", colour: "colour", ownerName: "ownerName", parkingSlotId: "parkingSlotId", stickerNo: "stickerNo" });
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={add.isPending ? () => undefined : onClose} maxWidth={560}>
      <ModalHeader title={`Add vehicle · ${unit.label}`} onClose={onClose} />
      <Blurb>The gate looks plates up in this register, so a registered car is let in without a call to the flat.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Registration number" req mono value={plate} onChange={(v) => setPlate(v.toUpperCase())} error={field.plate} placeholder="MH12AB1234" autoFocus autoComplete="off" />
          <PickField label="Type" req value={type} options={schemas.members.VEHICLE_TYPES.map((t) => ({ value: t, label: enumLabel(t) }))} onPick={setType} error={field.type} />
          <FieldPair>
            <TextField label="Make and model" value={make} onChange={setMake} error={field.make} placeholder="Maruti Baleno" />
            <TextField label="Colour" value={colour} onChange={setColour} error={field.colour} placeholder="White" />
          </FieldPair>
          <FieldPair>
            <TextField label="Owner's name" value={owner} onChange={setOwner} error={field.ownerName} />
            <TextField label="Sticker number" mono value={sticker} onChange={setSticker} error={field.stickerNo} />
          </FieldPair>
          {slots.length > 0 && (
            <SelectField label="Parking slot" value={slot} options={[{ value: "", label: "No slot" }, ...slots.map((s) => ({ value: s.id, label: `${s.code} · ${enumLabel(s.type)}` }))]} onChange={setSlot} error={field.parkingSlotId} />
          )}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={add.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={add.isPending} busyLabel="Registering…">
            Register vehicle
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** Register a pet (`members.addPet`). */
export function PetModal({ societyId, unit, onClose }: { societyId: string; unit: UnitOverview["unit"]; onClose: () => void }) {
  const { toast } = useAdminStore();
  const add = useApiMutation(api.members.addPet);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [vaccinated, setVaccinated] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (add.isPending) return;
    setFormError(null);
    const parsed = schemas.members.PetInput.safeParse({ name, species, breed: breed.trim() || null, vaccinatedUntil: vaccinated || null });
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      setField(local);
      return;
    }
    setField({});
    try {
      const r = await add.mutateAsync({ params: { societyId, unitId: unit.id }, body: parsed.data });
      toast("approvalId" in r ? "Sent for approval." : `${parsed.data.name} registered at ${unit.label}.`, "ok");
      onClose();
    } catch (err) {
      const r = placed(err, { name: "name", species: "species", breed: "breed", vaccinatedUntil: "vaccinatedUntil" });
      setField(r.field);
      setFormError(r.form);
    }
  };

  return (
    <ModalShell onClose={add.isPending ? () => undefined : onClose} maxWidth={520}>
      <ModalHeader title={`Add pet · ${unit.label}`} onClose={onClose} />
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
          <FieldPair>
            <TextField label="Name" req value={name} onChange={setName} error={field.name} autoFocus autoComplete="off" />
            <TextField label="Species" req value={species} onChange={setSpecies} error={field.species} placeholder="Dog" />
          </FieldPair>
          <FieldPair>
            <TextField label="Breed" value={breed} onChange={setBreed} error={field.breed} placeholder="Indie" />
            <TextField label="Vaccinated until" type="date" value={vaccinated} onChange={setVaccinated} error={field.vaccinatedUntil} />
          </FieldPair>
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={add.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={add.isPending} busyLabel="Registering…">
            Register pet
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}
