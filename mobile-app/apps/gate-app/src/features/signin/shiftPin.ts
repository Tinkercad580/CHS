import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The duty PIN, kept on this handset only.
 *
 * The API has no PIN (device binding and PIN shift unlock are MASTER_SPEC C9,
 * Phase 9), so this is not an identity check — the password sign-in is. The PIN
 * is what the guard chooses when their shift starts, and all it does is unlock
 * this handset again for the same signed-in account: after the door icon locks
 * it, or after the app restarts with the session still stored.
 *
 * It lives exactly as long as the session. SessionGate clears it on every
 * password sign-in and every sign-out, so each shift starts by choosing a new
 * one. Five wrong entries in a row end the session outright: ShiftScreen signs
 * out (push unregistered, refresh token revoked) and the guard needs their password.
 *
 * On a phone it sits in the OS keychain next to the session tokens; the web
 * preview has no keychain and uses localStorage.
 */

export const PIN_LENGTH = 4;
export const MAX_PIN_FAILURES = 5;

export interface StoredPin {
  pin: string;
  /** Wrong entries since the last right one — persisted, so restarting the app does not reset the count. */
  failures: number;
  /** When the PIN was chosen, i.e. when the shift started — so "on duty since" survives a restart. */
  startedAt: string;
}

const keyFor = (userId: string) => `chs.gate.dutyPin.${userId}`;

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeRaw(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage refused (private window): the PIN just won't survive a reload.
    }
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function loadPin(userId: string): Promise<StoredPin | null> {
  try {
    const raw = await readRaw(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPin>;
    if (typeof parsed.pin !== "string" || parsed.pin.length !== PIN_LENGTH) return null;
    return { pin: parsed.pin, failures: Number(parsed.failures) || 0, startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString() };
  } catch {
    return null;
  }
}

export async function savePin(userId: string, value: StoredPin): Promise<void> {
  await writeRaw(keyFor(userId), JSON.stringify(value));
}

export async function clearPin(userId: string): Promise<void> {
  try {
    await writeRaw(keyFor(userId), null);
  } catch {
    // Nothing to clear.
  }
}
