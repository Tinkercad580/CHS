import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View, type TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { api, schemas } from "@chs/contract";
import { ApiError } from "@chs/api-client";
import { useApi, useMe, useSession, useSessionController } from "@chs/api-client/react";
import { MAX_TOASTS } from "@sahaj/shared";
import { useGate } from "../../state/GateProvider";
import type { GateActions } from "../../state/actions";
import { colors } from "../../theme";
import { GateButton } from "../../components/GateButton";
import { iconPaths } from "../../components/iconPaths";
import { guardMembership } from "../../api/guard";
import { onForegroundPush, onPushOpened, registerForPush, unregisterPush } from "../../push/push";
import { GateShell } from "../shell/GateShell";
import { ShiftScreen } from "../signin/ShiftScreen";
import { clearPin } from "../signin/shiftPin";
import { SignInFlow } from "./SignInFlow";
import { AuthField, AuthLead, AuthNote, AuthScreen, AuthTitle, IconTile, NoteBox, splitError } from "./authUi";

/**
 * The root switch on the session's state (api-client `SessionController`):
 *
 *   unknown        → the bare canvas while a stored session is checked — no splash, no timer
 *   signedOut      → sign-in by mobile and password
 *   passwordChange → forced change after a temporary password; nothing else is reachable
 *   twoFactor      → the TOTP step (only an admin who enabled it would meet this here)
 *   signedIn       → the duty-PIN shift screen, then the gate shell
 *
 * Leaving `signedIn` for any reason — sign out, a revoked session, an expired
 * refresh token, five wrong duty PINs — drops that account's cached server data,
 * its duty PIN, its push registration and the shift. The gate's own local records
 * (log, parcels) stay in memory until the app restarts; nothing persists them yet.
 */
export function SessionGate() {
  const session = useSession();
  const controller = useSessionController();
  const client = useApi();
  const queryClient = useQueryClient();
  const { actions } = useGate();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const started = useRef(false);

  const restore = useCallback(() => {
    setRestoring(true);
    let hadSession = false;
    void Promise.resolve(client.tokens.hydrate?.())
      .then(() => {
        hadSession = client.tokens.get() !== null;
        return controller.restore();
      })
      .then(() => {
        setRestoreError(null);
        // A stored session the server refused (revoked or expired while the app was closed) never reaches
        // `signedIn`, so the listener below doesn't see it end — but this phone may still hold its push token.
        if (hadSession && controller.state.status === "signedOut") void unregisterPush();
      })
      // restore() keeps the stored tokens on a network failure and stays `unknown`, so this is the only way out.
      .catch((err: unknown) => setRestoreError(err instanceof ApiError ? err.message : "Could not reach the server. Check the handset's connection."))
      .finally(() => setRestoring(false));
  }, [client, controller]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restore();
  }, [restore]);

  // The phone-side cleanup, straight off the controller rather than a render: it
  // must run however the session ended. The sign-out button has already
  // unregistered push by now, so this matters when the session ends by itself
  // (expired, revoked, refresh rejected); unregisterPush() is a no-op the second time.
  useEffect(() => {
    let prev = controller.state;
    return controller.subscribe((next) => {
      const was = prev;
      prev = next;
      if (was.status !== "signedIn" || next.status === "signedIn") return;
      void unregisterPush();
      void clearPin(was.me.id);
    });
  }, [controller]);

  const status = session.status;
  const userId = session.status === "signedIn" ? session.me.id : null;
  const previous = useRef(status);
  const lastUser = useRef<string | null>(null);
  // A password sign-in starts a new shift, so any PIN left from an earlier one is
  // cleared before the shift screen reads it; a restored session keeps its PIN.
  const [pinReadyFor, setPinReadyFor] = useState<string | null>(null);

  useEffect(() => {
    const was = previous.current;
    if (was === status && (status !== "signedIn" || userId === lastUser.current)) return;
    previous.current = status;
    if (status === "signedIn" && userId) {
      lastUser.current = userId;
      if (was === "unknown") setPinReadyFor(userId);
      else void clearPin(userId).then(() => setPinReadyFor(userId));
      return;
    }
    if (was === "signedIn") {
      // The PIN and push registration are cleared by the controller subscription above.
      queryClient.clear();
      actions.endShift();
      setPinReadyFor(null);
    }
  }, [status, userId, queryClient, actions]);

  if (status === "signedIn") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        {pinReadyFor === userId ? <SignedInHandset /> : null}
      </SafeAreaView>
    );
  }

  let screen: React.ReactNode;
  if (status === "unknown") {
    screen = restoreError ? <RestoreFailed message={restoreError} retrying={restoring} onRetry={restore} /> : null;
    if (!screen) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  } else if (status === "passwordChange") {
    screen = <ForcedChangeScreen />;
  } else if (status === "twoFactor") {
    screen = <TwoFactorScreen />;
  } else {
    screen = <SignInFlow />;
  }
  // Only the top edge here: each auth screen pads its own bottom so the pinned action clears the home indicator.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      {screen}
    </SafeAreaView>
  );
}

/** Ends the session the way every sign-out must: stop push to this phone first (it needs the token), then revoke. */
function useSignOut(): { signOut: () => void; signingOut: boolean } {
  const controller = useSessionController();
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);
  const signOut = useCallback(() => {
    // The PIN screen signs out by itself after the fifth wrong PIN; a tap arriving at the same moment must not start a second logout.
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);
    void unregisterPush()
      .then(() => controller.logout())
      .finally(() => {
        inFlight.current = false;
        setSigningOut(false);
      });
  }, [controller]);
  return { signOut, signingOut };
}

