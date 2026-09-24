import React, { useEffect } from "react";
import type { ViewStyle, StyleProp } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT } from "../motion/easing";
import { revealDurationMs, revealTransform, type RevealTier } from "../motion/reveal";

interface Props {
  tier: RevealTier;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Fades and settles a card, row or section in on mount (`cardIn`/`scIn`):
 * opacity 0->1 plus a short translate and scale.
 *
 * Everything in a tier plays together. This used to delay each item by its
 * index, so a list arrived one row at a time; on a handset worked all shift
 * that reads as lag rather than polish. Under `useReducedMotion` it collapses
 * to a plain appearance.
 */
export function RevealItem({ tier, style, children }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const { translateY, scale } = revealTransform(tier);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: revealDurationMs(tier), easing: EASE_OUT });
    // Re-runs on a fresh mount so a re-rendered list replays its entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * translateY },
      { scale: scale + (1 - scale) * progress.value },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
