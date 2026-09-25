import React, { useEffect, useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { schemas, type LookupResult } from "@chs/contract";
import { ApiError } from "@chs/api-client";
import { useSessionController } from "@chs/api-client/react";
import { GateButton } from "../../components/GateButton";
import { GateText } from "../../components/GateText";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { groupMobile } from "../../api/guard";
import { AuthField, AuthLead, AuthNote, AuthScreen, AuthTitle, Checkbox, ERROR_INK, IconTile, NoteBox, RuleRow, passwordRules, splitError } from "./authUi";

/**
 * The signed-out handset: mobile → lookup → one of four screens (MASTER_SPEC
 * A2.1), the same steps as the resident app.
 *
 * Only the step lives here. Signing in hands the result to the session, and
 * SessionGate swaps this whole tree for the forced-change screen or the shift
 * screen — nothing here navigates past sign-in itself.
 */
type Step =
  | { name: "mobile" }
  | { name: "create"; mobile: string }
  | { name: "password"; mobile: string }
  | { name: "notRegistered"; mobile: string }
  | { name: "locked"; mobile: string; lockedUntil: string | null };

export function SignInFlow() {
  const [step, setStep] = useState<Step>({ name: "mobile" });
  // Kept across steps so "back" returns to the number they typed, not an empty field.
  const [mobile, setMobile] = useState("");
  const toMobile = () => setStep({ name: "mobile" });

  switch (step.name) {
    case "mobile":
      return (
        <MobileStep
          digits={mobile}
          onDigits={setMobile}
          onResult={(m, r) => {
            if (r.next === "CREATE_PASSWORD") setStep({ name: "create", mobile: m });
            else if (r.next === "ENTER_PASSWORD") setStep({ name: "password", mobile: m });
            else if (r.next === "NOT_REGISTERED") setStep({ name: "notRegistered", mobile: m });
            else setStep({ name: "locked", mobile: m, lockedUntil: r.lockedUntil ?? null });
          }}
        />
      );
    case "create":
      return <CreatePasswordStep mobile={step.mobile} onBack={toMobile} onAlreadySet={() => setStep({ name: "password", mobile: step.mobile })} />;
    case "password":
      return <PasswordStep mobile={step.mobile} onBack={toMobile} onLocked={(until) => setStep({ name: "locked", mobile: step.mobile, lockedUntil: until })} />;
    case "notRegistered":
      return <NotRegisteredStep mobile={step.mobile} onBack={toMobile} />;
    case "locked":
      return <LockedStep mobile={step.mobile} lockedUntil={step.lockedUntil} onBack={toMobile} onUnlocked={() => setStep({ name: "password", mobile: step.mobile })} />;
  }
}

/** Keeps the field to the 10-digit national number, accepting a pasted "+91 98900 12345" or "098900…" as the same thing. */
function toDigits(text: string): string {
  const d = text.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d.slice(0, 10);
}

function MobileStep({ digits, onDigits, onResult }: { digits: string; onDigits: (d: string) => void; onResult: (mobile: string, r: LookupResult) => void }) {
  const session = useSessionController();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    // The contract's own rule, so the message here is the one the server would send.
    const parsed = schemas.Mobile.safeParse(digits);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a 10-digit Indian mobile number");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await session.lookup(parsed.data);
      setBusy(false);
      onResult(parsed.data, result);
    } catch (err) {
      setBusy(false);
      const { fields, message } = splitError(err);
      setError(fields.mobile ?? message);
    }
  };

  return (
    <AuthScreen
      footer={
        <>
          <GateButton label={busy ? "Checking…" : "Continue"} onPress={submit} loading={busy} />
          <AuthNote center style={{ marginTop: 14 }}>
            Not registered? The society office adds guards to the gate.
          </AuthNote>
        </>
      }
    >
      <IconTile path={iconPaths.shield} />
      <AuthTitle>Sign in to start your shift</AuthTitle>
      <AuthLead>Enter the mobile number the society office registered for you. Everything you do on this handset is recorded against your name.</AuthLead>
      <AuthField
        label="Mobile number"
        prefix="+91"
        value={groupMobile(digits)}
        onChangeText={(t) => {
          onDigits(toDigits(t));
          if (error) setError(null);
        }}
        error={error}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        // The number is the account's username — this pairs it with the saved password.
        textContentType="username"
        autoComplete="username"
        returnKeyType="go"
        onSubmitEditing={submit}
        // No maxLength: it would cut a pasted "+91 98900 12345" before toDigits() can normalise it.
      />
    </AuthScreen>
  );
}

