import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { colors } from "../theme";

/** A borderless-ring spinner (`spin` keyframe in the source) — used for "Checking…" / "Asking the flat" states. */
export function Spinner({ size = 56 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
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
