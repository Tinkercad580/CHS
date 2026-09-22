import React, { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { motionDurationsMs } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";
import { EASE_STANDARD } from "./motion";

/** The 48×28 pill switch used for notification prefs and the ticket "Urgent" toggle —
 * knob slides `left: 3px → 23px` over 220ms (README's interaction timings). */
export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
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
      style={{ width: 48, height: 28, borderRadius: 999, backgroundColor: on ? colors.accent : colors.borderStrong, justifyContent: "center" }}
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
