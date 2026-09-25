import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { schemas } from "@chs/contract";
import { ApiError } from "@chs/api-client";
import { useSession, useSessionController } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "../../components/Button";
import { iconPaths } from "../../components/iconPaths";
import { ResidentShell } from "../shell/ResidentShell";
import { deriveIdentity, useResidentAccount } from "../../api/identity";
import { isLanguage } from "../../state/devicePrefs";
import { bindPushToSession, signOut } from "../../push/bridge";
import { SignInFlow } from "./SignInFlow";
import { AuthField, AuthLead, AuthNote, AuthScreen, AuthTitle, IconTile, NoteBox, splitError } from "./authUi";

/**
 * The root switch on the session's state (api-client `SessionController`):
 *
 *   unknown        → the bare canvas while a stored session is checked — no splash, no timer
 *   signedOut      → sign-in flow
 *   passwordChange → forced change after a temporary password; nothing else is reachable
 *   twoFactor      → the TOTP step (admins who enabled it)
 *   signedIn       → the resident app
 *
 * Leaving `signedIn` for any reason — sign out, a revoked session, an expired
 * refresh token — drops that account's cached server data and local state,
 * and unregisters the phone from push. Arriving at it registers the phone,
 * without waiting on the answer (push/bridge.ts `bindPushToSession`).
 */
export function SessionGate() {
  const session = useSession();
  const controller = useSessionController();
  const queryClient = useQueryClient();
  const { actions } = useResident();
  const { colors } = useTheme();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const started = useRef(false);

  const restore = useCallback(() => {
    setRestoring(true);
    controller
      .restore()
      .then(() => setRestoreError(null))
      // restore() keeps the stored tokens on a network failure and stays `unknown`, so this is the only way out.
      .catch((err: unknown) => setRestoreError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection."))
      .finally(() => setRestoring(false));
  }, [controller]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restore();
  }, [restore]);

  // Subscribed straight to the controller rather than to React state, so no
  // transition is missed between renders.
  useEffect(() => bindPushToSession(controller), [controller]);

  const status = session.status;
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === "signedIn" && status !== "signedIn") {
      queryClient.clear();
      actions.resetAll();
    }
    previous.current = status;
  }, [status, queryClient, actions]);

  if (status === "signedIn") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
        <SignedInApp />
      </SafeAreaView>
    );
  }

  let screen: React.ReactNode;
  if (status === "unknown") {
    screen = restoreError ? <RestoreFailed message={restoreError} retrying={restoring} onRetry={restore} /> : null;
    if (!screen) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  } else if (status === "passwordChange") {
    screen = <ForcedChangeScreen />;
  } else if (status === "twoFactor") {
    screen = <TwoFactorScreen />;
  } else {
    screen = <SignInFlow />;
  }
  // Only the top edge here: each auth screen pads its own bottom so the pinned action clears the home indicator.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {screen}
    </SafeAreaView>
  );
}

/**
 * Adopts the signed-in account into the app's state — its role and flat scope
 * every screen — then renders the shell. Adoption is a synchronous dispatch in
 * the first effect, so the shell appears on the next frame, not after a wait.
 */
