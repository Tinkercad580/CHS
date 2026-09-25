import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type PaymentRecord, type SocietyMembership } from "@chs/contract";
import type { z } from "zod";
import { holds, useCurrentSociety } from "../../api/society";
import { useUnitLookup } from "../../api/units";
import { ApiTable, LiveStatGrid, PageHeader } from "../../components/ApiTable";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { formatDate } from "../../lib/apiFormat";
import { inr, inrRound, todayIso } from "../../lib/money";
import { MODE_LABEL, paymentPill } from "../../lib/moneyLabels";
import { primaryBtnStyle, rowProps, useCursorPager } from "../../lib/tableKit";
import { ready, type LoadState } from "../../lib/loadState";
import { RecordPaymentModal } from "./RecordPaymentModal";

const PAGE_SIZE = 25;
type Status = z.infer<typeof schemas.payments.PaymentListQuery>["status"];

const COLS = [
  { label: "Receipt", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Mode", align: "left" as const },
  { label: "Reference", align: "left" as const },
  { label: "Paid on", align: "left" as const },
  { label: "Amount", align: "right" as const },
  { label: "Status", align: "right" as const },
];

const CHIPS: { label: string; status?: Status; today?: boolean }[] = [
  { label: "Cheques pending", status: "PENDING" },
  // The list's date filter is on when a payment was recorded, not when it was paid; the chip says so.
  { label: "Recorded today", today: true },
  { label: "Cancelled", status: "REVERSED" },
  { label: "Failed", status: "FAILED" },
];

const SORT_KEYS: ((p: PaymentRecord) => string | number)[] = [
  (p) => p.receipt?.number ?? "",
  (p) => p.unitLabel,
  (p) => p.mode,
  (p) => p.instrumentNo ?? "",
  (p) => p.paidAt ?? p.createdAt,
  (p) => p.amountPaise,
  (p) => p.status,
];

const PERMS = ["payments.record", "accounts.manage", "billing.publish"] as const;

/**
 * The collections desk (`payments.list`): online payments, office receipts
 * and cheques, newest first. The list API has no text search, so the box
 * takes a unit and filters by it once the unit is recognised.
 */
export function PaymentsPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Payments & reconciliation" />;
  if (!holds(society, ...PERMS)) return <NoAccess title="Payments & reconciliation" need="payments.record" />;
  return <Payments key={society.societyId} society={society} />;
}

