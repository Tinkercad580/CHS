import { useId, type ChangeEvent } from "react";
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

/**
 * FieldRow's input, for forms that talk to the API: a real <label>, the
 * server's message under the field when it rejects a value, and the input
 * types a browser needs to help (email, tel). Same 46px box, same type.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  req,
  mono,
  type = "text",
  placeholder,
  autoFocus,
  inputMode,
  autoComplete,
  multiline,
  rows = 3,
  maxLength,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  error?: string;
  hint?: string;
  req?: boolean;
  mono?: boolean;
  type?: "text" | "email" | "tel" | "date" | "month" | "datetime-local" | "time" | "password";
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "tel" | "numeric" | "decimal" | "email";
  autoComplete?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const style = {
    width: "100%",
    padding: multiline ? "12px 14px" : "0 14px",
    border: `1px solid ${error ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)"}`,
    borderRadius: 11,
    background: "var(--surface,#fff)",
    color: "var(--ink,#0F1A17)",
    font: mono ? "600 15px/1 'IBM Plex Mono',monospace" : multiline ? "500 14px/1.5 Figtree, sans-serif" : "500 14.5px/1 Figtree, sans-serif",
    outline: "none",
    resize: "vertical" as const,
    opacity: disabled ? 0.7 : 1,
  };
  const describedBy = error || hint ? `${id}-note` : undefined;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 8 }}>
        <label htmlFor={id} style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>
          {label}
        </label>
        <span style={{ font: "500 11.5px/1 Figtree, sans-serif", color: "var(--ink-dim,#A8B5B0)" }}>{req ? "required" : "optional"}</span>
      </div>
      {multiline ? (
        <textarea
          id={id}
          className="auth-input"
          value={value}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          style={style}
        />
      ) : (
        <input
          id={id}
          className="auth-input"
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          // First field of a modal takes focus so the form can be filled from the keyboard.
          autoFocus={autoFocus}
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...style, height: 46 }}
        />
      )}
      {(error || hint) && (
        <div id={`${id}-note`} style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: error ? "var(--bad-ink,#9B2B22)" : "var(--ink-muted,#6B7A75)" }}>
          {error ?? hint}
        </div>
      )}
    </div>
  );
}

/** FieldRow's row of pick buttons with values distinct from labels, announced as a radio group. */
export function PickField<V extends string>({
  label,
  value,
  options,
  onPick,
  error,
  req,
  disabled,
}: {
  label: string;
  value: V | null;
  options: { value: V; label: string }[];
  onPick: (v: V) => void;
  error?: string;
  req?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 8 }}>
        <span id={id} style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>
          {label}
        </span>
        <span style={{ font: "500 11.5px/1 Figtree, sans-serif", color: "var(--ink-dim,#A8B5B0)" }}>{req ? "required" : "optional"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onPick(o.value)}
              className="press-scale focus-ring"
              style={{
                height: 40,
                padding: "0 14px",
                border: `1px solid ${active ? "var(--accent,#0E6B5C)" : "var(--border-strong,#CCD6D2)"}`,
                borderRadius: 11,
                background: active ? "var(--accent-wash,#E6F2EF)" : "var(--surface,#fff)",
                color: active ? "var(--accent-ink,#0A5749)" : "var(--ink,#0F1A17)",
                font: "600 12.5px/1 Figtree, sans-serif",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled && !active ? 0.6 : 1,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && <div style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{error}</div>}
    </div>
  );
}

/** A server message that belongs to no single field, shown exactly as the API wrote it. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ padding: "11px 13px", borderRadius: 11, background: "var(--bad-wash,#FCEDEC)", border: "1px solid var(--bad-border,#F6D9D6)", font: "500 13px/1.5 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>
      {message}
    </div>
  );
}

/** A native select in TextField's box — for long option lists (charge categories, heads) where pick buttons would wrap into a wall. */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  req,
  placeholder,
  disabled,
}: {
  label: string;
  disabled?: boolean;
  value: V | "";
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  error?: string;
  hint?: string;
  req?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 8 }}>
        <label htmlFor={id} style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>
          {label}
        </label>
        <span style={{ font: "500 11.5px/1 Figtree, sans-serif", color: "var(--ink-dim,#A8B5B0)" }}>{req ? "required" : "optional"}</span>
      </div>
      <select
        id={id}
        className="auth-input"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        onChange={(e) => onChange(e.target.value as V)}
        style={{
          width: "100%",
          height: 46,
          padding: "0 12px",
          border: `1px solid ${error ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)"}`,
          borderRadius: 11,
          background: "var(--surface,#fff)",
          color: value ? "var(--ink,#0F1A17)" : "var(--ink-muted,#8A9995)",
          font: "500 14.5px/1 Figtree, sans-serif",
          outline: "none",
        }}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(error || hint) && (
        <div id={`${id}-note`} style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: error ? "var(--bad-ink,#9B2B22)" : "var(--ink-muted,#6B7A75)" }}>
          {error ?? hint}
        </div>
      )}
    </div>
  );
}

/** A labelled checkbox with a line of explanation — for a yes/no choice whose consequence needs saying. */
export function CheckField({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: "flex", gap: 11, alignItems: "flex-start", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 1, flex: "none", accentColor: "var(--accent,#0E6B5C)", cursor: "inherit" }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", font: "600 13.5px/1.35 Figtree, sans-serif" }}>{label}</span>
        {hint && <span style={{ display: "block", marginTop: 2, font: "400 12.5px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{hint}</span>}
      </span>
    </label>
  );
}
