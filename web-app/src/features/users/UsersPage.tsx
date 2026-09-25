import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type AccountStatus, type SocietyUser } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { ApiTable, LiveStatGrid, PageHeader, type LiveStat } from "../../components/ApiTable";
import { primaryBtnStyle, rowProps, secondaryBtnStyle, useCursorPager, useSettled } from "../../lib/tableKit";
import { Pill } from "../../components/Pill";
import { PanelModal } from "../../components/PanelModal";
import { formatMobile, formatWhen, userStatusPill } from "../../lib/apiFormat";
import { modulesSummary } from "../../lib/permissionLabels";
import { ready, type LoadState } from "../../lib/loadState";
import type { PanelSpec } from "../../lib/types";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { AddUserModal } from "./UserModals";

const PAGE_SIZE = 20;

const COLS = [
  { label: "Mobile", align: "left" as const },
  { label: "Name", align: "left" as const },
  { label: "Type", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Last login", align: "right" as const },
  { label: "Status", align: "right" as const },
];

/** The design's three chips plus Suspended, which the API adds and an admin needs to find someone to reactivate. */
const CHIPS: { label: string; status?: AccountStatus; role?: "ADMIN" }[] = [
  { label: "Locked", status: "LOCKED" },
  { label: "Never logged in", status: "INVITED" },
  { label: "Admins", role: "ADMIN" },
  { label: "Suspended", status: "SUSPENDED" },
];

const SORT_KEYS: ((u: SocietyUser) => string)[] = [
  (u) => u.mobile,
  (u) => u.name.toLowerCase(),
  (u) => u.userType,
  (u) => u.unitLabel ?? "",
  (u) => u.lastLoginAt ?? "",
  (u) => u.status,
];

/**
 * Users & access, from `users.list`. Search, the chips and paging are the
 * server's; sorting reorders the page on screen, since the list endpoint
 * has no sort parameter.
 */
export function UsersPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Users & access" />;
  if (!holds(society, "users.manage")) return <NoAccess title="Users & access" need="users.manage" />;
  return <UsersTable key={society.societyId} societyId={society.societyId} />;
}

