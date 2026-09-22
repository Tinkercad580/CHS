import React, { useEffect } from "react";
import type { ViewStyle, StyleProp } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT } from "../motion/easing";
import { staggerDelayMs, staggerDurationMs, staggerTransform, type StaggerTier } from "../motion/stagger";

interface Props {
  /** 0-based position within the group — the table's "(n-1)". */
  index?: number;
  tier: StaggerTier;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * The entrance choreography from README.md's stagger table (`cardIn`/`scIn`): opacity 0->1
 * plus a translate+scale settle, delayed per `index` and capped per `tier`. Under
 * `prefers-reduced-motion`'s RN equivalent (`useReducedMotion`), duration *and* delay both
 * collapse to near-zero — the README calls out that delay alone would leave elements
 * invisible for the skipped wait.
 */
export function StaggerItem({ index = 0, tier, style, children }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const { translateY, scale } = staggerTransform(tier);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    const delay = staggerDelayMs(index, tier);
    const duration = staggerDurationMs(tier);
    progress.value = withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
    // Re-run whenever this item's position or tier changes (e.g. a filtered list reindexes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tier, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * translateY }, { scale: scale + (1 - scale) * progress.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
