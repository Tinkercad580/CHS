import { asyncTokenStore, createApiClient, createRealtime, localStorageTokenStore, SessionController } from "@chs/api-client";
import { focusManager, onlineManager } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

/**
 * The resident app's API client, realtime socket and session.
 *
 * The API origin is EXPO_PUBLIC_API_ORIGIN, inlined at bundle time, or failing
 * that `expo.extra.apiOrigin`, which app.config.ts sets from the same variable
 * at config time. On a phone the session lives in the OS keychain
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

// React Query learns about focus and connectivity from the browser's window
// events, which a phone doesn't have. Coming back to the app counts as focus,
// so stale screens refetch the way they do on a browser tab; losing the network
// pauses queries and regaining it resumes them. A state that doesn't say
// (isConnected undefined) is treated as online, so nothing waits on a guess.
if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (status) => setFocused(status === "active"));
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
    return () => sub.remove();
  });
}
