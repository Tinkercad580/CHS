import React from "react";
import { ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
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
  /** Design type size for this button. The prototype varies it per call site, so it is passed in. */
  fontSize?: number;
  /** 600 for secondary/compact buttons, 700 for the primary action on a screen. */
  weight?: 600 | 700;
  /** Escape hatch for the few buttons the design radius formula does not describe. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Corner radius as a function of height, read off the prototype's button inventory:
 * 32→9, 36→10, 40→11, 44→12, 48→13, 52→14, 56→15, 62→16. That is floor(h/4)+1
 * across every sized button in both apps, so it is derived rather than passed —
 * a single hardcoded radius was wrong at every height except 44 and 46.
 */
function radiusForHeight(height: number): number {
  return Math.floor(height / 4) + 1;
}

/** Full-width action button in the three treatments the design uses (accent fill / bordered / subtle fill). */
export function Button({
  label,
  onPress,
  kind = "primary",
  loading,
  disabled,
  height = 52,
  fontSize = 16,
  weight = 700,
  radius,
  style,
}: Props) {
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
          borderRadius: radius ?? radiusForHeight(height),
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
      {/*
        Weight is selected by VARIANT, not by a fontWeight style. Each weight is a
        separate loaded font file ("Figtree_600SemiBold"), so setting fontWeight on a
        custom family renders the same face at the same weight and silently does
        nothing. Going through a 600 and a 700 variant also keeps the Devanagari swap
        that AppText applies for mr/hi. Only size is overridden here; the prototype
        sets line-height to 1 on every button.
      */}
      <AppText variant={weight === 700 ? "cardTitleLarge" : "label"} color={fg} style={{ fontSize, lineHeight: fontSize }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
