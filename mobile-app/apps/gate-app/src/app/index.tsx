import React from "react";
import { View } from "react-native";
import { useGate } from "../state/GateProvider";
import { StatusBarRow } from "../features/shell/StatusBarRow";
import { SignInScreen } from "../features/signin/SignInScreen";
import { GateShell } from "../features/shell/GateShell";
import { colors } from "../theme";

/**
 * The gate handset has exactly one route. The simulated OS status row (clock,
 * signal, battery) is system chrome and shows either way; which of the two
 * subtrees below it mounts is gated on `onDuty` — not just which chrome shows —
 * so a locked handset never mounts the shell that holds every live visitor
 * code (README.md, "Sign-in gate").
 */
export default function GateApp() {
  const { state } = useGate();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBarRow />
      {state.onDuty ? <GateShell /> : <SignInScreen />}
    </View>
  );
}
