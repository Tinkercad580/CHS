import { useState } from "react";
import { useApi, useApiMutation } from "@chs/api-client/react";
import { api, schemas } from "@chs/contract";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { FormError, PickField, TextField } from "../../components/FormFields";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { enumLabel } from "../../lib/apiFormat";

type Kind = (typeof schemas.members.MEMBERSHIP_KINDS)[number];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Admit an owner, co-owner or associate member to a unit
 * (`members.addMembership`). A member is a register entry, not a login:
 * giving them the app is a separate step in Users & access.
 */
export function AddMemberModal({ societyId, unitLabel, onClose, onAdded }: { societyId: string; unitLabel?: string; onClose: () => void; onAdded?: (unitId: string) => void }) {
  const { toast } = useAdminStore();
  const client = useApi();
  const add = useApiMutation(api.members.addMembership);
  const [unit, setUnit] = useState(unitLabel ?? "");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [kind, setKind] = useState<Kind>("PRIMARY");
  const [certificate, setCertificate] = useState("");
  const [admitted, setAdmitted] = useState(today);
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setField({});
    setFormError(null);
    const want = unit.trim().toUpperCase();
    if (!want) {
      setField({ unit: "Enter the unit, for example A-1206." });
      return;
    }
    setBusy(true);
    try {
      const page = await client.structure.units({ params: { societyId }, query: { q: want, limit: 20 } });
      const found = page.items.find((u) => u.label.toUpperCase() === want);
      if (!found) {
        setField({ unit: `No unit "${want}" in this society.` });
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
      const split = splitError(err, ["person.name", "person.mobile", "kind", "shareCertificateNo", "admissionDate"]);
      setField({ name: split.field["person.name"], mobile: split.field["person.mobile"], certificate: split.field.shareCertificateNo, admitted: split.field.admissionDate, kind: split.field.kind });
      setFormError(split.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <ModalHeader title="Add member" onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>
        A member of the society for this unit, as on the share certificate. App access is given separately, in Users &amp; access.
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
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
      </form>
    </ModalShell>
  );
}
