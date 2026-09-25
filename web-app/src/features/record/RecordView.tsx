import type { ReactNode } from "react";
import { DataBoundary } from "../../components/DataBoundary";
import { DotPill } from "../../components/Pill";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import type { DerivedRecord, DerivedSection } from "../../lib/recordDerive";
import type { LoadState } from "../../lib/loadState";
import type { PillKind, RecordActionKind } from "../../lib/types";
import { TWO_COLUMNS } from "./recordModel";

/**
 * The record page's look, separated from where its data comes from.
 *
 * RecordPage feeds it the mock-derived view model; the API-backed user and
 * unit records feed it the same shapes built from server data. Keeping one
 * set of components is what keeps the two indistinguishable on screen.
 */

const actionColors: Record<RecordActionKind, { bg: string; fg: string; bd: string }> = {
  primary: { bg: "var(--accent,#0E6B5C)", fg: "#ffffff", bd: "0" },
  ghost: { bg: "var(--surface,#fff)", fg: "var(--ink,#0F1A17)", bd: "1px solid var(--border-strong,#CCD6D2)" },
  warn: { bg: "var(--warn-wash,#FDF3E7)", fg: "var(--warn-ink,#8F4A0A)", bd: "1px solid var(--warn-border,#F5DFBE)" },
};

export interface RecordAction {
  label: string;
  kind: RecordActionKind;
  onClick: () => void;
  /** Label shown with the spinner while the action's request is in flight. */
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
}

