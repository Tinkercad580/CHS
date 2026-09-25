import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/ApiTable";
import { cardStyle } from "../../lib/uiStyles";
import { primaryBtnStyle, secondaryBtnStyle } from "../../lib/tableKit";

/**
 * A URL the console has no screen for — a mistyped address, an old
 * bookmark, a link from an email for a screen that has moved. It says so,
 * names the address, and offers a way back, instead of an empty main area.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title="Page not found" sub="The console has no screen at this address." />
      <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>Nothing lives at this address</div>
        <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>
          <span style={{ font: "500 13px/1.5 'IBM Plex Mono',monospace", overflowWrap: "anywhere" }}>{pathname}</span> may be mistyped, or the link is out of date.
        </div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(-1)} className="press-scale focus-ring" style={secondaryBtnStyle}>
            Go back
          </button>
          <button type="button" onClick={() => navigate("/")} className="press-scale focus-ring" style={primaryBtnStyle}>
            Open the dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
