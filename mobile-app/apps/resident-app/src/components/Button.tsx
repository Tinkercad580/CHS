import React from "react";
import { ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { radius } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";
import { AppText } from "./AppText";
import { AnimatedPressable } from "./AnimatedPressable";

interface Props {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Full-width action button in the three treatments the design uses (accent fill / bordered / subtle fill). */
export function Button({ label, onPress, kind = "primary", loading, disabled, height = 52, style }: Props) {
  const { colors } = useTheme();
  const bg = kind === "primary" ? colors.accent : kind === "danger" ? colors.surface : kind === "ghost" ? colors.subtle : colors.surface;
  const border = kind === "secondary" || kind === "danger" ? colors.borderStrong : "transparent";
  const fg = kind === "primary" ? "#FFFFFF" : kind === "danger" ? colors.badInk : colors.ink;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius.button + 2,
          backgroundColor: bg,
          borderWidth: border === "transparent" ? 0 : 1,
          borderColor: border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 10,
          opacity: disabled ? 0.55 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <AppText variant="cardTitleLarge" color={fg} style={{ fontSize: 15.5 }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
