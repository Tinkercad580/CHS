import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { colors, radius } from "../theme";

const SLICE_COUNT = 14;
// A bell curve across the band so a strip of flat Views reads as one soft
// highlight rather than a hard-edged block — the same approach the resident
// app's Skeleton takes, since neither has a gradient primitive.
const SLICE_OPACITIES = Array.from({ length: SLICE_COUNT }, (_, i) => Math.sin((i / (SLICE_COUNT - 1)) * Math.PI) * 0.12);

/**
 * Loading placeholder for the gate handset, shown only while something is
 * genuinely in flight.
 *
 * Dimmer than the resident app's by design: this screen is read at night, at a
 * gate, and a bright sweep in a dark palette is glare rather than information.
 * The sweep is also slower, because nothing here should suggest urgency the
 * guard has to react to.
 *
 * Most gate data is local by architecture — the handset caches residents, units
 * and passes for 24h offline autonomy — so in practice this appears only for the
 * few actions that genuinely reach the network.
 */
export function Skeleton({ height = 56, borderRadius = radius.card }: { height?: number; borderRadius?: number }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || width === 0) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [reduced, width, progress]);

  const bandWidth = Math.max(width * 0.4, 80);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + progress.value * (width + bandWidth * 2) }],
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius, backgroundColor: colors.card2, overflow: "hidden" }}
    >
      {width > 0 && !reduced ? (
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: bandWidth, flexDirection: "row" }, animatedStyle]}>
          {SLICE_OPACITIES.map((opacity, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: "#FFFFFF", opacity }} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}
