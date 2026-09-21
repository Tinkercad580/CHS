import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { withAlpha } from "../theme";

interface Props {
  label: string;
  color: string;
  tinted?: boolean;
}

/** The small INSIDE / EXITED / HELD-style pill used on entry, staff and parcel rows. */
export function StatusPill({ label, color, tinted = true }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: tinted ? withAlpha(color, 0.16) : color,
      }}
    >
      <GateText variant="statusPillGate" color={color}>
        {label}
      </GateText>
    </View>
  );
}
