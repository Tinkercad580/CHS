import React, { useCallback } from "react";
import { Pressable, type PressableProps, type GestureResponderEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { motionDurationsMs } from "@sahaj/shared";
import { EASE_STANDARD } from "../motion/easing";

interface Props extends PressableProps {
  /** README.md's press timing: `scale(.98)`-`(.988)` over 140-160ms, `--ease`. Default .98. */
  pressedScale?: number;
}

/**
 * A drop-in `Pressable` that eases to `pressedScale` on press-in/out instead of snapping —
 * the gate's card/row press feedback, for anything that doesn't already route through
 * `GateButton`. `style` is forwarded untouched, so a pressed-dependent style function
 * (border/background swap) keeps working exactly as before; only the scale is animated.
 */
export function AnimatedPressable({ pressedScale = 0.98, onPressIn, onPressOut, style, children, ...rest }: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const duration = reducedMotion ? 1 : motionDurationsMs.press;

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withTiming(pressedScale, { duration, easing: EASE_STANDARD });
      onPressIn?.(e);
    },
    [scale, pressedScale, duration, onPressIn]
  );
  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withTiming(1, { duration, easing: EASE_STANDARD });
      onPressOut?.(e);
    },
    [scale, duration, onPressOut]
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={style} {...rest}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
