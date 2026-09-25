import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Push to the resident and gate apps with Firebase Cloud Messaging, through
 * Google's official Admin SDK: HTTP v1 over a pooled HTTP/2 connection, OAuth
 * tokens minted and refreshed by the SDK, and multicast — one call reaches all
 * of a person's phones, with a result per phone.
 *
 * Credentials are a service account, not google-services.json /
 * GoogleService-Info.plist (those are public identifiers that let a device
 * receive; sending is privileged). In order of preference:
 *   FIREBASE_SERVICE_ACCOUNT_FILE — the JSON exactly as Firebase downloads it;
 *   FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY;
 *   GOOGLE_APPLICATION_CREDENTIALS / workload identity on Google Cloud.
 * A missing or broken credential logs why and leaves push off — it never
 * stops the API from starting.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function readServiceAccount(): ServiceAccount | null {
  const file = env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (file) {
    // Relative paths are tried from the working directory and its parent: npm
    // workspace scripts run inside backend/, but people write the path from the repo root.
    const candidates = isAbsolute(file) ? [file] : [resolve(process.cwd(), file), resolve(process.cwd(), "..", file)];
    const tried: string[] = [];
    for (const path of candidates) {
      try {
        const sa = JSON.parse(readFileSync(path, "utf8")) as Partial<ServiceAccount>;
        if (sa.project_id && sa.client_email && sa.private_key) return sa as ServiceAccount;
        tried.push(`${path}: missing project_id / client_email / private_key`);
      } catch (err) {
        tried.push(`${path}: ${(err as Error).message}`);
      }
    }
    logger.error({ tried }, "FCM: could not read the service account file");
    return null;
  }
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    // .env files can't hold newlines, so keys are stored with literal \n.
    return { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  }
  return null;
}

const app: App | null = (() => {
  if (env.PUSH_PROVIDER !== "fcm") return null;
  try {
    const existing = getApps().find((a) => a.name === "chs-push");
    if (existing) return existing;
    const sa = readServiceAccount();
    if (sa) {
      logger.info({ project: sa.project_id }, "FCM: service account loaded");
      return initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id }, "chs-push");
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_PROJECT_ID) {
      logger.info("FCM: using Google application default credentials");
      return initializeApp({ credential: applicationDefault(), projectId: env.FIREBASE_PROJECT_ID }, "chs-push");
    }
  } catch (err) {
    logger.error({ err }, "FCM: could not initialise Firebase Admin");
    return null;
  }
  logger.error("PUSH_PROVIDER=fcm but no Firebase credentials are configured — push is off");
  return null;
})();

export type PushStatus = "ok" | "log" | "misconfigured";
export function pushStatus(): PushStatus {
  if (env.PUSH_PROVIDER === "log") return "log";
  return app ? "ok" : "misconfigured";
}

export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  /** FCM data values must be strings. `route` tells the app which screen a tap opens. */
  data: Record<string, string>;
  /** Emergency: high priority, its own Android channel, time-sensitive on iOS. */
  urgent?: boolean;
  /** Unread count, for the app icon badge. */
  badge?: number;
  /** Replaces an earlier push with the same tag on the phone (e.g. one per bill). */
  collapseKey?: string;
}

export interface PushResult {
  token: string;
  ok: boolean;
  ref?: string;
  error?: string;
  /** The install is gone (uninstalled, token rotated): delete the token instead of retrying. */
  unregistered?: boolean;
  /** Worth retrying later (quota, FCM unavailable, network). */
  transient?: boolean;
}

const DEAD = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/mismatched-credential"]);
const TRANSIENT = new Set(["messaging/internal-error", "messaging/server-unavailable", "messaging/message-rate-exceeded", "messaging/device-message-rate-exceeded", "messaging/quota-exceeded", "app/network-error", "app/network-timeout"]);

/** Send one notification to up to 500 devices. Never throws; results are per token. */
export async function sendPush(msg: PushMessage): Promise<PushResult[]> {
  if (!msg.tokens.length) return [];
  if (env.PUSH_PROVIDER === "log") {
    logger.info({ title: msg.title, devices: msg.tokens.length, data: msg.data }, "push (log provider, not sent)");
    return msg.tokens.map((token) => ({ token, ok: true, ref: "log" }));
  }
  if (!app) return msg.tokens.map((token) => ({ token, ok: false, error: "Firebase is not configured", transient: false }));

  const message: MulticastMessage = {
    tokens: msg.tokens.slice(0, 500),
    notification: { title: msg.title, body: msg.body },
    data: msg.data,
    android: {
      priority: msg.urgent ? "high" : "normal",
      collapseKey: msg.collapseKey,
      // Messages that can't be delivered within a day are stale; an emergency within an hour.
      ttl: (msg.urgent ? 3600 : 86_400) * 1000,
      notification: { channelId: msg.urgent ? "emergency" : "default", sound: "default", ...(msg.badge !== undefined ? { notificationCount: msg.badge } : {}) },
    },
    apns: {
      headers: { "apns-priority": msg.urgent ? "10" : "5", ...(msg.collapseKey ? { "apns-collapse-id": msg.collapseKey } : {}) },
      payload: { aps: { sound: "default", ...(msg.badge !== undefined ? { badge: msg.badge } : {}), ...(msg.urgent ? { "interruption-level": "time-sensitive" } : {}) } },
    },
  };
  try {
    const res = await getMessaging(app).sendEachForMulticast(message);
    return res.responses.map((r, i) => {
      const token = message.tokens[i]!;
      if (r.success) return { token, ok: true, ref: r.messageId };
      const code = r.error?.code ?? "";
      return { token, ok: false, error: `${code}: ${r.error?.message ?? "failed"}`, unregistered: DEAD.has(code), transient: TRANSIENT.has(code) };
    });
  } catch (err) {
    // The whole call failed (auth, network): every token is worth retrying.
    return message.tokens.map((token) => ({ token, ok: false, error: (err as Error).message, transient: true }));
  }
}
