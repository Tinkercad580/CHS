import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PAGES } from "../../mock/pages";
import { PANELS } from "../../mock/panels";
import { mergedRows } from "../../lib/rows";
import { rowMatches, rowMatchesChip, sortRows } from "../../lib/format";
import { useAdminStore } from "../../store/AdminStore";
import { StatGrid } from "../../components/StatGrid";
import { Pill } from "../../components/Pill";
import { DataFormModal } from "../../components/DataFormModal";
import { PanelModal } from "../../components/PanelModal";
import { NotFoundPage } from "./NotFoundPage";

/**
 * The generic table page: search/filter/sort/pagination/empty-state driven
 * entirely by one PAGES[key] data object (README section 2, "Every table is
 * live"). Used for members, users, setup, payments, accounting, recovery,
 * gate, vendors, notices, meetings, documents, requests and reports.
 */
export function GenericPage() {
  const { pageKey = "" } = useParams();
  const page = PAGES[pageKey];
  const navigate = useNavigate();
  const { state, toast } = useAdminStore();

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [pageNo, setPageNo] = useState<1 | 2>(1);
  const [formOpen, setFormOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const all = useMemo(() => mergedRows(pageKey, state.added, state.edits), [pageKey, state.added, state.edits]);

  const filtered = useMemo(() => {
    let rows = all;
    if (search.trim()) rows = rows.filter((r) => rowMatches(r, search));
    if (chip !== null && page) rows = rows.filter((r) => rowMatchesChip(r, page.chips[chip]));
    if (sortCol !== null) rows = sortRows(rows, sortCol, sortDir);
    if (pageNo === 2 && !search.trim() && chip === null) rows = rows.slice().reverse();
    return rows;
  }, [all, search, chip, sortCol, sortDir, pageNo, page]);

  if (!page) return <NotFoundPage />;

  const isFiltering = Boolean(search.trim()) || chip !== null;
  const footer = isFiltering
    ? `Showing ${filtered.length} matching row${filtered.length === 1 ? "" : "s"}`
    : (state.added[pageKey]?.length ? `${page.footer} · ${state.added[pageKey].length} added by you` : page.footer);

  const clearFilters = () => {
    setSearch("");
    setChip(null);
  };

  const sortArrow = (i: number) => (sortCol === i ? (sortDir === 1 ? " ↑" : " ↓") : "");

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>{page.title}</h1>
          <p style={{ margin: 0, maxWidth: "66ch", font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{page.sub}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setPanelOpen(true)} className="press-scale" style={secondaryBtnStyle}>
            {page.second}
          </button>
          <button type="button" onClick={() => setFormOpen(true)} className="press-scale" style={primaryBtnStyle}>
            {page.primary}
          </button>
        </div>
      </div>

      <StatGrid stats={page.stats} />

      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, height: 36, padding: "0 12px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", flex: 1, minWidth: 180 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.4-4.4" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageNo(1);
              }}
              placeholder={page.searchHint}
              style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "400 13.5px/1 Figtree, sans-serif", outline: "none", color: "var(--ink,#0F1A17)" }}
            />
          </div>
          {page.chips.map((c, i) => {
            const active = chip === i;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setChip((cur) => (cur === i ? null : i));
                  setPageNo(1);
                }}
                className="press-scale"
                style={{
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 12px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`,
                  background: active ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)",
                  color: active ? "#ffffff" : "var(--ink-soft,#4A5B56)",
                  font: "600 12.5px/1 Figtree, sans-serif",
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                {page.cols.map((col, i) => (
                  <th key={col.label} style={{ padding: 0, textAlign: col.align }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSortCol((cur) => {
                          if (cur === i) {
                            setSortDir((d) => (d === 1 ? -1 : 1));
                            return i;
                          }
                          setSortDir(1);
                          return i;
                        });
                      }}
                      className="press-scale"
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
              {filtered.map((r, i) => (
                    <tr
                      key={i}
                      onClick={() => navigate(`/${pageKey}/record/${encodeURIComponent(r.a)}`)}
                      style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)", cursor: "pointer" }}
                      className="row-hover"
                    >
                      <td style={{ padding: "13px 16px", font: "500 13.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{r.a}</td>
                      <td style={{ padding: "13px 16px", font: "600 14px/1.4 Figtree, sans-serif" }}>{r.b}</td>
                      <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.c}</td>
                      <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.d}</td>
                      <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", color: r.eFg ?? "var(--ink,#0F1A17)" }}>{r.e}</td>
                      <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                        <Pill label={r.pill} kind={r.k} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {isFiltering && filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>Nothing matches</div>
            <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>
              {search.trim() ? `No row contains "${search.trim()}".` : "No row is in that state on this page."}
            </div>
            <button type="button" onClick={clearFilters} className="press-scale" style={secondaryBtnStyle}>
              Clear search and filters
            </button>
          </div>
        )}

        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{footer}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                if (pageNo === 1) {
                  toast("Already on the first page.", "warn");
                  return;
                }
                setPageNo(1);
              }}
              className="press-scale"
              style={{ height: 31, padding: "0 11px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 8, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: pageNo === 1 ? "var(--ink-dim,#A8B5B0)" : "var(--ink-soft,#5A6B66)", cursor: "pointer" }}
            >
              Prev
            </button>
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPageNo(n as 1 | 2);
                }}
                className="press-scale"
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
            <button
              type="button"
              onClick={() => {
                if (pageNo === 2) {
                  toast("No more pages in this filter.", "warn");
                  return;
                }
                setPageNo(2);
              }}
              className="press-scale"
              style={{ height: 31, padding: "0 11px", border: "1px solid var(--border,#E3E9E6)", borderRadius: 8, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: pageNo === 2 ? "var(--ink-dim,#A8B5B0)" : "var(--ink-soft,#5A6B66)", cursor: "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {formOpen && <DataFormModal pageKey={pageKey} editing={null} onClose={() => setFormOpen(false)} />}
      {panelOpen && PANELS[pageKey] && <PanelModal panel={PANELS[pageKey]} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

const secondaryBtnStyle: CSSProperties = {
  height: 38,
  padding: "0 15px",
  border: "1px solid var(--border-strong,#CCD6D2)",
  borderRadius: 10,
  background: "var(--surface,#fff)",
  font: "600 13.5px/1 Figtree, sans-serif",
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
};

const primaryBtnStyle: CSSProperties = {
  height: 38,
  padding: "0 16px",
  border: 0,
  borderRadius: 10,
  background: "#0E6B5C",
  color: "#fff",
  font: "600 13.5px/1 Figtree, sans-serif",
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
};
