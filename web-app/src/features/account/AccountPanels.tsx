import { useState } from "react";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, schemas, type NotificationPreferences } from "@chs/contract";
import type { z } from "zod";
import { useConsoleMe } from "../../api/society";
import { DataBoundary } from "../../components/DataBoundary";
import { FormError, TextField } from "../../components/FormFields";
import { Note, PanelTabs } from "../../components/Kit";
import { PasswordPanel, SessionsPanel, TwoFactorPanel } from "./AccountSecurity";
import { GhostButton, ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "../../components/ModalShell";
import { SkeletonText } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import { splitError } from "../../lib/apiErrors";
import { formatMobile, formatWhen } from "../../lib/apiFormat";
import { useAdminStore } from "../../store/AdminStore";

type Category = z.infer<typeof schemas.notifications.NotificationPreference>["category"];

const DISMISS_KEY = (userId: string) => `chs.admin.emailPrompt.dismissed.${userId}`;

function readDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY(userId)) === "1";
  } catch {
    return false;
  }
}

/**
 * The shell's prompt for an admin with no email on file. Scheduled digests
 * and emailed reports go nowhere without one, so it says what they are
 * missing and takes the address in place (`me.update`). Dismissing it is
 * remembered on this browser; it goes for good once an email is saved.
 */