function Payments({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [recording, setRecording] = useState(false);
  const today = todayIso();

  const lookup = useUnitLookup(societyId, search);
  const unitId = lookup.status === "found" ? lookup.unit.id : undefined;
  const active = CHIPS.find((c) => c.label === chip) ?? null;
  const unitBlocked = lookup.status === "missing" || lookup.status === "error";

  const paging = useCursorPager(`${unitId}|${chip}`);
  const list = useApiQuery(
    api.payments.list,
    { params: { societyId }, query: { unitId, status: active?.status, from: active?.today ? today : undefined, to: active?.today ? today : undefined, cursor: paging.cursor, limit: PAGE_SIZE } },
    { placeholderData: keepPreviousData, enabled: !unitBlocked && lookup.status !== "searching" },
  );
  const nextCursor = list.data?.nextCursor;
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(nextCursor);
  }, [nextCursor, list.isPlaceholderData, learn]);

  // Stat cards read their own narrow queries: today's receipts and the cheques in clearing.
  const todays = useApiQuery(api.payments.list, { params: { societyId }, query: { status: "SUCCESS", from: today, to: today, limit: 200 } });
  const cheques = useApiQuery(api.payments.list, { params: { societyId }, query: { status: "PENDING", limit: 200 } });
  const sum = (ps: PaymentRecord[] | undefined) => (ps ?? []).reduce((s, p) => s + p.amountPaise, 0);
  const stat = (q: { data?: unknown; isError: boolean }, x: string) => (q.data ? x : q.isError ? "—" : null);
  const all = useApiQuery(api.payments.list, { params: { societyId }, query: { limit: 1 } });
  // Recorded today and paid today differ for back-dated office receipts and imports; the card counts money paid today.
  const paidToday = (todays.data?.items ?? []).filter((p) => p.paidAt && new Date(p.paidAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === today);
  const stats = [
    { label: "Collected today", value: stat(todays, inrRound(sum(paidToday))), note: `${paidToday.length} payment${paidToday.length === 1 ? "" : "s"} paid today`, fg: "var(--ok,#167A3C)" },
    { label: "Cheques in clearing", value: stat(cheques, String(cheques.data?.items.length ?? 0)), note: `${inr(sum(cheques.data?.items))} counted once cleared`, fg: cheques.data?.items.length ? "var(--warn,#B45309)" : undefined },
    { label: "Payments on record", value: stat(all, all.data?.total !== null && all.data?.total !== undefined ? all.data.total.toLocaleString("en-IN") : "—"), note: "Online, office and cheque" },
    { label: "Unmatched credits", value: "—", note: "Bank statement matching is not live yet" },
  ];

  let rows: LoadState<PaymentRecord[]>;
  if (unitBlocked) rows = ready([]);
  else if (lookup.status === "searching") rows = { status: "loading" };
  else {
    const st = toLoadState(list);
    rows = st.status === "ready" ? ready(st.data.items) : st;
  }
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

  const items = unitBlocked ? [] : (list.data?.items ?? []);
  const total = list.data?.total ?? null;
  const footer =
    unitBlocked
      ? lookup.status === "missing"
        ? `No unit "${lookup.label}" in this society`
        : " "
      : list.status !== "success"
        ? " "
        : items.length === 0
          ? "No payments"
          : `Showing ${items.length} on page ${paging.pageNo}${total !== null ? ` · ${total.toLocaleString("en-IN")} in all` : ""}`;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader
        title="Payments & reconciliation"
        sub="Gateway payments and office receipts land here. Cheques stay pending until cleared; a receipt is cancelled, never deleted."
        actions={
          holds(society, "payments.record") ? (
            <button type="button" onClick={() => setRecording(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
              Record receipt
            </button>
          ) : undefined
        }
      />
      <LiveStatGrid stats={stats} />
      <ApiTable<PaymentRecord>
        searchHint="Filter by unit, for example B-0702"
        search={search}
        onSearch={(v) => setSearch(v.toUpperCase())}
        chips={CHIPS.map((c) => ({ label: c.label, active: chip === c.label, onClick: () => setChip((cur) => (cur === c.label ? null : c.label)) }))}
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
        renderRow={(p) => {
          const pill = paymentPill(p);
          return (
            <tr key={p.id} {...rowProps(() => navigate(`/payments/record/${p.id}`))}>
              <td style={{ padding: "13px 16px", font: "500 12.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap", color: p.receipt ? undefined : "var(--ink-dim,#A8B5B0)" }}>{p.receipt?.number ?? "—"}</td>
              <td style={{ padding: "13px 16px", font: "500 13.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{p.unitLabel}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{MODE_LABEL[p.mode]}</td>
              <td style={{ padding: "13px 16px", font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{[p.bankName, p.instrumentNo].filter(Boolean).join(" ") || (p.gateway ? `${p.gateway} gateway` : "—")}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{formatDate(p.paidAt ?? p.createdAt)}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textDecoration: p.status === "REVERSED" ? "line-through" : undefined, color: p.status === "REVERSED" ? "var(--ink-dim,#A8B5B0)" : undefined }}>
                {inr(p.amountPaise)}
              </td>
              <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                <Pill label={pill.label} kind={pill.kind} />
              </td>
            </tr>
          );
        }}
        filtering={Boolean(search.trim()) || chip !== null}
        onClearFilters={() => {
          setSearch("");
          setChip(null);
        }}
        emptyTitle="No payments yet"
        emptyBody="Online payments appear here as residents pay. Record cash, cheques and bank transfers with Record receipt."
        footer={footer}
        pager={paging.pager(Boolean(nextCursor) && !unitBlocked)}
      />
      {recording && <RecordPaymentModal societyId={societyId} onClose={() => setRecording(false)} onRecorded={(p) => navigate(`/payments/record/${p.id}`)} />}
    </div>
  );
}
