import { createApiClient, createRealtime, localStorageTokenStore, SessionController } from "@chs/api-client";
import { createQueryClient } from "@chs/api-client/react";

/**
 * The admin console's one API client, realtime socket and session.
 *
 * With no VITE_API_ORIGIN the console talks to its own origin: the Vite dev
 * server proxies /api and /realtime to the API in development, nginx does it
 * in production. Set VITE_API_ORIGIN only when the API lives elsewhere.
 */
const origin = import.meta.env.VITE_API_ORIGIN || window.location.origin;

export const apiClient = createApiClient({
  baseUrl: `${origin}/api/v1`,
  tokens: localStorageTokenStore("chs.admin.session"),
  headers: { "X-Client": "admin-web" },
  onSessionExpired: () => session.expire(),
});

export const realtime = createRealtime({ origin, getAccessToken: () => apiClient.tokens.get()?.accessToken });

export const session = new SessionController(apiClient, { client: "admin", deviceName: navigator.userAgent.slice(0, 90) });

/**
 * The console's one query cache. Created here rather than inside ApiProvider
 * so signing out can empty it: the next person to sign in on this browser must
 * never be shown the previous one's rows, even for the instant before refetch.
 */
export const queryClient = createQueryClient();
