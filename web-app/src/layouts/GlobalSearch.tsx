import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApiQuery } from "@chs/api-client/react";
import { api } from "@chs/contract";
import { holds, useCurrentSociety } from "../api/society";
import { Skeleton } from "../components/Skeleton";
import { formatMobile } from "../lib/apiFormat";
import { inr } from "../lib/money";
import { useSettled } from "../lib/tableKit";

interface Hit {
  key: string;
  group: string;
  title: string;
  sub: string;
  to: string;
}

const LIMIT = 5;

/**
 * The top bar's search: units (by label or owner), users (by name or
 * mobile) and bills (by number, title or payer), each through its own list
 * endpoint's `q`. A group is searched only when the admin holds that list's
 * permission, so nothing is asked that the server would refuse. ⌘K / Ctrl+K
 * focuses it; arrows move, Enter opens, Escape closes.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { society } = useCurrentSociety();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useSettled(text.trim(), 250);
  const societyId = society?.societyId ?? "";
  const ready = Boolean(society) && q.length >= 2;

  const canUnits = society ? holds(society, "society.configure", "members.manage", "billing.generate", "gate.operate", "gate.manage") : false;
  const canUsers = society ? holds(society, "users.manage") : false;
  const canBills = society ? holds(society, "billing.generate", "billing.publish", "payments.record", "accounts.manage") : false;
  const units = useApiQuery(api.structure.units, { params: { societyId }, query: { q, limit: LIMIT } }, { enabled: ready && canUnits });
  const users = useApiQuery(api.users.list, { params: { societyId }, query: { q, limit: LIMIT } }, { enabled: ready && canUsers });
  const bills = useApiQuery(api.billing.bills, { params: { societyId }, query: { q, limit: LIMIT } }, { enabled: ready && canBills });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits: Hit[] = [
    ...(units.data?.items ?? []).map((u) => ({ key: `u${u.id}`, group: "Units", title: u.label, sub: [u.primaryOwnerName ?? "No owner recorded", u.tenantName ? `tenant ${u.tenantName}` : null].filter(Boolean).join(" · "), to: `/members/record/${u.id}` })),
    ...(users.data?.items ?? []).map((u) => ({ key: `p${u.id}`, group: "Users", title: u.name, sub: [formatMobile(u.mobile), u.unitLabel].filter(Boolean).join(" · "), to: `/users/record/${u.id}` })),
    ...(bills.data?.items ?? []).map((b) => ({ key: `b${b.id}`, group: "Bills", title: b.number ?? b.title, sub: `${b.unitLabel} · ${b.title} · ${inr(b.totalPaise)}`, to: `/billing/bills/${b.id}` })),
  ];
  const searching = ready && ((canUnits && units.isFetching) || (canUsers && users.isFetching) || (canBills && bills.isFetching));
  const failed = [units, users, bills].find((x) => x.isError)?.error?.message ?? null;
  const settling = text.trim() !== q;
  const showPanel = open && text.trim().length >= 2;
  const index = Math.min(active, Math.max(0, hits.length - 1));

  const go = (h: Hit) => {
    setOpen(false);
    setText("");
    input.current?.blur();
    navigate(h.to);
  };

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 420 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 38, padding: "0 13px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#8A9995)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.4-4.4" />
        </svg>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && hits[index] ? `${listId}-${hits[index].key}` : undefined}
          aria-label="Search units, users and bills"
          value={text}
          disabled={!society}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[index]) {
              e.preventDefault();
              go(hits[index]);
            } else if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="Search unit, member, user or bill"
          style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", font: "400 14px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", outline: "none" }}
        />
        <span aria-hidden="true" style={{ font: "500 11px/1 'IBM Plex Mono',monospace", color: "var(--ink-soft,#5A6B66)", background: "var(--subtle,#F1F4F3)", padding: "3px 6px", borderRadius: 5 }}>
          {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
        </span>
      </div>
      {showPanel && (
        <div
          id={listId}
          role="listbox"
          // Keep focus in the input while a result is clicked.
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 40, background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, boxShadow: "0 18px 40px -18px rgba(15,26,23,.35)", maxHeight: 420, overflowY: "auto", padding: "6px 0", animation: "fadeUp .18s cubic-bezier(.2,.7,.3,1)" }}
        >
          {hits.length === 0 && (searching || settling) && (
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }} aria-busy="true">
              <Skeleton width="55%" height={12} />
              <Skeleton width="75%" height={10} />
              <Skeleton width="45%" height={12} />
            </div>
          )}
          {hits.length === 0 && !searching && !settling && (
            <div style={{ padding: "12px 14px", font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{failed ?? (canUnits || canUsers || canBills ? `Nothing matches "${text.trim()}".` : "Your permissions don't include any searchable list.")}</div>
          )}
          {hits.map((h, i) => (
            <div key={h.key}>
              {(i === 0 || hits[i - 1].group !== h.group) && <div style={{ padding: "8px 14px 4px", font: "600 10px/1 Figtree, sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-muted,#8A9995)" }}>{h.group}</div>}
              <div
                id={`${listId}-${h.key}`}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                style={{ padding: "8px 14px", cursor: "pointer", background: i === index ? "var(--accent-wash,#E6F2EF)" : "transparent" }}
              >
                <div style={{ font: h.group === "Users" ? "600 13.5px/1.35 Figtree, sans-serif" : "600 13px/1.35 'IBM Plex Mono',monospace" }}>{h.title}</div>
                <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
