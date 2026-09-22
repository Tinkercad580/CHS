import React, { useEffect } from "react";
import { Modal, View, Pressable, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { EASE_OUT } from "./motion";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_UP_MS = 320;
const SCRIM_FADE_MS = 200;

/**
 * The rounded bottom sheet used for Pay/QR/App (`sheetUp` in the design: `translateY(102%)
 * → none`). Only the Pay and "choose an app" sheets close on a backdrop tap in the
 * prototype — QR and the success takeover deliberately don't, so `onBackdropPress` is
 * optional. Slides up from fully off-screen on `--ease-out`, rather than the platform's
 * default `Modal` slide, so the curve matches the design's rather than the OS's.
 */
export function BottomSheet({ visible, onBackdropPress, children, fullScreen }: { visible: boolean; onBackdropPress?: () => void; children: React.ReactNode; fullScreen?: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent={!fullScreen} animationType="none" statusBarTranslucent>
      {fullScreen ? (
        <SheetSlide style={{ flex: 1, backgroundColor: colors.surface }}>{children}</SheetSlide>
      ) : (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Scrim onPress={onBackdropPress} />
          <SheetSlide style={{ backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: 0, paddingTop: 10, paddingHorizontal: 22, paddingBottom: 30, maxHeight: "90%" }}>
            <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 }} />
            {children}
          </SheetSlide>
        </View>
      )}
    </Modal>
  );
}

/** Scrim fade — `fadeIn` 200ms, matching the README's dismissible-overlay convention. */
function Scrim({ onPress }: { onPress?: () => void }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: reduced ? 1 : SCRIM_FADE_MS });
  }, [opacity, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: "rgba(9,14,13,0.55)" }, animatedStyle]}>
      <Pressable style={{ flex: 1 }} onPress={onPress} />
    </Animated.View>
  );
}

/** `sheetUp`: starts fully off-screen and settles to rest on `--ease-out`. */
function SheetSlide({ style, children }: { style: React.ComponentProps<typeof Animated.View>["style"]; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  useEffect(() => {
    translateY.value = withTiming(0, { duration: reduced ? 1 : SHEET_UP_MS, easing: EASE_OUT });
  }, [translateY, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
