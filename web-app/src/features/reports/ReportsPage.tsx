import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type ReportData, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { useUnitLookup } from "../../api/units";
import { PageHeader } from "../../components/ApiTable";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Crumbs, DataTable } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle, rowBorder } from "../../lib/uiStyles";
import { MODE_LABEL } from "../../lib/moneyLabels";
import { SelectField, TextField } from "../../components/FormFields";
import { formatDate, formatMobile } from "../../lib/apiFormat";
import { inr, periodLabel, todayIso } from "../../lib/money";
import { ready, type LoadState } from "../../lib/loadState";
import { EmailReport } from "./EmailReport";

type Param = "range" | "period" | "unit" | "notice";

interface ReportDef {
  slug: string;
  name: string;
  group: string;
  blurb: string;
  param?: Param;
}

/** The report library: what the API can run (`REPORT_TYPES`), in the order a committee reaches for them. */
const REPORTS: ReportDef[] = [
  { slug: "defaulters", name: "Defaulters", group: "Recovery", blurb: "Units with overdue bills, largest first, with the oldest due date." },
  { slug: "collections", name: "Collections", group: "Payments", blurb: "Every payment received between two dates, with totals by mode.", param: "range" },
  { slug: "bill-register", name: "Bill register", group: "Billing", blurb: "All bills for a period with charges, interest, GST and balance.", param: "period" },
  { slug: "receipt-register", name: "Receipt register", group: "Payments", blurb: "Receipts issued between two dates, cancelled ones included.", param: "range" },
  { slug: "member-ledger", name: "Member ledger", group: "Billing", blurb: "One unit's ledger with its running balance.", param: "unit" },
  { slug: "occupancy", name: "Occupancy", group: "Members", blurb: "Every unit's owner, occupancy and carpet area." },
  { slug: "tenant-register", name: "Tenant register", group: "Members", blurb: "Active tenancies, soonest expiry first, with police intimation." },
  { slug: "notice-delivery", name: "Notice delivery proof", group: "Governance", blurb: "Who received, read and acknowledged a notice — the proof of service.", param: "notice" },
];

/** Permissions that open `reports.get` (its contract access rule). */
const PERMS = ["reports.view", "billing.generate", "payments.record", "accounts.manage", "notices.publish", "members.manage"] as const;

