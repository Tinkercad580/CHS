import type { CSSProperties, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { LoadState } from "../lib/loadState";
import type { PillKind } from "../lib/types";
import { PILL_TOKENS } from "../lib/format";
import { DataBoundary } from "./DataBoundary";
import { SkeletonRows } from "./Skeleton";
import { GhostButton, ModalFooter, ModalShell, PrimaryButton } from "./ModalShell";
import { FormError, TextField } from "./FormFields";

/**
 * The small pieces the money and governance screens share: the design's card
 * frame, a plain data table with real skeleton columns, a section tab strip,
 * inline notes and a confirm dialog. Styles are the ones the dashboard, bill
 * run and record pages already use, collected so each screen does not
 * restate them.
 */

export function CardHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>{title}</div>
        {sub && <div style={{ marginTop: 3, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export interface Column {
  label: string;
  align?: "left" | "right";
}

/**
 * A table without the list-page chrome (search, chips, pager) — for a
 * record's lines, a preview's breakdown or a report. Loading shows skeleton
 * rows in the real columns; failure shows the message and retry in place.
 */
export function DataTable<T>({
  cols,
  rows,
  renderRow,
  empty,
  skeletonRows = 5,
  foot,
  minWidth = 560,
}: {
  cols: Column[];
  rows: LoadState<T[]>;
  renderRow: (row: T, i: number) => ReactNode;
  empty: ReactNode;
  skeletonRows?: number;
  foot?: ReactNode;
  minWidth?: number;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth }}>
        <thead>
          <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
            {cols.map((c, i) => (
              <th key={`${c.label}-${i}`} scope="col" style={{ padding: "10px 16px", textAlign: c.align ?? "left", font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.status === "loading" && <SkeletonRows rows={skeletonRows} cols={cols} />}
          {rows.status === "ready" && rows.data.map(renderRow)}
          {rows.status === "ready" && rows.data.length === 0 && (
            <tr>
              <td colSpan={cols.length} style={{ padding: "30px 20px", textAlign: "center", font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                {empty}
              </td>
            </tr>
          )}
          {rows.status === "error" && (
            <tr>
              <td colSpan={cols.length} style={{ padding: 0 }}>
                <DataBoundary state={rows} skeleton={null}>
                  {() => null}
                </DataBoundary>
              </td>
            </tr>
          )}
        </tbody>
        {foot && rows.status === "ready" && rows.data.length > 0 && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  );
}

/** Tabs across the top of a module (Billing: runs, bills, charge heads). Real links, so each tab has a URL and the back button works. */
export function SubNav({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  return (
    <nav aria-label="Sections" style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border,#E3E9E6)", overflowX: "auto" }}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className="focus-ring"
          style={({ isActive }) => ({
            padding: "10px 14px",
            marginBottom: -1,
            borderBottom: `2px solid ${isActive ? "var(--accent,#0E6B5C)" : "transparent"}`,
            color: isActive ? "var(--accent-ink,#0A5749)" : "var(--ink-soft,#5A6B66)",
            font: "600 13.5px/1 Figtree, sans-serif",
            textDecoration: "none",
            whiteSpace: "nowrap",
          })}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** A tinted note inside a card or form — the design's warning strip under the variance bars. */
export function Note({ kind = "warn", children, style }: { kind?: PillKind; children: ReactNode; style?: CSSProperties }) {
  const t = PILL_TOKENS[kind];
  return (
    <div role={kind === "bad" ? "alert" : undefined} style={{ padding: "11px 13px", borderRadius: 11, background: t.bg, font: "500 12.5px/1.5 Figtree, sans-serif", color: t.fg, ...style }}>
      {children}
    </div>
  );
}

export function Blurb({ children }: { children: ReactNode }) {
  return <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>{children}</div>;
}

export function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** Two fields side by side, stacking on a narrow modal. */
export function FieldPair({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>{children}</div>;
}

/**
 * The confirm step before something that can't be taken back — publishing a
 * run or a notice, cancelling a bill or a receipt. With `reason` it asks for
 * the reason the server records; the error, when the server refuses, is its
 * own message.
 */
export function ConfirmModal({
  title,
  body,
  confirm,
  busyLabel,
  tone = "accent",
  busy,
  error,
  reason,
  onConfirm,
  onClose,
  cancelLabel = "Cancel",
}: {
  title: string;
  body: ReactNode;
  confirm: string;
  busyLabel: string;
  tone?: "accent" | "bad";
  busy: boolean;
  error: string | null;
  /** `optional` labels the field optional — the bounce reason, which the server does not require. */
  reason?: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; optional?: boolean };
  onConfirm: () => void;
  onClose: () => void;
  cancelLabel?: string;
}) {
  const warn = tone === "bad";
  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={480}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: warn ? "var(--bad-wash,#FCEDEC)" : "var(--warn-wash,#FDF3E7)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={warn ? "var(--bad,#C0342B)" : "var(--warn,#B45309)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.5 22 20H2Z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      </div>
      <Form onSubmit={onConfirm}>
        <div style={{ font: "700 20px/1.3 Figtree, sans-serif", letterSpacing: "-.015em", marginBottom: 10 }}>{title}</div>
        <div style={{ font: "400 14.5px/1.6 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>{body}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reason && <TextField label={reason.label} req={!reason.optional} multiline autoFocus value={reason.value} onChange={reason.onChange} error={reason.error} placeholder={reason.placeholder} />}
          <FormError message={error} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            {cancelLabel}
          </GhostButton>
          <PrimaryButton type="submit" tone={tone} busy={busy} busyLabel={busyLabel}>
            {confirm}
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/** The small back-link line above a sub-page title: "Billing › Bill runs". */
export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7, flexWrap: "wrap" }}>
      {items.map((it, i) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          {i > 0 && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          )}
          {it.to ? (
            <NavLink to={it.to} end className="focus-ring" style={{ font: "400 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", textDecoration: "none" }}>
              {it.label}
            </NavLink>
          ) : (
            <span style={{ font: "600 12.5px/1 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)" }}>{it.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** A retry button in the house style, for error states outside DataBoundary. */
export function RetryButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press-scale focus-ring" style={{ height: 34, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer" }}>
      Try again
    </button>
  );
}

/**
 * Tabs inside a panel whose sections have no URL of their own (the account
 * panel's Notifications / Password / Sessions / Two-factor). Same look as
 * SubNav; buttons instead of links, announced as a tab list.
 */
export function PanelTabs<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border,#E3E9E6)", overflowX: "auto" }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className="focus-ring"
            style={{
              padding: "10px 14px",
              marginBottom: -1,
              border: 0,
              borderBottom: `2px solid ${active ? "var(--accent,#0E6B5C)" : "transparent"}`,
              background: "transparent",
              color: active ? "var(--accent-ink,#0A5749)" : "var(--ink-soft,#5A6B66)",
              font: "600 13.5px/1 Figtree, sans-serif",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** A small secondary button inside a card — "Edit", "Add building", "Allot". */
export function CardButton({ onClick, children, tone, disabled }: { onClick: () => void; children: ReactNode; tone?: "bad"; disabled?: boolean }) {
  const bad = tone === "bad";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press-scale focus-ring"
      style={{ height: 32, padding: "0 12px", border: `1px solid ${bad ? "var(--bad-border,#F6D9D6)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: bad ? "var(--bad-ink,#9B2B22)" : "var(--ink,#0F1A17)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, whiteSpace: "nowrap", flex: "none" }}
    >
      {children}
    </button>
  );
}
