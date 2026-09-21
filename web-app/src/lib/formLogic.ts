/**
 * The create/edit-merge logic for the data-driven form modal. This is the
 * part of the design README calls out three real bugs for (section
 * "One write path per column, and defaults belong to the field" /
 * "An update must overlay, never rebuild"), so the shape here is deliberate:
 *
 * - A single loop over the form's own fields is the only place a column is
 *   assigned; a typed value wins, a blank one takes the *field's own*
 *   declared default, never a positional guess and never a blanket
 *   "if nothing typed, wipe column e" rule.
 * - Editing starts the row as a COPY of the original record, so a column
 *   the form doesn't cover (a balance, a last-login date, a version string)
 *   survives untouched.
 * - The pill's semantic colour falls back to the ORIGINAL kind when the
 *   status is unchanged and outside the form's `kinds` map, not to "ok".
 */
import type { FormField, PillKind, Row } from "./types";
import { FORMS } from "../mock/forms";
import { formFields } from "../mock/forms";

export interface EditTarget {
  page: string;
  /** the row's position in the static seed array — immutable, unlike any displayed field */
  seed?: number;
  isNew: boolean;
  /** index within `added[page]` when isNew is true */
  idx: number;
  orig: Row;
}

/** Seeds the form's fields from an existing row, for the Edit flow. A pick
 * field whose current value is unlisted still renders as selected — the
 * caller (the form field renderer) is responsible for prepending it to the
 * options list; here we just carry the raw value through. */
export function seedFormFromRow(pageKey: string, row: Row): Record<string, string> {
  const fields = formFields(pageKey);
  const seed: Record<string, string> = {};
  const map: Record<string, string> = { a: row.a, b: row.b, c: row.c, d: row.d, e: row.e, pill: row.pill };
  fields.forEach((x) => {
    const raw = x.kind === "money" ? String(row.e || "").replace(/[^0-9.]/g, "") : map[x.k];
    seed[x.k] = raw && raw !== "—" && raw !== "Never" ? raw : x.kind === "pick" && x.opts ? x.opts[0] : "";
  });
  return seed;
}

function blankDefaultRow(pageKey: string): Row {
  const f = FORMS[pageKey];
  return { a: "—", b: "—", c: "—", d: "—", e: f?.blank ?? "—", pill: "Clear", k: "ok", eFg: "var(--ink,#0F1A17)" };
}

/**
 * Builds the row to write, given the form's current values and an optional
 * edit target. Returns the finished row plus which bucket it belongs in.
 */
export function buildSavedRow(
  pageKey: string,
  values: Record<string, string>,
  editing: EditTarget | null,
): Row {
  const f = FORMS[pageKey];
  const fields = formFields(pageKey);
  const base: Row = editing ? { ...editing.orig } : blankDefaultRow(pageKey);
  const row: Row = { ...base, eFg: base.eFg ?? "var(--ink,#0F1A17)" };
  delete row._seed;

  const pillField = fields.find((x) => x.k === "pill");

  fields.forEach((x) => {
    if (x.k === "pill") return;
    const raw = String(values[x.k] ?? "").trim();
    if (x.kind === "money") {
      if (raw) row.e = "₹" + Number(raw).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      else if (!editing) row.e = "—";
      return;
    }
    if (raw) {
      (row as unknown as Record<string, string>)[x.k] = raw;
    } else if (!editing) {
      (row as unknown as Record<string, string>)[x.k] = x.blank ?? (x.k === "e" ? f.blank ?? "—" : "—");
    }
  });

  const pill = String(values.pill ?? "").trim() || base.pill;
  row.pill = pill;
  const mapped = pillField?.kinds?.[pill];
  row.k = mapped ?? (pill === base.pill ? base.k : ("ok" as PillKind));

  if (!editing) row.isNew = true;
  return row;
}

/** Matches an option list case-insensitively and prepends the row's own
 * value when it is unlisted, so an out-of-vocabulary seed value ("OWNER",
 * "Insurance") still renders as selected rather than empty. */
export function optionsWithCurrent(opts: string[], current: string): string[] {
  if (!current) return opts;
  const has = opts.some((o) => o.toLowerCase() === current.toLowerCase());
  return has ? opts : [current, ...opts];
}

/** The first missing required field, or null if the form is valid. */
export function firstMissingField(fields: FormField[], values: Record<string, string>): FormField | null {
  return fields.find((x) => x.req && !String(values[x.k] ?? "").trim()) ?? null;
}
