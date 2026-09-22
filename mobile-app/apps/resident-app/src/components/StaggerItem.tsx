import React, { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useReducedMotion } from "react-native-reanimated";
import { staggerSpec, type StaggerTier } from "./motion";

/**
 * Wraps one repeating card/row/section so it cascades in on mount per the README's
 * stagger table, instead of every screen appearing as one flat block (the "signature
 * of this design"). `index` is the item's position within its own tier (0-based) —
 * pass the `.map` index straight through.
 *
 * Reduced-motion collapses this to a plain, undelayed appearance (`useReducedMotion`).
 */
export function StaggerItem({
  index,
  tier,
  style,
  children,
}: {
  index: number;
  tier: StaggerTier;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const spec = staggerSpec(tier, index, reduced);

  useEffect(() => {
    progress.value = withDelay(spec.delay, withTiming(1, { duration: spec.duration, easing: spec.easing }));
    // Intentionally re-runs only if the item's identity (index/tier) changes — a fresh
    // mount always starts its own cascade from 0, which is what a re-rendered list needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tier, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * spec.translateY },
      { scale: spec.scale + (1 - spec.scale) * progress.value },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
