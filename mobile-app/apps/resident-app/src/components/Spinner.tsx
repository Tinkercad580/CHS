import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useTheme } from "../hooks/useTheme";

/**
 * The project's own spinner — a ring with one coloured arc, matching the
 * design's `spin` keyframe and the gate app's equivalent.
 *
 * This replaces React Native's ActivityIndicator, which draws the platform's
 * native spinner: a different shape on iOS and Android, in a size and weight
 * the design does not control. Everything else on these screens is drawn from
 * the design's own tokens, and the one element that appears while the user is
 * waiting should not be the exception.
 *
 * It belongs inside the control that triggered the work — a button, a payment
 * sheet — alongside a label that says what is happening. A rotating shape on
 * its own does not tell anyone what they are waiting for.
 */
export function Spinner({ size = 18, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        // The track stays faint and the head carries the colour, so the ring
        // reads as one arc travelling rather than a whole circle pulsing.
        borderWidth: Math.max(2, Math.round(size / 9)),
        borderColor: colors.borderStrong,
        borderTopColor: color ?? colors.accent,
        transform: [{ rotate: spin }],
      }}
    />
  );
}
