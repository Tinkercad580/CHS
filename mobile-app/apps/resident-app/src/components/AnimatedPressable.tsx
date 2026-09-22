import React, { useCallback, useState } from "react";
import { Pressable, type PressableProps, type GestureResponderEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { motionDurationsMs } from "@sahaj/shared";
import { EASE_STANDARD } from "./motion";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, "style"> {
  style?: PressableProps["style"];
  /** Design range is .98–.988 (README's interaction timings); defaults to .98. */
  scaleTo?: number;
}

/**
 * Drop-in `Pressable` that adds the design's press feedback on top of whatever style
 * the caller already supplies — scale .98–.988 over 140–160ms (README's "press
 * `scale(.98)`–`(.988)` over 140–160ms"). Accepts a plain style or the usual
 * pressed-aware style function; either way the scale is layered on top, not instead of.
 */
export function AnimatedPressable({ style, onPressIn, onPressOut, scaleTo = 0.98, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      scale.value = withTiming(reduced ? 1 : scaleTo, { duration: reduced ? 0 : motionDurationsMs.press, easing: EASE_STANDARD });
      onPressIn?.(e);
    },
    [onPressIn, reduced, scale, scaleTo]
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(false);
      scale.value = withTiming(1, { duration: reduced ? 0 : motionDurationsMs.press, easing: EASE_STANDARD });
      onPressOut?.(e);
    },
    [onPressOut, reduced, scale]
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const resolvedStyle = typeof style === "function" ? style({ pressed }) : style;

  return (
    <AnimatedPressableBase onPressIn={handlePressIn} onPressOut={handlePressOut} style={[resolvedStyle, animatedStyle]} {...rest}>
      {children as React.ReactNode}
    </AnimatedPressableBase>
  );
}
