import { useState, type CSSProperties } from "react";
import { KANBAN, TICKET_CATEGORIES, TICKET_PRIORITIES } from "../../mock/helpdesk";
import { PANELS } from "../../mock/panels";
import { PanelModal } from "../../components/PanelModal";
import { ModalShell, ModalHeader, ModalFooter, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { useAdminStore } from "../../store/AdminStore";

/**
 * Helpdesk kanban — one of the three screens the README places outside the
 * generic template; "New ticket" is a real create form (category,
 * description, priority with its SLA) that prepends a card to Open.
 */
export function HelpdeskPage() {
  const { state } = useAdminStore();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  const columns = KANBAN.map((col, i) => (i === 0 ? { ...col, count: col.count + state.newTickets.length, cards: [...state.newTickets, ...col.cards] } : col));

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>Helpdesk</h1>
          <p style={{ margin: 0, font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>31 open · SLA compliance 84% this month · avg resolution 9.2 h</p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button type="button" onClick={() => setAnalyticsOpen(true)} style={secondaryBtn}>Analytics</button>
          <button type="button" onClick={() => setTicketOpen(true)} style={primaryBtn}>New ticket</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, alignItems: "start" }}>
        {columns.map((col) => (
          <div key={col.title} style={{ background: "var(--canvas-deep,#EFF3F1)", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 12px" }}>
              <span style={{ font: "700 12.5px/1 Figtree, sans-serif", letterSpacing: ".02em" }}>{col.title}</span>
              <span style={{ padding: "1px 8px", borderRadius: 999, background: "var(--surface,#fff)", font: "700 11px/1.7 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{col.count}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {col.cards.map((c) => (
                <div key={c.id} style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 11, padding: 13, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                    <span style={{ font: "500 10.5px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)" }}>{c.id}</span>
                    <span style={{ padding: "1px 7px", borderRadius: 5, background: c.slaBg, color: c.slaFg, font: "700 10px/1.7 Figtree, sans-serif" }}>{c.sla}</span>
                  </div>
                  <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", marginBottom: 6 }}>{c.title}</div>
                  <div style={{ font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{c.meta}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {analyticsOpen && <PanelModal panel={PANELS.helpdesk} onClose={() => setAnalyticsOpen(false)} />}
      {ticketOpen && <NewTicketModal onClose={() => setTicketOpen(false)} />}
    </div>
  );
}

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = useAdminStore();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [cat, setCat] = useState("Lift");
  const [pri, setPri] = useState("Normal");
  const [err, setErr] = useState<"title" | "unit" | null>(null);

  const save = () => {
    if (!title.trim()) {
      setErr("title");
      toast("Describe the problem so it can be routed.", "warn");
      return;
    }
    if (!unit.trim()) {
      setErr("unit");
      toast("A unit is needed — tickets are raised against a flat.", "warn");
      return;
    }
    const slaMap: Record<string, { sla: string; bg: string; fg: string }> = {
      Emergency: { sla: "1 h left", bg: "var(--bad-wash,#FCEDEC)", fg: "var(--bad-ink,#9B2B22)" },
      Urgent: { sla: "4 h left", bg: "var(--warn-wash,#FDF3E7)", fg: "var(--warn-ink,#8F4A0A)" },
      Normal: { sla: "24 h left", bg: "var(--subtle,#EDF1EF)", fg: "var(--ink-soft,#4A5B56)" },
    };
    const s = slaMap[pri];
    dispatch({
      type: "addTicket",
      card: { id: "TKT/" + (1189 + Math.floor(Math.random() * 100)), title: title.trim(), meta: `${cat} · ${unit.trim()} · just now`, sla: s.sla, slaBg: s.bg, slaFg: s.fg },
    });
    toast(`Ticket raised against ${unit.trim()} · ${pri.toLowerCase()}.`, "ok");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={500}>
      <ModalHeader title="New ticket" onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>Raised on behalf of a resident. It lands in Open and the SLA clock starts immediately.</div>
      <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>What is wrong?</div>
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setErr(null);
        }}
        placeholder="Lift stuck between 4 and 5"
        style={inputStyle(err === "title")}
      />
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Unit</div>
      <input
        type="text"
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value.toUpperCase());
          setErr(null);
        }}
        placeholder="B-0902"
        style={{ ...inputStyle(err === "unit"), font: "600 15px/1 'IBM Plex Mono',monospace" }}
      />
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Category</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {TICKET_CATEGORIES.map((c) => {
          const active = cat === c;
          return (
            <button key={c} type="button" onClick={() => setCat(c)} style={pickStyle(active)}>
              {c}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Priority</div>
      <div style={{ display: "flex", gap: 8 }}>
        {TICKET_PRIORITIES.map((p) => {
          const active = pri === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPri(p.key)}
              style={{ flex: 1, height: 54, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? pillBg(p.key) : "var(--surface,#fff)", color: active ? pillFg(p.key) : "var(--ink,#0F1A17)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}
            >
              <span style={{ font: "600 13px/1 Figtree, sans-serif" }}>{p.key}</span>
              <span style={{ font: "400 11px/1 Figtree, sans-serif", opacity: 0.8 }}>SLA {p.sla}</span>
            </button>
          );
        })}
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}>Raise ticket</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

function pillBg(pri: string): string {
  return pri === "Emergency" ? "var(--bad-wash,#FCEDEC)" : pri === "Urgent" ? "var(--warn-wash,#FDF3E7)" : "var(--subtle,#EDF1EF)";
}
function pillFg(pri: string): string {
  return pri === "Emergency" ? "var(--bad-ink,#9B2B22)" : pri === "Urgent" ? "var(--warn-ink,#8F4A0A)" : "var(--ink-soft,#4A5B56)";
}
function inputStyle(bad: boolean): CSSProperties {
  return { width: "100%", height: 46, padding: "0 14px", border: `1px solid ${bad ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: "var(--surface,#fff)", color: "var(--ink,#0F1A17)", font: "500 14.5px/1 Figtree, sans-serif", outline: "none" };
}
function pickStyle(active: boolean): CSSProperties {
  return { height: 42, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)", color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" };
}

const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
