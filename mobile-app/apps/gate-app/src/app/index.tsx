import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGate } from "../state/GateProvider";
import { SignInScreen } from "../features/signin/SignInScreen";
import { GateShell } from "../features/shell/GateShell";
import { colors } from "../theme";

/**
 * The gate handset has exactly one route. Which of the two subtrees below
 * mounts is gated on `onDuty` — not just which chrome shows — so a locked
 * handset never mounts the shell that holds every live visitor code
 * (README.md, "Sign-in gate").
 *
 * Only the top safe-area edge is applied here — the real OS status bar (tinted
 * by expo-status-bar in _layout.tsx) already occupies that space on device,
 * and its actual height adapts to whatever notch/punch-hole/no-cutout shape
 * that specific phone has, which a hand-drawn fixed-height row can't do. The
 * bottom edge is deliberately left to TabBar, which adds its own inset so it
 * isn't padded twice (see TabBar.tsx).
 */
export default function GateApp() {
  const { state } = useGate();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      {state.onDuty ? <GateShell /> : <SignInScreen />}
    </SafeAreaView>
  );
}
