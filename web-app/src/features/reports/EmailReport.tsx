import { useState } from "react";
import { ApiError } from "@chs/api-client";
import { useApiMutation } from "@chs/api-client/react";
import { api, schemas } from "@chs/contract";
import type { z } from "zod";
import { TextField } from "../../components/FormFields";
import { Note } from "../../components/Kit";
import { Spinner } from "../../components/Spinner";
import { splitError } from "../../lib/apiErrors";
import { secondaryBtnStyle } from "../../lib/tableKit";

type Params = z.input<typeof schemas.reports.ReportParams>;
type Format = "xlsx" | "csv";

/**
 * "Email me as Excel / CSV" for any report (`reports.email`). The file is
 * built in the background and sent to the admin's own address. Without one
 * on file the server answers EMAIL_REQUIRED; the prompt to add it appears
 * right here, saves it with `me.update`, and sends the report it was asked
 * for — the admin does not have to find their profile and come back.
 */
export function EmailReport({ societyId, type, params, disabled }: { societyId: string; type: string; params: Params; disabled?: boolean }) {
  const send = useApiMutation(api.reports.email);
  const saveEmail = useApiMutation(api.me.update);
  const [pending, setPending] = useState<Format | null>(null);
  const [needEmail, setNeedEmail] = useState<Format | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (format: Format) => {
    if (send.isPending) return;
    setPending(format);
    setSent(null);
    setError(null);
    try {
      const r = await send.mutateAsync({ params: { societyId, type }, body: { ...params, format } });
      setNeedEmail(null);
      setSent(`Queued. The ${format === "xlsx" ? "Excel" : "CSV"} file will arrive at ${r.to} in a few minutes.`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_REQUIRED") setNeedEmail(format);
      else setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  };

  const addAndSend = async () => {
    if (!needEmail || saveEmail.isPending) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError("Enter an email address, for example you@example.com.");
      return;
    }
    setEmailError(undefined);
    try {
      await saveEmail.mutateAsync({ body: { email: email.trim() } });
      await go(needEmail);
    } catch (err) {
      const split = splitError(err, ["email"]);
      setEmailError(split.field.email ?? split.form ?? undefined);
    }
  };

  const busy = send.isPending || saveEmail.isPending;
  const btn = (format: Format, label: string) => (
    <button
      type="button"
      onClick={() => void go(format)}
      disabled={disabled || busy}
      aria-busy={pending === format || undefined}
      className="press-scale focus-ring"
      style={{ ...secondaryBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, opacity: disabled ? 0.55 : 1, cursor: disabled || busy ? "default" : "pointer" }}
    >
      {pending === format && <Spinner size={13} />}
      {pending === format ? "Sending…" : label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {btn("xlsx", "Email me Excel")}
        {btn("csv", "Email me CSV")}
      </div>
      {sent && (
        <Note kind="ok" style={{ maxWidth: 420 }}>
          <span role="status">{sent}</span>
        </Note>
      )}
      {error && (
        <Note kind="bad" style={{ maxWidth: 420 }}>
          {error}
        </Note>
      )}
      {needEmail && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void addAndSend();
          }}
          style={{ width: "min(420px,100%)", padding: 14, border: "1px solid var(--warn-border,#F5DFBE)", background: "var(--warn-wash,#FDF9F3)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", color: "var(--warn-ink,#7C3D06)" }}>Add your email to receive reports</div>
          <div style={{ font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#8F4A0A)", marginTop: -6 }}>There is no email on your account. It is saved to your profile and this report is sent straight after.</div>
          <TextField label="Your email" req type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={setEmail} error={emailError} placeholder="you@example.com" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setNeedEmail(null)} disabled={busy} className="press-scale focus-ring" style={secondaryBtnStyle}>
              Not now
            </button>
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="press-scale focus-ring" style={{ ...secondaryBtnStyle, border: 0, background: "var(--accent,#0E6B5C)", color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {busy && <Spinner size={13} />}
              {saveEmail.isPending ? "Saving…" : send.isPending ? "Sending…" : "Save and send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
