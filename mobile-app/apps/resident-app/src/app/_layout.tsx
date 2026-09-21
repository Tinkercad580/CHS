import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ResidentProvider } from "../state/ResidentProvider";
import { useResidentFonts } from "../theme/fonts";
import { lightColors } from "@sahaj/shared";

/**
 * Root layout: loads the design's three Google fonts before anything renders
 * (Noto Sans Devanagari is required, not optional — README's Localisation
 * section) and wraps the single route in the one state object the whole app
 * reads. See the gate app's `_layout.tsx` for the identical pattern.
 */
export default function RootLayout() {
  const [fontsLoaded] = useResidentFonts();

  return (
    <ResidentProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: lightColors.canvas }}>{fontsLoaded ? <Slot /> : null}</View>
    </ResidentProvider>
  );
}
