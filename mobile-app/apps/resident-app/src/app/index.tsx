import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { ResidentShell } from "../features/shell/ResidentShell";

/**
 * The resident app's single route — every screen is a state switch inside
 * ResidentShell (see its header comment). Only the top safe-area edge is
 * applied here; the bottom edge is deliberately left to TabBar, which adds
 * its own inset so it isn't padded twice (see TabBar.tsx).
 */
export default function ResidentApp() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top"]}>
      <ResidentShell />
    </SafeAreaView>
  );
}
