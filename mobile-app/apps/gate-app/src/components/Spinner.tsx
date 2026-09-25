import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";
import { colors } from "../theme";

/**
 * A borderless-ring spinner (`spin` keyframe in the source). No screen uses it at
 * the moment: the walk-in wait it drew was a pretend request and is gone, and
 * button actions carry their own spinner (GateButton `loading`). Kept for the
 * first screen-level wait that is genuinely in flight.
 */
export function Spinner({ size = 56 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: colors.line,
        borderTopColor: colors.go,
        transform: [{ rotate: spin }],
      }}
    />
  );
}
