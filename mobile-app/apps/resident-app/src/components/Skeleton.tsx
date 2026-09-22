import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { motionDurationsMs } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";

const SLICE_COUNT = 14;
// A bell-shaped opacity curve across the band — peak in the middle, fading to
// nothing at both edges — so a strip of plain Views reads as one soft highlight
// sweeping past, standing in for a CSS gradient without a new dependency.
const SLICE_OPACITIES = Array.from({ length: SLICE_COUNT }, (_, i) => Math.sin((i / (SLICE_COUNT - 1)) * Math.PI) * 0.4);

/**
 * The 520ms dues-filter loading placeholder (README's "skeleton shimmer" — `shimmer`:
 * `background-position -260px→260px`, a moving highlight sweep, not a bare opacity
 * pulse). Built from plain Views translating across the skeleton's own measured width,
 * looping while `duesLoading` is true.
 */
export function Skeleton({ height = 82, radius = 15 }: { height?: number; radius?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || width === 0) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: motionDurationsMs.skeletonShimmer, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduced, width, progress]);

  const bandWidth = Math.max(width * 0.4, 80);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + progress.value * (width + bandWidth * 2) }],
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: radius, backgroundColor: colors.subtle, overflow: "hidden" }}
    >
      {width > 0 && !reduced ? (
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: bandWidth, flexDirection: "row" }, animatedStyle]}>
          {SLICE_OPACITIES.map((opacity, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: "#FFFFFF", opacity }} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}