function UsersTable({ societyId }: { societyId: string }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [adding, setAdding] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const q = useSettled(search.trim());
  const filter = chip === null ? {} : { status: CHIPS[chip].status, role: CHIPS[chip].role };
  const paging = useCursorPager(`${q}|${chip}`);

  const list = useApiQuery(
    api.users.list,
    { params: { societyId }, query: { q: q || undefined, ...filter, cursor: paging.cursor, limit: PAGE_SIZE } },
    // Keep the rows on screen while the next page or search result loads.
    { placeholderData: keepPreviousData },
  );
  const nextCursor = list.data?.nextCursor;
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(nextCursor);
  }, [nextCursor, list.isPlaceholderData, learn]);

  const templates = useApiQuery(api.users.templates, { params: { societyId } });
  const stats = useUserStats(societyId);

  const rows = useMemo((): LoadState<SocietyUser[]> => {
    const state = toLoadState(list);
    if (state.status !== "ready") return state;
    if (sortCol === null) return ready(state.data.items);
    const key = SORT_KEYS[sortCol];
    return ready(state.data.items.slice().sort((a, b) => key(a).localeCompare(key(b)) * sortDir));
  }, [list, sortCol, sortDir]);

  const filtering = Boolean(q) || chip !== null;
  const items = list.data?.items ?? [];
  const hasNext = Boolean(list.data?.nextCursor);
  const first = (paging.pageNo - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;
  const footer =
    list.status !== "success"
      ? " "
      : items.length === 0
        ? "No users"
        : hasNext
          ? `Showing ${first}–${last} · more on the next page`
          : filtering
            ? `Showing ${last} matching user${last === 1 ? "" : "s"}`
            : `Showing ${first}–${last} of ${last} users`;

  const panel: PanelSpec | null = templates.data
    ? {
        key: "users",
        title: "Permission templates",
        sub: `${templates.data.length} templates · a user sees only the modules their template allows`,
        head: ["Template", "Modules", "Role"],
        rows: templates.data.map((t) => ({ a: t.name, b: modulesSummary(t.permissions), c: t.role === "ADMIN" ? "Admin" : "User" })),
        foot: "Applied when a user is added or their template is changed.",
        cta: "Close",
        done: "",
      }
    : null;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader
        title="Users & access"
        sub="Two roles only. Everyone who is not an admin is a user whose visible modules come from admin-assigned permissions."
        actions={
          <>
            <button type="button" onClick={() => setTemplatesOpen(true)} disabled={!panel} className="press-scale focus-ring" style={{ ...secondaryBtnStyle, cursor: panel ? "pointer" : "default" }}>
              Permission templates
            </button>
            <button type="button" onClick={() => setAdding(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
              Add user
            </button>
          </>
        }
      />

      <LiveStatGrid stats={stats} />

      <ApiTable<SocietyUser>
        searchHint="Search name or mobile"
        search={search}
        onSearch={setSearch}
        chips={CHIPS.map((c, i) => ({ label: c.label, active: chip === i, onClick: () => setChip((cur) => (cur === i ? null : i)) }))}
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
          const pill = userStatusPill(u);
          return (
            <tr key={u.id} {...rowProps(() => navigate(`/users/record/${u.id}`))}>
              <td style={{ padding: "13px 16px", font: "500 13.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{formatMobile(u.mobile)}</td>
              <td style={{ padding: "13px 16px", font: "600 14px/1.4 Figtree, sans-serif" }}>{u.name}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{u.role === "ADMIN" ? "ADMIN" : u.userType}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{u.unitLabel ?? "—"}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", color: u.lastLoginAt ? "var(--ink,#0F1A17)" : "var(--ink-dim,#A8B5B0)", whiteSpace: "nowrap" }}>
                {formatWhen(u.lastLoginAt)}
              </td>
              <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                <Pill label={pill.label} kind={pill.kind} />
              </td>
            </tr>
          );
        }}
        filtering={filtering}
        onClearFilters={() => {
          setSearch("");
          setChip(null);
        }}
        emptyTitle="No users yet"
        emptyBody="Add the first user by mobile number. Nobody can sign in until they are added here."
        footer={footer}
        pager={paging.pager(hasNext)}
      />

      {adding && <AddUserModal societyId={societyId} onClose={() => setAdding(false)} onCreated={(u) => navigate(`/users/record/${u.id}`)} />}
      {templatesOpen && panel && <PanelModal panel={panel} onClose={() => setTemplatesOpen(false)} />}
    </div>
  );
}

/**
 * The four stat cards. The list endpoint returns pages, not totals, so each
 * count is one filtered page at the maximum size: exact up to 200, shown as
 * "200+" beyond that rather than as an invented number.
 */
function useUserStats(societyId: string): LiveStat[] {
  const max = 200;
  const params = { societyId };
  const active = useApiQuery(api.users.list, { params, query: { status: "ACTIVE", limit: max } });
  const invited = useApiQuery(api.users.list, { params, query: { status: "INVITED", limit: max } });
  const locked = useApiQuery(api.users.list, { params, query: { status: "LOCKED", limit: max } });
  const admins = useApiQuery(api.users.list, { params, query: { role: "ADMIN", limit: max } });
  const count = (r: typeof active) => (r.data ? `${r.data.items.length}${r.data.nextCursor ? "+" : ""}` : r.isError ? "—" : null);
  const lockedN = locked.data?.items.length ?? 0;
  return [
    { label: "Active users", value: count(active), note: "have set a password" },
    { label: "Never logged in", value: count(invited), note: "no password set yet" },
    { label: "Locked out", value: count(locked), note: "5 failed attempts", fg: lockedN ? "var(--bad,#C0342B)" : undefined },
    { label: "Admins", value: count(admins), note: "can open this console" },
  ];
}
