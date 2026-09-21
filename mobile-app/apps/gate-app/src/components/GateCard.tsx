import React from "react";
import { View, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** A 3px coloured left edge — used for entry/staff rows to flag their state at a glance. */
  edgeColor?: string;
  padding?: number;
}

export function GateCard({ children, style, edgeColor, padding = 14 }: Props) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.line,
          borderLeftWidth: edgeColor ? 3 : 1,
          borderLeftColor: edgeColor ?? colors.line,
          borderRadius: radius.card + 1,
          backgroundColor: colors.card,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
