import React, { useEffect, useRef } from "react";
import { Pressable, Animated, ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { GateText } from "./GateText";
import { colors, radius } from "../theme";

/**
 * `pulseGo` (README.md's Motion table) — "an expanding box-shadow ring, on the gate's
 * Allow-in button". RN has no animatable box-shadow, so this is a ring that scales up and
 * fades out behind the button, on an infinite loop, in the gate's `go` colour.
 */
function PulseRing() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => {
      progress.value = 0;
    };
  }, [reducedMotion, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : 0.45 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.32 }],
  }));

  return <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, ringStyle]} />;
}

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
      {pulsing && !isDisabled ? <PulseRing /> : null}
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
  ring: {
    borderRadius: radius.card + 2,
    borderWidth: 2,
    borderColor: colors.go,
  },
  label: {
    fontSize: 16.5,
    lineHeight: 20,
  },
});
