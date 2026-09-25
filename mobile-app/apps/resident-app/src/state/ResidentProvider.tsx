import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from "react";
import { residentReducer } from "./types";
import type { AppResidentState } from "./types";
import { createInitialState } from "./initialState";
import { useResidentActions, type ResidentActions } from "./actions";
import { loadDevicePrefs } from "./devicePrefs";

interface ResidentContextValue {
  state: AppResidentState;
  actions: ResidentActions;
}

const ResidentContext = createContext<ResidentContextValue | null>(null);

export function ResidentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(residentReducer, undefined, createInitialState);

  // A handful of actions (reading the in-progress invite form, the pass being
  // shared, the current theme, etc.) need the *latest* state synchronously rather than
  // through the reducer's functional "UPDATE" form — this ref makes that safe
  // without recreating every callback on each render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const getState = useCallback(() => stateRef.current, []);

  const actions = useResidentActions(dispatch, getState);

  // Every timer this app owns (toast dismissals, the QR countdown) must die with
  // the provider — the same `componentWillUnmount` clearAll the prototype's
  // class component does.
  useEffect(() => () => actions.clearAllTimers(), [actions]);

  // The theme and language this phone remembers, read once. Until it answers
  // (a keychain read, well before the session's own restore finishes) the
  // defaults stand.
  useEffect(() => {
    let live = true;
    void loadDevicePrefs().then((prefs) => {
      if (live) actions.hydratePrefs(prefs);
    });
    return () => {
      live = false;
    };
  }, [actions]);

  return <ResidentContext.Provider value={{ state, actions }}>{children}</ResidentContext.Provider>;
}

export function useResident(): ResidentContextValue {
  const ctx = useContext(ResidentContext);
  if (!ctx) throw new Error("useResident() must be used inside <ResidentProvider>");
  return ctx;
}
