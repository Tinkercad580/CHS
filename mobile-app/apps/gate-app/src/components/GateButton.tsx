import React, { useEffect, useRef } from "react";
import { Pressable, Animated, ActivityIndicator, Platform, StyleSheet, type ViewStyle } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { GateText } from "./GateText";
import { colors } from "../theme";

/**
 * `pulseGo` (README.md's Motion table) — "an expanding box-shadow ring, on the gate's
 * Allow-in button". RN has no animatable box-shadow, so this is a ring that scales up and
 * fades out behind the button, on an infinite loop, in the gate's `go` colour.
 */
function PulseRing({ radius: ringRadius }: { radius: number }) {
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

  return <Reanimated.View style={[StyleSheet.absoluteFill, styles.ring, { pointerEvents: "none" }, { borderRadius: ringRadius }, ringStyle]} />;
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
  /**
   * Type size and corner radius are per call site, not per component. The gate
   * prototype runs its buttons from 12.5px/r9 (theme toggle, code chips) up to
   * 17px/r16 (Allow in), and unlike the resident app its radii do not follow a
   * formula — 38→12, 50→14 and 52→15 all break floor(h/4)+1 — so both are read
   * off the prototype and passed rather than derived.
   */
  fontSize?: number;
  /** 600 for secondary/compact, 700 for the screen's committing action. */
  weight?: 600 | 700;
  radius?: number;
  style?: ViewStyle;
}

export function GateButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  pulsing = false,
  height = 56,
  fontSize = 16.5,
  weight = 700,
  radius: radiusProp = 15,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading || variant === "disabled";

  useEffect(() => {
    if (!pulsing || isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        // The web has no native animated module and warns if asked for one.
        Animated.timing(scale, { toValue: 1.015, duration: 900, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" }),
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
      {pulsing && !isDisabled ? <PulseRing radius={radiusProp} /> : null}
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          {
            height,
            borderRadius: radiusProp,
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
        {/* Weight comes from the variant: each weight is its own loaded font file, so a
            fontWeight style on a custom family silently renders the same face. */}
        <GateText
          variant={weight === 700 ? "screenTitleGate" : "label"}
          color={palette.fg}
          style={{ fontSize, lineHeight: fontSize * 1.2 }}
        >
          {label}
        </GateText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    width: "100%",
  },
  ring: {
    borderWidth: 2,
    borderColor: colors.go,
  },
});