export function EmailBanner() {
  const me = useConsoleMe();
  const save = useApiMutation(api.me.update);
  const { toast } = useAdminStore();
  const [dismissed, setDismissed] = useState(() => readDismissed(me.id));
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (me.email || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY(me.id), "1");
    } catch {
      // Private window or blocked storage: it is dismissed for this visit only.
    }
  };
  const submit = async () => {
    if (save.isPending) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter an email address, for example you@example.com.");
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync({ body: { email: email.trim() } });
      toast(`Email saved. Summaries and reports will go to ${email.trim()}.`, "ok");
    } catch (err) {
      const split = splitError(err, ["email"]);
      setError(split.field.email ?? split.form ?? undefined);
    }
  };

  return (
    <div role="region" aria-label="Email missing" className="theme-transition" style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 14, border: "1px solid var(--info-border,#D6E2FB)", background: "var(--info-wash,#EAF0FE)", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ font: "600 14px/1.4 Figtree, sans-serif", color: "var(--info-ink,#12327A)" }}>Add your email to receive daily collection summaries, weekly digests and reports</div>
        <div style={{ marginTop: 3, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--info-ink,#12327A)", opacity: 0.85 }}>There is no email on your account, so nothing scheduled can reach you.</div>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ flex: "1 1 340px", display: "flex", gap: 8, alignItems: "flex-start" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="Email for summaries and reports"
            aria-invalid={error ? true : undefined}
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", height: 40, padding: "0 12px", border: `1px solid ${error ? "var(--bad,#C0342B)" : "var(--border-strong,#CCD6D2)"}`, borderRadius: 10, background: "var(--surface,#fff)", color: "var(--ink,#0F1A17)", font: "500 14px/1 Figtree, sans-serif", outline: "none" }}
          />
          {error && <div style={{ marginTop: 6, font: "500 12px/1.45 Figtree, sans-serif", color: "var(--bad-ink,#9B2B22)" }}>{error}</div>}
        </div>
        <button type="submit" disabled={save.isPending} aria-busy={save.isPending || undefined} className="press-scale focus-ring" style={{ height: 40, padding: "0 15px", border: 0, borderRadius: 10, background: "var(--accent,#0E6B5C)", color: "#fff", font: "600 13.5px/1 Figtree, sans-serif", cursor: save.isPending ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, flex: "none" }}>
          {save.isPending && <Spinner size={13} />}
          {save.isPending ? "Saving…" : "Save email"}
        </button>
        <button type="button" onClick={dismiss} title="Dismiss" aria-label="Dismiss" className="press-scale focus-ring" style={{ width: 40, height: 40, flex: "none", border: 0, borderRadius: 10, background: "transparent", cursor: "pointer", color: "var(--info-ink,#12327A)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
            <path d="M17 7 7 17M7 7l10 10" />
          </svg>
        </button>
      </form>
    </div>
  );
}

const CATEGORY_TEXT: Record<Category, { label: string; hint: string }> = {
  REPORT: { label: "Reports & digests", hint: "Daily collection summary and weekly defaulters list, by email" },
  BILLING: { label: "Billing", hint: "Bill runs published, supplementary bills" },
  PAYMENT: { label: "Payments", hint: "Receipts, cheques cleared or bounced" },
  APPROVAL: { label: "Approvals", hint: "Tenancy, family and vehicle requests waiting for you" },
  NOTICE: { label: "Notices", hint: "Notices sent to you" },
  GENERAL: { label: "General", hint: "Everything else" },
  EMERGENCY: { label: "Emergencies", hint: "Always on — they bypass quiet hours" },
  ACCOUNT: { label: "Account security", hint: "Always on — sign-ins, password changes" },
};
const ORDER: Category[] = ["REPORT", "BILLING", "PAYMENT", "APPROVAL", "NOTICE", "GENERAL", "EMERGENCY", "ACCOUNT"];

export type AccountTab = "notifications" | "password" | "sessions" | "twoFactor";

/**
 * The signed-in admin's own account, opened from the sidebar footer: their
 * notification choices, password, signed-in devices and two-factor sign-in.
 * None of it needs a society permission.
 */
export function AccountModal({ initialTab = "notifications", onClose }: { initialTab?: AccountTab; onClose: () => void }) {
  const me = useConsoleMe();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  return (
    <ModalShell onClose={onClose} maxWidth={640}>
      <ModalHeader title="Your account" onClose={onClose} />
      <div style={{ font: "400 13px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", margin: "2px 0 12px" }}>
        {me.name} · {formatMobile(me.mobile)}
        {me.email ? ` · ${me.email}` : ""}
      </div>
      <PanelTabs
        items={[
          { key: "notifications", label: "Notifications" },
          { key: "password", label: "Password" },
          { key: "sessions", label: "Devices" },
          { key: "twoFactor", label: "Two-factor" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "notifications" && <NotificationSettings onClose={onClose} />}
      {tab === "password" && <PasswordPanel onDone={onClose} />}
      {tab === "sessions" && <SessionsPanel />}
      {tab === "twoFactor" && <TwoFactorPanel />}
    </ModalShell>
  );
}

/**
 * The signed-in admin's own notification choices (`notifications.preferences`
 * / `updatePreferences`): push and email per category, the email address
 * they go to, and a test send that checks push and SMTP end to end.
 */
function NotificationSettings({ onClose }: { onClose: () => void }) {
  const prefs = useApiQuery(api.notifications.preferences);
  return (
    <>
      <DataBoundary
        state={toLoadState(prefs)}
        skeleton={
          <div style={{ padding: "12px 0" }} aria-busy="true">
            <SkeletonText lines={8} />
          </div>
        }
      >
        {(data) => <SettingsForm data={data} onClose={onClose} />}
      </DataBoundary>
    </>
  );
}

function SettingsForm({ data, onClose }: { data: NotificationPreferences; onClose: () => void }) {
  const me = useConsoleMe();
  const { toast } = useAdminStore();
  const update = useApiMutation(api.notifications.updatePreferences);
  const test = useApiMutation(api.notifications.test);
  const saveEmail = useApiMutation(api.me.update);
  const [rows, setRows] = useState(() => ORDER.flatMap((c) => data.preferences.filter((p) => p.category === c)));
  const [email, setEmail] = useState(me.email ?? "");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const set = (c: Category, key: "push" | "email", v: boolean) => setRows((cur) => cur.map((r) => (r.category === c ? { ...r, [key]: v } : r)));
  const dirty = rows.some((r) => {
    const o = data.preferences.find((p) => p.category === r.category);
    return o && (o.push !== r.push || o.email !== r.email);
  });
  const emailDirty = email.trim() !== (me.email ?? "");

  const submit = async () => {
    setFormError(null);
    setEmailError(undefined);
    try {
      if (emailDirty) {
        if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
          setEmailError("Enter an email address, for example you@example.com.");
          return;
        }
        await saveEmail.mutateAsync({ body: { email: email.trim() || null } });
      }
      if (dirty) await update.mutateAsync({ body: { preferences: rows.filter((r) => !r.mandatory).map((r) => ({ category: r.category, push: r.push, email: r.email })) } });
      toast("Notification settings saved.", "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["email"]);
      setEmailError(split.field.email);
      setFormError(split.form);
    }
  };

  const runTest = async () => {
    setTestResult(null);
    try {
      const r = await test.mutateAsync({});
      const push = r.push === "sent" ? "Push sent" : r.push === "no_devices" ? "No phone registered for push" : "Push is not set up on the server";
      const mail = r.email === "sent" ? "email sent" : r.email === "no_email" ? "no email on file" : "email is not set up on the server";
      setTestResult(`${push}; ${mail}.`);
    } catch (err) {
      setTestResult(splitError(err, []).form);
    }
  };

  const saving = update.isPending || saveEmail.isPending;
  const hasEmail = Boolean(me.email);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 18 }}>How the console and the apps reach you. Emergencies and account security always come through.</div>
      <div style={{ marginBottom: 18 }}>
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} error={emailError} placeholder="you@example.com" hint={hasEmail ? "Reports and digests go here" : "Add one to receive reports and digests"} />
      </div>
      {!hasEmail && !email.trim() && (
        <Note kind="warn" style={{ marginBottom: 14 }}>
          Without an email, the report and digest emails below have nowhere to go.
        </Note>
      )}
      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--canvas,#F7F9F8)" }}>
              {["Category", "Push", "Email"].map((h, i) => (
                <th key={h} scope="col" style={{ padding: "10px 14px", textAlign: i ? "center" : "left", font: "600 10.5px/1 Figtree, sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink-soft,#5A6B66)", width: i ? 70 : undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = CATEGORY_TEXT[r.category];
              return (
                <tr key={r.category} style={{ borderTop: "1px solid var(--border-soft,#F1F4F3)" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ font: "600 13.5px/1.35 Figtree, sans-serif" }}>{t.label}</div>
                    <div style={{ marginTop: 2, font: "400 12px/1.4 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>{t.hint}</div>
                  </td>
                  {(["push", "email"] as const).map((k) => (
                    <td key={k} style={{ padding: "11px 14px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        aria-label={`${t.label} by ${k}`}
                        checked={r[k]}
                        disabled={r.mandatory}
                        onChange={(e) => set(r.category, k, e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: "var(--accent,#0E6B5C)", cursor: r.mandatory ? "default" : "pointer" }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
        {data.devices.length
          ? `Push goes to ${data.devices.map((d) => `${d.deviceName ?? d.platform} (${d.app}, seen ${formatWhen(d.lastSeenAt)})`).join(", ")}.`
          : "No phone is registered for push. Sign in to the resident or gate app to receive push notifications."}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={test.isPending}
          aria-busy={test.isPending || undefined}
          className="press-scale focus-ring"
          style={{ height: 36, padding: "0 13px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: test.isPending ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          {test.isPending && <Spinner size={12} />}
          {test.isPending ? "Sending…" : "Send me a test"}
        </button>
        {testResult && (
          <span role="status" style={{ font: "500 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
            {testResult}
          </span>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <FormError message={formError} />
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose} disabled={saving}>
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" busy={saving} busyLabel="Saving…" disabled={!dirty && !emailDirty}>
          Save
        </PrimaryButton>
      </ModalFooter>
    </form>
  );
}
