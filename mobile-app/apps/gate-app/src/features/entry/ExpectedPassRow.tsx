import React from "react";
import { Pressable, View } from "react-native";
import type { VisitorPass } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { colors } from "../../theme";
import { initials } from "../../utils/time";
import { passValidityLabel } from "../../utils/gate";

interface Props {
  pass: VisitorPass;
  onPress: () => void;
}

/** One row of the "Expected in the next hour" list — tapping it fills the code and submits it. */
export function ExpectedPassRow({ pass, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 15,
        backgroundColor: pressed ? colors.card2 : colors.card,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
        <GateText variant="cardTitle" color={colors.soft} style={{ fontSize: 13 }}>
          {initials(pass.name)}
        </GateText>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <GateText variant="cardTitle" style={{ marginBottom: 2 }}>
          {pass.name}
        </GateText>
        <GateText variant="meta" color={colors.soft}>
          {pass.purpose} · {pass.unit} · {passValidityLabel(pass)}
        </GateText>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: colors.card2 }}>
        <GateText variant="gateCodeKeypad" color={colors.go} style={{ fontSize: 14, letterSpacing: 1.7 }}>
          {pass.code}
        </GateText>
      </View>
    </Pressable>
  );
}