/**
 * A signed-in account on the handset. Registers the phone for push (never
 * awaited — a slow round trip to Google must not hold up the shift screen),
 * follows notification taps and foreground pushes, and gates the shell on duty
 * state. It stays mounted while the handset is locked, so it is what holds
 * anything that arrives before the PIN is entered.
 */
function SignedInHandset() {
  const me = useMe();
  const membership = guardMembership(me);
  const { state, actions } = useGate();
  const { signOut, signingOut } = useSignOut();
  const queryClient = useQueryClient();
  // Office notices already announced (or already waiting at the first load). Kept
  // here, not in the shell, so a notice that lands while the handset is locked is
  // still news when the shell remounts on unlock.
  const seenNotices = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!membership) return;
    void registerForPush(`${Platform.OS} gate handset`);
  }, [me.id, membership?.societyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap that arrives while the handset is locked waits for the PIN: opening
  // a notice must not be a way past the lock.
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  useEffect(() => onPushOpened((route) => setPendingRoute(route)), []);
  useEffect(() => {
    if (!pendingRoute || !state.onDuty) return;
    actions.openRoute(pendingRoute);
    setPendingRoute(null);
  }, [pendingRoute, state.onDuty, actions]);

  // Pushes that arrive with the app open (the OS doesn't show these). A notice only
  // refreshes the feed: the shell announces it from there, now or once unlocked. Any
  // other push is toasted — straight away on duty, or held until the PIN is entered,
  // so a locked handset shows nothing but still misses nothing.
  const onDuty = useRef(state.onDuty);
  useEffect(() => {
    onDuty.current = state.onDuty;
  }, [state.onDuty]);
  const [heldPushes, setHeldPushes] = useState<ForegroundToast[]>([]);
  useEffect(
    () =>
      onForegroundPush((msg) => {
        if (msg.data.noticeId) {
          void queryClient.invalidateQueries({ queryKey: [api.notices.feed.id] });
          return;
        }
        if (!msg.title) return;
        const held: ForegroundToast = { title: msg.title, urgent: msg.data.category === "EMERGENCY" };
        if (onDuty.current) showPush(actions, held);
        else setHeldPushes((q) => q.concat([held]).slice(-MAX_TOASTS));
      }),
    [queryClient, actions]
  );
  useEffect(() => {
    if (!state.onDuty || heldPushes.length === 0) return;
    heldPushes.forEach((p) => showPush(actions, p));
    setHeldPushes([]);
  }, [state.onDuty, heldPushes, actions]);

  if (!membership) return <NotAGuard name={me.name} onSignOut={signOut} signingOut={signingOut} />;
  if (!state.onDuty) {
    return <ShiftScreen userId={me.id} guardName={me.name} societyName={membership.societyName} onSignOut={signOut} signingOut={signingOut} />;
  }
  return <GateShell onSignOut={signOut} signingOut={signingOut} seenNotices={seenNotices} />;
}

interface ForegroundToast {
  title: string;
  urgent: boolean;
}

function showPush(actions: GateActions, push: ForegroundToast) {
  actions.toast(push.urgent ? `Emergency: ${push.title}` : push.title, push.urgent ? "bad" : "ok", { urgent: push.urgent });
}

/** Signed in, but not as anyone who works a gate — a resident who opened the wrong app, say. */
function NotAGuard({ name, onSignOut, signingOut }: { name: string; onSignOut: () => void; signingOut: boolean }) {
  return (
    <AuthScreen footer={<GateButton label={signingOut ? "Signing out…" : "Sign out"} variant="secondary" loading={signingOut} onPress={onSignOut} />}>
      <IconTile path={iconPaths.shield} tone="hold" />
      <AuthTitle>This account can't run the gate</AuthTitle>
      <AuthLead>
        {name}, your account isn't registered as a guard. The gate handset is only for security staff the society office has added. Residents use the Sahaj resident app.
      </AuthLead>
    </AuthScreen>
  );
}

function RestoreFailed({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <AuthScreen footer={<GateButton label={retrying ? "Trying again…" : "Try again"} onPress={onRetry} loading={retrying} />}>
      <IconTile path={iconPaths.alertTriangle} tone="hold" />
      <AuthTitle>Can't reach Sahaj</AuthTitle>
      <AuthLead>{message} You are still signed in on this handset.</AuthLead>
    </AuthScreen>
  );
}

function ForcedChangeScreen() {
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
            <GateButton label="Sign in again" onPress={() => void controller.logout()} />
          ) : (
            <GateButton label={busy ? "Saving…" : "Save and continue"} onPress={submit} loading={busy} />
          )}
        </>
      }
    >
      <IconTile path={iconPaths.lock} tone="hold" />
      <AuthTitle>Set a new password</AuthTitle>
      <AuthLead marginBottom={14}>You signed in with a temporary password issued by the society office.</AuthLead>
      <NoteBox tone="warn" marginBottom={24}>
        Temporary passwords work once and expire in 24 hours. The gate stays locked until this is done.
      </NoteBox>
      <AuthField
        label="New password"
        secret
        revealable
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

/** The TOTP step. Guards never enable two-factor (it is an admin option); this is here so an admin covering the gate isn't stranded. */
function TwoFactorScreen() {
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
    <AuthScreen back={{ label: "Start again", onPress: () => controller.expire() }} footer={<GateButton label={busy ? "Verifying…" : "Verify"} onPress={submit} loading={busy} />}>
      <IconTile path={iconPaths.lock} />
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
