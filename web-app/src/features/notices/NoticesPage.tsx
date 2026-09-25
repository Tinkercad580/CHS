import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type NoticeRecord, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { ApiTable, LiveStatGrid, PageHeader } from "../../components/ApiTable";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { formatDate } from "../../lib/apiFormat";
import { audienceLabel, channelsLabel, NOTICE_CATEGORY_LABEL, noticePill, ratio } from "../../lib/moneyLabels";
import { primaryBtnStyle, rowProps, useCursorPager, useSettled } from "../../lib/tableKit";
import { ready, type LoadState } from "../../lib/loadState";
import { istDate, todayIso } from "../../lib/money";
import { NoticeComposer } from "./NoticeComposer";

const PAGE_SIZE = 25;

const COLS = [
  { label: "Title", align: "left" as const },
  { label: "Audience", align: "left" as const },
  { label: "Channels", align: "left" as const },
  { label: "Published", align: "left" as const },
  { label: "Read", align: "right" as const },
  { label: "Acknowledged", align: "right" as const },
  { label: "State", align: "right" as const },
];

type Chip = { label: string; status?: "DRAFT" | "PUBLISHED" | "SUPERSEDED"; category?: "EMERGENCY" };
const CHIPS: Chip[] = [
  { label: "Drafts", status: "DRAFT" },
  { label: "Published", status: "PUBLISHED" },
  { label: "Superseded", status: "SUPERSEDED" },
  { label: "Emergency", category: "EMERGENCY" },
];

/**
 * Notices, drafts first and then newest (`notices.list`), with each one's
 * read and acknowledgement counts. Every published notice has a delivery
 * report — the society's proof of service — on its record.
 */
export function NoticesPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Notices & notifications" />;
  if (!holds(society, "notices.publish")) return <NoAccess title="Notices & notifications" need="notices.publish" />;
  return <Notices key={society.societyId} society={society} />;
}