function CreatePasswordStep({ mobile, onBack, onAlreadySet }: { mobile: string; onBack: () => void; onAlreadySet: () => void }) {
  const session = useSessionController();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<TextInput>(null);
  const rules = passwordRules(password, mobile);

  // Validation on blur, never mid-typing — the mismatch is only called out once they leave the field.
  const checkConfirm = () => {
    if (confirm && confirm !== password) setErrors((e) => ({ ...e, confirmPassword: "Passwords do not match" }));
  };

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    const policy = schemas.auth.NewPassword.safeParse(password);
    if (!policy.success) next.password = policy.error.issues[0]?.message ?? "Choose a stronger password";
    else if (!rules.every((r) => r.ok)) next.password = "Don't use your mobile number.";
    if (confirm !== password) next.confirmPassword = "Passwords do not match";
    if (!accepted) next.acceptTerms = "Accept the terms to continue";
    setErrors(next);
    setMessage(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await session.activate({ mobile, password, confirmPassword: confirm, acceptTerms: true });
      // Signed in: SessionGate replaces this screen.
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "PASSWORD_ALREADY_SET") return onAlreadySet();
      const { fields, message: m } = splitError(err, "password");
      setErrors(fields);
      setMessage(m);
    }
  };

  return (
    <AuthScreen
      back={{ label: `+91 ${groupMobile(mobile)}`, onPress: onBack }}
      footer={
        <>
          {message ? <NoteBox tone="bad" marginBottom={14}>{message}</NoteBox> : null}
          <GateButton label={busy ? "Activating…" : "Activate and continue"} onPress={submit} loading={busy} />
        </>
      }
    >
      <AuthTitle>Create your password</AuthTitle>
      <AuthLead>Found your number. Set a password once; you will use it with your number at the start of every shift.</AuthLead>
      <AuthField
        label="New password"
        secret
        revealable
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors(({ password: _p, ...rest }) => rest);
        }}
        error={errors.password}
        autoFocus
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules="minlength: 8; required: digit; required: lower, upper;"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <AuthField
        label="Confirm password"
        secret
        marginTop={14}
        inputRef={confirmRef}
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          if (errors.confirmPassword) setErrors(({ confirmPassword: _c, ...rest }) => rest);
        }}
        onBlur={checkConfirm}
        error={errors.confirmPassword}
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View style={{ marginTop: 18, gap: 9 }}>
        {rules.map((r) => (
          <RuleRow key={r.label} ok={r.ok} label={r.label} />
        ))}
      </View>
      <View style={{ marginTop: 20 }}>
        <Checkbox
          checked={accepted}
          onToggle={() => {
            setAccepted((a) => !a);
            if (errors.acceptTerms) setErrors(({ acceptTerms: _a, ...rest }) => rest);
          }}
          label="I accept the terms of use and the society's data policy."
          error={errors.acceptTerms}
        />
      </View>
    </AuthScreen>
  );
}

