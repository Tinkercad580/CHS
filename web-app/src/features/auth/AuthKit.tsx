import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Spinner } from "../../components/Spinner";
import { formatMobile } from "../../lib/apiFormat";
import { FormError } from "../../components/FormFields";

export { FormError };

/**
 * The pieces the sign-in screens are built from. The admin design has no
 * sign-in screen, so these borrow the console's own vocabulary — the modal
 * card's radius and shadow, FieldRow's 46px input, the primary button — and
 * nothing else. It is a door, not a landing page.
 */

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas,#F7F9F8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: "100%", maxWidth: 404 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingLeft: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent,#0E6B5C)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M5 21V8l7-5 7 5v13" />
              <path d="M9 21v-5h6v5" />
            </svg>
          </div>
          <div>
            <div style={{ font: "700 14px/1.2 Figtree, sans-serif", color: "var(--ink,#0F1A17)" }}>Sahaj</div>
            <div style={{ font: "500 11px/1.3 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>Admin console</div>
          </div>
        </div>
        <main
          className="theme-transition"
          style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 20, boxShadow: "0 24px 60px -34px rgba(15,26,23,.28)", padding: "28px 26px 26px", animation: "fadeUp .26s cubic-bezier(.2,.7,.3,1) both" }}
        >
          {children}
        </main>
        <div style={{ marginTop: 18, textAlign: "center", font: "400 12px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#6B7A75)" }}>
          Access is given by your society office. There is no self sign-up.
        </div>
      </div>
    </div>
  );
}

export function AuthTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ font: "700 21px/1.25 Figtree, sans-serif", letterSpacing: "-.02em", color: "var(--ink,#0F1A17)", marginBottom: children ? 7 : 0 }}>{title}</h1>
      {children && <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{children}</div>}
    </div>
  );
}

/** A form that submits on Enter and ignores a second submit while the first is in flight. */
export function AuthForm({ onSubmit, busy, children }: { onSubmit: () => void; busy: boolean; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!busy) onSubmit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {children}
    </form>
  );
}

export function AuthField({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  mono,
  autoComplete,
  inputMode,
  maxLength,
  autoFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: "text" | "password" | "tel";
  mono?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "text";
  maxLength?: number;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          className="auth-input"
          type={isPassword && !shown ? "password" : isPassword ? "text" : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          // The first field of each step takes focus so the flow is keyboard-only end to end.
          autoFocus={autoFocus}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            height: 46,
            padding: isPassword ? "0 64px 0 14px" : "0 14px",
            border: `1px solid ${error ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)"}`,
            borderRadius: 11,
            background: "var(--surface,#fff)",
            color: "var(--ink,#0F1A17)",
            font: mono ? "600 15px/1 'IBM Plex Mono',monospace" : "500 14.5px/1 Figtree, sans-serif",
            letterSpacing: mono ? ".02em" : undefined,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="auth-link"
            style={{ position: "absolute", right: 6, top: 7, height: 32, padding: "0 10px", border: 0, borderRadius: 8, background: "transparent", font: "600 12px/1 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", cursor: "pointer" }}
          >
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {note && (
        <div id={`${id}-note`} style={{ marginTop: 7, font: "500 12px/1.45 Figtree, sans-serif", color: error ? "var(--bad-ink,#9B2B22)" : "var(--ink-muted,#6B7A75)" }}>
          {note}
        </div>
      )}
    </div>
  );
}

export function AuthCheckbox({ checked, onChange, error, children }: { checked: boolean; onChange: (v: boolean) => void; error?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#4A5B56)" }}>
        <input
          id={id}
          type="checkbox"
          className="auth-check"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-note` : undefined}
          style={{ width: 17, height: 17, margin: "1px 0 0", flex: "none", accentColor: "var(--accent,#0E6B5C)", cursor: "pointer" }}
        />
        <span>{children}</span>
      </label>
      {error && (
        <div id={`${id}-note`} style={{ marginTop: 6, marginLeft: 27, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function SubmitButton({ busy, busyLabel, children, tone = "accent" }: { busy: boolean; busyLabel: string; children: ReactNode; tone?: "accent" | "ghost" }) {
  const ghost = tone === "ghost";
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className="press-scale auth-button"
      style={{
        width: "100%",
        height: 46,
        marginTop: 4,
        border: ghost ? "1px solid var(--border-strong,#CCD6D2)" : 0,
        borderRadius: 11,
        background: ghost ? "var(--surface,#fff)" : "var(--accent,#0E6B5C)",
        color: ghost ? "var(--ink,#0F1A17)" : "#fff",
        font: "600 14.5px/1 Figtree, sans-serif",
        cursor: busy ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
      }}
    >
      {busy && <Spinner size={15} />}
      {busy ? busyLabel : children}
    </button>
  );
}

export function PlainButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="auth-link"
      style={{ alignSelf: "center", height: 34, padding: "0 10px", border: 0, borderRadius: 8, background: "transparent", font: "600 13px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)", cursor: disabled ? "default" : "pointer" }}
    >
      {children}
    </button>
  );
}

/** The mobile number the flow is using, with a way back to change it. */
export function MobileChip({ mobile, onChange, disabled }: { mobile: string; onChange: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 14px", borderRadius: 11, background: "var(--canvas,#F7F9F8)", border: "1px solid var(--border,#E3E9E6)" }}>
      <span style={{ flex: 1, font: "600 14px/1 'IBM Plex Mono',monospace", color: "var(--ink,#0F1A17)" }}>{formatMobile(mobile)}</span>
      <button type="button" onClick={onChange} disabled={disabled} className="auth-link" style={{ height: 28, padding: "0 8px", border: 0, borderRadius: 7, background: "transparent", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--accent-ink,#0A5749)", cursor: disabled ? "default" : "pointer" }}>
        Change
      </button>
    </div>
  );
}
