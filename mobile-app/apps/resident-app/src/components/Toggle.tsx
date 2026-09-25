import React, { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { motionDurationsMs } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";
import { EASE_STANDARD } from "./motion";

/** The 48×28 pill switch used for notification prefs and the ticket "Urgent" toggle —
 * knob slides `left: 3px → 23px` over 220ms (README's interaction timings).
 * `disabled` is for a setting that can't be changed (a mandatory notification):
 * it keeps its state, dims, and says so to a screen reader. */
export function Toggle({ on, onPress, disabled, accessibilityLabel }: { on: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const left = useSharedValue(on ? 23 : 3);

  useEffect(() => {
    left.value = withTiming(on ? 23 : 3, { duration: reduced ? 0 : motionDurationsMs.toggleKnob, easing: EASE_STANDARD });
  }, [on, reduced, left]);

  const animatedStyle = useAnimatedStyle(() => ({ left: left.value }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      style={{ width: 48, height: 28, borderRadius: 999, backgroundColor: on ? colors.accent : colors.borderStrong, justifyContent: "center", opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 3,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#FFFFFF",
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 2 },
          },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
}
