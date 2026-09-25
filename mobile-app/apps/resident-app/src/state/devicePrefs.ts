import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Language } from "@sahaj/shared";

/**
 * The two settings that belong to this phone rather than to the resident store,
 * which resets on every sign-out: the theme and the language. They are kept
 * where the session is (the keychain through expo-secure-store, localStorage on
 * the web preview) because the app has no other on-device storage. Reads and
 * writes never throw: a phone that can't store them just starts from the
 * defaults next time.
 */

export interface DevicePrefs {
  dark?: boolean;
  language?: Language;
}

const THEME_KEY = "chs.resident.theme";
const LANGUAGE_KEY = "chs.resident.language";

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "mr" || value === "hi";
}

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else void SecureStore.setItemAsync(key, value).catch(() => undefined);
  } catch {
    // Private browsing or a locked keychain: the choice holds for this run only.
  }
}

/** What this phone remembers. A field is absent when nothing was ever chosen. */
export async function loadDevicePrefs(): Promise<DevicePrefs> {
  const [theme, language] = await Promise.all([read(THEME_KEY), read(LANGUAGE_KEY)]);
  return {
    dark: theme === "dark" ? true : theme === "light" ? false : undefined,
    language: isLanguage(language) ? language : undefined,
  };
}

export function saveTheme(dark: boolean): void {
  write(THEME_KEY, dark ? "dark" : "light");
}

export function saveLanguage(language: Language): void {
  write(LANGUAGE_KEY, language);
}
