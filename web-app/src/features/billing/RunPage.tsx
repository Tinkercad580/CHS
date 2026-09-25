import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type BillRunPreview, type SocietyMembership } from "@chs/contract";
import { holds } from "../../api/society";
import { ConfirmModal, Crumbs, Note, RetryButton } from "../../components/Kit";
import { cardStyle } from "../../lib/uiStyles";
import { Skeleton, SkeletonText } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import { formatDate, formatDateTime } from "../../lib/apiFormat";
import { bpsChange, inr, periodLabel, periodShort, rateLabel } from "../../lib/money";
import { METHOD_LABEL } from "../../lib/moneyLabels";
import { secondaryBtnStyle, primaryBtnStyle } from "../../lib/tableKit";
import { useAdminStore } from "../../store/AdminStore";
import { BillingGuard } from "./BillingShell";
import { RUNS_PERMS } from "./billingAccess";

const STEPS = ["Snapshot", "Compute", "Preview", "Approve", "Publish"];

/**
 * One bill run: the design's preview screen on `billing.run`. Head-wise
 * totals with each head's apportionment, the change against the last
 * published run by building, the units that moved more than 10%, and the
 * exceptions the engine raised. A draft can be recomputed after a rate
 * change, published (with a confirm step) or discarded. Publishing is
 * idempotent: `useApiMutation` keeps one Idempotency-Key for the run until
 * the publish succeeds, so a retry after a timeout is replayed by the server
 * rather than publishing twice.
 */
export function RunPage({ runId }: { runId: string }) {
  // billing.run, billing.runs and billing.heads all need billing.generate or billing.publish.
  return <BillingGuard need={RUNS_PERMS}>{(s) => <Run society={s} runId={runId} />}</BillingGuard>;
}

function Run({ society, runId }: { society: SocietyMembership; runId: string }) {
  const navigate = useNavigate();
  const societyId = society.societyId;
  const run = useApiQuery(api.billing.run, { params: { societyId, runId } });
  const state = toLoadState(run);

  if (state.status === "loading") return <RunSkeleton />;
  if (state.status === "error") {
    const missing = run.error instanceof ApiError && run.error.code === "NOT_FOUND";
    return (
      <div>
        <Crumbs items={[{ label: "Billing", to: "/billing" }, { label: "Bill run" }]} />
        <div style={{ ...cardStyle, padding: "22px 22px" }}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>{missing ? "This bill run could not be found" : state.message}</div>
          <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 14 }}>{missing ? "It may belong to another society." : "Nothing was changed."}</div>
          {missing ? (
            <button type="button" onClick={() => navigate("/billing")} className="press-scale focus-ring" style={secondaryBtnStyle}>
              Back to bill runs
            </button>
          ) : (
            <RetryButton onClick={state.retry} />
          )}
        </div>
      </div>
    );
  }
  return <RunView society={society} run={state.data} />;
}

