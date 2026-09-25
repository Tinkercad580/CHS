import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type NoticeRecord, type SocietyMembership } from "@chs/contract";
import type { z } from "zod";
import { holds, useCurrentSociety } from "../../api/society";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { CardHead, ConfirmModal, DataTable, RetryButton } from "../../components/Kit";
import { cardStyle, cellStyle, rowBorder } from "../../lib/uiStyles";
import { formatDate, formatDateTime } from "../../lib/apiFormat";
import { audienceLabel, channelsLabel, deliveryLabel, NOTICE_CATEGORY_LABEL, noticePill } from "../../lib/moneyLabels";
import { useBack } from "../../lib/nav";
import { ready, type LoadState } from "../../lib/loadState";
import type { PillKind } from "../../lib/types";
import { useAdminStore } from "../../store/AdminStore";
import { RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard, type RecordAction } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";
import { EmailReport } from "../reports/EmailReport";
import { NoticeComposer } from "./NoticeComposer";

type Recipient = z.infer<typeof schemas.notifications.NoticeReport>["recipients"][number];
type Modal = "edit" | "correct" | "publish" | "discard" | null;

/**
 * One notice. A draft can be edited, published (confirmed; the response
 * says how many it reached) or deleted. A published notice shows its
 * delivery and acknowledgement report (`notices.report`) — who got it on
 * which channel, who read it, who acknowledged — which can be emailed as the
 * proof of service, and can be corrected by a notice that supersedes it.
 */
