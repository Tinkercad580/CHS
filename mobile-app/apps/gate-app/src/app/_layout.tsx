import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GateProvider } from "../state/GateProvider";
import { useGateFonts } from "../theme/fonts";
import { colors } from "../theme";

/**
 * Root layout: loads the design's three Google fonts before anything renders
 * (a code display or status pill in the system font would be visibly wrong),
 * and wraps the single route in the one state object the whole handset reads.
 *
 * SafeAreaProvider is required here (not just SafeAreaView further down) —
 * without it, real per-device inset values (which vary by notch/punch-hole
 * shape and by Android edge-to-edge gesture nav) aren't available at all and
 * safe-area hooks/components silently fall back to zero.
 */
export default function RootLayout() {
  const [fontsLoaded] = useGateFonts();

  return (
    <SafeAreaProvider>
      <GateProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>{fontsLoaded ? <Slot /> : null}</View>
      </GateProvider>
    </SafeAreaProvider>
  );
}
