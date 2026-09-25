import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type Unit } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { ApiTable, LiveStatGrid, PageHeader } from "../../components/ApiTable";
import { primaryBtnStyle, rowProps, useCursorPager, useSettled } from "../../lib/tableKit";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { enumLabel } from "../../lib/apiFormat";
import { ready, type LoadState } from "../../lib/loadState";
import type { PillKind } from "../../lib/types";
import { AddMemberModal } from "./MemberModals";

const PAGE_SIZE = 20;

/**
 * The design's columns, with one swap: "Since" became "Carpet area". The unit
 * list carries no occupancy start date, and a column of dashes says less than
 * the area, which billing needs and which is often missing.
 */
const COLS = [
  { label: "Unit", align: "left" as const },
  { label: "Primary owner", align: "left" as const },
  { label: "Occupancy", align: "left" as const },
  { label: "Carpet area", align: "left" as const },
  { label: "Outstanding", align: "right" as const },
  { label: "Status", align: "right" as const },
];

const SORT_KEYS: ((u: Unit) => string | number)[] = [
  (u) => u.label,
  (u) => (u.primaryOwnerName ?? "").toLowerCase(),
  (u) => u.occupancy ?? "",
  (u) => u.carpetAreaSqft ?? 0,
  () => 0,
  (u) => unitStatus(u).label,
];

/**
 * A unit's pill. The design's pills are about dues (Clear, Due, Legal stage);
 * billing has no API yet, so this reports what the register itself knows:
 * whether the facts billing will need are on file.
 */
function unitStatus(u: Unit): { label: string; kind: PillKind } {
  if (u.status === "INACTIVE") return { label: "Inactive", kind: "mute" };
  if (!u.primaryOwnerName || u.carpetAreaSqft === null) return { label: "Data missing", kind: "info" };
  return { label: "Active", kind: "ok" };
}

export function MembersPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Members & units" />;
  // The unit list's own access rule (contract: structure.units).
  if (!holds(society, "society.configure", "members.manage", "billing.generate", "gate.operate", "gate.manage"))
    return <NoAccess title="Members & units" need="members.manage" />;
  return <MembersTable key={society.societyId} societyId={society.societyId} unitCount={society.unitCount} canApprove={holds(society, "members.manage")} />;
}

function MembersTable({ societyId, unitCount, canApprove }: { societyId: string; unitCount: number; canApprove: boolean }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [adding, setAdding] = useState(false);

  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  // The approvals queue needs members.manage; without it the card says so rather than asking and being refused.
  const approvals = useApiQuery(api.members.approvals, { params: { societyId }, query: { status: "PENDING", limit: 200 } }, { enabled: canApprove });

  const q = useSettled(search.trim());
  const paging = useCursorPager(`${q}|${building}`);
  const list = useApiQuery(
    api.structure.units,
    { params: { societyId }, query: { q: q || undefined, buildingId: building ?? undefined, cursor: paging.cursor, limit: PAGE_SIZE } },
    { placeholderData: keepPreviousData },
  );
  const nextCursor = list.data?.nextCursor;
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(nextCursor);
  }, [nextCursor, list.isPlaceholderData, learn]);

  const rows = useMemo((): LoadState<Unit[]> => {
    const state = toLoadState(list);
    if (state.status !== "ready") return state;
    if (sortCol === null) return ready(state.data.items);
    const key = SORT_KEYS[sortCol];
    return ready(
      state.data.items.slice().sort((a, b) => {
        const x = key(a);
        const y = key(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sortDir;
      }),
    );
  }, [list, sortCol, sortDir]);

  const bList = buildings.data ?? [];
  const pending = !canApprove ? "—" : approvals.data ? `${approvals.data.items.length}${approvals.data.nextCursor ? "+" : ""}` : approvals.isError ? "—" : null;
  const pendingN = approvals.data?.items.length ?? 0;
  const stats = [
    {
      label: "Units",
      value: String(unitCount),
      note: buildings.data ? `${bList.length} building${bList.length === 1 ? "" : "s"} · ${bList.map((b) => b.name).join(" · ")}` : "Across the society",
    },
    // The unit list has no occupancy filter or totals, so these are not
    // counted rather than estimated from one page.
    { label: "Tenanted", value: "—", note: "Shown on each unit's record" },
    { label: "Vacant", value: "—", note: "Shown on each unit's record" },
    { label: "Pending approvals", value: pending, note: canApprove ? "tenancy, family and vehicle requests" : "Needs the members.manage permission", fg: pendingN ? "var(--warn,#B45309)" : undefined },
  ];

  const filtering = Boolean(q) || building !== null;
  const items = list.data?.items ?? [];
  const hasNext = Boolean(list.data?.nextCursor);
  const first = (paging.pageNo - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;
  const footer =
    list.status !== "success"
      ? " "
      : items.length === 0
        ? "No units"
        : hasNext
          ? `Showing ${first}–${last}${filtering ? "" : ` of ${unitCount}`} units`
          : filtering
            ? `Showing ${first}–${last} matching unit${last === 1 ? "" : "s"}`
            : `Showing ${first}–${last} of ${last} units`;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader
        title="Members & units"
        sub={`${unitCount} units${bList.length ? ` across ${bList.length} buildings` : ""}. Occupancy drives non-occupancy charges, so it is edited with effective dates and never overwritten.`}
        actions={
          <button type="button" onClick={() => setAdding(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
            Add member
          </button>
        }
      />

      <LiveStatGrid stats={stats} />

      <ApiTable<Unit>
        searchHint="Search unit or owner"
        search={search}
        onSearch={setSearch}
        chips={bList.map((b) => ({
          label: b.name.length <= 2 ? `Building ${b.name}` : b.name,
          active: building === b.id,
          onClick: () => setBuilding((cur) => (cur === b.id ? null : b.id)),
        }))}
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
        renderRow={(u) => {
          const pill = unitStatus(u);
          const dim = "var(--ink-dim,#A8B5B0)";
          return (
            <tr key={u.id} {...rowProps(() => navigate(`/members/record/${u.id}`))}>
              <td style={{ padding: "13px 16px", font: "500 13.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{u.label}</td>
              <td style={{ padding: "13px 16px", font: "600 14px/1.4 Figtree, sans-serif", color: u.primaryOwnerName ? undefined : dim }}>{u.primaryOwnerName ?? "Not recorded"}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{u.occupancy ? enumLabel(u.occupancy) : "Not recorded"}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: u.carpetAreaSqft === null ? dim : "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>
                {u.carpetAreaSqft === null ? "Not on file" : `${u.carpetAreaSqft.toLocaleString("en-IN")} sq ft`}
              </td>
              {/* Billing has no API yet: no amount is shown rather than an invented one. */}
              <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", color: dim }}>—</td>
              <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                <Pill label={pill.label} kind={pill.kind} />
              </td>
            </tr>
          );
        }}
        filtering={filtering}
        onClearFilters={() => {
          setSearch("");
          setBuilding(null);
        }}
        emptyTitle="No units yet"
        emptyBody="Units are added in Society setup. Once they exist, members are recorded against them here."
        footer={footer}
        pager={paging.pager(hasNext)}
      />

      {adding && <AddMemberModal societyId={societyId} onClose={() => setAdding(false)} onAdded={(unitId) => navigate(`/members/record/${unitId}`)} />}
    </div>
  );
}
