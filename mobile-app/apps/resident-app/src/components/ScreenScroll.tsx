import React from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import { useTheme } from "../hooks/useTheme";

/** The scrollable body every screen renders inside — resets to top on navigation via the `key`/ref the caller controls. */
export function ScreenScroll({ children, contentPadded = true, ...rest }: ScrollViewProps & { children: React.ReactNode; contentPadded?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      {...rest}
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={[{ paddingBottom: 26 }, contentPadded ? { paddingHorizontal: 22, paddingTop: 18 } : null, rest.contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
