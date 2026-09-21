import { useState } from "react";
import type { QuickSpec } from "../lib/types";
import { ModalShell, ModalHeader, ModalFooter, GhostButton, PrimaryButton } from "./ModalShell";
import { FieldRow } from "./FormFields";
import { useAdminStore } from "../store/AdminStore";

/**
 * The small ad-hoc form used for record-page section adds ("Add charge",
 * "Raise ticket", "Book"...), Receive payment, Change permission template,
 * App access and Send statement. Its field list is built by the caller from
 * the section's own columns (README, "Section actions generate their form
 * from the section's own columns").
 */
export function QuickModal({ spec, onClose }: { spec: QuickSpec; onClose: () => void }) {
  const { toast } = useAdminStore();
  const [values, setValues] = useState<Record<string, string>>(spec.seed);
  const [errKey, setErrKey] = useState<string | null>(null);

  const save = () => {
    const missing = spec.fields.find((x) => x.req && !String(values[x.k] ?? "").trim());
    if (missing) {
      setErrKey(missing.k);
      toast(missing.label + " is needed.", "warn");
      return;
    }
    spec.save(values);
  };

  return (
    <ModalShell onClose={onClose} maxWidth={470}>
      <ModalHeader title={spec.title} onClose={onClose} />
      <div style={{ font: "400 13.5px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>{spec.blurb}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {spec.fields.map((f) => (
          <FieldRow
            key={f.k}
            field={{ k: f.k, label: f.label, kind: f.kind ?? "text", ph: f.ph, req: f.req, opts: f.opts }}
            value={values[f.k] ?? ""}
            bad={errKey === f.k}
            onChange={(v) => {
              setValues((s) => ({ ...s, [f.k]: v }));
              if (errKey === f.k) setErrKey(null);
            }}
            onPick={(v) => {
              setValues((s) => ({ ...s, [f.k]: v }));
              setErrKey(null);
            }}
          />
        ))}
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}>{spec.cta}</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}