function SignedInApp() {
  const { me, membership, query } = useResidentAccount();
  const { state, actions } = useResident();
  const derived = membership ? deriveIdentity(me, membership, query.data) : null;
  const key = derived ? JSON.stringify(derived) : null;

  useEffect(() => {
    if (derived) actions.adoptIdentity(derived.identity, derived.role);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The account's language, until one is chosen on this phone (Profile → Language).
  useEffect(() => {
    if (isLanguage(me.language)) actions.defaultLanguage(me.language);
  }, [me.language, actions]);

  if (!membership) return <NoResidentHome />;
  if (state.identity?.userId !== me.id) return null;
  return <ResidentShell />;
}

/** An account with no USER-role flat — an office-only admin, say. The resident app has nothing true to show them. */
function NoResidentHome() {
  const { me } = useResidentAccount();
  const { colors } = useTheme();
  const controller = useSessionController();
  const [busy, setBusy] = useState(false);
  const society = me.memberships[0]?.societyName;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AuthScreen
        footer={
          <Button
            label={busy ? "Signing out…" : "Sign out"}
            kind="secondary"
            loading={busy}
            radius={13}
            onPress={() => {
              setBusy(true);
              void signOut(controller);
            }}
          />
        }
      >
        <IconTile path={iconPaths.society} background={colors.subtle} stroke={colors.inkSoft} />
        <AuthTitle>No flat on this account</AuthTitle>
        <AuthLead>
          {society
            ? `${me.name}, your account at ${society} isn't linked to a flat, so there is nothing to show in the resident app. If you live in the society, ask the office to add you against your flat.`
            : `${me.name}, your account isn't part of a society yet. Ask your society office to add you against your flat.`}
        </AuthLead>
      </AuthScreen>
    </View>
  );
}

function RestoreFailed({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <AuthScreen footer={<Button label={retrying ? "Trying again…" : "Try again"} onPress={onRetry} loading={retrying} radius={13} />}>
      <IconTile path={iconPaths.alert} background={colors.warnWash} stroke={colors.warn} />
      <AuthTitle>Can't reach Sahaj</AuthTitle>
      <AuthLead>{message} You are still signed in on this phone.</AuthLead>
    </AuthScreen>
  );
}

function ForcedChangeScreen() {
  const { colors } = useTheme();
  const controller = useSessionController();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string> = {};
    const policy = schemas.auth.NewPassword.safeParse(password);
    if (!policy.success) next.newPassword = policy.error.issues[0]?.message ?? "Choose a stronger password";
    if (confirm !== password) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    setMessage(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await controller.forcedChange(password, confirm);
    } catch (err) {
      setBusy(false);
      // The restricted token is short-lived; once it's gone the only way forward is signing in again.
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      const { fields, message: m } = splitError(err, "newPassword");
      setErrors(fields);
      setMessage(m);
    }
  };

  return (
    <AuthScreen
      footer={
        <>
          {message ? <NoteBox tone="bad" marginBottom={14}>{message}</NoteBox> : null}
          {expired ? (
            <Button label="Sign in again" onPress={() => void controller.logout()} radius={13} />
          ) : (
            <Button label={busy ? "Saving…" : "Save and continue"} onPress={submit} loading={busy} radius={13} />
          )}
        </>
      }
    >
      <IconTile path={iconPaths.lock} background={colors.warnWash} stroke={colors.warn} />
      <AuthTitle>Set a new password</AuthTitle>
      {/* The design adds when it was issued ("on 10 Sep"); the PASSWORD_CHANGE result doesn't carry that date. */}
      <AuthLead marginBottom={8}>You signed in with a temporary password issued by the society office.</AuthLead>
      <NoteBox tone="warn" marginBottom={24}>
        Temporary passwords work once and expire in 24 hours. You cannot reach any other screen until this is done.
      </NoteBox>
      <AuthField
        label="New password"
        secret
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.newPassword) setErrors(({ newPassword: _n, ...rest }) => rest);
        }}
        error={errors.newPassword}
        autoFocus
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <AuthField
        label="Confirm new password"
        secret
        marginTop={14}
        inputRef={confirmRef}
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          if (errors.confirmPassword) setErrors(({ confirmPassword: _c, ...rest }) => rest);
        }}
        onBlur={() => {
          if (confirm && confirm !== password) setErrors((e) => ({ ...e, confirmPassword: "Passwords do not match" }));
        }}
        error={errors.confirmPassword}
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <AuthNote style={{ marginTop: 16 }}>Saving this signs you out of every other device.</AuthNote>
    </AuthScreen>
  );
}

/**
 * The TOTP step. Residents never enable two-factor (it is an admin option), so
 * this appears only for an admin who also lives in the society. The resident
 * design has no screen for it; it reuses the sign-in screens' parts.
 */
function TwoFactorScreen() {
  const { colors } = useTheme();
  const controller = useSessionController();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await controller.verifyTwoFactor(code);
    } catch (err) {
      setBusy(false);
      setCode("");
      const { fields, message } = splitError(err);
      setError(fields.code ?? message);
    }
  };

  return (
    <AuthScreen
      back={{ label: "Start again", onPress: () => controller.expire() }}
      footer={<Button label={busy ? "Verifying…" : "Verify"} onPress={submit} loading={busy} radius={13} />}
    >
      <IconTile path={iconPaths.lock} background={colors.accentWash} stroke={colors.accentInk} />
      <AuthTitle>Enter your code</AuthTitle>
      <AuthLead>Open your authenticator app and enter the 6-digit code for Sahaj.</AuthLead>
      <AuthField
        label="Code"
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, "").slice(0, 6));
          if (error) setError(null);
        }}
        error={error}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={6}
      />
    </AuthScreen>
  );
}