function PasswordStep({ mobile, onBack, onLocked }: { mobile: string; onBack: () => void; onLocked: (until: string | null) => void }) {
  const session = useSessionController();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
    if (!password) {
      setError("Enter your password");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await session.login(mobile, password);
      // Signed in, or sent to the forced change / 2FA step — SessionGate takes it from here.
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "ACCOUNT_LOCKED") {
        const until = (err.details as { lockedUntil?: string } | undefined)?.lockedUntil ?? null;
        return onLocked(until);
      }
      const { fields, message } = splitError(err);
      setError(fields.password ?? message);
      // A wrong password is retyped from scratch, not edited.
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setPassword("");
        inputRef.current?.focus();
      }
    }
  };

  return (
    <AuthScreen
      back={{ label: `+91 ${groupMobile(mobile)}`, onPress: onBack }}
      footer={
        <View style={{ padding: 15, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
          <GateText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 5 }}>
            Forgot your password?
          </GateText>
          {/* MASTER_SPEC A2.4: recovery is a person, not a reset link. */}
          <AuthNote>There is no self-service reset. The society office issues a one-time password valid for 24 hours.</AuthNote>
        </View>
      }
    >
      {/* Lookup returns neither the guard's name nor the gate, so the number above stands in for "Welcome back, Ramesh". */}
      <AuthTitle>Enter your password</AuthTitle>
      <AuthLead marginBottom={26}>Your number is registered for the gate. Sign in to start your shift.</AuthLead>
      <AuthField
        label="Password"
        secret
        revealable
        inputRef={inputRef}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError(null);
        }}
        error={error}
        autoFocus
        textContentType="password"
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <GateButton label={busy ? "Signing in…" : "Sign in"} onPress={submit} loading={busy} style={{ marginTop: 22 }} />
    </AuthScreen>
  );
}

function NotRegisteredStep({ mobile, onBack }: { mobile: string; onBack: () => void }) {
  return (
    <AuthScreen back={{ label: `+91 ${groupMobile(mobile)}`, onPress: onBack }} footer={<GateButton label="Use a different number" variant="secondary" onPress={onBack} />}>
      <IconTile path={iconPaths.alertTriangle} tone="stop" />
      <AuthTitle>This number is not registered</AuthTitle>
      {/* No society is known for an unregistered number, so there is no office phone to show. */}
      <AuthLead>Only guards the society office has added can sign in to the gate. Ask the office or your supervisor to add {`+91\u00A0${groupMobile(mobile).replace(" ", "\u00A0")}`}.</AuthLead>
    </AuthScreen>
  );
}

function remaining(until: string | null, now: number): number {
  return until ? Math.max(0, Date.parse(until) - now) : 0;
}

function clock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function LockedStep({ mobile, lockedUntil, onBack, onUnlocked }: { mobile: string; lockedUntil: string | null; onBack: () => void; onUnlocked: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const left = remaining(lockedUntil, now);

  // A clock, not a wait: it counts down to a time the server gave us, and stops at zero.
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlocksAt = lockedUntil ? new Date(lockedUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;

  return (
    <AuthScreen
      back={{ label: `+91 ${groupMobile(mobile)}`, onPress: onBack }}
      footer={<GateButton label={left > 0 ? "Try again when unlocked" : "Try again"} onPress={onUnlocked} disabled={left > 0} />}
    >
      <IconTile path={iconPaths.lock} tone="stop" />
      <AuthTitle>Your account is locked</AuthTitle>
      <AuthLead>Five wrong passwords lock the account for 15 minutes. The society office can unlock it sooner.</AuthLead>
      <View style={{ padding: 15, borderRadius: 14, backgroundColor: withAlpha(colors.stop, 0.12), borderWidth: 1, borderColor: withAlpha(colors.stop, 0.35) }}>
        {left > 0 ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.stop }} />
              <GateText variant="gateCodeKeypad" color={ERROR_INK} style={{ fontSize: 15, lineHeight: 18 }} accessibilityLiveRegion="none">
                {clock(left)} remaining
              </GateText>
            </View>
            {unlocksAt ? (
              <GateText variant="bodySmall" color={ERROR_INK} style={{ fontSize: 12.5, marginTop: 8 }}>
                You can sign in again at {unlocksAt}.
              </GateText>
            ) : null}
          </>
        ) : (
          <GateText variant="cardTitle" color={ERROR_INK} style={{ fontSize: 13 }}>
            {lockedUntil ? "The lock has lifted. You can sign in again now." : "Try again in a few minutes, or ask the office to unlock it."}
          </GateText>
        )}
      </View>
    </AuthScreen>
  );
}
