import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GateProvider } from "../state/GateProvider";
import { useGateFonts } from "../theme/fonts";
import { colors } from "../theme";

/**
 * Root layout: loads the design's three Google fonts before anything renders
 * (a code display or status pill in the system font would be visibly wrong),
 * and wraps the single route in the one state object the whole handset reads.
 */
export default function RootLayout() {
  const [fontsLoaded] = useGateFonts();

  return (
    <GateProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{fontsLoaded ? <Slot /> : null}</View>
    </GateProvider>
  );
}
