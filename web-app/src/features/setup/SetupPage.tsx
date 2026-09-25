import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type Onboarding, type Society, type SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { LiveStatGrid, PageHeader } from "../../components/ApiTable";
import { CardHead, ConfirmModal, SubNav } from "../../components/Kit";
import { DataBoundary } from "../../components/DataBoundary";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { Pill } from "../../components/Pill";
import { SkeletonText } from "../../components/Skeleton";
import { formatDate } from "../../lib/apiFormat";
import { cardStyle } from "../../lib/uiStyles";
import { primaryBtnStyle, secondaryBtnStyle } from "../../lib/tableKit";
import { useAdminStore } from "../../store/AdminStore";
import { NotFoundPage } from "../generic/NotFoundPage";
import { BillingConfigTab, ProfileTab } from "./SetupForms";
import { BanksTab, BuildingsTab, ParkingTab } from "./SetupStructure";
import { StatutoryTab } from "./SetupStatutory";

export type SetupTab = "overview" | "profile" | "billing" | "banks" | "buildings" | "parking" | "statutory";

/**
 * Each tab and the permissions that let its reads through (the contract's
 * access rules). A tab the admin can't read is not offered; within a tab,
 * writes are hidden unless the stricter write permission is held.
 */
const TABS: { key: SetupTab; label: string; can: (m: SocietyMembership) => boolean }[] = [
  { key: "overview", label: "Checklist", can: (m) => holds(m, "society.configure") },
  { key: "profile", label: "Profile & settings", can: (m) => holds(m, "society.configure") },
  { key: "billing", label: "Billing", can: (m) => holds(m, "society.configure", "billing.generate") },
  { key: "banks", label: "Bank accounts", can: (m) => holds(m, "society.configure", "accounts.manage", "payments.record") },
  { key: "buildings", label: "Buildings & units", can: (m) => holds(m, "society.configure") },
  { key: "parking", label: "Parking", can: (m) => holds(m, "society.configure", "members.manage") },
  { key: "statutory", label: "Statutory config", can: (m) => holds(m, "compliance.manage", "society.configure", "billing.generate") },
];

const path = (t: SetupTab) => (t === "overview" ? "/setup" : `/setup/${t}`);

/**
 * Society setup on `society.*` and `structure.*`: the go-live checklist, the
 * society's profile and settings, billing configuration, bank accounts,
 * buildings and their units, parking and the statutory parameters. It keeps
 * the design's setup page — the registration line under the title, the
 * onboarding figures and the statutory table — and puts each area behind a
 * tab with its own URL, the way Billing does.
 */
export function SetupPage({ tab }: { tab?: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Society setup" />;
  const visible = TABS.filter((t) => t.can(society));
  if (!visible.length) return <NoAccess title="Society setup" need="society.configure" />;
  if (!tab) return visible[0].key === "overview" ? <Setup key={society.societyId} society={society} tab="overview" tabs={visible} /> : <Navigate to={path(visible[0].key)} replace />;
  const def = TABS.find((t) => t.key === tab);
  if (!def || def.key === "overview") return <NotFoundPage />;
  if (!def.can(society)) return <NoAccess title="Society setup" need="society.configure" />;
  return <Setup key={society.societyId} society={society} tab={def.key} tabs={visible} />;
}

function Setup({ society, tab, tabs }: { society: SocietyMembership; tab: SetupTab; tabs: typeof TABS }) {
  const societyId = society.societyId;
  const profile = useApiQuery(api.society.get, { params: { societyId } });
  const s = profile.data;
  const sub = s ? registrationLine(s) : profile.isError ? "The society's profile could not be loaded." : " ";

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title="Society setup" sub={sub} actions={tab === "overview" ? <OverviewActions society={society} profile={s ?? null} /> : undefined} />
      {tabs.length > 1 && <SubNav items={tabs.map((t) => ({ to: path(t.key), label: t.label, end: true }))} />}
      <TabBody society={society} tab={tab} />
    </div>
  );
}

