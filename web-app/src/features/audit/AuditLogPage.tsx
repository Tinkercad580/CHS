import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type AuditLog, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { ApiTable, PageHeader } from "../../components/ApiTable";
import { ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { formatDateTime, formatWhen } from "../../lib/apiFormat";
import { ready } from "../../lib/loadState";
import { cellStyle, monoCell } from "../../lib/uiStyles";
import { rowProps, useCursorPager, useSettled } from "../../lib/tableKit";

const PAGE_SIZE = 50;

const COLS = [
  { label: "When", align: "left" as const },
  { label: "Who", align: "left" as const },
  { label: "Action", align: "left" as const },
  { label: "Record", align: "left" as const },
  { label: "Permission", align: "left" as const },
  { label: "IP", align: "right" as const },
];

/** The record kinds worth a chip. The server filters on one entity at a time. */
const ENTITIES: { entity: string; label: string }[] = [
  { entity: "payment", label: "Payments" },
  { entity: "bill", label: "Bills" },
  { entity: "bill_run", label: "Bill runs" },
  { entity: "notice", label: "Notices" },
  { entity: "society_user", label: "Users" },
  { entity: "member_approval", label: "Approvals" },
  { entity: "society", label: "Society" },
];

/** "payment.cheque_clear" -> "Payment · cheque clear". */
function actionLabel(action: string): string {
  const [head, ...rest] = action.split(".");
  const words = (s: string) => s.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const first = words(head);
  return rest.length ? `${first.charAt(0).toUpperCase()}${first.slice(1)} · ${words(rest.join("."))}` : `${first.charAt(0).toUpperCase()}${first.slice(1)}`;
}

/**
 * The society's audit log (`society.auditLogs`, needs audit.view): who did
 * what, when, under which permission and from where, newest first. Every
 * write the API accepts is recorded here by the server; the console only
 * reads it. Search matches the action or the person; chips narrow it to one
 * kind of record; a row opens the before and after the server stored.
 */
export function AuditLogPage() {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Audit log" />;
  if (!holds(society, "audit.view")) return <NoAccess title="Audit log" need="audit.view" />;
  return <Audit key={society.societyId} society={society} />;
}

function Audit({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<string | null>(null);
  const [open, setOpen] = useState<AuditLog | null>(null);
  const q = useSettled(search.trim());
  const paging = useCursorPager(`${q}|${entity}`);
  const list = useApiQuery(
    api.society.auditLogs,
    { params: { societyId }, query: { q: q || undefined, entity: entity ?? undefined, cursor: paging.cursor, limit: PAGE_SIZE } },
    { placeholderData: keepPreviousData },
  );
  const { learn } = paging;
  useEffect(() => {
    if (!list.isPlaceholderData) learn(list.data?.nextCursor);
  }, [list.data?.nextCursor, list.isPlaceholderData, learn]);

  const state = toLoadState(list);
  const rows = state.status === "ready" ? ready(state.data.items) : state;
  const items = list.data?.items ?? [];
  const first = (paging.pageNo - 1) * PAGE_SIZE + 1;
  const footer = list.status !== "success" ? " " : items.length ? `Showing ${first}–${first + items.length - 1}${list.data?.nextCursor ? "" : " · end of the log"}` : "No entries";

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title="Audit log" sub="Every change made through the console and the apps, recorded by the server with who made it, under which permission and from where. Nothing here can be edited or deleted." />
      <ApiTable<AuditLog>
        searchHint="Search action or person"
        search={search}
        onSearch={setSearch}
        chips={ENTITIES.map((e) => ({ label: e.label, active: entity === e.entity, onClick: () => setEntity((cur) => (cur === e.entity ? null : e.entity)) }))}
        cols={COLS}
        sortCol={null}
        sortDir={1}
        // The log is read newest first; the endpoint has no other order.
        onSort={() => undefined}
        rows={rows}
        skeletonRows={10}
        renderRow={(a) => (
          <tr key={a.id} {...rowProps(() => setOpen(a))}>
            <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })} title={formatDateTime(a.createdAt)}>
              {formatWhen(a.createdAt)}
              <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif" }}>{new Date(a.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
            </td>
            <td style={cellStyle("left", { font: "600 13.5px/1.4 Figtree, sans-serif" })}>{a.actorName ?? "System"}</td>
            <td style={cellStyle()}>
              {actionLabel(a.action)}
              <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-muted,#8A9995)" }}>{a.action}</div>
            </td>
            <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>
              {a.entity.replace(/_/g, " ")}
              {a.entityId && <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-muted,#8A9995)" }}>{a.entityId.slice(0, 8)}…</div>}
            </td>
            <td style={cellStyle()}>{a.permission ? <Pill label={a.permission} kind="mute" /> : <span style={{ color: "var(--ink-muted,#8A9995)" }}>—</span>}</td>
            <td style={cellStyle("right", { ...monoCell, color: "var(--ink-soft,#5A6B66)" })}>{a.ip ?? "—"}</td>
          </tr>
        )}
        filtering={Boolean(q) || entity !== null}
        onClearFilters={() => {
          setSearch("");
          setEntity(null);
        }}
        emptyTitle="Nothing recorded yet"
        emptyBody="Changes made in this society appear here as they happen."
        footer={footer}
        pager={paging.pager(Boolean(list.data?.nextCursor))}
      />
      {open && <EntryModal entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)", marginBottom: 6 }}>{label}</div>
      {value === null || value === undefined ? (
        <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>Nothing recorded</div>
      ) : (
        <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: "var(--subtle,#EDF1EF)", font: "500 12px/1.5 'IBM Plex Mono',monospace", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 280, overflowY: "auto" }}>{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  );
}

function EntryModal({ entry: a, onClose }: { entry: AuditLog; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} maxWidth={720}>
      <ModalHeader title={actionLabel(a.action)} onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>
        {a.actorName ?? "The system"} · {formatDateTime(a.createdAt)}
        {a.permission ? ` · under ${a.permission}` : ""}
        {a.ip ? ` · from ${a.ip}` : ""}
      </div>
      <div style={{ font: "500 12.5px/1.5 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)", marginBottom: 16, overflowWrap: "anywhere" }}>
        {a.entity}
        {a.entityId ? ` ${a.entityId}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        <Json label="Before" value={a.before} />
        <Json label="After" value={a.after} />
      </div>
      <ModalFooter>
        <PrimaryButton onClick={onClose}>Close</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}
