import React from "react";
import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";

interface Props extends ViewProps {
  edge?: string;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/** The bordered white card used everywhere — optionally with a 3px left status edge (bill/utility/tenant cards). */
export function Card({ edge, padding = spacing.s15, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: edge ? 3 : 1,
          borderLeftColor: edge ?? colors.border,
          borderRadius: radius.card,
          backgroundColor: colors.surface,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
