import React from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../hooks/useTheme";

/** The 48×28 pill switch used for notification prefs and the ticket "Urgent" toggle — knob slides 3px→23px. */
export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 48, height: 28, borderRadius: 999, backgroundColor: on ? colors.accent : colors.borderStrong, justifyContent: "center" }}
    >
      <View
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#FFFFFF",
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
        }}
      />
    </Pressable>
  );
}
