import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "../app/ThemeProvider";
import { useAdminStore } from "../store/AdminStore";
import { NAV } from "../mock/nav";
import { SOCIETIES } from "../mock/societies";
import { NOTIFS } from "../mock/dashboard";
import { Toaster } from "../components/Toaster";
import { ModalShell } from "../components/ModalShell";

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
        <Sidebar narrow={narrow} onNavigate={() => narrow && setRailOpen(false)} onOpenSocieties={() => setSocietyOpen(true)} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar narrow={narrow} onOpenRail={() => setRailOpen(true)} onOpenNotifs={() => setNotifOpen(true)} />
        <main style={{ flex: 1, padding: "26px 28px 72px", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>

      {societyOpen && <SocietyModal onClose={() => setSocietyOpen(false)} />}
      {notifOpen && <NotifDrawer onClose={() => setNotifOpen(false)} />}
      <Toaster />
    </div>
  );
}

function Sidebar({
  narrow,
  onNavigate,
  onOpenSocieties,
}: {
  narrow: boolean;
  onNavigate: () => void;
  onOpenSocieties: () => void;
}) {
  const { state } = useAdminStore();
  const society = SOCIETIES[state.societyIndex];

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
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--rail-line,#E3E9E6)", background: "var(--rail-foot,#F7F9F8)", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ width: 24, height: 24, flex: "none", borderRadius: 7, background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>{society.mark}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", font: "600 12.5px/1.3 Figtree, sans-serif", color: "var(--rail-ink,#0F1A17)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{society.name}</span>
            <span style={{ display: "block", font: "500 10.5px/1.3 Figtree, sans-serif", color: "var(--rail-soft,#5A6B66)" }}>
              {society.units} units · {society.city}
            </span>
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rail-soft,#5A6B66)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 10 5 5 5-5" />
          </svg>
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
                  {n.badge && (
                    <span style={{ flex: "none", padding: "1px 7px", borderRadius: 999, background: isActive ? "var(--accent,#0E6B5C)" : "var(--subtle,#EDF1EF)", color: isActive ? "#ffffff" : "var(--ink-soft,#4A5B56)", font: "700 10.5px/1.6 Figtree, sans-serif" }}>
                      {n.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ),
        )}
      </nav>

      <div style={{ flex: "none", padding: "14px 16px", borderTop: "1px solid var(--rail-line,#E3E9E6)", background: "var(--rail-foot,#F7F9F8)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--accent-wash,#E6F2EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)" }}>SP</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", font: "600 12.5px/1.3 Figtree, sans-serif", color: "var(--rail-ink,#0F1A17)" }}>Sanjay Patil</span>
          <span style={{ display: "block", font: "500 10.5px/1.3 Figtree, sans-serif", color: "var(--rail-soft,#5A6B66)" }}>Secretary · full access</span>
        </span>
      </div>
    </aside>
  );
}

function TopBar({ narrow, onOpenRail, onOpenNotifs }: { narrow: boolean; onOpenRail: () => void; onOpenNotifs: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <header className="theme-transition" style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--canvas,#F7F9F8)", borderBottom: "1px solid var(--border,#E3E9E6)", padding: "12px 28px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {narrow && (
        <button type="button" onClick={onOpenRail} title="Menu" className="press-scale" style={{ width: 38, height: 38, flex: "none", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 38, padding: "0 13px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", flex: 1, minWidth: 180, maxWidth: 420 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.4-4.4" />
        </svg>
        <input type="text" placeholder="Search unit, member, bill or ticket" style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "400 14px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", outline: "none" }} />
        <span style={{ font: "500 11px/1 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)", background: "var(--subtle,#F1F4F3)", padding: "3px 6px", borderRadius: 5 }}>⌘K</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", borderRadius: 999, background: "var(--ok-wash,#E8F5EC)", font: "600 12px/1 Figtree, sans-serif", color: "var(--ok-ink,#14663A)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#167A3C" }} />
          FY 2026-27 open
        </span>
        <button type="button" onClick={toggleTheme} title={dark ? "Switch to light" : "Switch to dark"} className="press-scale" style={{ width: 38, height: 38, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        <button type="button" onClick={onOpenNotifs} className="press-scale" style={{ position: "relative", width: 38, height: 38, border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
          <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--bad,#C0342B)", border: "1.5px solid var(--surface,#fff)" }} />
        </button>
      </div>
    </header>
  );
}

function SocietyModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch, toast } = useAdminStore();
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
        You administer {SOCIETIES.length} societies. Switching reloads every screen against that society's data.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {SOCIETIES.map((soc, i) => {
          const current = i === state.societyIndex;
          return (
            <button
              key={soc.name}
              type="button"
              onClick={() => {
                if (current) {
                  onClose();
                  return;
                }
                dispatch({ type: "switchSociety", index: i });
                onClose();
                navigate("/");
                toast(`Switched to ${soc.name}. Every screen now shows their data.`, "ok");
              }}
              className="press-scale"
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
              <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: current ? "var(--accent,#0E6B5C)" : "var(--subtle,#EDF1EF)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px/1 Figtree, sans-serif", color: current ? "#ffffff" : "var(--ink-soft,#4A5B56)" }}>{soc.mark}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px/1.3 Figtree, sans-serif", color: "var(--ink,#0F1A17)", marginBottom: 2 }}>{soc.name}</div>
                <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
                  {soc.units} units · {soc.city} · {soc.role}
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

function NotifDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,26,23,.4)", display: "flex", justifyContent: "flex-end", animation: "veilIn .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(400px,92vw)", height: "100%", background: "var(--surface,#fff)", boxShadow: "-16px 0 50px -20px rgba(15,26,23,.36)", display: "flex", flexDirection: "column", animation: "drawerIn .28s cubic-bezier(.2,.7,.3,1)" }}>
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, font: "700 17px/1.3 Figtree, sans-serif", letterSpacing: "-.015em" }}>Notifications</span>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, border: 0, borderRadius: 9, background: "var(--canvas,#F7F9F8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft,#5A6B66)" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {NOTIFS.map((n, i) => (
            <div key={i} className="row-hover" style={{ padding: "14px 22px", borderBottom: "1px solid var(--border-soft,#F5F7F6)", display: "flex", gap: 12, cursor: "pointer" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", marginTop: 6, background: n.dot }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif" }}>{n.t}</div>
                <div style={{ marginTop: 3, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{n.b}</div>
                <div style={{ marginTop: 5, font: "500 11px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
