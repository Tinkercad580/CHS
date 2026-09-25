import { api } from "@chs/contract";
import Constants from "expo-constants";
import { PermissionsAndroid, Platform } from "react-native";
import { apiClient } from "../api/client";

/**
 * Push notifications — Firebase Cloud Messaging through React Native Firebase.
 *
 * Firebase is linked into the native build only when google-services.json /
 * GoogleService-Info.plist were present at prebuild (app.config.ts), so the
 * module is reached lazily and everything here degrades to "no push" when it
 * isn't there — a build without Firebase still runs, and so does the web
 * preview, which never has push.
 *
 * The server sends `notification` messages (title and body), which the OS
 * shows on its own while the app is in the background. In the foreground the
 * app's realtime inbox already updates; `onForegroundPush` lets a screen
 * surface a banner as well.
 */

const APP = "gate" as const;

type RemoteMessage = { data?: Record<string, string | object>; notification?: { title?: string; body?: string } };
type Messaging = object;
type Mod = {
  getMessaging(): Messaging;
  getToken(m: Messaging): Promise<string>;
  deleteToken(m: Messaging): Promise<void>;
  onTokenRefresh(m: Messaging, fn: (t: string) => void): () => void;
  onMessage(m: Messaging, fn: (msg: RemoteMessage) => void): () => void;
  onNotificationOpenedApp(m: Messaging, fn: (msg: RemoteMessage) => void): () => void;
  getInitialNotification(m: Messaging): Promise<RemoteMessage | null>;
  requestPermission(m: Messaging): Promise<number>;
  setBackgroundMessageHandler(m: Messaging, fn: (msg: RemoteMessage) => Promise<void>): void;
  AuthorizationStatus: { AUTHORIZED: number; PROVISIONAL: number };
};

const enabled = Platform.OS !== "web" && !!(Constants.expoConfig?.extra as { pushEnabled?: boolean } | undefined)?.pushEnabled;
let mod: Mod | null | undefined;
let messaging: Messaging | null = null;

function firebase(): { mod: Mod; m: Messaging } | null {
  if (mod === undefined) {
    mod = null;
    if (enabled) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mod = require("@react-native-firebase/messaging") as Mod;
        messaging = mod.getMessaging();
        // Notification messages are displayed by the OS; nothing to do in the background,
        // but registering a handler keeps RN Firebase from warning on data messages.
        mod.setBackgroundMessageHandler(messaging, async () => undefined);
      } catch {
        mod = null;
      }
    }
  }
  return mod && messaging ? { mod, m: messaging } : null;
}

/** True when this build can receive push at all. */
export const isPushAvailable = (): boolean => firebase() !== null;

/**
 * Android channels, created before anything can arrive. The server picks
 * `emergency` for EMERGENCY notices: maximum importance, heard in Do Not Disturb.
 */
async function ensureChannels() {
  if (Platform.OS !== "android") return;
  // Loaded here, not at the top: importing expo-notifications registers a push-token
  // listener as a side effect, which the web preview answers with a console warning.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");
  await Notifications.setNotificationChannelAsync("default", { name: "Updates", importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.setNotificationChannelAsync("emergency", {
    name: "Emergencies",
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export type PushPermission = "granted" | "denied" | "unavailable";

/** Ask the OS. Android 13+ has its own runtime permission; iOS asks through Firebase. */
export async function requestPushPermission(): Promise<PushPermission> {
  const fb = firebase();
  if (!fb) return "unavailable";
  if (Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version >= 33) {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (res !== PermissionsAndroid.RESULTS.GRANTED) return "denied";
  }
  const status = await fb.mod.requestPermission(fb.m);
  return status === fb.mod.AuthorizationStatus.AUTHORIZED || status === fb.mod.AuthorizationStatus.PROVISIONAL ? "granted" : "denied";
}

let current: string | null = null;
/** True once this phone's token has been deleted and not fetched again — so a second unregister has nothing to do. */
let tokenDeleted = false;
let stopRefresh: (() => void) | null = null;

/**
 * Register this phone with the API after sign-in. Not awaited by the caller:
 * a slow round trip to Google must never hold up the first screen.
 */
export async function registerForPush(deviceName?: string): Promise<PushPermission> {
  const fb = firebase();
  if (!fb) return "unavailable";
  try {
    await ensureChannels();
    const permission = await requestPushPermission();
    if (permission !== "granted") return permission;
    const token = await fb.mod.getToken(fb.m);
    tokenDeleted = false;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    await apiClient.call(api.notifications.registerDevice, { body: { token, app: APP, platform, deviceName } });
    current = token;
    stopRefresh?.();
    // Tokens rotate (reinstall, restore, Google's own refresh); follow them.
    stopRefresh = fb.mod.onTokenRefresh(fb.m, (t) => {
      current = t;
      void apiClient.call(api.notifications.registerDevice, { body: { token: t, app: APP, platform, deviceName } }).catch(() => undefined);
    });
    return "granted";
  } catch {
    return "unavailable";
  }
}

let unregistering: Promise<void> | null = null;

/**
 * When the session ends: stop pushes to this phone for this account, and drop the
 * token so the next account gets a fresh one. Called before a sign-out (while the
 * API still accepts the call) and again, best-effort, whenever the session ends by
 * itself — expired, revoked, refresh rejected. By then the tokens are gone and the
 * server can't be told, so only the local token is deleted; FCM then refuses it, and
 * the server prunes it on its next send. Concurrent calls share one run, and a call
 * after the token is already gone does nothing (so the sign-out button and the
 * session listener can both call it).
 */
export function unregisterPush(): Promise<void> {
  unregistering ??= runUnregister().finally(() => {
    unregistering = null;
  });
  return unregistering;
}

async function runUnregister(): Promise<void> {
  const fb = firebase();
  stopRefresh?.();
  stopRefresh = null;
  if (!fb || tokenDeleted) return;
  if (apiClient.tokens.get()) {
    try {
      const token = current ?? (await fb.mod.getToken(fb.m));
      await apiClient.call(api.notifications.unregisterDevice, { body: { token } });
    } catch {
      // The session is ending regardless.
    }
  }
  try {
    await fb.mod.deleteToken(fb.m);
    tokenDeleted = true;
  } catch {
    /* ditto */
  }
  current = null;
}

/** The screen a notification opens: the server puts it in `data.route`. */
export function routeOf(msg: RemoteMessage | null | undefined): string | null {
  const r = msg?.data?.route;
  return typeof r === "string" && r.startsWith("/") ? r : null;
}

/** Taps, including the one that launched the app from cold. */
export function onPushOpened(handler: (route: string, data: Record<string, string>) => void): () => void {
  const fb = firebase();
  if (!fb) return () => undefined;
  const fire = (msg: RemoteMessage | null) => {
    const route = routeOf(msg);
    if (route) handler(route, (msg?.data ?? {}) as Record<string, string>);
  };
  const off = fb.mod.onNotificationOpenedApp(fb.m, fire);
  void fb.mod.getInitialNotification(fb.m).then(fire).catch(() => undefined);
  return off;
}

/** Pushes that arrive while the app is open (the OS doesn't show these). */
export function onForegroundPush(handler: (msg: { title: string; body: string; data: Record<string, string> }) => void): () => void {
  const fb = firebase();
  if (!fb) return () => undefined;
  return fb.mod.onMessage(fb.m, (msg) =>
    handler({ title: msg.notification?.title ?? "", body: msg.notification?.body ?? "", data: (msg.data ?? {}) as Record<string, string> }),
  );
}