function RunView({ society, run }: { society: SocietyMembership; run: BillRunPreview }) {
  const navigate = useNavigate();
  const { toast } = useAdminStore();
  const societyId = society.societyId;
  const params = { societyId, runId: run.id };
  const [confirm, setConfirm] = useState<"publish" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const heads = useApiQuery(api.billing.heads, { params: { societyId } });
  const runs = useApiQuery(api.billing.runs, { params: { societyId } });
  // The building comparison is against the last published run before this one.
  const previousId = runs.data?.find((r) => r.status === "PUBLISHED" && r.period < run.period)?.id ?? null;
  const previous = useApiQuery(api.billing.run, { params: { societyId, runId: previousId ?? "" } }, { enabled: Boolean(previousId) });
  const prevRun = runs.data?.find((r) => r.id === previousId) ?? null;

  const recompute = useApiMutation(api.billing.recomputeRun);
  const publish = useApiMutation(api.billing.publishRun);
  const discard = useApiMutation(api.billing.discardRun);

  const draft = run.status === "DRAFT";
  const canGenerate = holds(society, "billing.generate");
  const canPublish = holds(society, "billing.publish");
  const headByCode = new Map((heads.data ?? []).map((h) => [h.code, h]));
  const step = run.status === "PUBLISHED" ? STEPS.length : 2;

  const doRecompute = () =>
    recompute.mutate(
      { params },
      {
        onSuccess: (r) => toast(`Recomputed: ${r.billCount} bills, ${inr(r.totalPaise)}.`, "ok"),
        onError: (e) => toast(e.message, "warn"),
      },
    );
  const doPublish = async () => {
    setError(null);
    try {
      const r = await publish.mutateAsync({ params });
      setConfirm(null);
      toast(`${r.billCount} bills for ${periodLabel(r.period)} published. Residents are being notified.`, "ok");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  };
  const doDiscard = async () => {
    setError(null);
    try {
      await discard.mutateAsync({ params });
      setConfirm(null);
      toast(`${periodLabel(run.period)} draft discarded.`, "warn");
      navigate("/billing");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  };

  const title = `${periodLabel(run.period)} · ${run.status === "DRAFT" ? "draft" : run.status === "PUBLISHED" ? "published" : "discarded"}`;
  const busy = recompute.isPending || publish.isPending || discard.isPending;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <Crumbs items={[{ label: "Billing", to: "/billing" }, { label: "Bill run" }]} />
          <h1 style={{ margin: 0, font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>{title}</h1>
          <div style={{ marginTop: 6, font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            Bill date {formatDate(run.billDate)} · due {formatDate(run.dueDate)}
            {run.publishedAt ? ` · published ${formatDateTime(run.publishedAt)}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {draft && canGenerate && (
            <button type="button" onClick={() => setConfirm("discard")} disabled={busy} className="press-scale focus-ring" style={{ ...secondaryBtnStyle, color: "var(--bad-ink,#9B2B22)" }}>
              Discard
            </button>
          )}
          {draft && canGenerate && (
            <button type="button" onClick={doRecompute} disabled={busy} aria-busy={recompute.isPending || undefined} className="press-scale focus-ring" style={{ ...secondaryBtnStyle, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {recompute.isPending && <Spinner size={13} />}
              {recompute.isPending ? "Recomputing…" : "Recompute"}
            </button>
          )}
          {draft && canPublish && (
            <button type="button" onClick={() => setConfirm("publish")} disabled={busy || run.billCount === 0} className="press-scale focus-ring" style={{ ...primaryBtnStyle, opacity: run.billCount === 0 ? 0.55 : 1 }}>
              Publish {run.billCount} bills
            </button>
          )}
          {run.status === "PUBLISHED" && (
            <button type="button" onClick={() => navigate(`/billing/bills?period=${run.period}`)} className="press-scale focus-ring" style={primaryBtnStyle}>
              View {run.billCount} bills
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, padding: 5, marginBottom: 16, overflowX: "auto" }} aria-label={`Step ${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s} aria-current={active ? "step" : undefined} style={{ flex: 1, minWidth: 120, display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderRadius: 10, background: active ? "#0E6B5C" : done ? "var(--accent-wash,#E6F2EF)" : "transparent" }}>
              <span style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", background: done ? "#0E6B5C" : active ? "#fff" : "var(--subtle,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px/1 Figtree, sans-serif", color: active ? "#0E6B5C" : "var(--ink-soft,#5A6B66)" }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4.5 12.5 5 5 10-11" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span style={{ font: "600 13px/1.3 Figtree, sans-serif", color: done ? "var(--accent-ink,#0A5749)" : active ? "#fff" : "var(--ink-soft,#5A6B66)" }}>{s}</span>
            </div>
          );
        })}
      </div>

      {run.status === "DISCARDED" && <Note kind="mute" style={{ marginBottom: 14 }}>This draft was discarded. Generate the period again from Bill runs.</Note>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Head-wise totals</span>
            <span style={{ font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Apportionment basis</span>
          </div>
          {run.byHead.length === 0 && <div style={{ padding: "20px", font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>No charges in this run.</div>}
          {run.byHead.map((h) => {
            const head = headByCode.get(h.code);
            // The rate in force for this run's period, not today's: a new rate may start with this very month.
            const rate = head?.rates.find((r) => r.effectiveFrom <= run.periodStart && (!r.effectiveTo || r.effectiveTo > run.periodStart)) ?? null;
            return (
              <div key={h.code} className="row-hover" style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{h.label}</div>
                  <div style={{ marginTop: 2, font: "500 11px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)" }} title={head ? METHOD_LABEL[head.method] : undefined}>
                    {head ? head.method : h.code}
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none", maxWidth: "55%" }}>
                  <div style={{ font: "600 14px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{inr(h.totalPaise)}</div>
                  <div style={{ marginTop: 2, font: "400 11.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                    {h.units} unit{h.units === 1 ? "" : "s"}
                    {head && rate ? ` · ${rateLabel(head.method, rate.rate, rate.rateByType)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "var(--canvas,#F7F9F8)" }}>
            <span style={{ font: "700 14px/1.3 Figtree, sans-serif" }}>Total billed</span>
            <span style={{ font: "700 17px/1.3 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{inr(run.totalPaise)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>{prevRun ? `Variance vs ${periodShort(prevRun.period).split(" ")[0]}` : "By building"}</div>
            <BuildingBars run={run} previous={previousId ? (previous.data ?? null) : null} comparing={Boolean(previousId) && previous.isPending} />
            {run.variances.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <Note kind="warn">
                  {run.variances.length} unit{run.variances.length === 1 ? "'s bill moved" : "s' bills moved"} more than 10% against {prevRun ? periodLabel(prevRun.period) : "the last published run"}. Check them before publishing.
                </Note>
                <div style={{ marginTop: 10, maxHeight: 240, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Unit", "Before", "Now", "Change"].map((h, i) => (
                          <th key={h} scope="col" style={{ padding: "8px 6px", textAlign: i ? "right" : "left", font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {run.variances.map((v) => (
                        <tr key={v.unitId} className="row-hover" style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)", cursor: "pointer" }} onClick={() => navigate(`/members/record/${v.unitId}`)}>
                          <td style={{ padding: "8px 6px", font: "500 12.5px/1.4 'IBM Plex Mono',monospace" }}>{v.unitLabel}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", font: "400 12.5px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", color: "var(--ink-soft,#5A6B66)" }}>{inr(v.previousPaise)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", font: "600 12.5px/1.4 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{inr(v.currentPaise)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right", font: "600 12.5px/1.4 Figtree, sans-serif", color: v.changeBps > 0 ? "var(--warn,#B45309)" : "var(--ok,#167A3C)" }}>{bpsChange(v.changeBps)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              prevRun && <Note kind="ok" style={{ marginTop: 14 }}>No unit's bill moved more than 10% against {periodLabel(prevRun.period)}.</Note>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <span style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Exceptions</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, background: run.exceptions.length ? "var(--bad-wash,#FCEDEC)" : "var(--ok-wash,#E8F5EC)", color: run.exceptions.length ? "var(--bad-ink,#9B2B22)" : "var(--ok-ink,#14663A)", font: "700 11px/1.6 Figtree, sans-serif" }}>{run.exceptions.length}</span>
            </div>
            {run.exceptions.length === 0 ? (
              <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Every unit was billed without a problem.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {run.exceptions.map((ex, i) => (
                  <div key={`${ex.code}-${ex.unitId ?? i}`} style={{ padding: "12px 13px", border: "1px solid var(--warn-border,#F5DFBE)", background: "var(--warn-wash,#FDF9F3)", borderRadius: 11 }}>
                    <div style={{ font: "600 13px/1.4 Figtree, sans-serif", color: "var(--warn-ink,#7C3D06)" }}>
                      {ex.unitLabel ? `${ex.unitLabel} · ` : ""}
                      {ex.code.toLowerCase().replace(/_/g, " ")}
                    </div>
                    <div style={{ marginTop: 3, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#8F4A0A)" }}>{ex.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirm === "publish" && (
        <ConfirmModal
          title={`Publish ${run.billCount} bills for ${periodLabel(run.period).split(" ")[0]}?`}
          body={
            <>
              Each bill gets its number, is posted to the unit's ledger and the residents are notified. Published bills cannot be edited — a mistake is corrected by cancelling that bill or issuing a credit note.
              {run.exceptions.length > 0 && ` ${run.exceptions.length} exception${run.exceptions.length === 1 ? " is" : "s are"} still listed.`}
            </>
          }
          confirm={`Publish ${run.billCount}`}
          busyLabel="Publishing…"
          cancelLabel={run.exceptions.length ? "Review exceptions" : "Cancel"}
          busy={publish.isPending}
          error={error}
          onConfirm={() => void doPublish()}
          onClose={() => {
            setConfirm(null);
            setError(null);
          }}
        />
      )}
      {confirm === "discard" && (
        <ConfirmModal
          title={`Discard the ${periodLabel(run.period)} draft?`}
          body="The draft bills are deleted. Nothing was sent to residents. You can generate the period again."
          confirm="Discard draft"
          busyLabel="Discarding…"
          cancelLabel="Keep draft"
          tone="bad"
          busy={discard.isPending}
          error={error}
          onConfirm={() => void doDiscard()}
          onClose={() => {
            setConfirm(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * The design's per-wing variance bars. With a previous run the bar is the
 * change in that building's total; without one it is the building's share
 * of this run.
 */
function BuildingBars({ run, previous, comparing }: { run: BillRunPreview; previous: BillRunPreview | null; comparing: boolean }) {
  if (comparing) return <SkeletonText lines={3} />;
  const rows = run.byBuilding.map((b) => {
    const before = previous?.byBuilding.find((p) => p.buildingName === b.buildingName)?.totalPaise ?? null;
    const changeBps = before ? Math.round(((b.totalPaise - before) / before) * 10_000) : null;
    return { ...b, changeBps };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.totalPaise));
  const labelStyle: CSSProperties = { width: 110, flex: "none", font: "500 13px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" };
  if (!rows.length) return <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>No buildings in this run.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r) => {
        const big = r.changeBps !== null && Math.abs(r.changeBps) > 500;
        // A 10% move fills the bar, as in the design's wing chart; anything larger is clipped.
        const pct = previous ? (r.changeBps === null ? 0 : Math.min(100, Math.max(3, Math.abs(r.changeBps) / 10))) : (r.totalPaise / maxTotal) * 100;
        const color = big ? "#B45309" : "#6FB3A1";
        return (
          <div key={r.buildingName} style={{ display: "flex", alignItems: "center", gap: 12 }} title={`${inr(r.totalPaise)} · ${r.bills} bills`}>
            <span style={labelStyle}>{r.buildingName.length <= 2 ? `Building ${r.buildingName}` : r.buildingName}</span>
            <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, transformOrigin: "left", animation: "grow .6s cubic-bezier(.2,.7,.3,1)" }} />
            </div>
            <span style={{ font: "600 12.5px/1 Figtree, sans-serif", color: previous ? (big ? "var(--warn,#B45309)" : "var(--ok,#167A3C)") : "var(--ink-soft,#5A6B66)", minWidth: 48, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {previous ? (r.changeBps === null ? "new" : bpsChange(r.changeBps)) : `${r.bills} bills`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RunSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading bill run">
      <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
      <Skeleton width={260} height={28} style={{ marginBottom: 20 }} />
      <Skeleton height={42} radius={14} style={{ marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <SkeletonText lines={8} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...cardStyle, padding: 20 }}>
            <SkeletonText lines={4} />
          </div>
          <div style={{ ...cardStyle, padding: 20 }}>
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
