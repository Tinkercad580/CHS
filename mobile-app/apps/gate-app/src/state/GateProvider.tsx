import React, { createContext, useContext, useEffect, useReducer } from "react";
import { gateReducer } from "./types";
import type { AppGateState } from "./types";
import { createInitialState } from "./initialState";
import { useGateActions, type GateActions } from "./actions";

interface GateContextValue {
  state: AppGateState;
  actions: GateActions;
}

const GateContext = createContext<GateContextValue | null>(null);

export function GateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gateReducer, undefined, createInitialState);
  const actions = useGateActions(dispatch);

  // Every timer this screen owns (toast dismissals, the verify tick, the alert
  // hold interval) must die with the provider — the same
  // `componentWillUnmount` clearAll the prototype's class component does.
  useEffect(() => () => actions.clearAllTimers(), [actions]);

  return <GateContext.Provider value={{ state, actions }}>{children}</GateContext.Provider>;
}

export function useGate(): GateContextValue {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useGate() must be used inside <GateProvider>");
  return ctx;
}
