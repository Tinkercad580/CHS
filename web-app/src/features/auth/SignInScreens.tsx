import { useState } from "react";
import { ApiError } from "@chs/api-client";
import { useSessionController } from "@chs/api-client/react";
import { schemas } from "@chs/contract";
import {
  AuthCheckbox,
  AuthField,
  AuthForm,
  AuthFrame,
  AuthTitle,
  FormError,
  MobileChip,
  PlainButton,
  SubmitButton,
} from "./AuthKit";
import { formatMobile, formatUntil } from "../../lib/apiFormat";
import { splitError } from "../../lib/apiErrors";

const POLICY_HINT = `At least ${schemas.auth.PASSWORD_MIN_LENGTH} characters, with a letter and a number.`;

type Step =
  | { kind: "mobile" }
  | { kind: "password" }
  | { kind: "create" }
  | { kind: "notRegistered" }
  | { kind: "locked"; until: string | null };

/**
 * Sign-in, MASTER_SPEC A2.1: the number decides the next screen. An
 * admin-added number without a password creates one; one with a password
 * enters it; an unknown number is told to contact the office and nothing
 * else — no sign-up, no OTP, no hint about which numbers exist.
 *
 * A successful sign-in, forced change or two-factor challenge changes the
 * session state, and the gate above renders the next screen from that.
 */
