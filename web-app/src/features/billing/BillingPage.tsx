import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type SocietyMembership } from "@chs/contract";
import type { z } from "zod";
import { holds } from "../../api/society";
import { LiveStatGrid } from "../../components/ApiTable";
import { DataTable } from "../../components/Kit";
import { amountCell, cardStyle, cellStyle, monoCell } from "../../lib/uiStyles";
import { Pill } from "../../components/Pill";
import { formatDate, formatDateTime } from "../../lib/apiFormat";
import { inr, inrRound, nextPeriod, periodLabel, todayIso } from "../../lib/money";
import { RUN_STATE } from "../../lib/moneyLabels";
import { primaryBtnStyle, rowProps } from "../../lib/tableKit";
import { BillingGuard, BillingHeader } from "./BillingShell";
import { GenerateRunModal } from "./BillingModals";

type Run = z.infer<typeof schemas.billing.BillRunSummary>;

const COLS = [
  { label: "Period", align: "left" as const },
  { label: "Bill date", align: "left" as const },
  { label: "Due", align: "left" as const },
  { label: "Bills", align: "right" as const },
  { label: "Total", align: "right" as const },
  { label: "Published", align: "left" as const },
  { label: "Status", align: "right" as const },
];

/**
 * Bill runs, newest period first (`billing.runs`). A run is generated as a
 * draft, previewed, then published; "Generate bills" suggests the month
 * after the latest run.
 */
export function BillingPage() {
  return <BillingGuard>{(s) => <BillRuns society={s} />}</BillingGuard>;
}

function BillRuns({ society }: { society: SocietyMembership }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const canGenerate = holds(society, "billing.generate");
  const canList = holds(society, "billing.generate", "billing.publish");
  const [generating, setGenerating] = useState(false);
  const runs = useApiQuery(api.billing.runs, { params: { societyId } }, { enabled: canList });
  const list = runs.data ?? [];
  const live = list.filter((r) => r.status !== "DISCARDED");
  const latest = live[0] ?? null;
  const lastPublished = list.find((r) => r.status === "PUBLISHED") ?? null;
  const draft = list.find((r) => r.status === "DRAFT") ?? null;
  const suggest = latest ? nextPeriod(latest.period) : todayIso().slice(0, 7);
  const fyTotal = list.filter((r) => r.status === "PUBLISHED" && sameFy(r.period)).reduce((s, r) => s + r.totalPaise, 0);

  // Stat values wait on the list; if it failed the table says so and the cards show a dash.
  const settled = !canList || runs.status !== "pending";
  const v = (x: string) => (!settled ? null : runs.isError ? "—" : x);
  const stats = [
    { label: "Last published", value: v(lastPublished ? periodLabel(lastPublished.period) : "None yet"), note: lastPublished ? `${lastPublished.billCount} bills · ${inrRound(lastPublished.totalPaise)}` : "No run published" },
    { label: "Draft", value: v(draft ? periodLabel(draft.period) : "None"), note: draft ? `${draft.billCount} bills waiting to publish` : "Generate the next month when ready", fg: draft ? "var(--warn,#B45309)" : undefined },
    { label: "Billed this FY", value: v(inrRound(fyTotal)), note: "Published runs only" },
    { label: "Next period", value: v(periodLabel(suggest)), note: "Periods are billed in order" },
  ];

  return (
    <>
      <BillingHeader
        sub="Every month's bills are computed as a draft, checked against the previous month and published in one step. Published bills are numbered and cannot be edited."
        actions={
          canGenerate ? (
            <button type="button" onClick={() => (draft ? navigate(`/billing/runs/${draft.id}`) : setGenerating(true))} className="press-scale focus-ring" style={primaryBtnStyle}>
              {draft ? `Review ${periodLabel(draft.period)}` : "Generate bills"}
            </button>
          ) : undefined
        }
      />
      <LiveStatGrid stats={stats} />
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <DataTable<Run>
          cols={COLS}
          rows={canList ? toLoadState(runs) : { status: "ready", data: [] }}
          skeletonRows={4}
          empty={canList ? "No bill runs yet. Generate the first month's bills to see the preview." : "Bill runs need the billing.generate or billing.publish permission."}
          renderRow={(r) => {
            const st = RUN_STATE[r.status];
            return (
              <tr key={r.id} {...rowProps(() => navigate(`/billing/runs/${r.id}`))}>
                <td style={cellStyle("left", { font: "600 14px/1.4 Figtree, sans-serif" })}>{periodLabel(r.period)}</td>
                <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{formatDate(r.billDate)}</td>
                <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)" })}>{formatDate(r.dueDate)}</td>
                <td style={cellStyle("right", monoCell)}>{r.billCount}</td>
                <td style={cellStyle("right", amountCell)}>{inr(r.totalPaise)}</td>
                <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" })}>{r.publishedAt ? formatDateTime(r.publishedAt) : "—"}</td>
                <td style={cellStyle("right")}>
                  <Pill label={st.label} kind={st.kind} />
                </td>
              </tr>
            );
          }}
        />
      </div>
      {generating && <GenerateRunModal societyId={societyId} suggest={suggest} onClose={() => setGenerating(false)} />}
    </>
  );
}

/** Whether a YYYY-MM period falls in the current April–March financial year. */
function sameFy(period: string): boolean {
  const [ty, tm] = todayIso().split("-").map(Number);
  const fyStart = tm >= 4 ? ty : ty - 1;
  const [y, m] = period.split("-").map(Number);
  return (m >= 4 ? y : y - 1) === fyStart;
}
