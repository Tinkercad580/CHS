import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type BillRecord, type SocietyMembership } from "@chs/contract";
import { holds } from "../../api/society";
import { ApiTable } from "../../components/ApiTable";
import { Pill } from "../../components/Pill";
import { formatDate } from "../../lib/apiFormat";
import { inr, periodShort } from "../../lib/money";
import { BILL_STATE } from "../../lib/moneyLabels";
import { primaryBtnStyle, rowProps, useCursorPager, useSettled } from "../../lib/tableKit";
import { ready, type LoadState } from "../../lib/loadState";
import { BillingGuard, BillingHeader } from "./BillingShell";
import { BILLS_PERMS } from "./billingAccess";
import { AdhocBillModal } from "./BillingModals";

const PAGE_SIZE = 25;

const COLS = [
  { label: "Bill no.", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Payer", align: "left" as const },
  { label: "Period", align: "left" as const },
  { label: "Due", align: "left" as const },
  { label: "Total", align: "right" as const },
  { label: "Balance", align: "right" as const },
  { label: "Status", align: "right" as const },
];

type State = "UNPAID" | "PAID" | "OVERDUE";
const STATES: { label: string; value: State }[] = [
  { label: "Unpaid", value: "UNPAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Paid", value: "PAID" },
];

const SORT_KEYS: ((b: BillRecord) => string | number)[] = [
  (b) => b.number ?? "",
  (b) => b.unitLabel,
  (b) => (b.payerName ?? "").toLowerCase(),
  (b) => b.period,
  (b) => b.dueDate,
  (b) => b.totalPaise,
  (b) => b.balancePaise,
  (b) => b.paymentState,
];

/**
 * Every published bill (`billing.bills`), filtered by period and payment
 * state, searchable by bill number, title or payer. The period chips are the
 * latest runs; `?period=` arrives from a run's "View bills".
 */
export function BillsPage() {
  return <BillingGuard need={BILLS_PERMS}>{(s) => <Bills society={s} />}</BillingGuard>;
}

function Bills({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const period = params.get("period");
  const stateParam = params.get("state");
  const state = STATES.some((s) => s.value === stateParam) ? (stateParam as State) : null;
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [adhoc, setAdhoc] = useState(false);

  const setFilter = (key: "period" | "state", value: string | null) =>
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const runs = useApiQuery(api.billing.runs, { params: { societyId } }, { enabled: holds(society, "billing.generate", "billing.publish") });
  const periods = (runs.data ?? []).filter((r) => r.status === "PUBLISHED").slice(0, 3).map((r) => r.period);
  if (period && !periods.includes(period)) periods.push(period);

  const q = useSettled(search.trim());
  const paging = useCursorPager(`${q}|${period}|${state}`);
  const list = useApiQuery(
    api.billing.bills,
    { params: { societyId }, query: { q: q || undefined, period: period ?? undefined, state: state ?? undefined, cursor: paging.cursor, limit: PAGE_SIZE } },
    { placeholderData: keepPreviousData },
  );
  const nextCursor = list.data?.nextCursor;
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(nextCursor);
  }, [nextCursor, list.isPlaceholderData, learn]);

  const loaded = toLoadState(list);
  let rows: LoadState<BillRecord[]> = loaded.status === "ready" ? ready(loaded.data.items) : loaded;
  if (rows.status === "ready" && sortCol !== null) {
    const key = SORT_KEYS[sortCol];
    rows = ready(
      rows.data.slice().sort((a, b) => {
        const x = key(a);
        const y = key(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sortDir;
      }),
    );
  }

  const items = list.data?.items ?? [];
  const hasNext = Boolean(nextCursor);
  // The payment-state filter runs after the page is read on the server, so its `total` counts the unfiltered bills and is not quoted.
  const total = state ? null : (list.data?.total ?? null);
  const footer =
    list.status !== "success"
      ? " "
      : items.length === 0
        ? "No bills"
        : `Showing ${items.length} bill${items.length === 1 ? "" : "s"} on page ${paging.pageNo}${total !== null ? ` · ${total.toLocaleString("en-IN")} in all` : ""}`;

  return (
    <>
      <BillingHeader
        sub="Published bills with their head-wise breakup. A bill is corrected by cancelling it while unpaid, or with a credit note; it is never edited."
        actions={
          holds(society, "billing.publish") ? (
            <button type="button" onClick={() => setAdhoc(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
              Supplementary bill
            </button>
          ) : undefined
        }
      />
      <ApiTable<BillRecord>
        searchHint="Search bill number, title or payer"
        search={search}
        onSearch={setSearch}
        chips={[
          ...periods.map((p) => ({ label: periodShort(p), active: period === p, onClick: () => setFilter("period", period === p ? null : p) })),
          ...STATES.map((s) => ({ label: s.label, active: state === s.value, onClick: () => setFilter("state", state === s.value ? null : s.value) })),
        ]}
        cols={COLS}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={(i) => {
          if (sortCol === i) setSortDir((d) => (d === 1 ? -1 : 1));
          else {
            setSortCol(i);
            setSortDir(1);
          }
        }}
        rows={rows}
        skeletonRows={10}
        renderRow={(b) => {
          const st = BILL_STATE[b.paymentState];
          return (
            <tr key={b.id} {...rowProps(() => navigate(`/billing/bills/${b.id}`))}>
              <td style={{ padding: "13px 16px", font: "500 12.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{b.number ?? "Draft"}</td>
              <td style={{ padding: "13px 16px", font: "500 13.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{b.unitLabel}</td>
              <td style={{ padding: "13px 16px", font: "600 14px/1.4 Figtree, sans-serif" }}>
                {b.payerName ?? "—"}
                {b.kind === "SUPPLEMENTARY" && <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{b.title}</div>}
              </td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{periodShort(b.period)}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{formatDate(b.dueDate)}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{inr(b.totalPaise)}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: b.balancePaise > 0 ? (b.paymentState === "OVERDUE" ? "var(--bad,#C0342B)" : undefined) : "var(--ink-dim,#A8B5B0)" }}>
                {b.balancePaise > 0 ? inr(b.balancePaise) : "—"}
              </td>
              <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                <Pill label={st.label} kind={st.kind} />
              </td>
            </tr>
          );
        }}
        filtering={Boolean(q) || Boolean(period) || Boolean(state)}
        onClearFilters={() => {
          setSearch("");
          setParams(new URLSearchParams(), { replace: true });
        }}
        emptyTitle="No bills yet"
        emptyBody="Bills appear here once a run is published, or a supplementary bill is issued."
        footer={footer}
        pager={paging.pager(hasNext)}
      />
      {adhoc && <AdhocBillModal societyId={societyId} onClose={() => setAdhoc(false)} />}
    </>
  );
}
