import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "../app/ThemeProvider";
import { useAdminStore } from "../store/AdminStore";
import { NAV } from "../mock/nav";
import { useApiQuery, useSessionController } from "@chs/api-client/react";
import { api } from "@chs/contract";
import { accessSummary, holds, initials, societyMark, useConsoleMe, useCurrentSociety } from "../api/society";
import { Spinner } from "../components/Spinner";
import { Toaster } from "../components/Toaster";
import { ModalShell } from "../components/ModalShell";
import { AccountModal, EmailBanner } from "../features/account/AccountPanels";
import { NotificationsDrawer } from "../features/account/NotificationsDrawer";
import { useUnreadCount } from "../features/account/notifications";
import { fyLabel } from "../lib/money";
import { GlobalSearch } from "./GlobalSearch";

const BREAKPOINT = 1100;

/**
 * The admin shell: 246px sticky sidebar + sticky top bar, collapsing to a
 * fixed overlay drawer below 1100px (README, "Responsive" table). The
 * breakpoint is tracked with a resize listener, not a media query, because
 * the sidebar changes from a layout participant to an overlay.
 */
export function AdminLayout() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < BREAKPOINT);
  const [railOpen, setRailOpen] = useState(false);
  const [societyOpen, setSocietyOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const n = window.innerWidth < BREAKPOINT;
      setNarrow((cur) => {
        if (cur === n) return cur;
        setRailOpen(false);
        return n;
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // Escape closes the rail and any open overlays, matching the prototype.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRailOpen(false);
        setSocietyOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const railVisible = !narrow || railOpen;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas,#F7F9F8)", fontFamily: "var(--font-sans)" }}>
      {narrow && railOpen && (
        <div
          onClick={() => setRailOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(9,14,13,.42)", animation: "veilIn .2s ease" }}
        />
      )}

      {railVisible && (
        <Sidebar narrow={narrow} onNavigate={() => narrow && setRailOpen(false)} onOpenSocieties={() => setSocietyOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar narrow={narrow} onOpenRail={() => setRailOpen(true)} onOpenNotifs={() => setNotifOpen(true)} />
        <main style={{ flex: 1, padding: "26px 28px 72px", minWidth: 0 }}>
          <EmailBanner />
          <Outlet />
        </main>
      </div>

      {societyOpen && <SocietyModal onClose={() => setSocietyOpen(false)} />}
      {notifOpen && <NotificationsDrawer onClose={() => setNotifOpen(false)} />}
      {settingsOpen && <AccountModal onClose={() => setSettingsOpen(false)} />}
      <Toaster />
    </div>
  );
}

function Sidebar({
  narrow,
  onNavigate,
  onOpenSocieties,
  onOpenSettings,
}: {
  narrow: boolean;
  onNavigate: () => void;
  onOpenSocieties: () => void;
  onOpenSettings: () => void;
}) {
  const me = useConsoleMe();
  const { society, societies } = useCurrentSociety();
  const badges = useNavBadges();

  const railStyle = narrow
    ? {
        width: 262,
        flex: "none" as const,
        position: "fixed" as const,
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 70,
        overflow: "hidden",
        borderRight: "1px solid var(--rail-line,#E3E9E6)",
        boxShadow: "0 24px 60px -20px rgba(15,26,23,.4)",
        animation: "railIn .26s var(--ease-out,cubic-bezier(.22,1,.36,1)) both",
      }
    : { width: 246, flex: "none" as const, position: "sticky" as const, top: 0, height: "100vh", overflow: "hidden", borderRight: "1px solid var(--rail-line,#E3E9E6)" };

  return (
    <aside className="theme-transition" style={{ ...railStyle, background: "var(--rail,#FFFFFF)", color: "var(--rail-ink,#0F1A17)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "none", padding: "20px 18px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent,#0E6B5C)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V8l7-5 7 5v13" />
            <path d="M9 21v-5h6v5" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "700 14px/1.2 Figtree, sans-serif", color: "var(--rail-ink,#0F1A17)" }}>Sahaj</div>
          <div style={{ font: "500 11px/1.3 Figtree, sans-serif", color: "var(--rail-soft,#5A6B66)" }}>Admin console</div>
        </div>
      </div>

      <div style={{ flex: "none", padding: "0 12px 14px" }}>
        <button
          type="button"
          onClick={onOpenSocieties}
          disabled={societies.length < 2}
          title={societies.length < 2 ? undefined : "Switch society"}
          className="focus-ring"
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--rail-line,#E3E9E6)", background: "var(--rail-foot,#F7F9F8)", cursor: societies.length < 2 ? "default" : "pointer", textAlign: "left" }}
        >
          <span style={{ width: 24, height: 24, flex: "none", borderRadius: 7, background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>{society ? societyMark(society.societyName) : "—"}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", font: "600 12.5px/1.3 Figtree, sans-serif", color: "var(--rail-ink,#0F1A17)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{society ? society.societyName : "No society"}</span>
            <span style={{ display: "block", font: "500 10.5px/1.3 Figtree, sans-serif", color: "var(--rail-soft,#5A6B66)" }}>
              {society ? [`${society.unitCount} units`, society.city].filter(Boolean).join(" · ") : "Platform administrator"}
            </span>
          </span>
          {societies.length > 1 && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rail-soft,#5A6B66)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 10 5 5 5-5" />
            </svg>
          )}
        </button>
      </div>

      <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 10px 20px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) =>
          "group" in n ? (
            <div key={n.group} style={{ padding: "15px 12px 6px", font: "600 10px/1 Figtree, sans-serif", letterSpacing: ".13em", textTransform: "uppercase", color: "var(--rail-soft,#5A6B66)" }}>
              {n.group}
            </div>
          ) : (
            <NavLink
              key={n.key}
              to={n.key === "dash" ? "/" : `/${n.key}`}
              onClick={onNavigate}
              style={({ isActive }) => ({
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                border: 0,
                borderRadius: 9,
                cursor: "pointer",
                textAlign: "left",
                background: isActive ? "var(--rail-active,#E6F2EF)" : "transparent",
                color: isActive ? "var(--rail-active-ink,#0A5749)" : "var(--rail-soft,#5A6B66)",
                font: "600 13px/1.35 Figtree, sans-serif",
                textDecoration: "none",
              })}
              end={n.key === "dash"}
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <span style={{ width: 3, height: 16, borderRadius: 2, flex: "none", background: isActive ? "var(--accent,#0E6B5C)" : "transparent" }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
                  {badges[n.key] && (
                    <span style={{ flex: "none", padding: "1px 7px", borderRadius: 999, background: isActive ? "var(--accent,#0E6B5C)" : "var(--subtle,#EDF1EF)", color: isActive ? "#ffffff" : "var(--ink-soft,#4A5B56)", font: "700 10.5px/1.6 Figtree, sans-serif" }}>
                      {badges[n.key]}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ),
        )}
      </nav>

      <div style={{ flex: "none", padding: "14px 12px 14px 16px", borderTop: "1px solid var(--rail-line,#E3E9E6)", background: "var(--rail-foot,#F7F9F8)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>{initials(me.name)}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", font: "600 12.5px/1.3 Figtree, sans-serif", color: "var(--rail-ink,#0F1A17)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.name}</span>
          <span style={{ display: "block", font: "500 10.5px/1.3 Figtree, sans-serif", color: "var(--rail-soft,#5A6B66)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {society ? accessSummary(society) : "Platform administrator"}
          </span>
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Your account: notifications, password, devices, two-factor"
          aria-label="Your account"
          className="press-scale focus-ring"
          style={{ width: 32, height: 32, flex: "none", border: "1px solid var(--rail-line,#E3E9E6)", borderRadius: 9, background: "var(--rail,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rail-soft,#5A6B66)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </button>
        <SignOutButton />
      </div>
    </aside>
  );
}

function TopBar({ narrow, onOpenRail, onOpenNotifs }: { narrow: boolean; onOpenRail: () => void; onOpenNotifs: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const unread = useUnreadCount();

  return (
    <header className="theme-transition" style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--canvas,#F7F9F8)", borderBottom: "1px solid var(--border,#E3E9E6)", padding: "12px 28px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {narrow && (
        <button type="button" onClick={onOpenRail} title="Menu" aria-label="Menu" className="press-scale" style={{ width: 38, height: 38, flex: "none", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      <GlobalSearch />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
        <FyChip />
        <button type="button" onClick={toggleTheme} title={dark ? "Switch to light" : "Switch to dark"} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} className="press-scale" style={{ width: 38, height: 38, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.6 5.4 16.9 7.1M7.1 16.9 5.4 18.6M18.6 18.6 16.9 16.9M7.1 7.1 5.4 5.4" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5 8.8 8.8 0 1 0 20.5 14.3Z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenNotifs}
          title="Notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="press-scale"
          style={{ position: "relative", width: 38, height: 38, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--bad,#C0342B)", border: "1.5px solid var(--surface,#fff)" }} />}
        </button>
      </div>
    </header>
  );
}

/**
 * The society's current financial year, from its profile's start month
 * (`society.get`) and today's date in India. The design's chip also said
 * "open"; nothing in the API closes a year yet, so it says only which year.
 */
function FyChip() {
  const { society } = useCurrentSociety();
  const profile = useApiQuery(api.society.get, { params: { societyId: society?.societyId ?? "" } }, { enabled: Boolean(society) });
  if (!profile.data) return null;
  return (
    <span title="Current financial year" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", borderRadius: 999, background: "var(--ok-wash,#E8F5EC)", font: "600 12px/1 Figtree, sans-serif", color: "var(--ok-ink,#14663A)", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok,#167A3C)" }} />
      {fyLabel(profile.data.fyStartMonth)}
    </span>
  );
}

/**
 * Counts beside nav items, from the API. Only Members & units has one today:
 * approvals waiting on the office (`members.approvals` total), for admins
 * who can decide them. The design's other badges belong to modules with no
 * API yet, so they are not shown rather than invented.
 */
function useNavBadges(): Record<string, string> {
  const { society } = useCurrentSociety();
  const canApprove = society ? holds(society, "members.manage") : false;
  const pending = useApiQuery(api.members.approvals, { params: { societyId: society?.societyId ?? "" }, query: { status: "PENDING", limit: 1 } }, { enabled: canApprove });
  const n = pending.data?.total ?? pending.data?.items.length ?? 0;
  return n > 0 ? { members: String(n) } : {};
}

/**
 * Signing out ends this session on the server and empties the cache (the
 * session gate does that on the state change), so the next person to use
 * this browser starts clean. The local sign-out succeeds even offline.
 */
function SignOutButton() {
  const session = useSessionController();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true);
        void session.logout();
      }}
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      className="press-scale focus-ring"
      style={{ width: 32, height: 32, flex: "none", border: "1px solid var(--rail-line,#E3E9E6)", borderRadius: 9, background: "var(--rail,#fff)", cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rail-soft,#5A6B66)" }}
    >
      {busy ? (
        <Spinner size={13} />
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l-5-5 5-5M5 12h11" />
        </svg>
      )}
    </button>
  );
}

function SocietyModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = useAdminStore();
  const { society: currentSociety, societies } = useCurrentSociety();
  const navigate = useNavigate();

  return (
    <ModalShell onClose={onClose} maxWidth={460} zIndex={95}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0, font: "700 21px/1.25 Figtree, sans-serif", letterSpacing: "-.02em" }}>Switch society</div>
        <button type="button" onClick={onClose} title="Close" style={{ width: 32, height: 32, flex: "none", border: 0, borderRadius: 9, background: "var(--canvas,#F7F9F8)", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round">
            <path d="M17 7 7 17M7 7l10 10" />
          </svg>
        </button>
      </div>
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 20 }}>
        You administer {societies.length} {societies.length === 1 ? "society" : "societies"}. Switching reloads every screen against that society's data.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {societies.map((soc) => {
          const current = soc.societyId === currentSociety?.societyId;
          const mark = societyMark(soc.societyName);
          return (
            <button
              key={soc.societyId}
              type="button"
              onClick={() => {
                if (current) {
                  onClose();
                  return;
                }
                dispatch({ type: "switchSociety", societyId: soc.societyId });
                onClose();
                navigate("/");
                toast(`Switched to ${soc.societyName}. Every screen now shows their data.`, "ok");
              }}
              className="press-scale focus-ring"
              style={{
                width: "100%",
                textAlign: "left",
                border: `1px solid ${current ? "var(--accent,#0E6B5C)" : "var(--border,#E3E9E6)"}`,
                borderRadius: 14,
                background: current ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)",
                padding: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 13,
              }}
            >
              <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: current ? "var(--accent,#0E6B5C)" : "var(--subtle,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px/1 Figtree, sans-serif", color: current ? "#ffffff" : "var(--ink-soft,#4A5B56)" }}>{mark}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px/1.3 Figtree, sans-serif", color: "var(--ink,#0F1A17)", marginBottom: 2 }}>{soc.societyName}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                  {[`${soc.unitCount} units`, soc.city, accessSummary(soc)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {current && (
                <span style={{ flex: "none", padding: "3px 9px", borderRadius: 999, background: "var(--surface,#fff)", font: "600 11px/1.4 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>Current</span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onClose} style={{ marginTop: 18, width: "100%", height: 44, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 11, background: "var(--surface,#fff)", font: "600 14.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
        Cancel
      </button>
    </ModalShell>
  );
}
