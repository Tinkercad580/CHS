import { useState } from "react";
import type { Row } from "../lib/types";
import { FORMS, formFields } from "../mock/forms";
import { buildSavedRow, firstMissingField, seedFormFromRow, type EditTarget } from "../lib/formLogic";
import { ModalShell, ModalHeader, ModalFooter, GhostButton, PrimaryButton } from "./ModalShell";
import { FieldRow } from "./FormFields";
import { useAdminStore } from "../store/AdminStore";

/**
 * The one modal that renders every screen's primary-action form, from the
 * page's own FORMS[key] spec (README, "Every page's primary action opens a
 * real form ... one modal renders from a per-page field spec"). Create and
 * edit share this component; `editing` carries the distinction (README,
 * "Create and update share one modal, so the distinction has to be carried
 * explicitly").
 */
export function DataFormModal({ pageKey, editing, onClose }: { pageKey: string; editing: EditTarget | null; onClose: () => void }) {
  const { dispatch, toast } = useAdminStore();
  const form = FORMS[pageKey];
  const fields = formFields(pageKey);

  const [values, setValues] = useState<Record<string, string>>(() => {
    if (editing) return seedFormFromRow(pageKey, editing.orig);
    const seed: Record<string, string> = {};
    fields.forEach((f) => {
      seed[f.k] = f.kind === "pick" && f.opts ? f.opts[0] : "";
    });
    return seed;
  });
  const [errKey, setErrKey] = useState<string | null>(null);

  if (!form) return null;

  const save = () => {
    const missing = firstMissingField(fields, values);
    if (missing) {
      setErrKey(missing.k);
      toast(missing.label + " is needed.", "warn");
      return;
    }
    const row: Row = buildSavedRow(pageKey, values, editing);
    if (editing) {
      if (editing.isNew && editing.idx > -1) {
        dispatch({ type: "saveEditedAdded", page: pageKey, idx: editing.idx, row });
      } else if (editing.seed !== undefined) {
        dispatch({ type: "saveEditedSeed", page: pageKey, seed: editing.seed, row });
      }
      toast((values.b || values.a || "Record").trim() + " updated.", "ok");
    } else {
      dispatch({ type: "addRow", page: pageKey, row });
      toast(form.done(values), "ok");
    }
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <ModalHeader title={form.title} onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>{form.blurb}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.map((f) => (
          <FieldRow
            key={f.k}
            field={f}
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
        <PrimaryButton onClick={save}>{form.cta}</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}
