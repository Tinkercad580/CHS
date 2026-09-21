import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { heldParcelsCount } from "../../state/selectors";
import { GuardHeader } from "./GuardHeader";
import { TabBar } from "./TabBar";
import { SHIFT_LINE } from "../signin/SignInScreen";
import { EntryScreen } from "../entry/EntryScreen";
import { ResultSheet } from "../entry/ResultSheet";
import { WalkinScreen } from "../walkin/WalkinScreen";
import { StaffScreen } from "../staff/StaffScreen";
import { LogScreen } from "../log/LogScreen";
import { ParcelsScreen } from "../parcels/ParcelsScreen";
import { ParcelSheet } from "../parcels/ParcelSheet";
import { MoreScreen } from "../more/MoreScreen";
import { AlertScreen } from "../alert/AlertScreen";
import { PlateLookupScreen } from "../plate/PlateLookupScreen";
import { HandoverScreen } from "../handover/HandoverScreen";
import { ToastStack } from "../../components/ToastStack";

/**
 * Everything a signed-in guard sees: the guard header, the current screen, the
 * tab bar, and any open overlay. This whole tree is only ever mounted from
 * `_layout.tsx` when `onDuty` is true — see SignInScreen's header comment.
 */
export function GateShell() {
  const { state, actions } = useGate();
  const held = heldParcelsCount(state);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GuardHeader guardName={state.guardName ?? ""} shiftLine={SHIFT_LINE} onSignOut={actions.signOut} onAlert={() => actions.go("alert", "Opened the alert screen")} />

      <View style={{ flex: 1 }}>
        {state.screen === "entry" ? <EntryScreen /> : null}
        {state.screen === "staff" ? <StaffScreen /> : null}
        {state.screen === "log" ? <LogScreen /> : null}
        {state.screen === "parcels" ? <ParcelsScreen /> : null}
        {state.screen === "more" ? <MoreScreen /> : null}
        {state.screen === "walkin" ? <WalkinScreen /> : null}
        {state.screen === "alert" ? <AlertScreen /> : null}
        {state.screen === "plate" ? <PlateLookupScreen /> : null}
        {state.screen === "handover" ? <HandoverScreen /> : null}
      </View>

      <TabBar screen={state.screen} heldCount={held} onTab={(s) => actions.go(s, `Tapped ${s} tab`)} />

      {state.result ? <ResultSheet /> : null}
      {state.parcelOpen ? <ParcelSheet /> : null}
      <ToastStack toasts={state.toasts} />
    </View>
  );
}
