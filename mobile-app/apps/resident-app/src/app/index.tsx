import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { ResidentShell } from "../features/shell/ResidentShell";

/** The resident app's single route — every screen is a state switch inside ResidentShell (see its header comment). */
export default function ResidentApp() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "bottom"]}>
      <ResidentShell />
    </SafeAreaView>
  );
}
