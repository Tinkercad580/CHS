import type { ChangeEvent } from "react";
import type { FieldKind } from "../lib/types";
import { optionsWithCurrent } from "../lib/formLogic";

export interface RenderField {
  k: string;
  label: string;
  kind: FieldKind;
  ph?: string;
  req?: boolean;
  opts?: string[];
}

/** One labelled field — text/mono/money input or a row of pick buttons —
 * shared by the 13-page form modal and the ad-hoc "quick" modal. */
export function FieldRow({
  field,
  value,
  bad,
  onChange,
  onPick,
}: {
  field: RenderField;
  value: string;
  bad: boolean;
  onChange: (v: string) => void;
  onPick: (v: string) => void;
}) {
  const isPick = field.kind === "pick";
  const bd = bad ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)";
  const font = field.kind === "mono" || field.kind === "money" ? "600 15px/1 'IBM Plex Mono',monospace" : "500 14.5px/1 Figtree, sans-serif";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 8 }}>
        <span style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>{field.label}</span>
        <span style={{ font: "500 11.5px/1 Figtree, sans-serif", color: bad ? "var(--bad,#C0342B)" : "var(--ink-dim,#A8B5B0)" }}>
          {bad ? "required" : field.req ? "required" : "optional"}
        </span>
      </div>
      {isPick ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {optionsWithCurrent(field.opts ?? [], value).map((o) => {
            const active = value.toLowerCase() === o.toLowerCase();
            return (
              <button
                key={o}
                type="button"
                onClick={() => onPick(o)}
                className="press-scale"
                style={{
                  height: 40,
                  padding: "0 14px",
                  border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`,
                  borderRadius: 11,
                  background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)",
                  color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)",
                  font: "600 12.5px/1 Figtree, sans-serif",
                  cursor: "pointer",
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          placeholder={field.ph ?? ""}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            onChange(field.kind === "money" ? raw.replace(/[^0-9.]/g, "") : field.kind === "mono" ? raw.toUpperCase() : raw);
          }}
          style={{
            width: "100%",
            height: 46,
            padding: "0 14px",
            border: `1px solid ${bd}`,
            borderRadius: 11,
            background: "var(--surface,#fff)",
            color: "var(--ink,#0F1A17)",
            font,
            outline: "none",
          }}
        />
      )}
    </div>
  );
}
