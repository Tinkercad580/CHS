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

/**
 * Rectangular option button used for purpose/category/role/day/window pickers
 * throughout invite/ticket/booking forms. `flex={1}` (the default) is for a
 * single non-wrapping row of equal-width buttons; pass `flex={0}` for a
 * `flexWrap: "wrap"` row instead — mixing flex:1 children with flexWrap
 * fights over space before wrapping resolves and overlaps them (RN Yoga,
 * not a web-flexbox behaviour), so a wrapping row needs content-sized chips.
 */
/**
 * `flex` is only for an OptionButton that sits DIRECTLY in a row and shares its
 * width with siblings. Left unset, the button stretches to whatever its parent is
 * and keeps its explicit height.
 *
 * This matters because RN's `flex: 1` shorthand means flexBasis 0, applied to the
 * parent's MAIN axis. A RevealItem is a column, so a flexed child's basis lands on
 * the height — `height: 44` was being overridden and every wrapped option collapsed
 * to its text box (measured 20.8px against the design's 44px). The fix is to let the
 * wrapper carry the horizontal flex and the button carry the height.
 */
export function OptionButton({ label, sub, active, onPress, flex, height = 44, fontSize = 13 }: { label: string; sub?: string; active: boolean; onPress: () => void; flex?: number; height?: number; fontSize?: number }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        ...(flex === undefined ? { alignSelf: "stretch" as const } : { flex }),
        height,
        borderRadius: radius.button + 2,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.borderStrong,
        backgroundColor: active ? colors.accentWash : colors.surface,
        alignItems: "center",
        justifyContent: sub ? "space-between" : "center",
        flexDirection: sub ? "row" : "column",
        paddingHorizontal: sub ? 15 : 12,
      }}
    >
      <AppText variant="cardTitle" color={active ? colors.accentInk : colors.ink} style={{ fontSize }}>
        {label}
      </AppText>
      {sub ? (
        <AppText variant="medium" color={active ? colors.accentInk : colors.inkSoft} style={{ opacity: 0.75 }}>
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
