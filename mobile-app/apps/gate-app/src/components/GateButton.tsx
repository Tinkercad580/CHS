import React, { useEffect, useRef } from "react";
import { Pressable, Animated, ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import { GateText } from "./GateText";
import { colors, radius } from "../theme";

type Variant = "primary" | "secondary" | "outline" | "dangerOutline" | "disabled";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** The Allow-in / Ask-the-resident CTA pulses gently to draw the thumb — `pulseGo` in the source. */
  pulsing?: boolean;
  height?: number;
  style?: ViewStyle;
}

export function GateButton({ label, onPress, variant = "primary", loading = false, disabled = false, pulsing = false, height = 56, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading || variant === "disabled";

  useEffect(() => {
    if (!pulsing || isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.015, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, isDisabled, scale]);

  const palette = isDisabled
    ? { bg: colors.card, fg: colors.dim, border: undefined }
    : variant === "primary"
      ? { bg: colors.go, fg: colors.goInk, border: undefined }
      : variant === "secondary"
        ? { bg: colors.card2, fg: colors.ink, border: undefined }
        : variant === "dangerOutline"
          ? { bg: "transparent", fg: colors.stop, border: colors.line }
          : { bg: "transparent", fg: colors.ink, border: colors.line };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          {
            height,
            backgroundColor: palette.bg,
            borderWidth: palette.border ? 1 : 0,
            borderColor: palette.border,
            opacity: pressed && !isDisabled ? 0.92 : 1,
            transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={palette.fg} /> : null}
        <GateText variant="screenTitleGate" color={palette.fg} style={styles.label}>
          {label}
        </GateText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card + 2,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    width: "100%",
  },
  label: {
    fontSize: 16.5,
    lineHeight: 20,
  },
});