export function NoticeRecordPage({ noticeId }: { noticeId: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Notices & notifications" />;
  if (!holds(society, "notices.publish")) return <NoAccess title="Notices & notifications" need="notices.publish" />;
  return <NoticeLoader society={society} noticeId={noticeId} />;
}

function NoticeLoader({ society, noticeId }: { society: SocietyMembership; noticeId: string }) {
  const back = useBack("/notices");
  const q = useApiQuery(api.notices.get, { params: { societyId: society.societyId, noticeId } });
  const state = toLoadState(q);
  if (state.status === "loading") return <RecordSkeleton />;
  if (state.status === "error") {
    const missing = q.error instanceof ApiError && q.error.code === "NOT_FOUND";
    return <RecordMessage title={missing ? "This notice could not be found" : state.message} body={missing ? "It may have been a draft that was deleted." : "Nothing was changed."} onBack={back} action={missing ? undefined : <RetryButton onClick={state.retry} />} />;
  }
  return <NoticeView society={society} n={state.data} onBack={back} />;
}

const REPORT_COLS = [
  { label: "Recipient", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Push", align: "left" as const },
  { label: "Email", align: "left" as const },
  { label: "Read", align: "left" as const },
  { label: "Acknowledged", align: "left" as const },
];

function statusKind(s: string | null): PillKind {
  const t = (s ?? "").toUpperCase();
  if (/SENT|DELIVERED|OPENED/.test(t)) return "ok";
  if (/FAIL|BOUNCE|INVALID/.test(t)) return "bad";
  if (/QUEUED|PENDING/.test(t)) return "warn";
  return "mute";
}

function NoticeView({ society, n, onBack }: { society: SocietyMembership; n: NoticeRecord; onBack: () => void }) {
  const navigate = useNavigate();
  const { toast } = useAdminStore();
  const societyId = society.societyId;
  const params = { societyId, noticeId: n.id };
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = n.status === "DRAFT";
  const report = useApiQuery(api.notices.report, { params }, { enabled: !draft });
  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const bName = (id: string) => buildings.data?.find((b) => b.id === id)?.name;
  const publish = useApiMutation(api.notices.publish);
  const discard = useApiMutation(api.notices.discard);
  const audience = audienceLabel(n.audience, bName);

  const doPublish = async () => {
    setError(null);
    try {
      const r = await publish.mutateAsync({ params });
      setModal(null);
      const count = r.stats?.recipients ?? 0;
      toast(`Published to ${count} recipient${count === 1 ? "" : "s"}.${n.supersedesId ? " The earlier notice is marked superseded." : ""}`, "ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };
  const doDiscard = async () => {
    setError(null);
    try {
      await discard.mutateAsync({ params });
      toast("Draft deleted.", "warn");
      navigate("/notices");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  const pill = noticePill(n);
  const chips: [string, PillKind][] = [
    [pill.label, pill.kind],
    [NOTICE_CATEGORY_LABEL[n.category] ?? n.category, n.category === "EMERGENCY" ? "bad" : "info"],
    ...(n.pinned ? ([["Pinned", "info"]] as [string, PillKind][]) : []),
    ...(n.ackRequired ? ([["Acknowledgement required", "warn"]] as [string, PillKind][]) : []),
  ];

  const actions: RecordAction[] = [];
  if (draft) {
    actions.push({ label: "Publish", kind: "primary", onClick: () => setModal("publish") });
    actions.push({ label: "Edit", kind: "ghost", onClick: () => setModal("edit") });
    actions.push({ label: "Delete draft", kind: "warn", onClick: () => setModal("discard") });
  } else if (n.status === "PUBLISHED" && !n.supersededById) {
    actions.push({ label: "Issue correction", kind: "ghost", onClick: () => setModal("correct") });
  }

  const s = n.stats;
  const recips: Recipient[] = report.data?.recipients ?? [];
  const reportState = toLoadState(report);
  const reportRows: LoadState<Recipient[]> = reportState.status === "ready" ? ready(reportState.data.recipients) : reportState;
  const pushSent = recips.filter((r) => statusKind(r.pushStatus) === "ok").length;
  const emailSent = recips.filter((r) => statusKind(r.emailStatus) === "ok").length;
  const pct = (a: number, b: number) => (b ? ` · ${Math.round((a / b) * 100)}%` : "");
  const muted = "var(--ink-muted,#8A9995)";
  const tiles = draft
    ? [
        tile("Status", "Draft", `Saved ${formatDate(n.createdAt)} — not sent`, "var(--warn,#B45309)"),
        tile("Audience", audience, "Recipients are fixed when you publish", "var(--info,#1D4ED8)"),
        tile("Channels", channelsLabel(n.channels), n.ackRequired ? "Acknowledgement will be asked for" : "No acknowledgement asked", muted),
        tile("Expires", n.expiresAt ? formatDateTime(n.expiresAt) : "Never", n.pinned ? "Pinned to the top" : "Not pinned", muted),
      ]
    : [
        tile("Recipients", String(s?.recipients ?? 0), audience, "var(--accent,#0E6B5C)"),
        tile("Read", s ? `${s.read}` : "—", s ? `of ${s.recipients}${pct(s.read, s.recipients)}` : "", "var(--ok,#167A3C)"),
        tile("Acknowledged", n.ackRequired && s ? `${s.acknowledged}` : "Not asked", n.ackRequired && s ? `of ${s.recipients}${pct(s.acknowledged, s.recipients)}` : "This notice did not ask for it", n.ackRequired && s && s.acknowledged < s.recipients ? "var(--warn,#B45309)" : muted),
        tile("Delivered", report.data ? `${pushSent} push · ${emailSent} email` : "—", channelsLabel(n.channels), "var(--info,#1D4ED8)"),
      ];

  const details = section({
    h: "Notice details",
    type: "grid",
    rows: [
      ["Category", NOTICE_CATEGORY_LABEL[n.category] ?? n.category],
      ["Audience", audience],
      ["Channels", channelsLabel(n.channels)],
      ["Acknowledgement", n.ackRequired ? "Required" : "Not asked"],
      ["Published", n.publishedAt ? formatDateTime(n.publishedAt) : "Not yet"],
      ["Expires", n.expiresAt ? formatDateTime(n.expiresAt) : "Never"],
      ...(n.emergencyReason ? [["Emergency reason", n.emergencyReason]] : []),
    ],
  });
  // A notice can both correct an earlier one and be corrected itself; each row opens its own notice.
  const links = [
    ...(n.supersedesId ? [{ row: ["Corrects an earlier notice", "The notice this replaces", "Earlier"], to: n.supersedesId }] : []),
    ...(n.supersededById ? [{ row: ["Superseded by a correction", "Recipients now see the correction", "Later"], to: n.supersededById }] : []),
  ];

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <RecordHeaderCard
        initial={n.title[0]?.toUpperCase() ?? "N"}
        name={n.title}
        code={NOTICE_CATEGORY_LABEL[n.category] ?? n.category}
        meta={[audience, channelsLabel(n.channels), n.publishedAt ? `Published ${formatDate(n.publishedAt)}` : "Draft"]}
        chips={chips}
        actions={actions}
        onBack={onBack}
      />
      <RecordTiles tiles={tiles} />
      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <>
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <CardHead title="Notice" sub={n.publishedAt ? `As sent on ${formatDateTime(n.publishedAt)}` : "Draft text"} />
              <div style={{ padding: "16px 20px", font: "400 14px/1.65 Figtree, sans-serif", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.body}</div>
            </div>
            {!draft && (
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <CardHead
                  title="Delivery & acknowledgement"
                  sub={report.data ? `${recips.length} recipient${recips.length === 1 ? "" : "s"} · the proof of service` : "The proof of service"}
                  right={<EmailReport societyId={societyId} type="notice-delivery" params={{ noticeId: n.id }} disabled={!report.data} />}
                />
                <DataTable<Recipient>
                  cols={REPORT_COLS}
                  rows={reportRows}
                  skeletonRows={5}
                  minWidth={640}
                  empty="Nobody was in the audience when this was published."
                  renderRow={(r, i) => (
                    <tr key={`${r.name}-${r.unitLabel}-${i}`} style={rowBorder}>
                      <td style={cellStyle("left", { font: "600 13.5px/1.4 Figtree, sans-serif" })}>{r.name || "—"}</td>
                      <td style={cellStyle("left", { font: "500 12.5px/1.4 'IBM Plex Mono',monospace", whiteSpace: "nowrap" })}>{r.unitLabel ?? "—"}</td>
                      <td style={cellStyle("left", { color: statusKind(r.pushStatus) === "bad" ? "var(--bad-ink,#9B2B22)" : "var(--ink-soft,#5A6B66)" })}>{deliveryLabel(r.pushStatus)}</td>
                      <td style={cellStyle("left", { color: statusKind(r.emailStatus) === "bad" ? "var(--bad-ink,#9B2B22)" : "var(--ink-soft,#5A6B66)" })}>{deliveryLabel(r.emailStatus)}</td>
                      <td style={cellStyle("left", { whiteSpace: "nowrap", color: r.readAt ? undefined : "var(--ink-dim,#A8B5B0)" })}>{r.readAt ? formatDateTime(r.readAt) : "Not yet"}</td>
                      <td style={cellStyle("left", { whiteSpace: "nowrap", color: r.acknowledgedAt ? "var(--ok,#167A3C)" : "var(--ink-dim,#A8B5B0)" })}>{r.acknowledgedAt ? formatDateTime(r.acknowledgedAt) : n.ackRequired ? "Pending" : "—"}</td>
                    </tr>
                  )}
                />
              </div>
            )}
          </>
        }
        right={
          <>
            <SectionCard s={details} />
            {links.length > 0 && (
              <SectionCard
                s={section({ h: "Corrections", type: "list", rows: links.map((l) => l.row) })}
                rowAction={(i) => ({ label: "Open", onClick: () => navigate(`/notices/record/${links[i].to}`) })}
              />
            )}
          </>
        }
      />

      {modal === "edit" && <NoticeComposer societyId={societyId} draft={n} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {modal === "correct" && (
        <NoticeComposer
          societyId={societyId}
          corrects={n}
          onClose={() => setModal(null)}
          onSaved={(c) => {
            setModal(null);
            navigate(`/notices/record/${c.id}`);
          }}
        />
      )}
      {modal === "publish" && (
        <ConfirmModal
          title="Publish this notice?"
          body={
            <>
              It goes to <strong>{audience.toLowerCase()}</strong> by {channelsLabel(n.channels).toLowerCase()}. The recipient list is fixed now and the notice cannot be edited afterwards — a mistake is fixed by issuing a correction.
              {n.category === "EMERGENCY" ? " As an emergency it bypasses quiet hours." : ""}
            </>
          }
          confirm="Publish"
          busyLabel="Publishing…"
          busy={publish.isPending}
          error={error}
          onConfirm={() => void doPublish()}
          onClose={() => {
            setModal(null);
            setError(null);
          }}
        />
      )}
      {modal === "discard" && (
        <ConfirmModal
          title="Delete this draft?"
          body="It was never sent. This cannot be undone."
          confirm="Delete draft"
          busyLabel="Deleting…"
          cancelLabel="Keep draft"
          tone="bad"
          busy={discard.isPending}
          error={error}
          onConfirm={() => void doDiscard()}
          onClose={() => {
            setModal(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
