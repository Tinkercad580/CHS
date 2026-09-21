import React from "react";
import { Pressable } from "react-native";
import { GateText } from "./GateText";
import { colors } from "../theme";

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

/** All / Inside / Out — the filter row on Staff and Log. */
export function FilterPill({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.go : colors.line,
        backgroundColor: active ? colors.go : colors.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GateText variant="label" color={active ? colors.goInk : colors.soft} style={{ fontSize: 12.5 }}>
        {label}
      </GateText>
    </Pressable>
  );
}
