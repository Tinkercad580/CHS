import { useEffect, useRef, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { SessionController } from "@chs/api-client";
import { useResident } from "../state/ResidentProvider";
import { useOpenRoute } from "../api/notifications";
import { isPushAvailable, onForegroundPush, onPushOpened, registerForPush, unregisterPush, type PushPermission } from "./push";

/**
 * Where push meets the app: registering after sign-in, unregistering whenever
 * the session ends, and turning a tapped or foreground notification into
 * navigation or a toast. push.ts knows Firebase; this file knows the app.
 *
 * The permission outcome lives in a module store rather than resident state
 * because registration starts the moment the session is signed in — before the
 * shell adopts the account and resets its state.
 */

export type PushState = PushPermission | "pending";

let pushState: PushState = isPushAvailable() ? "pending" : "unavailable";
const listeners = new Set<() => void>();

function setPushState(next: PushState) {
  pushState = next;
  listeners.forEach((l) => l());
}

export function usePushState(): PushState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pushState,
    () => pushState
  );
}

const DEVICE_NAME = `${Platform.OS} resident app`;

// Whether registration was started for the current session, so the one that
// ends it unregisters exactly once: signOut() first, then the session listener
// seeing the same sign-out, finds nothing left to do.
let registered = false;

/** After sign-in, never awaited: a slow round trip to Google must not hold up the first screen. */
export function startPush(): void {
  if (!isPushAvailable()) return setPushState("unavailable");
  registered = true;
  setPushState("pending");
  void registerForPush(DEVICE_NAME).then(setPushState);
}

/** Settings' "Allow notifications": asks the OS again and, if allowed, registers this phone. */
export async function retryPush(): Promise<PushState> {
  registered = true;
  setPushState("pending");
  const result = await registerForPush(DEVICE_NAME);
  setPushState(result);
  return result;
}

/**
 * Stops pushes to this phone for the account that was signed in. Best effort:
 * once the session is already gone the server call fails, but the FCM token is
 * still deleted, so the next account on this phone gets a fresh one and the
 * server's copy of the old one stops working.
 */
async function stopPush(): Promise<void> {
  if (!registered) return;
  registered = false;
  setPushState(isPushAvailable() ? "pending" : "unavailable");
  await unregisterPush();
}

/** Stops pushes to this phone for this account, then signs out. The unregister needs the session, so it goes first. */
export async function signOut(session: SessionController): Promise<void> {
  await stopPush();
  await session.logout();
}

/**
 * Ties push registration to the session for the life of the app: arriving at
 * `signedIn` registers this phone, and leaving it by any road — the sign-out
 * button, a revoked session, a refresh token the server rejected — unregisters
 * it. Returns the unsubscribe.
 */
export function bindPushToSession(session: SessionController): () => void {
  let signedIn = session.state.status === "signedIn";
  if (signedIn) startPush();
  return session.subscribe((next) => {
    const now = next.status === "signedIn";
    if (now && !signedIn) startPush();
    if (!now && signedIn) void stopPush();
    signedIn = now;
  });
}

/** Mounted once in the shell: a tapped notification opens its screen, one arriving in the foreground shows as a toast. */
export function usePushRouting(): void {
  const { actions } = useResident();
  const openRoute = useOpenRoute();
  // Subscribed once: onPushOpened also replays the notification that launched the
  // app, so re-subscribing whenever the callback changed would open it again.
  const openRef = useRef(openRoute);
  openRef.current = openRoute;
  const toastRef = useRef(actions.toast);
  toastRef.current = actions.toast;

  useEffect(() => onPushOpened((route) => openRef.current(route)), []);
  useEffect(
    () =>
      onForegroundPush((msg) => {
        const text = msg.title && msg.body ? `${msg.title} — ${msg.body}` : msg.title || msg.body;
        if (text) toastRef.current(text);
      }),
    []
  );
}
