import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useTheme } from "../hooks/useTheme";

/** A pulsing placeholder block for the 520ms dues-filter loading state (README's "skeleton shimmer"). */
export function Skeleton({ height = 82, radius = 15 }: { height?: number; radius?: number }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={{ height, borderRadius: radius, backgroundColor: colors.subtle, opacity: pulse }} />;
}
