import React from "react";
import { View } from "react-native";
import { GateText } from "../../components/GateText";
import { SignalIcon } from "../../components/Icon";
import { colors } from "../../theme";
import { useClock } from "../../hooks/useClock";
import { useOffline } from "../../hooks/useOffline";

/** The simulated OS status row — clock, an OFFLINE pill when the handset has no signal, signal bars, battery. Rendered even while locked. */
export function StatusBarRow() {
  const clock = useClock();
  const offline = useOffline();
  return (
    <View style={{ height: 44, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 7 }}>
      <GateText variant="cardTitleLarge" style={{ fontSize: 13, lineHeight: 13 }}>
        {clock}
      </GateText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {offline ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(232,163,61,0.18)" }}>
            <GateText variant="label" color={colors.hold} style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
              OFFLINE
            </GateText>
          </View>
        ) : null}
        <SignalIcon color={colors.soft} />
        <View style={{ width: 19, height: 10, borderWidth: 1.4, borderColor: colors.soft, borderRadius: 3, padding: 1.4, justifyContent: "center" }}>
          <View style={{ width: "64%", height: "100%", backgroundColor: colors.soft, borderRadius: 1 }} />
        </View>
      </View>
    </View>
  );
}