export function SignInScreen() {
  const session = useSessionController();
  const [step, setStep] = useState<Step>({ kind: "mobile" });
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const go = (next: Step) => {
    setField({});
    setFormError(null);
    setStep(next);
  };

  const fail = (err: unknown, fields: readonly string[]) => {
    const split = splitError(err, fields);
    setField(split.field);
    setFormError(split.form);
  };

  const lookup = async () => {
    setBusy(true);
    setField({});
    setFormError(null);
    try {
      const r = await session.lookup(mobile);
      if (r.next === "ENTER_PASSWORD") go({ kind: "password" });
      else if (r.next === "CREATE_PASSWORD") go({ kind: "create" });
      else if (r.next === "LOCKED") go({ kind: "locked", until: r.lockedUntil ?? null });
      else go({ kind: "notRegistered" });
    } catch (err) {
      fail(err, ["mobile"]);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => go({ kind: "mobile" });

  return (
    <AuthFrame>
      {step.kind === "mobile" && (
        <>
          <AuthTitle title="Sign in">Enter the mobile number your society office registered for you.</AuthTitle>
          <AuthForm onSubmit={lookup} busy={busy}>
            <AuthField
              label="Mobile number"
              value={mobile}
              onChange={(v) => setMobile(v.replace(/[^\d+\s-]/g, ""))}
              error={field.mobile}
              type="tel"
              inputMode="tel"
              autoComplete="username"
              placeholder="98200 00000"
              maxLength={16}
              mono
              autoFocus
            />
            <FormError message={formError} />
            <SubmitButton busy={busy} busyLabel="Checking…">
              Continue
            </SubmitButton>
          </AuthForm>
        </>
      )}

      {step.kind === "password" && <PasswordStep mobile={mobile} onBack={restart} onLocked={(until) => go({ kind: "locked", until })} />}

      {step.kind === "create" && <CreatePasswordStep mobile={mobile} onBack={restart} />}

      {step.kind === "notRegistered" && (
        <>
          <AuthTitle title="Number not registered" />
          <MobileChip mobile={mobile} onChange={restart} />
          <p style={{ marginTop: 16, font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink,#0F1A17)" }}>
            Your number is not registered. Please contact your society office.
          </p>
        </>
      )}

      {step.kind === "locked" && <LockedStep mobile={mobile} until={step.until} onBack={restart} onRetry={lookup} busy={busy} />}
    </AuthFrame>
  );
}

function PasswordStep({ mobile, onBack, onLocked }: { mobile: string; onBack: () => void; onLocked: (until: string | null) => void }) {
  const session = useSessionController();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setField({});
    setFormError(null);
    try {
      await session.login(mobile, password);
      // Unmounts on success: the session state now names the next screen.
    } catch (err) {
      if (err instanceof ApiError && err.code === "ACCOUNT_LOCKED") {
        onLocked((err.details as { lockedUntil?: string } | undefined)?.lockedUntil ?? null);
        return;
      }
      const split = splitError(err, ["password"]);
      setField(split.field);
      setFormError(split.form);
      setPassword("");
      setBusy(false);
    }
  };

  return (
    <>
      <AuthTitle title="Enter your password" />
      <AuthForm onSubmit={submit} busy={busy}>
        <MobileChip mobile={mobile} onChange={onBack} disabled={busy} />
        <AuthField label="Password" value={password} onChange={setPassword} error={field.password} type="password" autoComplete="current-password" autoFocus />
        <FormError message={formError} />
        <SubmitButton busy={busy} busyLabel="Signing in…">
          Sign in
        </SubmitButton>
        <div style={{ font: "400 12.5px/1.5 Figtree, sans-serif", color: "var(--ink-muted,#6B7A75)", textAlign: "center" }}>
          Forgot your password? Your society office can issue a temporary one.
        </div>
      </AuthForm>
    </>
  );
}

function CreatePasswordStep({ mobile, onBack }: { mobile: string; onBack: () => void }) {
  const session = useSessionController();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setField({});
    setFormError(null);
    // The body types acceptTerms as the literal `true`, so an unticked box
    // never leaves the browser. The wording is the contract's own.
    if (!accept) {
      setField({ acceptTerms: "Accept the terms to continue" });
      return;
    }
    setBusy(true);
    try {
      await session.activate({ mobile, password, confirmPassword: confirm, acceptTerms: true });
    } catch (err) {
      const split = splitError(err, ["password", "confirmPassword", "acceptTerms"]);
      setField(split.field);
      setFormError(split.form);
      setBusy(false);
    }
  };

  return (
    <>
      <AuthTitle title="Create your password">This is your first sign-in. Choose a password you will use from now on.</AuthTitle>
      <AuthForm onSubmit={submit} busy={busy}>
        <MobileChip mobile={mobile} onChange={onBack} disabled={busy} />
        <AuthField label="New password" value={password} onChange={setPassword} error={field.password} hint={POLICY_HINT} type="password" autoComplete="new-password" autoFocus />
        <AuthField label="Confirm password" value={confirm} onChange={setConfirm} error={field.confirmPassword} type="password" autoComplete="new-password" />
        <AuthCheckbox checked={accept} onChange={setAccept} error={field.acceptTerms}>
          I accept the terms of use and the privacy policy of Sahaj.
        </AuthCheckbox>
        <FormError message={formError} />
        <SubmitButton busy={busy} busyLabel="Creating password…">
          Create password and sign in
        </SubmitButton>
      </AuthForm>
    </>
  );
}

function LockedStep({ mobile, until, onBack, onRetry, busy }: { mobile: string; until: string | null; onBack: () => void; onRetry: () => void; busy: boolean }) {
  // Read the clock once, when the notice appears; the time it names is what matters.
  const [now] = useState(() => Date.now());
  const when = until ? new Date(until) : null;
  const at = until ? formatUntil(until) : null;
  const mins = when ? Math.max(1, Math.ceil((when.getTime() - now) / 60_000)) : null;
  return (
    <>
      <AuthTitle title="Account locked">
        Too many wrong passwords were entered for <span style={{ whiteSpace: "nowrap" }}>{formatMobile(mobile)}</span>.
      </AuthTitle>
      <div style={{ padding: "14px 15px", borderRadius: 12, background: "var(--warn-wash,#FDF3E7)", border: "1px solid var(--warn-border,#F5DFBE)", marginBottom: 16 }}>
        <div style={{ font: "600 14px/1.4 Figtree, sans-serif", color: "var(--warn-ink,#8F4A0A)" }}>
          {at ? `It unlocks at ${at}${mins ? ` (in about ${mins} minute${mins === 1 ? "" : "s"})` : ""}.` : "It unlocks shortly."}
        </div>
        <div style={{ marginTop: 4, font: "400 13px/1.5 Figtree, sans-serif", color: "var(--warn-ink,#8F4A0A)" }}>Your society office can unlock it sooner.</div>
      </div>
      <AuthForm onSubmit={onRetry} busy={busy}>
        <SubmitButton busy={busy} busyLabel="Checking…" tone="ghost">
          Try again
        </SubmitButton>
        <PlainButton onClick={onBack} disabled={busy}>
          Use a different number
        </PlainButton>
      </AuthForm>
    </>
  );
}

/** After a temporary password: MASTER_SPEC A2.1(4) — a new password before any screen. */
export function ForcedChangeScreen() {
  const session = useSessionController();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setField({});
    setFormError(null);
    try {
      await session.forcedChange(password, confirm);
    } catch (err) {
      const split = splitError(err, ["newPassword", "confirmPassword"]);
      setField(split.field);
      setFormError(split.form);
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <AuthTitle title="Set a new password">You signed in with a temporary password. Choose your own before you continue.</AuthTitle>
      <AuthForm onSubmit={submit} busy={busy}>
        <AuthField label="New password" value={password} onChange={setPassword} error={field.newPassword} hint={POLICY_HINT} type="password" autoComplete="new-password" autoFocus />
        <AuthField label="Confirm password" value={confirm} onChange={setConfirm} error={field.confirmPassword} type="password" autoComplete="new-password" />
        <FormError message={formError} />
        <SubmitButton busy={busy} busyLabel="Saving…">
          Save and continue
        </SubmitButton>
        <PlainButton onClick={() => void session.logout()} disabled={busy}>
          Cancel and sign out
        </PlainButton>
      </AuthForm>
    </AuthFrame>
  );
}

/** The optional admin TOTP step. */
export function TwoFactorScreen() {
  const session = useSessionController();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setField({});
    setFormError(null);
    try {
      await session.verifyTwoFactor(code);
    } catch (err) {
      const split = splitError(err, ["code"]);
      setField(split.field);
      setFormError(split.form);
      setCode("");
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <AuthTitle title="Two-factor code">Enter the 6-digit code from your authenticator app.</AuthTitle>
      <AuthForm onSubmit={submit} busy={busy}>
        <AuthField
          label="Code"
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          error={field.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          mono
          autoFocus
        />
        <FormError message={formError} />
        <SubmitButton busy={busy} busyLabel="Verifying…">
          Verify
        </SubmitButton>
        <PlainButton onClick={() => session.expire()} disabled={busy}>
          Back to sign in
        </PlainButton>
      </AuthForm>
    </AuthFrame>
  );
}

/** Signed in, but nothing here to administer. */
export function NotAdminScreen({ name, mobile }: { name: string; mobile: string }) {
  const session = useSessionController();
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame>
      <AuthTitle title="This console is for society administrators">
        You are signed in as {name} (<span style={{ whiteSpace: "nowrap" }}>{formatMobile(mobile)}</span>), but your account does not administer a society. Residents, tenants and staff use the Sahaj app.
      </AuthTitle>
      <AuthForm
        busy={busy}
        onSubmit={() => {
          setBusy(true);
          void session.logout();
        }}
      >
        <SubmitButton busy={busy} busyLabel="Signing out…">
          Sign out
        </SubmitButton>
      </AuthForm>
    </AuthFrame>
  );
}

/** Start-up could not reach the API. The stored session is kept, so a retry can pick it up. */
export function UnreachableScreen({ message, onRetry, busy }: { message: string; onRetry: () => void; busy: boolean }) {
  return (
    <AuthFrame>
      <AuthTitle title="Can't reach the server">{message}</AuthTitle>
      <AuthForm onSubmit={onRetry} busy={busy}>
        <SubmitButton busy={busy} busyLabel="Retrying…">
          Try again
        </SubmitButton>
      </AuthForm>
    </AuthFrame>
  );
}