function TabBody({ society, tab }: { society: SocietyMembership; tab: SetupTab }) {
  switch (tab) {
    case "overview":
      return <Overview society={society} />;
    case "profile":
      return <ProfileTab society={society} />;
    case "billing":
      return <BillingConfigTab society={society} />;
    case "banks":
      return <BanksTab society={society} />;
    case "buildings":
      return <BuildingsTab society={society} />;
    case "parking":
      return <ParkingTab society={society} />;
    case "statutory":
      return <StatutoryTab society={society} />;
  }
}

/** "Shanti Vihar CHS · Reg. PNA/… · GST registered · financial year starts 1 April" — the design's line under the title. */
function registrationLine(s: Society): string {
  const month = new Date(2000, s.fyStartMonth - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  return [s.name, s.registrationNumber ? `Reg. ${s.registrationNumber}` : "Registration number not recorded", s.gstRegistered ? "GST registered" : "Not GST registered", `financial year starts 1 ${month}`].join(" · ");
}

/** The design's header buttons: "Go live" while the society is a draft, and a way to the statutory table. */
function OverviewActions({ society, profile }: { society: SocietyMembership; profile: Society | null }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const onboarding = useApiQuery(api.society.onboarding, { params: { societyId: society.societyId } });
  const canStatutory = holds(society, "compliance.manage", "society.configure", "billing.generate");
  const draft = profile?.status === "DRAFT";
  return (
    <>
      {canStatutory && (
        <button type="button" onClick={() => navigate("/setup/statutory")} className="press-scale focus-ring" style={secondaryBtnStyle}>
          Statutory config
        </button>
      )}
      {draft && (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={!onboarding.data?.canGoLive}
          title={onboarding.data?.canGoLive ? undefined : "Finish the required checklist items first"}
          className="press-scale focus-ring"
          style={{ ...primaryBtnStyle, opacity: onboarding.data?.canGoLive ? 1 : 0.55, cursor: onboarding.data?.canGoLive ? "pointer" : "default" }}
        >
          Go live
        </button>
      )}
      {confirm && profile && <GoLiveConfirm societyId={society.societyId} name={profile.name} onClose={() => setConfirm(false)} />}
    </>
  );
}

function GoLiveConfirm({ societyId, name, onClose }: { societyId: string; name: string; onClose: () => void }) {
  const { toast } = useAdminStore();
  const goLive = useApiMutation(api.society.goLive);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmModal
      title={`Take ${name} live?`}
      body="Residents can sign in to the apps, bills can be published and notices go out. A live society cannot be moved back to draft."
      confirm="Go live"
      busyLabel="Going live…"
      busy={goLive.isPending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        setError(null);
        goLive.mutate(
          { params: { societyId } },
          {
            onSuccess: (s) => {
              toast(`${s.name} is live.`, "ok");
              onClose();
            },
            onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong. Try again."),
          },
        );
      }}
    />
  );
}

/** Where each checklist item is fixed. Keys are the server's (society.onboarding). */
const FIX: Record<string, { to: string; label: string }> = {
  profile: { to: "/setup/profile", label: "Edit profile" },
  admin: { to: "/users", label: "Users & access" },
  buildings: { to: "/setup/buildings", label: "Add buildings" },
  construction_cost: { to: "/setup/buildings", label: "Enter costs" },
  units: { to: "/setup/buildings", label: "Add units" },
  members: { to: "/members", label: "Members & units" },
  billing_config: { to: "/setup/billing", label: "Billing setup" },
  bank_account: { to: "/setup/banks", label: "Add account" },
  charge_heads: { to: "/billing/heads", label: "Charge heads" },
};

