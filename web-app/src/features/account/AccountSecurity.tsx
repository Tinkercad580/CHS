import { useState } from "react";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery, useSessionController } from "@chs/api-client/react";
import { api, schemas, type Session } from "@chs/contract";
import { useConsoleMe } from "../../api/society";
import { ConfirmModal, DataTable, Form, Note } from "../../components/Kit";
import { FormError, TextField } from "../../components/FormFields";
import { GhostButton, PrimaryButton } from "../../components/ModalShell";
import { Pill } from "../../components/Pill";
import { splitError } from "../../lib/apiErrors";
import { deviceLabel, enumLabel, formatDate, formatWhen } from "../../lib/apiFormat";
import { cellStyle, rowBorder } from "../../lib/uiStyles";
import { useAdminStore } from "../../store/AdminStore";

/**
 * The signed-in admin's own account security, as panels in the account
 * dialog: change password (`me.changePassword`), the devices signed in
 * (`me.sessions`, `me.revokeSession`, `me.logoutAll`) and two-factor
 * sign-in (`me.twoFactorSetup` / `Enable` / `Disable`). These need only a
 * signed-in user, not a society permission.
 */

/** Change password. The server signs out every other session; this one stays. */
export function PasswordPanel({ onDone }: { onDone: () => void }) {
  const { toast } = useAdminStore();
  const change = useApiMutation(api.me.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (change.isPending) return;
    setFormError(null);
    const parsed = schemas.auth.ChangePasswordBody.safeParse({ currentPassword: current, newPassword: next, confirmPassword: confirm });
    if (!parsed.success) {
      const local: Record<string, string> = {};
      for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
      if (local.currentPassword) local.currentPassword = "Enter your current password.";
      setField(local);
      return;
    }
    setField({});
    try {
      await change.mutateAsync({ body: parsed.data });
      toast("Password changed. Every other device has been signed out.", "ok");
      onDone();
    } catch (err) {
      const split = splitError(err, ["currentPassword", "newPassword", "confirmPassword"]);
      // A wrong current password comes back as the form message; it belongs under that field.
      if (err instanceof ApiError && !Object.keys(split.field).length && err.status === 401) {
        setField({ currentPassword: err.message });
        setFormError(null);
      } else {
        setField(split.field);
        setFormError(split.form);
      }
      setCurrent("");
    }
  };

  return (
    <Form onSubmit={() => void submit()}>
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>
        At least {schemas.auth.PASSWORD_MIN_LENGTH} characters, with a letter and a number. Changing it signs you out on every other device.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <TextField label="Current password" req type="password" autoComplete="current-password" value={current} onChange={setCurrent} error={field.currentPassword} autoFocus />
        <TextField label="New password" req type="password" autoComplete="new-password" value={next} onChange={setNext} error={field.newPassword} />
        <TextField label="Confirm new password" req type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={field.confirmPassword} />
        <FormError message={formError} />
      </div>
      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton type="submit" busy={change.isPending} busyLabel="Changing…">
          Change password
        </PrimaryButton>
      </div>
    </Form>
  );
}

