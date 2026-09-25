import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { isDrillDownScreen, type GateActions } from "../../state/actions";
import type { AppGateState } from "../../state/types";

/**
 * The Android back button, mapped onto the handset's own screen state (there is
 * one router route; screens are chosen by `state.screen`). Each press undoes one
 * thing, innermost first, and does what that screen's on-screen back control does:
 *
 *   an open sheet (verdict, parcel) → closes it
 *   a notice                        → the notices list (NoticeScreen's back)
 *   any other drill-down            → whatever opened it (`goBack`)
 *   Staff, Log, Parcels, More       → Entry
 *   Entry                           → not handled, so Android leaves the app
 *
 * Only mounted with the shell. On the PIN and sign-in screens the default applies.
 */
export function useHardwareBack(state: AppGateState, actions: GateActions) {
  // One listener for the shell's lifetime, reading the latest state when pressed.
  const latest = useRef({ state, actions });
  useEffect(() => {
    latest.current = { state, actions };
  }, [state, actions]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const { state: s, actions: a } = latest.current;
      if (s.result) a.closeResult();
      else if (s.parcelOpen) a.closeParcel();
      else if (s.screen === "notice") a.go("notices");
      else if (isDrillDownScreen(s.screen)) a.goBack();
      else if (s.screen !== "entry") a.go("entry");
      else return false;
      return true;
    });
    return () => sub.remove();
  }, []);
}