export function RecordHeaderCard({
  initial,
  name,
  code,
  meta,
  chips,
  actions,
  onBack,
}: {
  initial: string;
  name: string;
  code: string;
  meta: string[];
  chips: [string, PillKind][];
  actions: RecordAction[];
  onBack: () => void;
}) {
  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 16, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <BackButton onClick={onBack} />
        <span style={{ width: 54, height: 54, flex: "none", borderRadius: "50%", background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 20px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>
          {initial}
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ font: "700 25px/1.2 Figtree, sans-serif", letterSpacing: "-.026em", marginBottom: 7 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ font: "500 12.5px/1 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{code}</span>
            {meta.map((m) => (
              <span key={m} style={{ font: "400 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{m}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {chips.map(([label, kind], i) => (
              <DotPill key={label + i} label={label} kind={kind} />
            ))}
          </div>
        </div>
        {actions.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "none" }}>
            {actions.map((a) => {
              const c = actionColors[a.kind];
              const off = a.disabled || a.busy;
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  disabled={off}
                  aria-busy={a.busy || undefined}
                  className="press-scale"
                  style={{ height: 40, padding: "0 15px", border: c.bd, borderRadius: 10, background: c.bg, color: c.fg, font: "600 13.5px/1 Figtree, sans-serif", cursor: off ? "default" : "pointer", opacity: a.disabled && !a.busy ? 0.55 : 1, whiteSpace: "nowrap", flex: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  {a.busy && <Spinner size={13} />}
                  {a.busy ? (a.busyLabel ?? a.label) : a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Back"
      aria-label="Back"
      style={{ width: 36, height: 36, flex: "none", border: "1px solid var(--border,#E3E9E6)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 5-7 7 7 7" />
      </svg>
    </button>
  );
}

export function RecordTiles({ tiles }: { tiles: DerivedRecord["tiles"] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(208px,1fr))", gap: 1, background: "var(--border,#E3E9E6)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, overflow: "hidden" }}>
      {tiles.map((t) => (
        <div key={t.label} className="theme-transition" style={{ background: "var(--surface,#fff)", padding: "18px 20px 17px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 13, minHeight: 26 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.accent, flex: "none", marginTop: 4 }} />
            <span style={{ font: "600 10.5px/1.25 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)" }}>{t.label}</span>
          </div>
          <div style={{ font: "600 24px/1.15 Figtree, sans-serif", letterSpacing: "-.028em", marginBottom: 7, color: t.valueFg, fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
          <div style={{ font: "400 12px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function RecordAlertCard({ alert, onAct, busy }: { alert: NonNullable<DerivedRecord["alert"]>; onAct: () => void; busy?: boolean }) {
  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--bad-border,#F6D9D6)", borderTop: "3px solid var(--bad,#C0342B)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--bad-ink,#9B2B22)", marginBottom: 9 }}>{alert.label}</div>
        <div style={{ font: "700 26px/1.1 Figtree, sans-serif", letterSpacing: "-.026em", marginBottom: 5 }}>{alert.value}</div>
        <div style={{ font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{alert.sub}</div>
      </div>
      <button type="button" onClick={onAct} disabled={busy} className="press-scale" style={{ height: 42, padding: "0 18px", border: 0, borderRadius: 11, background: "var(--bad,#C0342B)", color: "#fff", font: "600 14px/1 Figtree, sans-serif", cursor: busy ? "default" : "pointer", flex: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 8 }}>
        {busy && <Spinner size={13} />}
        {alert.cta}
      </button>
    </div>
  );
}

export function RecordColumns({ grid, left, right }: { grid: string; left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: grid, gap: 14, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>{left}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>{right}</div>
    </div>
  );
}

/**
 * `load` covers a section whose rows come from their own request: while it
 * is in flight the card shows its heading and a few bars; if it fails the
 * card says so and offers the retry, and the rest of the record is unaffected.
 */
export function SectionCard({ s, onAdd, busy, load }: { s: DerivedSection; onAdd?: () => void; busy?: boolean; load?: LoadState<unknown> }) {
  const emptyText = s.empty ?? "Nothing here yet.";
  if (load && load.status !== "ready") {
    return (
      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-soft,#EDF1EF)" }}>
          <div style={{ font: "700 15.5px/1.25 Figtree, sans-serif", letterSpacing: "-.012em" }}>{s.h}</div>
          <div style={{ marginTop: 3, font: "400 12px/1.35 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{load.status === "loading" ? "Loading…" : "Could not load"}</div>
        </div>
        {load.status === "loading" ? (
          <div style={{ padding: 18 }} aria-busy="true">
            <SkeletonText lines={3} />
          </div>
        ) : (
          <DataBoundary state={load} skeleton={null}>
            {() => null}
          </DataBoundary>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 15.5px/1.25 Figtree, sans-serif", letterSpacing: "-.012em" }}>{s.h}</div>
          <div style={{ marginTop: 3, font: "400 12px/1.35 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{s.sub}</div>
        </div>
        {s.hasAction && onAdd && (
          <button type="button" onClick={onAdd} disabled={busy} className="press-scale" style={{ height: 34, padding: "0 13px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: busy ? "default" : "pointer", flex: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 7 }}>
            {busy && <Spinner size={12} />}
            {s.action}
          </button>
        )}
      </div>

      {s.rows.length === 0 && s.type !== "grid" && s.empty !== undefined && (
        <div style={{ padding: "18px 18px", font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>{emptyText}</div>
      )}

      {s.type === "table" && (s.rows.length > 0 || s.empty === undefined) && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                {s.headLabels.map((h, i) => (
                  <th key={h} style={{ padding: "9px 18px", textAlign: i === 1 || i === 3 ? "right" : "left", font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((x, i) => (
                <tr key={i} className="row-hover" style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
                  <td style={{ padding: "12px 18px", font: "600 13px/1.4 Figtree, sans-serif" }}>{x.a}</td>
                  <td style={{ padding: "12px 18px", textAlign: "right", font: "600 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{x.b}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <DotPill label={x.c} kind={x.pillKind} />
                  </td>
                  <td style={{ padding: "12px 18px", textAlign: "right", font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{x.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.type === "people" && (
        <div>
          {s.rows.map((x, i) => (
            <div key={i} className="row-hover" style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: "var(--subtle,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#4A5B56)" }}>{x.mark}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13.5px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{x.b}</div>
              </div>
              <span style={{ flex: "none", font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)", whiteSpace: "nowrap" }}>{x.d}</span>
            </div>
          ))}
        </div>
      )}

      {s.type === "grid" && (
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "18px 16px" }}>
          {s.rows.map((x, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              <div style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)", marginBottom: 7 }}>{x.a}</div>
              <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", overflowWrap: "anywhere" }}>{x.b}</div>
            </div>
          ))}
        </div>
      )}

      {s.type === "list" && (
        <div>
          {s.rows.length === 0 && s.empty === undefined && <div style={{ padding: "18px 18px", font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>Nothing here yet.</div>}
          {s.rows.map((x, i) => (
            <div key={i} className="row-hover" style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", overflowWrap: "anywhere" }}>{x.b}</div>
              </div>
              <span style={{ flex: "none", padding: "3px 9px", borderRadius: 7, background: "var(--subtle,#EDF1EF)", font: "600 11.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#4A5B56)", whiteSpace: "nowrap" }}>{x.d}</span>
            </div>
          ))}
        </div>
      )}

      {s.type === "trail" && (s.rows.length > 0 || s.empty === undefined) && (
        <div style={{ padding: "16px 18px" }}>
          {s.rows.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", width: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: i === 0 ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)", flex: "none", marginTop: 4 }} />
                <span style={{ flex: 1, width: 1.5, background: "var(--border,#E3E9E6)", minHeight: 12 }} />
              </div>
              <div style={{ flex: 1, paddingBottom: 14, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.35 Figtree, sans-serif", marginBottom: 2 }}>{x.a}</div>
                <div style={{ font: "400 11.5px/1.3 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>{x.b}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder for a record while it is fetched: the header card, the tile
 * strip and two columns of section cards, at their real sizes.
 */
export function RecordSkeleton({ tiles = 4 }: { tiles?: number }) {
  const card = { background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: 18 } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-busy="true" aria-label="Loading record">
      <div style={{ ...card, borderRadius: 16, padding: "20px 22px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <Skeleton width={36} height={36} radius={10} />
        <Skeleton width={54} height={54} radius={27} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton width="38%" height={24} />
          <Skeleton width="52%" height={12} />
          <Skeleton width={140} height={20} radius={999} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(208px,1fr))", gap: 1, background: "var(--border,#E3E9E6)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, overflow: "hidden" }}>
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} style={{ background: "var(--surface,#fff)", padding: "18px 20px 17px", display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton width="45%" height={10} />
            <Skeleton width="60%" height={22} />
            <Skeleton width="50%" height={11} />
          </div>
        ))}
      </div>
      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <>
            <div style={card}><SkeletonText lines={4} /></div>
            <div style={card}><SkeletonText lines={3} /></div>
          </>
        }
        right={<div style={card}><SkeletonText lines={6} /></div>}
      />
    </div>
  );
}

/** A record that failed to load or does not exist, inside the same card frame. */
export function RecordMessage({ title, body, onBack, action }: { title: string; body: string; onBack: () => void; action?: ReactNode }) {
  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 16, padding: "20px 22px", display: "flex", gap: 16, alignItems: "flex-start" }}>
      <BackButton onClick={onBack} />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>{title}</div>
        <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: action ? 14 : 0 }}>{body}</div>
        {action}
      </div>
    </div>
  );
}
