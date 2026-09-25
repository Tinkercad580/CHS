import { asyncTokenStore, createApiClient, createRealtime, localStorageTokenStore, SessionController } from "@chs/api-client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The resident app's API client, realtime socket and session.
 *
 * The API origin comes from `expo.extra.apiOrigin` (app.json) or
 * EXPO_PUBLIC_API_ORIGIN. On a phone the session lives in the OS keychain
 * (expo-secure-store); the web preview has no keychain and uses localStorage.
 */
const origin =
  process.env.EXPO_PUBLIC_API_ORIGIN ||
  (Constants.expoConfig?.extra as { apiOrigin?: string } | undefined)?.apiOrigin ||
  "http://localhost:4100";

const tokens =
  Platform.OS === "web"
    ? localStorageTokenStore("chs.resident.session")
    : asyncTokenStore({
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
        deleteItem: (k) => SecureStore.deleteItemAsync(k),
      }, "chs.resident.session");

export const apiClient = createApiClient({
  baseUrl: `${origin}/api/v1`,
  tokens,
  headers: { "X-Client": "resident" },
  onSessionExpired: () => session.expire(),
});

export const realtime = createRealtime({ origin, getAccessToken: () => apiClient.tokens.get()?.accessToken });

export const session = new SessionController(apiClient, { client: "resident", deviceName: `${Platform.OS} resident app` });