/** Every device signed in to this account, with sign-out for one or all. */
export function SessionsPanel() {
  const session = useSessionController();
  const { toast } = useAdminStore();
  // Opening the panel always asks again (showing what is cached meanwhile): a device list a few seconds old can hide the one to sign out.
  const sessions = useApiQuery(api.me.sessions, undefined, { refetchOnMount: "always" });
  const revoke = useApiMutation(api.me.revokeSession);
  const all = useApiMutation(api.me.logoutAll);
  const [confirm, setConfirm] = useState<Session | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = (sessions.data ?? []).filter((s) => !s.current).length;

  const run = async () => {
    if (!confirm) return;
    setError(null);
    try {
      if (confirm === "all") {
        await all.mutateAsync({});
        // This device's session went too; the gate returns to sign-in and clears the cache.
        session.expire();
        return;
      }
      await revoke.mutateAsync({ params: { sessionId: confirm.id } });
      if (confirm.current) {
        session.expire();
        return;
      }
      toast(`${deviceLabel(confirm)} signed out.`, "ok");
      setConfirm(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <div>
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 14 }}>
        Where your account is signed in. Sign out a device you don't recognise, then change your password.
      </div>
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden" }}>
        <DataTable<Session>
          cols={[{ label: "Device" }, { label: "Last used" }, { label: "", align: "right" }]}
          rows={toLoadState(sessions)}
          skeletonRows={3}
          minWidth={480}
          empty="No active sessions."
          renderRow={(s) => {
            const device = deviceLabel(s);
            const client = enumLabel(s.client);
            return (
              <tr key={s.id} style={rowBorder}>
                <td style={cellStyle()}>
                  <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {device}
                    {s.current && <Pill label="This device" kind="ok" />}
                  </div>
                  <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{[device === client ? null : client, s.ip, `since ${formatDate(s.createdAt)}`].filter(Boolean).join(" · ")}</div>
                </td>
                <td style={cellStyle("left", { whiteSpace: "nowrap", color: "var(--ink-soft,#5A6B66)" })}>{formatWhen(s.lastUsedAt)}</td>
                <td style={cellStyle("right")}>
                  <button type="button" onClick={() => setConfirm(s)} className="press-scale focus-ring" style={{ height: 30, padding: "0 11px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 8, background: "var(--surface,#fff)", font: "600 12px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Sign out
                  </button>
                </td>
              </tr>
            );
          }}
        />
      </div>
      {sessions.data && sessions.data.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{others ? `${others} other device${others === 1 ? "" : "s"} signed in.` : "Only this device is signed in."}</span>
          <GhostButton onClick={() => setConfirm("all")}>Sign out everywhere</GhostButton>
        </div>
      )}
      {confirm && (
        <ConfirmModal
          title={confirm === "all" ? "Sign out everywhere?" : confirm.current ? "Sign out of this device?" : `Sign out ${deviceLabel(confirm)}?`}
          body={confirm === "all" ? "Every device, this one included, is signed out. You will need your password to sign in again." : confirm.current ? "You are signed out here and return to the sign-in screen." : "That device is signed out at once and needs the password to sign in again."}
          confirm={confirm === "all" ? "Sign out everywhere" : "Sign out"}
          busyLabel="Signing out…"
          tone="bad"
          busy={revoke.isPending || all.isPending}
          error={error}
          onConfirm={() => void run()}
          onClose={() => {
            setConfirm(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Two-factor sign-in with an authenticator app. Setup returns a secret and
 * an otpauth:// link; the console shows both as text (there is no QR
 * library here), the admin adds it to their app, and a first code turns it
 * on. Turning it off also needs a current code.
 */
export function TwoFactorPanel() {
  const me = useConsoleMe();
  const { toast } = useAdminStore();
  const setup = useApiMutation(api.me.twoFactorSetup);
  const enable = useApiMutation(api.me.twoFactorEnable);
  const disable = useApiMutation(api.me.twoFactorDisable);
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const valid = /^\d{6}$/.test(code);

  const start = async () => {
    setFormError(null);
    try {
      setSecret(await setup.mutateAsync({}));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };
  const confirmCode = async (turnOn: boolean) => {
    if (!valid) {
      setCodeError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setCodeError(undefined);
    setFormError(null);
    try {
      if (turnOn) await enable.mutateAsync({ body: { code } });
      else await disable.mutateAsync({ body: { code } });
      toast(turnOn ? "Two-factor sign-in is on. You will be asked for a code each time you sign in." : "Two-factor sign-in is off.", turnOn ? "ok" : "warn");
      setSecret(null);
      setCode("");
    } catch (err) {
      const split = splitError(err, ["code"]);
      setCodeError(split.field.code ?? (err instanceof ApiError && err.status < 500 ? err.message : undefined));
      setFormError(split.field.code || (err instanceof ApiError && err.status < 500) ? null : split.form);
      setCode("");
    }
  };
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  };

  const codeField = (
    <TextField
      label="Code from your authenticator app"
      req
      mono
      inputMode="numeric"
      autoComplete="one-time-code"
      value={code}
      onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
      error={codeError}
      placeholder="123456"
      autoFocus
    />
  );

  if (me.twoFactorEnabled) {
    return (
      <Form onSubmit={() => void confirmCode(false)}>
        <Note kind="ok" style={{ marginBottom: 16 }}>
          Two-factor sign-in is on. Each sign-in to the console asks for a code from your authenticator app.
        </Note>
        <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>To turn it off, enter a current code. Your account is then protected by the password alone.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {codeField}
          <FormError message={formError} />
        </div>
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton type="submit" tone="bad" busy={disable.isPending} busyLabel="Turning off…">
            Turn off two-factor
          </PrimaryButton>
        </div>
      </Form>
    );
  }

  if (!secret) {
    return (
      <div>
        <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 16 }}>
          Two-factor sign-in asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) after your password. A stolen password alone is then not enough to get in.
        </div>
        <FormError message={formError} />
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton onClick={() => void start()} busy={setup.isPending} busyLabel="Preparing…">
            Set up two-factor
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const mono = { font: "500 13px/1.5 'IBM Plex Mono',monospace", overflowWrap: "anywhere" as const, padding: "10px 12px", borderRadius: 10, background: "var(--subtle,#EDF1EF)" };
  return (
    <Form onSubmit={() => void confirmCode(true)}>
      <ol style={{ margin: "0 0 18px", paddingLeft: 20, font: "400 14px/1.6 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
        <li>In your authenticator app, add an account and choose to enter a setup key.</li>
        <li>Enter the key below (time-based, 6 digits), or paste the link into an app that accepts one.</li>
        <li>Type the code the app shows to turn two-factor on.</li>
      </ol>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>Setup key</span>
            <button type="button" onClick={() => void copy("key", secret.secret)} className="focus-ring" style={{ border: 0, background: "none", color: "var(--accent-ink,#0A5749)", font: "600 12px/1 Figtree, sans-serif", cursor: "pointer" }}>
              {copied === "key" ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ ...mono, font: "600 15px/1.5 'IBM Plex Mono',monospace", letterSpacing: ".08em" }}>{secret.secret.replace(/(.{4})/g, "$1 ").trim()}</div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ font: "600 12.5px/1 Figtree, sans-serif" }}>Setup link</span>
            <button type="button" onClick={() => void copy("link", secret.otpauthUrl)} className="focus-ring" style={{ border: 0, background: "none", color: "var(--accent-ink,#0A5749)", font: "600 12px/1 Figtree, sans-serif", cursor: "pointer" }}>
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={mono}>{secret.otpauthUrl}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {codeField}
        <FormError message={formError} />
      </div>
      <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <GhostButton
          onClick={() => {
            setSecret(null);
            setCode("");
            setCodeError(undefined);
          }}
          disabled={enable.isPending}
        >
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" busy={enable.isPending} busyLabel="Checking code…">
          Turn on two-factor
        </PrimaryButton>
      </div>
    </Form>
  );
}
