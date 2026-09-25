import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ResidentProvider } from "../state/ResidentProvider";
import { useResidentFonts } from "../theme/fonts";
import { lightColors } from "@sahaj/shared";
import { ApiProvider } from "@chs/api-client/react";
import { apiClient, realtime, session } from "../api/client";

/**
 * Root layout: loads the design's three Google fonts before anything renders
 * (Noto Sans Devanagari is required, not optional — README's Localisation
 * section) and wraps the single route in the one state object the whole app
 * reads. See the gate app's `_layout.tsx` for the identical pattern.
 *
 * SafeAreaProvider is required here (not just SafeAreaView further down) —
 * without it, real per-device inset values (which vary by notch/punch-hole
 * shape and by Android edge-to-edge gesture nav) aren't available at all and
 * safe-area hooks/components silently fall back to zero.
 */
export default function RootLayout() {
  const [fontsLoaded] = useResidentFonts();

  return (
    <SafeAreaProvider>
      <ApiProvider client={apiClient} session={session} realtime={realtime}>
        <ResidentProvider>
          <StatusBar style="dark" />
          <View style={{ flex: 1, backgroundColor: lightColors.canvas }}>{fontsLoaded ? <Slot /> : null}</View>
        </ResidentProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
}