export function ReportsPage({ slug }: { slug?: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Reports" />;
  if (!holds(society, ...PERMS)) return <NoAccess title="Reports" need="reports.view" />;
  const def = slug ? REPORTS.find((r) => r.slug === slug) : undefined;
  // Notice delivery is chosen from notices.list, which needs notices.publish; without it the report can't be pointed at a notice.
  const reports = REPORTS.filter((r) => r.param !== "notice" || holds(society, "notices.publish"));
  if (slug && !def) return <Library reports={reports} missing={slug} />;
  if (def && !reports.includes(def)) return <NoAccess title={def.name} need="notices.publish" />;
  return def ? <ReportView key={`${society.societyId}/${def.slug}`} society={society} def={def} /> : <Library reports={reports} />;
}

function Library({ reports, missing }: { reports: ReportDef[]; missing?: string }) {
  const navigate = useNavigate();
  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title="Reports" sub="Run a report to see it here, then have it emailed to you as Excel or CSV. Large exports are built in the background and arrive by email." />
      {missing && <div style={{ ...cardStyle, padding: "14px 18px", marginBottom: 14, font: "500 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>There is no report called "{missing}". Choose one below.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {reports.map((r) => (
          <button
            key={r.slug}
            type="button"
            onClick={() => navigate(`/reports/${r.slug}`)}
            className="hover-lift press-scale focus-ring theme-transition"
            style={{ ...cardStyle, padding: 18, textAlign: "left", cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <span style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)" }}>{r.group}</span>
            <span style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>{r.name}</span>
            <span style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.blurb}</span>
            <span style={{ marginTop: 4, font: "600 12.5px/1 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)" }}>Run report</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The server's subtitles carry ISO dates ("Overdue as of 2026-09-25"); print them the way the rest of the console does. */
function readableDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => formatDate(d)).replace(/\b\d{4}-(0[1-9]|1[0-2])\b(?!-)/g, (p) => periodLabel(p));
}

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}

function ReportView({ society, def }: { society: SocietyMembership; def: ReportDef }) {
  const societyId = society.societyId;
  const [sp, setSp] = useSearchParams();
  const today = todayIso();
  const get = (k: string, fallback = "") => sp.get(k) ?? fallback;
  const set = (k: string, v: string) =>
    setSp(
      (cur) => {
        const n = new URLSearchParams(cur);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true },
    );

  const from = get("from", daysBefore(today, 30));
  const to = get("to", today);
  const period = get("period", today.slice(0, 7));
  const [unitText, setUnitText] = useState(get("unit"));
  const noticeId = get("noticeId");
  const [filter, setFilter] = useState("");

  const lookup = useUnitLookup(societyId, def.param === "unit" ? unitText : "");
  // The picker reads notices.list (notices.publish); ReportsPage only opens this report to admins who hold it.
  const notices = useApiQuery(api.notices.list, { params: { societyId }, query: { status: "PUBLISHED", limit: 100 } }, { enabled: def.param === "notice" });

  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const params =
    def.param === "range"
      ? isDate(from) && isDate(to)
        ? { from, to }
        : null
      : def.param === "period"
        ? /^\d{4}-\d{2}$/.test(period)
          ? { period }
          : null
        : def.param === "unit"
          ? lookup.status === "found"
            ? { unitId: lookup.unit.id }
            : null
          : def.param === "notice"
            ? noticeId
              ? { noticeId }
              : null
            : {};

  const report = useApiQuery(api.reports.get, { params: { societyId, type: def.slug }, query: params ?? {} }, { enabled: params !== null, placeholderData: keepPreviousData });
  const data = params ? report.data : undefined;

  const waiting: string | null =
    params !== null
      ? null
      : def.param === "unit"
        ? lookup.status === "missing"
          ? `No unit "${lookup.label}" in this society.`
          : lookup.status === "searching"
            ? "Looking up the unit…"
            : "Enter a unit to see its ledger."
        : def.param === "notice"
          ? "Choose a published notice."
          : "Choose the dates.";

  const state: LoadState<ReportData> = params === null ? { status: "loading" } : toLoadState(report);
  const want = filter.trim().toLowerCase();
  const rows: LoadState<ReportData["rows"]> =
    state.status === "ready" ? ready(want ? state.data.rows.filter((r) => Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(want))) : state.data.rows) : state;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <Crumbs items={[{ label: "Reports", to: "/reports" }, { label: def.name }]} />
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>{data?.title ?? def.name}</h1>
          <p style={{ margin: 0, maxWidth: "66ch", font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{data ? readableDates(data.subtitle) : def.blurb}</p>
        </div>
        <EmailReport societyId={societyId} type={def.slug} params={params ?? {}} disabled={params === null} />
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {def.param === "range" && (
            <>
              <div style={{ width: 180 }}>
                <TextField label="From" type="date" value={from} onChange={(v) => set("from", v)} />
              </div>
              <div style={{ width: 180 }}>
                <TextField label="To" type="date" value={to} onChange={(v) => set("to", v)} />
              </div>
            </>
          )}
          {def.param === "period" && (
            <div style={{ width: 200 }}>
              <TextField label="Period" type="month" value={period} onChange={(v) => set("period", v)} hint={/^\d{4}-\d{2}$/.test(period) ? periodLabel(period) : undefined} />
            </div>
          )}
          {def.param === "unit" && (
            <div style={{ width: 220 }}>
              <TextField
                label="Unit"
                req
                mono
                autoFocus={!unitText}
                autoComplete="off"
                value={unitText}
                onChange={(v) => {
                  setUnitText(v.toUpperCase());
                  set("unit", v.toUpperCase());
                }}
                placeholder="B-0702"
                hint={lookup.status === "found" ? (lookup.unit.primaryOwnerName ?? "Owner not recorded") : undefined}
                error={lookup.status === "missing" && unitText.trim().length >= 4 ? `No unit "${lookup.label}".` : undefined}
              />
            </div>
          )}
          {def.param === "notice" && (
            <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
              <SelectField
                label="Notice"
                req
                value={noticeId}
                placeholder={notices.isPending ? "Loading notices…" : notices.data?.items.length ? "Choose a published notice" : "No published notices"}
                options={(notices.data?.items ?? []).map((n) => ({ value: n.id, label: `${n.title} · ${formatDate(n.publishedAt)}` }))}
                onChange={(v) => set("noticeId", v)}
                error={notices.isError ? notices.error.message : undefined}
              />
            </div>
          )}
          {data && data.rows.length > 8 && (
            <div style={{ flex: "1 1 200px", maxWidth: 280, marginLeft: "auto" }}>
              <TextField label="Find in results" value={filter} onChange={setFilter} placeholder="Unit, name, receipt…" />
            </div>
          )}
        </div>

        {waiting ? (
          <div style={{ padding: "40px 24px", textAlign: "center", font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{waiting}</div>
        ) : (
          <ReportTable state={state} rows={rows} filtered={Boolean(want)} />
        )}
      </div>
    </div>
  );
}

/** Columns come with the data, so the skeleton uses a typical width until the first answer and the real columns after. */
function ReportTable({ state, rows, filtered }: { state: LoadState<ReportData>; rows: LoadState<ReportData["rows"]>; filtered: boolean }) {
  const data = state.status === "ready" ? state.data : null;
  const columns = data?.columns ?? [];
  const cols = data ? data.columns.map((c) => ({ label: c.label, align: c.kind === "money" || c.kind === "number" ? ("right" as const) : ("left" as const) })) : Array.from({ length: 6 }, (_, i) => ({ label: `c${i}`, align: "left" as const }));
  const cell = (key: string, kind: string, v: string | number | null) => {
    if (v === null || v === "") return "—";
    if (key === "mobile" && typeof v === "string") return formatMobile(v);
    if (kind === "money" && typeof v === "number") return inr(v);
    if (kind === "date" && typeof v === "string") return formatDate(v);
    if (kind === "number" && typeof v === "number") return v.toLocaleString("en-IN");
    return String(v);
  };
  const totals = data?.totals ?? null;
  const colTotals = totals && data ? data.columns.filter((c) => totals[c.key] !== undefined) : [];
  // Totals with no column of their own — collections by mode — are listed under the table.
  const extra = totals && data ? Object.entries(totals).filter(([k]) => !data.columns.some((c) => c.key === k)) : [];

  return (
    <>
      <DataTable<ReportData["rows"][number]>
        cols={data ? cols : cols.map((c) => ({ ...c, label: " ".repeat(8) }))}
        rows={rows}
        skeletonRows={10}
        minWidth={Math.max(560, cols.length * 120)}
        empty={filtered ? "No row matches that search." : "Nothing to report for these choices."}
        renderRow={(r, i) => (
          <tr key={i} className="row-hover" style={rowBorder}>
            {columns.map((c) => (
              <td key={c.key} style={cellStyle(c.kind === "money" || c.kind === "number" ? "right" : "left", c.kind === "money" ? amountCell : c.key === "unit" ? { font: "500 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" } : c.kind === "date" ? { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" } : undefined)}>
                {cell(c.key, c.kind, r[c.key] ?? null)}
              </td>
            ))}
          </tr>
        )}
        foot={
          colTotals.length && data ? (
            <tr style={{ borderTop: "1px solid var(--border,#E3E9E6)", background: "var(--canvas,#F7F9F8)" }}>
              {data.columns.map((c, i) => (
                <td key={c.key} style={cellStyle(c.kind === "money" || c.kind === "number" ? "right" : "left", { ...amountCell, fontWeight: 700 })}>
                  {totals && totals[c.key] !== undefined ? (c.kind === "money" ? inr(totals[c.key]) : totals[c.key].toLocaleString("en-IN")) : i === 0 ? "Total" : ""}
                </td>
              ))}
            </tr>
          ) : undefined
        }
      />
      {data && (
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 16, flexWrap: "wrap", font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
          <span>
            {data.rows.length.toLocaleString("en-IN")} row{data.rows.length === 1 ? "" : "s"}
          </span>
          {extra.map(([k, v]) => (
            <span key={k}>
              {k.startsWith("mode_") ? (MODE_LABEL[k.slice(5) as keyof typeof MODE_LABEL] ?? k.slice(5)) : k.charAt(0).toUpperCase() + k.slice(1)}: <strong style={{ color: "var(--ink,#0F1A17)" }}>{k.startsWith("mode_") ? inr(v) : v.toLocaleString("en-IN")}</strong>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

