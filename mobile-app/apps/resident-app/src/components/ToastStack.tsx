import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from "react-native-reanimated";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";
import { useTheme } from "../hooks/useTheme";
import { EASE_OUT } from "./motion";
import type { AppToast } from "../state/types";

const TOAST_IN_MS = 260;

/** Bottom-centre, max 3, each dismissed by its own 2.8s timer (owned by useResidentActions' toast()) — never a shared one. */
export function ToastStack({ toasts }: { toasts: AppToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 18, right: 18, bottom: 96, zIndex: 30, gap: 8 }}>
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

/** Keyed by `toast.id`, so each toast is a fresh mount — its `toastIn` entrance (opacity +
 * translateY(14px) scale(.97)→none) runs independently of every other toast on screen. */
function ToastRow({ toast }: { toast: AppToast }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: reduced ? 1 : TOAST_IN_MS, easing: EASE_OUT });
  }, [progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }, { scale: 0.97 + 0.03 * progress.value }],
  }));

  const bg = toast.kind === "warn" ? colors.warn : colors.ink;
  return (
    <Animated.View
      style={[
        {
          borderRadius: 13,
          backgroundColor: bg,
          paddingHorizontal: 15,
          paddingVertical: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.5,
          shadowRadius: 30,
          elevation: 6,
        },
        animatedStyle,
      ]}
    >
      <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
        <Icon d={toast.kind === "warn" ? iconPaths.sos : iconPaths.check} size={13} color="#FFFFFF" strokeWidth={2.6} />
      </View>
      <AppText variant="cardTitle" color="#FFFFFF" style={{ flex: 1, fontSize: 13 }}>
        {toast.message}
      </AppText>
    </Animated.View>
  );
}
