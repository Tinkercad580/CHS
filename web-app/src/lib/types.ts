/**
 * Shared shapes for the generic table/form/record pattern described in
 * README.md section 2 ("Every page's primary action opens a real form" /
 * "A record opens as a full page"). One page object drives search, filter,
 * sort, pagination and empty state for every table screen; one form spec
 * drives the create/edit modal; one record spec drives the record page.
 */

/** Semantic pill colour kind — maps to a token pair via PILL_KIND in lib/format.ts */
export type PillKind = "ok" | "warn" | "bad" | "info" | "mute";

/**
 * A table row. Columns are deliberately generic (a..e) because the same
 * table shape is reused for every screen with different meanings per column
 * — exactly as PAGES[x].cols supplies the labels in the prototype. `_seed`
 * is the row's position in the static seed array; it is the immutable edit
 * key described in README ("An update must overlay, never rebuild").
 */
export interface Row {
  a: string;
  b: string;
  c: string;
  d: string;
  e: string;
  pill: string;
  k: PillKind;
  eFg?: string;
  _seed?: number;
  isNew?: boolean;
  edited?: boolean;
}

export interface ColSpec {
  label: string;
  align: "left" | "right";
}

export interface StatSpec {
  label: string;
  value: string;
  note: string;
  fg?: string;
}

export interface PageSpec {
  key: string;
  title: string;
  sub: string;
  primary: string;
  second: string;
  searchHint: string;
  chips: string[];
  stats: StatSpec[];
  cols: [ColSpec, ColSpec, ColSpec, ColSpec, ColSpec, ColSpec];
  rows: Row[];
  footer: string;
}

export type FieldKind = "text" | "mono" | "money" | "pick";

export interface FormFieldMeta {
  ph?: string;
  kind?: FieldKind;
  req?: boolean;
  opts?: string[];
  blank?: string;
}

export interface FormSpec {
  key: string;
  title: string;
  blurb: string;
  cta: string;
  /** exactly 5 entries, mapped positionally onto columns a..e */
  meta: [FormFieldMeta, FormFieldMeta, FormFieldMeta, FormFieldMeta, FormFieldMeta];
  pill?: { opts: string[]; kinds: Record<string, PillKind> };
  blank?: string;
  done: (v: Record<string, string>) => string;
}

/** A field ready to render, with its label derived from the page's own column. */
export interface FormField {
  k: string;
  label: string;
  kind: FieldKind;
  ph?: string;
  req?: boolean;
  opts?: string[];
  kinds?: Record<string, PillKind>;
  blank?: string;
}

export interface PanelRow {
  a: string;
  b: string;
  c: string;
}

export interface PanelSpec {
  key: string;
  title: string;
  sub: string;
  head: [string, string, string];
  rows: PanelRow[];
  foot: string;
  cta: string;
  /** empty string means "read-only reference" — closes rather than acts */
  done: string;
}

export type SectionType = "table" | "people" | "grid" | "list" | "trail";

export interface RecordSection {
  h: string;
  sub?: string;
  action?: string;
  type: SectionType;
  head?: string[];
  rows: string[][];
}

export interface RecordTile {
  label: string;
  value: string;
  sub: string;
  accent: string;
}

export interface RecordAlert {
  label: string;
  value: string;
  sub: string;
  cta: string;
}

export type RecordActionKind = "primary" | "ghost" | "warn";

export interface RecordContext {
  kind: string;
  code: string;
  meta: string[];
  chips: [string, PillKind][];
  actions: [string, RecordActionKind][];
  tiles: RecordTile[];
  alert: RecordAlert | null;
  left: RecordSection[];
  right: RecordSection[];
}

export interface NavGroup {
  group: string;
}
export interface NavItem {
  key: string;
  label: string;
  badge?: string;
}
export type NavEntry = NavGroup | NavItem;

export interface Society {
  name: string;
  units: number;
  city: string;
  role: string;
  mark: string;
}

export interface ToastSpec {
  id: string;
  text: string;
  kind: "ok" | "warn";
}

/** A lightweight ad-hoc field spec used by the "quick" modal (section adds,
 *  receive payment, change template, app access, send statement, etc). */
export interface QuickField {
  k: string;
  label: string;
  kind?: FieldKind;
  req?: boolean;
  opts?: string[];
  ph?: string;
}

export interface QuickSpec {
  title: string;
  blurb: string;
  cta: string;
  fields: QuickField[];
  seed: Record<string, string>;
  save: (v: Record<string, string>) => void;
}
