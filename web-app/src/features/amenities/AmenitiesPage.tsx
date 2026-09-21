import { useState, type CSSProperties } from "react";
import { useAdminStore } from "../../store/AdminStore";
import { CAL_DAYS, CAL_SLOTS } from "../../mock/amenities";
import { money } from "../../lib/format";
import { ModalShell, ModalHeader, ModalFooter, GhostButton, PrimaryButton } from "../../components/ModalShell";

/**
 * Amenities — the booking calendar (three slots × five days) plus the
 * rates table whose status pill doubles as an open/close toggle (README
 * section 2, "Amenities").
 */
export function AmenitiesPage() {
  const { state, dispatch, toast } = useAdminStore();
  const [calFilter, setCalFilter] = useState<"All" | "Confirmed" | "Pending">("All");
  const [addOpen, setAddOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockSeed, setBlockSeed] = useState<{ day: number; slot: number }>({ day: 19, slot: 0 });
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const activeBooking = state.bookings.find((b) => b.id === activeBookingId) ?? null;

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", font: "700 27px/1.2 Figtree, sans-serif", letterSpacing: "-.024em" }}>Amenities</h1>
          <p style={{ margin: 0, maxWidth: "66ch", font: "400 14.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            {state.amenities.length} amenities, {state.bookings.length} bookings this week. Charges land on the resident's next maintenance bill.
          </p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setBlockSeed({ day: 19, slot: 0 });
              setBlockOpen(true);
            }}
            style={secondaryBtn}
          >
            Block a slot
          </button>
          <button type="button" onClick={() => setAddOpen(true)} style={primaryBtn}>Add amenity</button>
        </div>
      </div>

      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ font: "700 15px/1 Figtree, sans-serif", marginRight: "auto", whiteSpace: "nowrap" }}>Booking calendar · 19–23 September</span>
          {(["All", "Confirmed", "Pending"] as const).map((f) => {
            const active = calFilter === f;
            return (
              <button key={f} type="button" onClick={() => setCalFilter(f)} style={{ height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, background: active ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)", color: active ? "#fff" : "var(--ink,#0F1A17)", font: "600 12.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
                {f}
              </button>
            );
          })}
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 760, padding: "18px 20px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "92px repeat(5,1fr)", gap: 9, marginBottom: 9 }}>
              <span />
              {CAL_DAYS.map((d) => (
                <div key={d.n} style={{ textAlign: "center", padding: "7px 0" }}>
                  <div style={{ font: "600 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 4 }}>{d.l}</div>
                  <div style={{ font: "700 17px/1 Figtree, sans-serif", color: d.n === 19 ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)" }}>{d.n}</div>
                </div>
              ))}
            </div>
            {CAL_SLOTS.map((slot, si) => (
              <div key={slot} style={{ display: "grid", gridTemplateColumns: "92px repeat(5,1fr)", gap: 9, marginBottom: 9 }}>
                <div style={{ display: "flex", alignItems: "center", font: "600 11.5px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{slot}</div>
                {CAL_DAYS.map((d) => {
                  const bk = state.bookings.find((b) => b.day === d.n && b.slot === si && (calFilter === "All" || b.state === calFilter));
                  if (!bk) {
                    return (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() => {
                          setBlockSeed({ day: d.n, slot: si });
                          setBlockOpen(true);
                        }}
                        style={{ minHeight: 76, border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, background: "var(--canvas,#F7F9F8)", padding: "9px 10px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 }}
                      >
                        <span style={{ margin: "auto", font: "500 11.5px/1 Figtree, sans-serif", color: "var(--ink-dim,#A8B5B0)" }}>Free</span>
                      </button>
                    );
                  }
                  const pending = bk.state === "Pending";
                  return (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => setActiveBookingId(bk.id)}
                      style={{ minHeight: 76, border: `1px solid ${pending ? "var(--warn-border,#F5DFBE)" : "var(--accent-200,#C9E4DC)"}`, borderRadius: 12, background: pending ? "var(--warn-wash,#FDF3E7)" : "var(--accent-wash,#E6F2EF)", padding: "9px 10px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 4 }}
                    >
                      <span style={{ font: "600 12px/1.3 Figtree, sans-serif", color: "var(--ink,#0F1A17)" }}>{bk.amenity}</span>
                      <span style={{ font: "400 11px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{bk.unit}</span>
                      <span style={{ marginTop: "auto", display: "inline-block", padding: "2px 7px", borderRadius: 5, background: "var(--surface,#fff)", font: "600 10px/1.4 Figtree, sans-serif", color: pending ? "var(--warn-ink,#8F4A0A)" : "var(--accent-ink,#0A5749)", alignSelf: "flex-start" }}>{bk.state}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-soft,#EDF1EF)", font: "700 15px/1 Figtree, sans-serif" }}>Amenities and rates</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
                {["Amenity", "Capacity", "Hours", "Rate", "Deposit", "Status"].map((h, i) => (
                  <th key={h} style={{ padding: i === 5 ? "11px 20px 11px 16px" : "11px 16px", textAlign: i >= 3 ? "right" : "left", font: "600 11px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.amenities.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
                  <td style={{ padding: "13px 16px", font: "600 14px/1.4 Figtree, sans-serif" }}>{a.name}</td>
                  <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{a.capacity}</td>
                  <td style={{ padding: "13px 16px", font: "400 13.5px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{a.open}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", font: "600 13.5px/1.4 'IBM Plex Mono',monospace" }}>{a.rate ? `${money(a.rate)} / ${a.unit}` : "Free"}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", font: "400 13.5px/1.4 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)" }}>{a.deposit ? money(a.deposit) : "—"}</td>
                  <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: "toggleAmenity", id: a.id });
                        const next = a.status === "Open" ? "Closed" : "Open";
                        toast(`${a.name} is now ${next.toLowerCase()} for booking.`, next === "Open" ? "ok" : "warn");
                      }}
                      style={{ padding: "4px 11px", border: `1px solid ${a.status === "Open" ? "var(--ok-wash,#E8F5EC)" : "var(--bad-border,#F6D9D6)"}`, borderRadius: 999, font: "600 11.5px/1.5 Figtree, sans-serif", background: a.status === "Open" ? "var(--ok-wash,#E8F5EC)" : "var(--bad-wash,#FCEDEC)", color: a.status === "Open" ? "var(--ok-ink,#14663A)" : "var(--bad-ink,#9B2B22)", cursor: "pointer" }}
                    >
                      {a.status}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <AddAmenityModal onClose={() => setAddOpen(false)} />}
      {blockOpen && <BlockSlotModal seedDay={blockSeed.day} seedSlot={blockSeed.slot} onClose={() => setBlockOpen(false)} />}
      {activeBooking && (
        <BookingDetailModal
          amenity={activeBooking.amenity}
          rows={[
            { label: "Flat", value: activeBooking.unit },
            { label: "Booked by", value: activeBooking.who },
            { label: "When", value: `${activeBooking.day} Sep · ${CAL_SLOTS[activeBooking.slot]}` },
            { label: "Charge", value: activeBooking.amount ? `${money(activeBooking.amount)} on the next bill` : "No charge" },
          ]}
          pending={activeBooking.state === "Pending"}
          onClose={() => setActiveBookingId(null)}
          onConfirm={() => {
            dispatch({ type: "confirmBooking", id: activeBooking.id });
            toast(`${activeBooking.amenity} confirmed for ${activeBooking.unit}.`, "ok");
            setActiveBookingId(null);
          }}
          onRelease={() => {
            dispatch({ type: "removeBooking", id: activeBooking.id });
            toast(`${activeBooking.amenity} released. ${activeBooking.unit} was told.`, "warn");
            setActiveBookingId(null);
          }}
        />
      )}
    </div>
  );
}

function AddAmenityModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = useAdminStore();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [open, setOpen] = useState("");
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("");

  const save = () => {
    if (!name.trim()) {
      toast("Name the amenity.", "warn");
      return;
    }
    if (!capacity.trim()) {
      toast("Capacity decides how many can book at once.", "warn");
      return;
    }
    dispatch({
      type: "addAmenity",
      amenity: { id: "am" + Date.now(), name: name.trim(), capacity: capacity.trim(), rate: parseInt(rate || "0", 10), unit: "hour", deposit: parseInt(deposit || "0", 10), open: open.trim() || "6:00am – 10:00pm", status: "Open" },
    });
    toast(`${name.trim()} is now bookable by residents.`, "ok");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={460}>
      <ModalHeader title="Add amenity" onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 20 }}>It appears in the resident app as soon as you save, and charges flow to the next bill.</div>
      <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Name</div>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Party lawn" style={inputStyle} />
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Capacity</div>
      <input type="text" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="60 standing" style={inputStyle} />
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Hours</div>
      <input type="text" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="6:00am – 10:00pm" style={inputStyle} />
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Rate per hour</div>
          <input type="text" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0 for free" style={{ ...inputStyle, font: "600 14.5px/1 'IBM Plex Mono',monospace" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Deposit</div>
          <input type="text" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" style={{ ...inputStyle, font: "600 14.5px/1 'IBM Plex Mono',monospace" }} />
        </div>
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}>Add amenity</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

function BlockSlotModal({ seedDay, seedSlot, onClose }: { seedDay: number; seedSlot: number; onClose: () => void }) {
  const { state, dispatch, toast } = useAdminStore();
  const [amenity, setAmenity] = useState(state.amenities[0]?.name ?? "Clubhouse hall");
  const [day, setDay] = useState(seedDay);
  const [slot, setSlot] = useState(seedSlot);
  const [reason, setReason] = useState("");

  const save = () => {
    if (!reason.trim()) {
      toast("Residents will see this reason — write one.", "warn");
      return;
    }
    const taken = state.bookings.find((b) => b.day === day && b.slot === slot);
    if (taken) {
      toast(`That slot is already booked by ${taken.unit}.`, "warn");
      return;
    }
    dispatch({ type: "addBooking", booking: { id: "bk" + Date.now(), day, slot, amenity, unit: "Society", who: reason.trim(), state: "Confirmed", amount: 0 } });
    toast(`${amenity} blocked on ${day} Sep. Residents can no longer book it.`, "ok");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={460}>
      <ModalHeader title="Block a slot" onClose={onClose} />
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 20 }}>For repairs, society functions or anything residents should not book over.</div>
      <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Amenity</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {state.amenities.map((a) => {
          const active = amenity === a.name;
          return (
            <button key={a.id} type="button" onClick={() => setAmenity(a.name)} style={{ height: 42, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)", color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)", font: "600 13px/1 Figtree, sans-serif", cursor: "pointer", textAlign: "left", padding: "0 14px" }}>
              {a.name}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Day</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
        {CAL_DAYS.map((d) => {
          const active = day === d.n;
          return (
            <button key={d.n} type="button" onClick={() => setDay(d.n)} style={{ height: 44, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? "var(--accent,#0E6B5C)" : "var(--surface,#fff)", color: active ? "#fff" : "var(--ink,#0F1A17)", font: "600 12px/1 Figtree, sans-serif", cursor: "pointer" }}>
              {d.l} {d.n}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Slot</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CAL_SLOTS.map((s, i) => {
          const active = slot === i;
          return (
            <button key={s} type="button" onClick={() => setSlot(i)} style={{ height: 42, border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 11, background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)", color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)", font: "600 13px/1 Figtree, sans-serif", cursor: "pointer" }}>
              {s}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 8 }}>Reason residents will see</div>
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Flooring work" style={inputStyle} />
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={save}>Block the slot</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

function BookingDetailModal({
  amenity,
  rows,
  pending,
  onClose,
  onConfirm,
  onRelease,
}: {
  amenity: string;
  rows: { label: string; value: string }[];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRelease: () => void;
}) {
  return (
    <ModalShell onClose={onClose} maxWidth={430}>
      <div style={{ font: "700 21px/1.25 Figtree, sans-serif", letterSpacing: "-.02em", marginBottom: 18 }}>{amenity}</div>
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ padding: "13px 16px", borderBottom: "1px solid var(--border-soft,#F1F4F3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ font: "400 13px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{r.label}</span>
            <span style={{ font: "600 13.5px/1.3 Figtree, sans-serif", textAlign: "right" }}>{r.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" onClick={onRelease} style={{ height: 44, padding: "0 18px", border: "1px solid var(--bad-border,#F6D9D6)", borderRadius: 11, background: "var(--surface,#fff)", color: "var(--bad-ink,#9B2B22)", font: "600 14.5px/1 Figtree, sans-serif", cursor: "pointer" }}>
          Release slot
        </button>
        {pending && <PrimaryButton onClick={onConfirm}>Confirm booking</PrimaryButton>}
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </ModalShell>
  );
}

const inputStyle: CSSProperties = { width: "100%", height: 46, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 11, background: "var(--surface,#fff)", font: "500 14.5px/1 Figtree, sans-serif", outline: "none", color: "var(--ink,#0F1A17)" };
const secondaryBtn: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
const primaryBtn: CSSProperties = { height: 38, padding: "0 16px", border: 0, borderRadius: 10, background: "#0E6B5C", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: "pointer" };