function Notices({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [composing, setComposing] = useState(false);
  const active = CHIPS.find((c) => c.label === chip);

  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const bName = (id: string) => buildings.data?.find((b) => b.id === id)?.name;

  const q = useSettled(search.trim());
  const paging = useCursorPager(`${q}|${chip}`);
  const list = useApiQuery(
    api.notices.list,
    { params: { societyId }, query: { q: q || undefined, status: active?.status, category: active?.category, cursor: paging.cursor, limit: PAGE_SIZE } },
    { placeholderData: keepPreviousData },
  );
  const nextCursor = list.data?.nextCursor;
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(nextCursor);
  }, [nextCursor, list.isPlaceholderData, learn]);

  // The stat cards look at the latest published notices, not the filtered page.
  const recent = useApiQuery(api.notices.list, { params: { societyId }, query: { status: "PUBLISHED", limit: 100 } });
  const drafts = useApiQuery(api.notices.list, { params: { societyId }, query: { status: "DRAFT", limit: 1 } });
  // The month in India, as everywhere else in the console; UTC would move late-evening notices on the 1st into the month before.
  const month = todayIso().slice(0, 7);
  const pub = recent.data?.items ?? [];
  const thisMonth = pub.filter((n) => n.publishedAt !== null && istDate(n.publishedAt).slice(0, 7) === month);
  const sum = (f: (n: NoticeRecord) => number, ns: NoticeRecord[]) => ns.reduce((s, n) => s + f(n), 0);
  const recipients = sum((n) => n.stats?.recipients ?? 0, pub);
  const readN = sum((n) => n.stats?.read ?? 0, pub);
  const ackPub = pub.filter((n) => n.ackRequired);
  const ackOf = sum((n) => n.stats?.recipients ?? 0, ackPub);
  const ackN = sum((n) => n.stats?.acknowledged ?? 0, ackPub);
  const val = (x: string) => (recent.data ? x : recent.isError ? "—" : null);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const stats = [
    { label: "Sent this month", value: val(String(thisMonth.length)), note: `${thisMonth.filter((n) => n.ackRequired).length} needing acknowledgement` },
    { label: "Read", value: val(pct(readN, recipients)), note: `${readN} of ${recipients} deliveries opened`, fg: "var(--ok,#167A3C)" },
    { label: "Acknowledged", value: val(pct(ackN, ackOf)), note: ackOf ? `of ${ackOf} required` : "No notice asks for it", fg: ackOf && ackN < ackOf ? "var(--warn,#B45309)" : undefined },
    { label: "Drafts", value: drafts.data ? String(drafts.data.total ?? drafts.data.items.length) : drafts.isError ? "—" : null, note: "Saved, not yet sent" },
  ];

  const loaded = toLoadState(list);
  let rows: LoadState<NoticeRecord[]> = loaded.status === "ready" ? ready(loaded.data.items) : loaded;
  const SORT: ((n: NoticeRecord) => string | number)[] = [
    (n) => n.title.toLowerCase(),
    (n) => audienceLabel(n.audience, bName),
    (n) => n.channels.join(),
    (n) => n.publishedAt ?? "",
    (n) => n.stats?.read ?? 0,
    (n) => n.stats?.acknowledged ?? 0,
    (n) => noticePill(n).label,
  ];
  if (rows.status === "ready" && sortCol !== null) {
    const key = SORT[sortCol];
    rows = ready(rows.data.slice().sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sortDir;
    }));
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? null;
  const footer = list.status !== "success" ? " " : items.length === 0 ? "No notices" : `Showing ${items.length}${total !== null ? ` of ${total}` : ""} notice${(total ?? items.length) === 1 ? "" : "s"}`;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader
        title="Notices & notifications"
        sub="Every notice produces a delivery and acknowledgement report — that report is the society's proof of service. Published notices are never edited; a correction supersedes them."
        actions={
          <button type="button" onClick={() => setComposing(true)} className="press-scale focus-ring" style={primaryBtnStyle}>
            Compose notice
          </button>
        }
      />
      <LiveStatGrid stats={stats} />
      <ApiTable<NoticeRecord>
        searchHint="Search notice title"
        search={search}
        onSearch={setSearch}
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
        renderRow={(n) => {
          const pill = noticePill(n);
          const s = n.stats;
          return (
            <tr key={n.id} {...rowProps(() => navigate(`/notices/record/${n.id}`))}>
              <td style={{ padding: "13px 16px" }}>
                <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>
                  {n.title}
                  {n.pinned && <Pill label="Pinned" kind="info" style={{ marginLeft: 8, verticalAlign: "1px" }} />}
                </div>
                <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{NOTICE_CATEGORY_LABEL[n.category] ?? n.category}</div>
              </td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{audienceLabel(n.audience, bName)}</td>
              <td style={{ padding: "13px 16px", font: "400 13px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{channelsLabel(n.channels)}</td>
              <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{n.publishedAt ? formatDate(n.publishedAt) : "—"}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "500 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{s && n.status !== "DRAFT" ? ratio(s.read, s.recipients) : "—"}</td>
              <td style={{ padding: "13px 16px", textAlign: "right", font: "500 13px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{s && n.ackRequired && n.status !== "DRAFT" ? ratio(s.acknowledged, s.recipients) : "—"}</td>
              <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                <Pill label={pill.label} kind={pill.kind} />
              </td>
            </tr>
          );
        }}
        filtering={Boolean(q) || chip !== null}
        onClearFilters={() => {
          setSearch("");
          setChip(null);
        }}
        emptyTitle="No notices yet"
        emptyBody="Compose the first one. It is saved as a draft until you publish it."
        footer={footer}
        pager={paging.pager(Boolean(nextCursor))}
      />
      {composing && (
        <NoticeComposer
          societyId={societyId}
          onClose={() => setComposing(false)}
          onSaved={(n) => {
            setComposing(false);
            navigate(`/notices/record/${n.id}`);
          }}
        />
      )}
    </div>
  );
}
