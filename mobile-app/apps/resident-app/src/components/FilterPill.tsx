import React from "react";
import { View } from "react-native";
import { radius } from "@sahaj/shared";
import { useTheme } from "../hooks/useTheme";
import { AppText } from "./AppText";
import { AnimatedPressable } from "./AnimatedPressable";

/** Pill-shaped filter/segment button (dues All/Unpaid/Paid, category pickers, etc). */
export function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        height: 34,
        paddingHorizontal: 13,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.borderStrong,
        backgroundColor: active ? colors.accent : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant="cardTitle" color={active ? "#FFFFFF" : colors.ink} style={{ fontSize: 12.5 }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

/** Rectangular option button used for purpose/category/role/day/window pickers throughout invite/ticket/booking forms. */
export function OptionButton({ label, sub, active, onPress, flex = 1, height = 44 }: { label: string; sub?: string; active: boolean; onPress: () => void; flex?: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        flex,
        height,
        borderRadius: radius.button + 2,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.borderStrong,
        backgroundColor: active ? colors.accentWash : colors.surface,
        alignItems: "center",
        justifyContent: sub ? "space-between" : "center",
        flexDirection: sub ? "row" : "column",
        paddingHorizontal: sub ? 15 : 4,
      }}
    >
      <AppText variant="cardTitle" color={active ? colors.accentInk : colors.ink} style={{ fontSize: 13 }}>
        {label}
      </AppText>
      {sub ? (
        <AppText variant="meta" color={active ? colors.accentInk : colors.inkSoft} style={{ opacity: 0.8 }}>
          {sub}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}

/** 7 square day-of-week toggles used by the daily-help invite form. */
export function DayToggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.borderStrong,
        backgroundColor: active ? colors.accent : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant="cardTitleLarge" color={active ? "#FFFFFF" : colors.inkSoft} style={{ fontSize: 13 }} forceLatin>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

/** A radio-style row (role/language/delivery-pref pickers) — a ringed dot plus label+detail. */
export function RadioRow({
  label,
  detail,
  active,
  onPress,
}: {
  label: string;
  detail: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentWash : colors.surface,
        borderRadius: 15,
        padding: 15,
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: active ? colors.accent : colors.borderStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="cardTitle" style={{ marginBottom: 2 }}>
          {label}
        </AppText>
        <AppText variant="meta" color={colors.inkSoft} style={{ fontSize: 12 }}>
          {detail}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
