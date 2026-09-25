import { asyncTokenStore, createApiClient, createRealtime, localStorageTokenStore, SessionController } from "@chs/api-client";
import { createQueryClient } from "@chs/api-client/react";
import { focusManager, onlineManager } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

/**
 * The gate app's API client, realtime socket and session.
 *
 * The session carries the whole of the guard's sign-in (MASTER_SPEC A2):
 * lookup, password, activation, forced change, two-factor. `client: "gate"` in
 * those calls is what the server uses to refuse accounts that aren't guards.
 * Device binding and a server-checked PIN per shift are C9 (Phase 9); until
 * then the duty PIN is a local screen lock (features/signin/shiftPin.ts).
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
    ? localStorageTokenStore("chs.gate.session")
    : asyncTokenStore({
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
        deleteItem: (k) => SecureStore.deleteItemAsync(k),
      }, "chs.gate.session");

export const apiClient = createApiClient({
  baseUrl: `${origin}/api/v1`,
  tokens,
  headers: { "X-Client": "gate" },
  onSessionExpired: () => session.expire(),
});

export const realtime = createRealtime({ origin, getAccessToken: () => apiClient.tokens.get()?.accessToken });

export const session = new SessionController(apiClient, { client: "gate", deviceName: `${Platform.OS} gate handset` });

/**
 * The React Query cache, with the app's lifecycle wired in. React Query learns
 * about focus and connectivity from the browser's window and network events; a
 * phone has neither, so on native:
 *
 *  - focus follows `AppState`: coming back to the foreground refetches stale
 *    queries (the `refetchOnWindowFocus` default), so a handset left in a pocket
 *    shows current notices and plates when it is picked up;
 *  - online follows expo-network: regaining a connection refetches too.
 *
 * `networkMode: "always"` keeps requests going out while the device reports no
 * network, rather than pausing them. A paused first load would sit on its
 * skeleton until the signal came back — a wait the guard can't escape — whereas
 * a failed one shows LoadError with Retry, and the header already says OFFLINE.
 */
export const queryClient = createQueryClient();
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  queries: { ...defaults.queries, networkMode: "always" },
  mutations: { ...defaults.mutations, networkMode: "always" },
});

if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (status) => setFocused(status === "active"));
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((net) => setOnline(net.isConnected !== false));
    return () => sub.remove();
  });
}
