import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ResidentProvider } from "../state/ResidentProvider";
import { useResidentFonts } from "../theme/fonts";
import { useTheme } from "../hooks/useTheme";
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
          <Canvas>{fontsLoaded ? <Slot /> : null}</Canvas>
        </ResidentProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
}

/** The app's backdrop, in the theme this phone remembers (Profile → Dark mode). */
function Canvas({ children }: { children: React.ReactNode }) {
  const { colors, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>{children}</View>
    </>
  );
}
