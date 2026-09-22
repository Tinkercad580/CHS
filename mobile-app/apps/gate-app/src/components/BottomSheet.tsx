import React, { useEffect, useState } from "react";
import { Pressable, View, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT } from "../motion/easing";
import { colors, radius } from "../theme";

interface Props {
  children: React.ReactNode;
  onDismissScrim?: () => void;
}

/**
 * `sheetUp` (README.md's Motion table): `translateY(102%) -> none`, over a fading scrim
 * (`fadeIn`). The sheet's own height is measured on layout so the 102% start is a real
 * off-screen position rather than a guessed pixel offset; a generous fallback covers the
 * first frame, before that measurement lands.
 */
export function BottomSheet({ children, onDismissScrim }: Props) {
  const reducedMotion = useReducedMotion();
  const [sheetHeight, setSheetHeight] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reducedMotion ? 1 : withTiming(1, { duration: 320, easing: EASE_OUT });
  }, [reducedMotion, progress]);

  const handleSheetLayout = (e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (height > 0 && Math.round(height) !== Math.round(sheetHeight)) setSheetHeight(height);
  };

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => {
    const offscreen = sheetHeight > 0 ? sheetHeight * 1.02 : 820;
    return { transform: [{ translateY: (1 - progress.value) * offscreen }] };
  });

  return (
    <Animated.View style={[styles.scrim, scrimStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismissScrim} />
      <Animated.View onLayout={handleSheetLayout} style={[styles.sheet, sheetStyle]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
          {children}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5,16,13,0.72)",
    justifyContent: "flex-end",
    zIndex: 24,
  },
  sheet: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    borderBottomLeftRadius: radius.sheetBottom,
    borderBottomRightRadius: radius.sheetBottom,
    paddingTop: 10,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 20,
  },
});
