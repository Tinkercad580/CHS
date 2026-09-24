import React, { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { revealSpec, type RevealTier } from "./motion";

/**
 * Fades and lifts a card, row or section in on mount.
 *
 * Everything in a tier plays together. This used to take the item's `index` and
 * turn it into a delay, so a list arrived one row at a time and the last row
 * waited up to .78s; the fade is kept, the cascade is not. See
 * docs/LOADING_AND_MOTION.md for why.
 *
 * Reduced motion collapses this to a plain appearance (`useReducedMotion`).
 */
export function RevealItem({
  tier,
  style,
  children,
}: {
  tier: RevealTier;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const spec = revealSpec(tier, reduced);

  useEffect(() => {
    progress.value = withTiming(1, { duration: spec.duration, easing: spec.easing });
    // A fresh mount always replays its own entrance, which is what a re-rendered list needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * spec.translateY },
      { scale: spec.scale + (1 - spec.scale) * progress.value },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
