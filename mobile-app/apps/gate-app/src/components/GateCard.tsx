import React from "react";
import { View, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** A 3px coloured left edge — used for entry/staff rows to flag their state at a glance. */
  edgeColor?: string;
  padding?: number;
  /** Makes the whole card tappable, with the same eased press-scale as GateButton. */
  onPress?: () => void;
}

export function GateCard({ children, style, edgeColor, padding = 14, onPress }: Props) {
  const cardStyle = (pressed: boolean): ViewStyle => ({
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: edgeColor ? 3 : 1,
    borderLeftColor: edgeColor ?? colors.line,
    borderRadius: radius.card + 1,
    backgroundColor: pressed ? colors.card2 : colors.card,
    padding,
    ...style,
  });

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} style={({ pressed }) => cardStyle(pressed)}>
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle(false)}>{children}</View>;
}
