import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useAdminStore } from "../../store/AdminStore";
import { MDAYS, STAFF_ROLES } from "../../mock/staff";
import { money } from "../../lib/format";
import { ModalShell, ModalHeader, ModalFooter, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { listRowStyle, taggedCardStyle } from "../../lib/motion";

/**
 * Staff & help — the 30-column clickable attendance sheet (README section
 * 2, "Staff & help"). Every cell cycles present → absent → weekly off on
 * click; the four stat cards below are derived from the sheet, never
 * stored, so they can never disagree with what a click just changed.
 */
export function StaffPage() {
  const { state, dispatch, toast } = useAdminStore();
  const [role, setRole] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const roleChips = ["All", ...STAFF_ROLES.filter((r) => state.staff.some((p) => p.role === r))];
  const rows = state.staff.filter((p) => role === "All" || p.role === role);

  const stats = useMemo(() => {
    const ppl = state.staff;
    const totalPresent = ppl.reduce((t, p) => t + p.days.filter((d) => d === 1).length, 0);
    const payable = ppl.reduce((t, p) => t + Math.round((p.salary / MDAYS) * p.days.filter((d) => d === 1).length), 0);
    const absent = ppl.reduce((t, p) => t + p.days.filter((d) => d === 0).length, 0);
    return [
      { label: "Registered", value: String(ppl.length), note: `${ppl.filter((p) => p.role === "Housekeeping").length} housekeeping · ${ppl.filter((p) => p.role !== "Housekeeping").length} other` },
      { label: "Attendance", value: `${Math.round((totalPresent / (ppl.length * MDAYS)) * 100)}%`, note: `${totalPresent} of ${ppl.length * MDAYS} person-days` },
      { label: "Absences", value: String(absent), note: "logged by the gate, not claimed" },
      { label: "Payable this month", value: money(payable), note: "pro-rated on days present" },
    ];
  }, [state.staff]);

  const exportCsv = () => {
    const header = ["Name", "Role", "Pass", ...Array.from({ length: MDAYS }, (_, i) => String(i + 1)), "Present", "Payable"];
    const lines = state.staff.map((p) => {
      const present = p.days.filter((d) => d === 1).length;
      const payable = Math.round((p.salary / MDAYS) * present);
      const dayCells = p.days.map((d) => (d === 1 ? "P" : d === 0 ? "A" : "O"));
      return [p.name, p.role, p.pass, ...dayCells, `${present}/${MDAYS}`, String(payable)].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-september-2026.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("September attendance sheet exported as CSV.", "ok");
  };

  const active = state.staff.find((p) => p.id === activeId) ?? null;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>Staff &amp; help</h1>
          <p style={{ margin: 0, maxWidth: "66ch", font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Attendance comes from the gate's own in-and-out, not a register. September, {MDAYS} days elapsed.</p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" onClick={exportCsv} className="press-scale" style={secondaryBtn}>Export sheet</button>
          <button type="button" onClick={() => setAddOpen(true)} className="press-scale" style={primaryBtn}>Add staff</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="hover-lift theme-transition"
            style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, padding: "16px 18px", ...taggedCardStyle(i) }}
          >
            <div style={{ font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", marginBottom: 10 }}>{s.label}</div>
            <div style={{ font: "700 22px/1 Figtree, sans-serif", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            <div style={{ marginTop: 8, font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ font: "700 15px/1 Figtree, sans-serif", marginRight: "auto", whiteSpace: "nowrap" }}>Attendance sheet</span>
          {roleChips.map((r) => {
            const activeChip = role === r;
            return (
              <button key={r} type="button" onClick={() => setRole(r)} className="press-scale" style={{ height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${activeChip ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, background: activeChip ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)", color: activeChip ? "#fff" : "var(--ink,#0F1A17)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
                {r}
              </button>
            );
          })}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                <th style={{ padding: "11px 16px", textAlign: "left", font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--canvas,#F7F9F8)", zIndex: 1, minWidth: 186 }}>Person</th>
                {Array.from({ length: MDAYS }, (_, i) => (
                  <th key={i} style={{ padding: "11px 0", textAlign: "center", font: "600 10px/1 'IBM Plex Mono',monospace", color: (i + 1) % 7 === 0 ? "var(--ink-dim,#A8B5B0)" : "var(--ink-soft,#5A6B66)", width: 22 }}>{i + 1}</th>
                ))}
                <th style={{ padding: "11px 16px", textAlign: "right", font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>Present</th>
                <th style={{ padding: "11px 20px 11px 16px", textAlign: "right", font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>Payable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, ri) => {
                const present = p.days.filter((d) => d === 1).length;
                const payable = Math.round((p.salary / MDAYS) * present);
                return (
                  <tr key={p.id} className="row-hover" style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)", ...listRowStyle(ri) }}>
                    <td style={{ padding: "11px 16px", position: "sticky", left: 0, background: "var(--surface,#fff)", zIndex: 1, minWidth: 186 }}>
                      <button type="button" onClick={() => setActiveId(p.id)} className="press-scale" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", display: "block", maxWidth: "100%" }}>
                        <span style={{ display: "block", font: "600 13.5px/1.3 Figtree, sans-serif", color: "var(--ink,#0F1A17)", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ display: "block", font: "400 11.5px/1.35 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", whiteSpace: "nowrap" }}>{p.role} · {p.pass}</span>
                      </button>
                    </td>
                    {p.days.map((d, i) => (
                      <td key={i} style={{ padding: 0, textAlign: "center" }}>
                        <button
                          type="button"
                          title={`${p.name} · ${i + 1} Sep · ${d === 1 ? "present" : d === 0 ? "absent" : "weekly off"}`}
                          onClick={() => {
                            dispatch({ type: "toggleStaffDay", id: p.id, dayIdx: i });
                            const next = d === 1 ? 0 : d === 0 ? 2 : 1;
                            toast(`${p.name} · ${i + 1} Sep marked ${next === 1 ? "present" : next === 0 ? "absent" : "weekly off"}.`, "ok");
                          }}
                          className="press-scale"
                          style={{ width: 20, height: 22, margin: "1px auto", display: "block", border: 0, borderRadius: 4, background: d === 1 ? "var(--ok-wash,#E8F5EC)" : d === 0 ? "var(--bad-wash,#FCEDEC)" : "var(--subtle,#EDF1EF)", cursor: "pointer" }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "11px 16px", textAlign: "right", font: "600 13.5px/1.3 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{present}/{MDAYS}</td>
                    <td style={{ padding: "11px 20px 11px 16px", textAlign: "right", font: "600 13.5px/1.3 'IBM Plex Mono',monospace", whiteSpace: "nowrap" }}>{money(payable)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border-soft,#EDF1EF)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Legend bg="var(--ok-wash,#E8F5EC)" label="Present" />
          <Legend bg="var(--bad-wash,#FCEDEC)" label="Absent" />
          <Legend bg="var(--subtle,#EDF1EF)" label="Weekly off" />
          <span style={{ marginLeft: "auto", font: "400 12.5px/1.4 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>Click any cell to correct it. Corrections are logged against your name.</span>
        </div>
      </div>

      {addOpen && <AddStaffModal onClose={() => setAddOpen(false)} />}
      {active && (
        <StaffDetailModal
          name={active.name}
          role={active.role}
          rows={[
            { label: "Staff pass", value: active.pass },
            { label: "Works at", value: active.flats },
            { label: "Phone", value: active.phone },
            { label: "Police verification", value: active.verified },
            { label: "Monthly salary", value: money(active.salary) },
            { label: "Days present", value: `${active.days.filter((d) => d === 1).length} of ${MDAYS}` },
            { label: "Payable", value: money(Math.round((active.salary / MDAYS) * active.days.filter((d) => d === 1).length)) },
          ]}
          onClose={() => setActiveId(null)}
          onRevoke={() => {
            dispatch({ type: "revokeStaff", id: active.id });
            setActiveId(null);
            toast(`${active.name}'s pass revoked. The gate can no longer admit them.`, "warn");
          }}
        />
      )}
    </div>
  );
}

function Legend({ bg, label }: { bg: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "400 12.5px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
      <span style={{ width: 13, height: 13, borderRadius: 4, background: bg }} />
      {label}
    </span>
  );
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = useAdminStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Housekeeping");
  const [flats, setFlats] = useState("");
  const [phone, setPhone] = useState("");
  const [salary, setSalary] = useState("");

  const rateNote = (() => {
    const n = parseInt(salary || "0", 10);
    return n ? `${money(n)} over ${MDAYS} days is ${money(Math.round(n / MDAYS))} a day.` : "Attendance is pro-rated on this, so the per-day rate is never in dispute.";
  })();

  const save = () => {
    if (!name.trim()) {
      toast("A name is needed.", "warn");
      return;
    }
    if (!salary) {
      toast("Enter the agreed monthly salary.", "warn");
      return;
    }
    const pass = "ST-" + String(1000 + Math.floor(Math.random() * 8999));
    dispatch({
      type: "addStaff",
      person: { id: "s" + Date.now(), name: name.trim(), role, pass, flats: flats.trim() || "Not assigned", phone: phone.trim() || "—", verified: "Pending", salary: parseInt(salary, 10), days: new Array(MDAYS).fill(2) },
    });
    toast(`${name.trim()} registered · pass ${pass} issued.`, "ok");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={500}>
      <ModalHeader title="Add staff" onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 20 }}>A standing pass, not a visitor code. The gate's in-and-out becomes their attendance.</div>
      <Field label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name as on the ID" style={inputStyle} />
      </Field>
      <Field label="Role">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {STAFF_ROLES.map((r) => {
            const active = role === r;
            return (
              <button key={r} type="button" onClick={() => setRole(r)} className="press-scale" style={{ height: 42, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)", color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
                {r}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Works at">
        <input type="text" value={flats} onChange={(e) => setFlats(e.target.value.toUpperCase())} placeholder="A-1204, B-702" style={{ ...inputStyle, font: "600 14.5px/1 'IBM Plex Mono',monospace" }} />
      </Field>
      <Field label="Phone">
        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" style={inputStyle} />
      </Field>
      <Field label="Monthly salary">
        <input type="text" value={salary} onChange={(e) => setSalary(e.target.value.replace(/[^0-9]/g, ""))} placeholder="5200" style={{ ...inputStyle, font: "600 14.5px/1 'IBM Plex Mono',monospace" }} />
      </Field>
      <div style={{ marginTop: 9, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{rateNote}</div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}>Register and issue pass</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

function StaffDetailModal({
  name,
  role,
  rows,
  onClose,
  onRevoke,
}: {
  name: string;
  role: string;
  rows: { label: string; value: string }[];
  onClose: () => void;
  onRevoke: () => void;
}) {
  return (
    <ModalShell onClose={onClose} maxWidth={430}>
      <div style={{ font: "700 21px/1.25 Figtree, sans-serif", letterSpacing: "-.02em", marginBottom: 3 }}>{name}</div>
      <div style={{ font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>{role}</div>
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ font: "400 13px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.label}</span>
            <span style={{ font: "600 13.5px/1.3 Figtree, sans-serif", textAlign: "right" }}>{r.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" onClick={onRevoke} className="press-scale" style={{ height: 44, padding: "0 18px", border: "1px solid var(--bad-border,#F6D9D6)", borderRadius: 11, background: "var(--surface,#fff)", color: "var(--bad-ink,#9B2B22)", font: "600 14.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
          Revoke pass
        </button>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>{label}</div>
      {children}
    </>
  );
}

const inputStyle: CSSProperties = { width: "100%", height: 46, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 11, background: "var(--surface,#fff)", font: "500 14.5px/1 Figtree, sans-serif", outline: "none", color: "var(--ink,#0F1A17)" };
const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