function Overview({ society }: { society: SocietyMembership }) {
  const societyId = society.societyId;
  const onboarding = useApiQuery(api.society.onboarding, { params: { societyId } });
  const buildings = useApiQuery(api.structure.buildings, { params: { societyId } });
  const banks = useApiQuery(api.society.bankAccounts, { params: { societyId } });
  const canHeads = holds(society, "billing.generate", "billing.publish", "society.configure");
  const heads = useApiQuery(api.billing.heads, { params: { societyId } }, { enabled: canHeads });
  const profile = useApiQuery(api.society.get, { params: { societyId } });

  const val = <T,>(q: { data?: T; isError: boolean }, f: (d: T) => string) => (q.data !== undefined ? f(q.data) : q.isError ? "—" : null);
  const ob = onboarding.data;
  const remaining = ob ? ob.items.filter((i) => !i.done) : [];
  const stats = [
    { label: "Onboarding", value: val(onboarding, (d) => `${d.percent}%`), note: ob ? (remaining.length ? `${remaining.length} item${remaining.length === 1 ? "" : "s"} remaining` : "Every item done") : "Setup checklist" },
    {
      label: "Buildings",
      value: val(buildings, (d) => String(d.length)),
      note: buildings.data ? [buildings.data.map((b) => b.name).join(" · "), `${buildings.data.filter((b) => b.liftPresent).length} with lifts`].filter(Boolean).join(" · ") : "Wings and towers",
    },
    { label: "Charge heads", value: canHeads ? val(heads, (d) => String(d.filter((h) => h.active).length)) : "—", note: canHeads ? "Active heads billed each run" : "Needs a billing permission" },
    {
      label: "Bank accounts",
      value: val(banks, (d) => String(d.filter((b) => b.active).length)),
      note: banks.data ? [...new Set(banks.data.filter((b) => b.active).map((b) => b.purpose.toLowerCase()))].join(", ") || "None yet" : "Where collections are banked",
    },
  ];

  return (
    <>
      <LiveStatGrid stats={stats} />
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHead
          title="Go-live checklist"
          sub={profile.data?.status === "LIVE" ? `Live since ${formatDate(profile.data.wentLiveAt)}. Items not required to go live can be finished any time.` : "Items marked required must be done before the society goes live."}
          right={profile.data ? <Pill label={profile.data.status === "LIVE" ? "Live" : profile.data.status === "DRAFT" ? "Draft" : "Suspended"} kind={profile.data.status === "LIVE" ? "ok" : profile.data.status === "DRAFT" ? "warn" : "bad"} /> : undefined}
        />
        <DataBoundary state={toLoadState(onboarding)} skeleton={<div style={{ padding: 20 }} aria-busy="true"><SkeletonText lines={6} /></div>}>
          {(d) => <Checklist data={d} />}
        </DataBoundary>
      </div>
    </>
  );
}

function Checklist({ data }: { data: Onboarding }) {
  const navigate = useNavigate();
  const blocking = data.items.filter((i) => i.requiredForLive && !i.done).length;
  return (
    <div>
      <div style={{ padding: "16px 20px 6px" }}>
        <div style={{ height: 8, borderRadius: 999, background: "var(--subtle,#EDF1EF)", overflow: "hidden" }} role="progressbar" aria-valuenow={data.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Setup complete">
          <div style={{ width: `${data.percent}%`, height: "100%", background: "var(--accent,#0E6B5C)", borderRadius: 999, transformOrigin: "left", animation: "grow .6s cubic-bezier(.2,.7,.3,1)" }} />
        </div>
        <div style={{ marginTop: 8, font: "500 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
          {data.percent}% complete{blocking ? ` · ${blocking} required item${blocking === 1 ? "" : "s"} left before going live` : data.canGoLive ? " · ready to go live" : ""}
        </div>
      </div>
      {data.items.map((i) => {
        const fix = FIX[i.key];
        return (
          <div key={i.key} style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", gap: 13 }}>
            <Tick done={i.done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 13.5px/1.35 Figtree, sans-serif", color: i.done ? "var(--ink-soft,#5A6B66)" : "var(--ink,#0F1A17)" }}>{i.label}</div>
              {i.hint && <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{i.hint}</div>}
            </div>
            {i.requiredForLive && !i.done && <Pill label="Required" kind="warn" />}
            {!i.done && fix && (
              <button type="button" onClick={() => navigate(fix.to)} className="press-scale focus-ring" style={{ height: 32, padding: "0 12px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer", whiteSpace: "nowrap" }}>
                {fix.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Tick({ done }: { done: boolean }) {
  return (
    <span aria-label={done ? "Done" : "Not done"} style={{ width: 22, height: 22, flex: "none", borderRadius: "50%", border: done ? 0 : "1.5px solid var(--border-strong,#CCD6D2)", background: done ? "var(--ok,#167A3C)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {done && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 5 5 9-10" />
        </svg>
      )}
    </span>
  );
}
