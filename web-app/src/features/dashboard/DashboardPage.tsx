import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { api, type Dashboard } from "@chs/contract";
import { holds, useConsoleMe, useCurrentSociety } from "../../api/society";
import { Skeleton } from "../../components/Skeleton";
import { RetryButton } from "../../components/Kit";
import { formatDate } from "../../lib/apiFormat";
import { inrRound, periodLabel } from "../../lib/money";

const card: CSSProperties = { background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: 18 };

/** Permissions that open `reports.dashboard` (its contract access rule). */
const DASHBOARD_PERMS = ["reports.view", "billing.generate", "payments.record", "accounts.manage", "society.configure"] as const;

/**
 * The society-wide overview, from `reports.dashboard`: billed and collected
 * this month and this financial year, outstanding with its ageing, the
 * largest defaulters, occupancy and the people and notices counts.
 *
 * The design's six-month chart needs collections by month, which the API does
 * not give yet, so that card compares this month with the year to date
 * instead. Compliance, fund balances and the gate have no API; their cards
 * keep their place and show a dash.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { society } = useCurrentSociety();
  const firstName = useConsoleMe().name.split(/\s+/)[0];
  const [hour] = useState(() => new Date().getHours());
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const societyId = society?.societyId ?? "";
  const canSee = Boolean(society && holds(society, ...DASHBOARD_PERMS));
  const canRuns = Boolean(society && holds(society, "billing.generate", "billing.publish"));
  const dash = useApiQuery(api.reports.dashboard, { params: { societyId } }, { enabled: canSee });
  const runs = useApiQuery(api.billing.runs, { params: { societyId } }, { enabled: canRuns });
  const state = toLoadState(dash);
  const d = state.status === "ready" ? state.data : null;
  const loading = canSee && state.status === "loading";

  const latest = runs.data?.find((r) => r.status === "PUBLISHED") ?? null;
  const draft = runs.data?.find((r) => r.status === "DRAFT") ?? null;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const publishedAgo = latest?.publishedAt ? daysAgo(latest.publishedAt) : null;
  const sub = latest ? `${today} · ${periodLabel(latest.period).split(" ")[0]} bills published ${publishedAgo}` : today;

  const monthName = d ? new Date(`${d.asOf}T00:00:00`).toLocaleDateString("en-GB", { month: "long" }) : "this month";
  const monthPct = d && d.billedThisMonthPaise > 0 ? Math.min(100, Math.round((d.collectedThisMonthPaise / d.billedThisMonthPaise) * 100)) : 0;
  const efficiency = d?.collectionEfficiencyBps ?? null;
  const ageing = d ? [d.ageing.d0_30, d.ageing.d31_60, d.ageing.d61_90, d.ageing.d90plus] : [0, 0, 0, 0];
  const over30 = ageing[1] + ageing[2] + ageing[3];

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ margin: 0, font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{sub}</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate("/reports")} className="press-scale focus-ring" style={secondaryBtn}>
            Export
          </button>
          <button type="button" onClick={() => navigate(draft ? `/billing/runs/${draft.id}` : "/billing")} className="press-scale focus-ring" style={primaryBtn}>
            {draft ? `Review ${periodLabel(draft.period).split(" ")[0]} draft` : "New bill run"}
          </button>
        </div>
      </div>

      {state.status === "error" && (
        <div role="alert" style={{ ...card, marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderColor: "var(--bad-border,#F6D9D6)" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ font: "600 14px/1.4 Figtree, sans-serif" }}>{state.message}</div>
            <div style={{ marginTop: 2, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>The figures below could not be loaded.</div>
          </div>
          <RetryButton onClick={state.retry} />
        </div>
      )}
      {!canSee && society && (
        <div style={{ ...card, marginBottom: 14, font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
          The money figures need the reports.view or billing permission. An administrator who manages users can grant it.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 14 }}>
        <div className="hover-lift theme-transition" style={card}>
          <Label>Billed · {monthName}</Label>
          <BigNum loading={loading}>{d ? inrRound(d.billedThisMonthPaise) : "—"}</BigNum>
          <Note>{d ? `${latest && latest.period === d.asOf.slice(0, 7) ? `${latest.billCount} bills · ` : ""}${inrRound(d.billedFyPaise)} this FY` : loading ? " " : "—"}</Note>
        </div>
        <div className="hover-lift theme-transition" style={card}>
          <Label>Collected · {monthName}</Label>
          <BigNum loading={loading} color="var(--ok,#167A3C)">
            {d ? inrRound(d.collectedThisMonthPaise) : "—"}
          </BigNum>
          <div style={{ marginTop: 9, height: 5, borderRadius: 3, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
            {d && <div style={{ height: "100%", width: `${monthPct}%`, background: "#167A3C", transformOrigin: "left", animation: "grow .8s cubic-bezier(.2,.7,.3,1)" }} />}
          </div>
          <Note style={{ marginTop: 7 }}>{d ? `${monthPct}% of this month's bills · ${efficiency === null ? "—" : `${(efficiency / 100).toFixed(1)}%`} efficiency this FY` : loading ? " " : "—"}</Note>
        </div>
        <div className="hover-lift theme-transition" style={card}>
          <Label>Outstanding</Label>
          <BigNum loading={loading} color="var(--bad,#C0342B)">
            {d ? inrRound(d.outstandingPaise) : "—"}
          </BigNum>
          <div style={{ marginTop: 11, display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2, background: d ? undefined : "var(--subtle,#EDF1EF)" }} aria-hidden="true">
            {d && ageing.map((v, i) => (v > 0 ? <div key={i} style={{ flex: v, background: AGEING_COLORS[i] }} /> : null))}
          </div>
          <Note style={{ marginTop: 7 }}>{d ? `${inrRound(over30)} over 30 days · ${inrRound(d.ageing.d90plus)} over 90` : loading ? " " : "—"}</Note>
        </div>
        <div className="hover-lift theme-transition" style={card}>
          <Label>Compliance score</Label>
          {/* No compliance API yet: the card keeps its place without a made-up score. */}
          <div style={{ font: "700 25px/1 Figtree, sans-serif", letterSpacing: "-.022em", color: "var(--ink-dim,#A8B5B0)" }}>—</div>
          <Note>Compliance tracking is not live yet</Note>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 14 }}>
        <BilledVsCollected d={d} loading={loading} monthName={monthName} />
        <Attention d={d} loading={loading} draft={draft ? { id: draft.id, period: draft.period, count: draft.billCount } : null} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Top defaulters</div>
            {d && d.topDefaulters.length > 0 && (
              <button type="button" onClick={() => navigate("/reports/defaulters")} className="focus-ring" style={linkBtn}>
                All
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {loading && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
            {d && d.topDefaulters.length === 0 && <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>No unit is overdue.</div>}
            {d?.topDefaulters.slice(0, 5).map((x) => {
              const days = Math.max(0, Math.floor((Date.parse(d.asOf) - Date.parse(x.oldestDueDate)) / 86_400_000));
              return (
                <button key={x.unitId} type="button" onClick={() => navigate(`/members/record/${x.unitId}`)} className="row-hover focus-ring" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }}>
                  <div>
                    <div style={{ font: "600 13.5px/1.3 Figtree, sans-serif" }}>
                      {x.unitLabel} · {x.ownerName ?? "Owner not recorded"}
                    </div>
                    <div style={{ marginTop: 2, font: "400 12px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                      {days} days · due since {formatDate(x.oldestDueDate)}
                    </div>
                  </div>
                  <span style={{ font: "700 14px/1 Figtree, sans-serif", fontVariantNumeric: "tabular-nums", color: days > 30 ? "var(--bad,#C0342B)" : "var(--warn,#B45309)" }}>{inrRound(x.duePaise)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ResidentsCard d={d} loading={loading} />

        <div style={card}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Fund balances</div>
          {/* Fund balances come from accounting, which has no API yet. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {["Sinking fund", "Repair & maintenance", "Major repair"].map((name) => (
              <div key={name}>
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 13px/1.3 Figtree, sans-serif", marginBottom: 6 }}>
                  <span>{name}</span>
                  <span style={{ fontWeight: 700, color: "var(--ink-dim,#A8B5B0)" }}>—</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--subtle,#EDF1EF)" }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft,#F1F4F3)", font: "400 12px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            Balances appear once accounting is live. Withdrawals require a general body resolution reference.
          </div>
        </div>

        <div style={card}>
          <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Today at the gate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {["visitors in", "still inside", "deliveries", "staff present"].map((label) => (
              <div key={label}>
                <div style={{ font: "700 22px/1 Figtree, sans-serif", color: "var(--ink-dim,#A8B5B0)" }}>—</div>
                <div style={{ marginTop: 4, font: "400 12px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 10, background: "var(--subtle,#EDF1EF)", font: "600 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ink-dim,#A8B5B0)" }} />
            Gate figures are not live yet
          </div>
        </div>
      </div>
    </div>
  );
}

const AGEING_COLORS = ["var(--accent-200,#C9E4DC)", "#6FB3A1", "#B45309", "#C0342B"];

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** This month and the year to date, billed against collected, in the design chart's bar style. */
function BilledVsCollected({ d, loading, monthName }: { d: Dashboard | null; loading: boolean; monthName: string }) {
  const groups = d
    ? [
        { m: monthName, billed: d.billedThisMonthPaise, collected: d.collectedThisMonthPaise },
        { m: "FY to date", billed: d.billedFyPaise, collected: d.collectedFyPaise },
      ]
    : [];
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Billed vs collected</div>
        <div style={{ font: "400 12.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>This month and FY to date</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 132, justifyContent: "center" }}>
        {loading &&
          [0, 1].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width={90} height={11} />
              <Skeleton height={10} />
              <Skeleton width="70%" height={10} />
            </div>
          ))}
        {!loading && !d && <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>—</div>}
        {groups.map((g) => {
          const max = Math.max(g.billed, g.collected, 1);
          const pct = g.billed ? Math.round((g.collected / g.billed) * 100) : 0;
          return (
            <div key={g.m}>
              <div style={{ display: "flex", justifyContent: "space-between", font: "600 12.5px/1.3 Figtree, sans-serif", marginBottom: 7 }}>
                <span>{g.m}</span>
                <span style={{ color: "var(--ink-soft,#5A6B66)", fontWeight: 500 }}>{pct}% collected</span>
              </div>
              <Bar value={g.billed} max={max} color="var(--accent-200,#C9E4DC)" label={inrRound(g.billed)} />
              <div style={{ height: 5 }} />
              <Bar value={g.collected} max={max} color="#0E6B5C" label={inrRound(g.collected)} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 16, font: "500 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
        <Legend color="var(--accent-200,#C9E4DC)" label="Billed" />
        <Legend color="#0E6B5C" label="Collected" />
      </div>
    </div>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 10, borderRadius: 4, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 4, transformOrigin: "left", animation: "grow .6s cubic-bezier(.2,.7,.3,1)" }} />
      </div>
      <span style={{ width: 104, flex: "none", textAlign: "right", font: "600 12.5px/1 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{label}</span>
    </div>
  );
}

interface AttentionItem {
  dot: string;
  title: string;
  meta: string;
  cta: string;
  to: string;
}

/** The design's attention list, built from what the API counts; an item appears only when there is something to do. */
function Attention({ d, loading, draft }: { d: Dashboard | null; loading: boolean; draft: { id: string; period: string; count: number } | null }) {
  const navigate = useNavigate();
  const items: AttentionItem[] = [];
  if (draft) items.push({ dot: "var(--warn,#B45309)", title: `${periodLabel(draft.period)} bills are a draft`, meta: `${draft.count} bills waiting to be reviewed and published`, cta: "Review", to: `/billing/runs/${draft.id}` });
  if (d) {
    const overdue = d.ageing.d31_60 + d.ageing.d61_90 + d.ageing.d90plus;
    if (d.topDefaulters.length) items.push({ dot: "var(--bad,#C0342B)", title: `${inrRound(overdue)} overdue by more than 30 days`, meta: `${d.topDefaulters.length}${d.topDefaulters.length >= 10 ? "+" : ""} units in arrears · largest ${d.topDefaulters[0].unitLabel}`, cta: "Defaulters", to: "/reports/defaulters" });
    if (d.pendingApprovals) items.push({ dot: "var(--info,#1D4ED8)", title: `${d.pendingApprovals} request${d.pendingApprovals === 1 ? "" : "s"} awaiting approval`, meta: "Tenancy, family and vehicle requests", cta: "Review", to: "/members/approvals" });
    if (d.invitedUsers) items.push({ dot: "var(--ink-soft,#5A6B66)", title: `${d.invitedUsers} user${d.invitedUsers === 1 ? " has" : "s have"} never signed in`, meta: "Added to the society but no password set yet", cta: "Open", to: "/users" });
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif" }}>Needs your attention</div>
        {!loading && <span style={badge(items.length ? "var(--bad-wash,#FCEDEC)" : "var(--ok-wash,#E8F5EC)", items.length ? "var(--bad-ink,#9B2B22)" : "var(--ok-ink,#14663A)")}>{items.length}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {loading && [0, 1, 2].map((i) => <RowSkeleton key={i} pad />)}
        {!loading && items.length === 0 && <div style={{ padding: "12px 0", font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{d ? "Nothing needs you right now." : "—"}</div>}
        {items.map((a, i) => (
          <button
            key={a.title}
            type="button"
            onClick={() => navigate(a.to)}
            className="row-hover focus-ring"
            style={{ display: "flex", gap: 12, padding: "12px 0", border: 0, borderBottom: i < items.length - 1 ? "1px solid var(--border-soft,#F1F4F3)" : "none", background: "transparent", cursor: "pointer", textAlign: "left", color: "inherit" }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.dot, flex: "none", marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{a.title}</div>
              <div style={{ marginTop: 2, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{a.meta}</div>
            </div>
            <span style={{ font: "600 12.5px/1.4 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)", alignSelf: "center" }}>{a.cta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const OCC_ORDER = ["SELF_OCCUPIED", "FAMILY_OCCUPIED", "TENANTED", "VACANT", "LOCKED", "UNDER_RENOVATION"];
const OCC_LABEL: Record<string, string> = { SELF_OCCUPIED: "Self-occupied", FAMILY_OCCUPIED: "Family", TENANTED: "Tenanted", VACANT: "Vacant", LOCKED: "Locked", UNDER_RENOVATION: "Renovation" };
const OCC_COLOR: Record<string, string> = { SELF_OCCUPIED: "#0E6B5C", FAMILY_OCCUPIED: "#6FB3A1", TENANTED: "var(--info,#1D4ED8)", VACANT: "var(--accent-200,#C9E4DC)", LOCKED: "var(--ink-dim,#A8B5B0)", UNDER_RENOVATION: "#B45309" };

/** Occupancy split, app users and notices — the dashboard's count of people rather than money. */
function ResidentsCard({ d, loading }: { d: Dashboard | null; loading: boolean }) {
  const entries = d ? Object.entries(d.occupancy).sort((a, b) => OCC_ORDER.indexOf(a[0]) - OCC_ORDER.indexOf(b[0])) : [];
  const recorded = entries.reduce((s, [, n]) => s + n, 0);
  const unrecorded = d ? Math.max(0, d.units - recorded) : 0;
  return (
    <div style={card}>
      <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 14 }}>Residents</div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={7} />
          <Skeleton width="80%" height={11} />
          <Skeleton width="60%" height={11} />
        </div>
      ) : !d ? (
        <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>—</div>
      ) : (
        <>
          <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 10 }} aria-hidden="true">
            {entries.map(([k, n]) => (n ? <div key={k} style={{ flex: n, background: OCC_COLOR[k] ?? "var(--ink-dim,#A8B5B0)" }} /> : null))}
            {unrecorded > 0 && <div style={{ flex: unrecorded, background: "var(--subtle,#EDF1EF)" }} />}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", font: "500 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 14 }}>
            {entries.map(([k, n]) => (
              <Legend key={k} color={OCC_COLOR[k] ?? "var(--ink-dim,#A8B5B0)"} label={`${OCC_LABEL[k] ?? k} ${n}`} />
            ))}
            {unrecorded > 0 && <Legend color="var(--subtle,#EDF1EF)" label={`Not recorded ${unrecorded}`} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
            <Mini value={String(d.activeUsers)} label={`app users · ${d.invitedUsers} invited`} />
            <Mini value={String(d.noticesThisMonth)} label="notices this month" />
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ font: "700 22px/1 Figtree, sans-serif", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ marginTop: 4, font: "400 12px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{label}</div>
    </div>
  );
}

function RowSkeleton({ pad }: { pad?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: pad ? "12px 0" : 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="45%" height={10} />
      </div>
      <Skeleton width={60} height={14} />
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", marginBottom: 11 }}>{children}</div>;
}
function BigNum({ children, color, loading }: { children: ReactNode; color?: string; loading?: boolean }) {
  if (loading) return <Skeleton width={130} height={25} />;
  return <div style={{ font: "700 25px/1 Figtree, sans-serif", letterSpacing: "-.022em", fontVariantNumeric: "tabular-nums", color: children === "—" ? "var(--ink-dim,#A8B5B0)" : color }}>{children}</div>;
}
function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ marginTop: 9, minHeight: 17, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", ...style }}>{children}</div>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}
function badge(bg: string, fg: string): CSSProperties {
  return { padding: "2px 8px", borderRadius: 999, background: bg, color: fg, font: "600 11.5px/1.5 Figtree, sans-serif" };
}

const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const linkBtn: CSSProperties = { border: 0, background: "transparent", padding: 0, font: "600 12.5px/1.3 Figtree, sans-serif", color: "var(--accent-ink,#0E6B5C)", cursor: "pointer" };
