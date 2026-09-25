import type { CSSProperties, ReactNode } from "react";
import { secondaryBtnStyle, type Pager } from "../lib/tableKit";
import type { LoadState } from "../lib/loadState";
import { Skeleton, SkeletonRows } from "./Skeleton";
import { DataBoundary } from "./DataBoundary";

/**
 * The generic table page's frame — header, stat cards, search and chips,
 * sortable header, footer and pager — for screens whose rows come from the
 * API. Same markup and styles as GenericPage, so an API-backed screen and a
 * mock one are indistinguishable; the difference is that the rows arrive as
 * a LoadState and the pager walks server cursors.
 */

export interface ApiColumn {
  label: string;
  align: "left" | "right";
}

export function PageHeader({ title, sub, actions }: { title: string; sub: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: "66ch", font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{sub}</p>
      </div>
      {actions && <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export interface LiveStat {
  label: string;
  /** `null` while the count is in flight — the card keeps its size and shows a bar. */
  value: string | null;
  note: string;
  fg?: string;
}

/** StatGrid with values that may still be loading. */
export function LiveStatGrid({ stats }: { stats: LiveStat[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
      {stats.map((s) => (
        <div key={s.label} className="hover-lift theme-transition" style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", marginBottom: 10 }}>{s.label}</div>
          {s.value === null ? (
            <Skeleton width={56} height={22} />
          ) : (
            <div style={{ font: "700 22px/1 Figtree, sans-serif", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: s.fg ?? "var(--ink,#0F1A17)" }}>{s.value}</div>
          )}
          <div style={{ marginTop: 8, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{s.note}</div>
        </div>
      ))}
    </div>
  );
}

export interface Chip {
  label: string;
  active: boolean;
  onClick: () => void;
}


export function ApiTable<T>({
  searchHint,
  search,
  onSearch,
  chips,
  cols,
  sortCol,
  sortDir,
  onSort,
  rows,
  renderRow,
  skeletonRows = 6,
  filtering,
  onClearFilters,
  emptyTitle,
  emptyBody,
  footer,
  pager,
}: {
  searchHint: string;
  search: string;
  onSearch: (v: string) => void;
  chips: Chip[];
  cols: ApiColumn[];
  sortCol: number | null;
  sortDir: 1 | -1;
  onSort: (i: number) => void;
  rows: LoadState<T[]>;
  renderRow: (row: T) => ReactNode;
  skeletonRows?: number;
  filtering: boolean;
  onClearFilters: () => void;
  emptyTitle: string;
  emptyBody: string;
  footer: string;
  pager: Pager;
}) {
  const sortArrow = (i: number) => (sortCol === i ? (sortDir === 1 ? " ↑" : " ↓") : "");
  const empty = rows.status === "ready" && rows.data.length === 0;

  return (
    <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, height: 36, padding: "0 12px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", flex: 1, minWidth: 180 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.4-4.4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchHint}
            aria-label={searchHint}
            style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "400 13.5px/1 Figtree, sans-serif", outline: "none", color: "var(--ink,#0F1A17)" }}
          />
        </div>
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            aria-pressed={c.active}
            className="press-scale focus-ring"
            style={{
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 12px",
              borderRadius: 999,
              border: `1px solid ${c.active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`,
              background: c.active ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)",
              color: c.active ? "#ffffff" : "var(--ink-soft,#4A5B56)",
              font: "600 12.5px/1 Figtree, sans-serif",
              cursor: "pointer",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
              {cols.map((col, i) => (
                <th key={col.label} style={{ padding: 0, textAlign: col.align }} aria-sort={sortCol === i ? (sortDir === 1 ? "ascending" : "descending") : undefined}>
                  <button
                    type="button"
                    onClick={() => onSort(i)}
                    className="press-scale focus-ring"
                    style={{
                      width: "100%",
                      padding: "11px 16px",
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: col.align,
                      font: "600 11px/1 Figtree, sans-serif",
                      letterSpacing: ".09em",
                      textTransform: "uppercase",
                      color: sortCol === i ? "var(--accent-ink,#0A5749)" : "var(--ink-soft,#5A6B66)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                    {sortArrow(i)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.status === "loading" && <SkeletonRows rows={skeletonRows} cols={cols} />}
            {rows.status === "ready" && rows.data.map(renderRow)}
            {rows.status === "error" && (
              // DataBoundary's message is a block; inside a table it needs a full-width cell.
              <tr>
                <td colSpan={cols.length} style={{ padding: 0 }}>
                  <DataBoundary state={rows} skeleton={null}>
                    {() => null}
                  </DataBoundary>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {empty && (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>{filtering ? "Nothing matches" : emptyTitle}</div>
          <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: filtering ? 16 : 0 }}>
            {filtering ? (search.trim() ? `No row contains "${search.trim()}".` : "No row is in that state.") : emptyBody}
          </div>
          {filtering && (
            <button type="button" onClick={onClearFilters} className="press-scale focus-ring" style={secondaryBtnStyle}>
              Clear search and filters
            </button>
          )}
        </div>
      )}

      <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{footer}</span>
        <PagerButtons pager={pager} />
      </div>
    </div>
  );
}

function PagerButtons({ pager }: { pager: Pager }) {
  const { pageNo, pageCount, onPage } = pager;
  const canPrev = pageNo > 1;
  const canNext = pageNo < pageCount;
  const edge = (enabled: boolean): CSSProperties => ({
    height: 31,
    padding: "0 11px",
    border: "1px solid var(--border,#E3E9E6)",
    borderRadius: 8,
    background: "var(--surface,#fff)",
    font: "600 12.5px/1 Figtree, sans-serif",
    color: enabled ? "var(--ink-soft,#5A6B66)" : "var(--ink-dim,#A8B5B0)",
    cursor: enabled ? "pointer" : "default",
  });
  return (
    <nav aria-label="Pages" style={{ display: "flex", gap: 6 }}>
      <button type="button" onClick={() => onPage(pageNo - 1)} disabled={!canPrev} className="press-scale focus-ring" style={edge(canPrev)}>
        Prev
      </button>
      {Array.from({ length: Math.max(1, pageCount) }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-current={pageNo === n ? "page" : undefined}
          className="press-scale focus-ring"
          style={{
            height: 31,
            minWidth: 31,
            border: pageNo === n ? "0" : "1px solid var(--border,#E3E9E6)",
            borderRadius: 8,
            background: pageNo === n ? "#0E6B5C" : "var(--surface,#fff)",
            color: pageNo === n ? "#ffffff" : "var(--ink,#0F1A17)",
            font: "600 12.5px/1 Figtree, sans-serif",
            cursor: "pointer",
          }}
        >
          {n}
        </button>
      ))}
      <button type="button" onClick={() => onPage(pageNo + 1)} disabled={!canNext} className="press-scale focus-ring" style={edge(canNext)}>
        Next
      </button>
    </nav>
  );
}
