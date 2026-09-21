import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { vehicles } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { SHIFT_LINE } from "../signin/SignInScreen";

export function MoreScreen() {
  const { state, actions } = useGate();

  const items = [
    { key: "alert", label: "Raise an alert", detail: "Medical, fire, security or other", icon: iconPaths.alertTriangle, color: colors.stop, go: () => actions.go("alert", "Opened the alert screen") },
    { key: "plate", label: "Plate lookup", detail: `${vehicles.length} registered vehicles`, icon: iconPaths.plate, color: colors.go, go: () => actions.go("plate", "Opened plate lookup") },
    {
      key: "handover",
      label: "Shift handover",
      detail: state.handoverDone ? "Handed over" : "Closing at 10:00pm",
      icon: iconPaths.handover,
      color: colors.soft,
      go: () => actions.go("handover", "Opened shift handover"),
    },
    { key: "walkin", label: "Walk-in entry", detail: "No code, ask the flat", icon: iconPaths.entryTab, color: colors.hold, go: actions.startWalkin },
    { key: "signout", label: "End shift and lock", detail: "Signs you out of the handset", icon: iconPaths.signOut, color: colors.stop, go: actions.signOut },
  ] as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
        More
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
        {state.guardName} · {SHIFT_LINE}
      </GateText>

      <View style={{ gap: 10 }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.go}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              backgroundColor: pressed ? colors.card2 : colors.card,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            })}
          >
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: withAlpha(item.color, 0.16), alignItems: "center", justifyContent: "center" }}>
              <Icon d={item.icon} color={item.color} size={20} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <GateText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
                {item.label}
              </GateText>
              <GateText variant="meta" color={colors.soft}>
                {item.detail}
              </GateText>
            </View>
            <Icon d={iconPaths.forwardChevron} color={colors.dim} size={17} strokeWidth={2.2} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
