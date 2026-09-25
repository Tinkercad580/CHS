import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";
import { colors } from "../theme";

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

/** The "<- Title" pattern used by Walk-in, Plate lookup and Shift handover, or a bare title on the tab-root screens. */
export function ScreenHeader({ title, subtitle, onBack }: Props) {
  if (onBack) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <AnimatedPressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon d={iconPaths.backChevron} color={colors.ink} size={19} strokeWidth={2.1} />
        </AnimatedPressable>
        <GateText variant="cardTitleLarge" style={{ fontSize: 19 }}>
          {title}
        </GateText>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: subtitle ? 6 : 18 }}>
      <GateText variant="screenTitleGate" style={{ marginBottom: subtitle ? 6 : 0 }}>
        {title}
      </GateText>
      {subtitle ? (
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {subtitle}
        </GateText>
      ) : null}
    </View>
  );
}
