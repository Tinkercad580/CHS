import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, queryKey } from "@chs/api-client";
import { useSession, useSessionController } from "@chs/api-client/react";
import { api } from "@chs/contract";
import { queryClient } from "../api/client";
import { adminMemberships, useConsoleMe } from "../api/society";
import { ForcedChangeScreen, NotAdminScreen, SignInScreen, TwoFactorScreen, UnreachableScreen } from "../features/auth/SignInScreens";

/**
 * Decides what the console shows from the session state and nothing else.
 *
 * Start-up restores a stored session with one `/me` call. Until it answers
 * the page is the bare canvas — no splash, no timer: the wait is exactly the
 * request, and a fast one is not seen at all. If the API cannot be reached
 * the tokens are kept and the user gets a retry, rather than being signed
 * out by a network blip.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSessionController();
  const state = useSession();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const started = useRef(false);

  const restore = useCallback(async () => {
    setRetrying(true);
    try {
      await session.restore();
      setRestoreError(null);
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    } finally {
      setRetrying(false);
    }
  }, [session]);

  useEffect(() => {
    // StrictMode runs effects twice in development; one restore is enough.
    if (started.current) return;
    started.current = true;
    void restore();
  }, [restore]);

  // One person's cached rows must never show for the next one on this
  // browser. Signing out empties the cache; signing in seeds `me` so the
  // first render reads the user who just signed in.
  useEffect(() => {
    if (state.status === "signedOut") queryClient.clear();
    if (state.status === "signedIn") queryClient.setQueryData(queryKey(api.me.get, undefined), state.me);
  }, [state]);

  if (state.status === "unknown") {
    if (restoreError) return <UnreachableScreen message={restoreError} onRetry={() => void restore()} busy={retrying} />;
    return <div style={{ minHeight: "100vh", background: "var(--canvas,#F7F9F8)" }} />;
  }
  if (state.status === "signedOut") return <SignInScreen />;
  if (state.status === "passwordChange") return <ForcedChangeScreen />;
  if (state.status === "twoFactor") return <TwoFactorScreen />;
  return <AdminOnly>{children}</AdminOnly>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const me = useConsoleMe();
  if (!adminMemberships(me).length && !me.isPlatformAdmin) return <NotAdminScreen name={me.name} mobile={me.mobile} />;
  return <>{children}</>;
}
