import React from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GateText } from "../../components/GateText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import type { GateScreen } from "@sahaj/shared";
import type { AppScreen } from "../../state/types";

const TABS: { k: GateScreen; label: string; d: string }[] = [
  { k: "entry", label: "Entry", d: iconPaths.entryTab },
  { k: "staff", label: "Staff", d: iconPaths.staffTab },
  { k: "log", label: "Log", d: iconPaths.logTab },
  { k: "parcels", label: "Parcels", d: iconPaths.parcelsTab },
  { k: "more", label: "More", d: iconPaths.moreTab },
];

interface Props {
  screen: AppScreen;
  heldCount: number;
  /** Notices from the office not yet opened — they live under More. */
  moreCount: number;
  onTab: (screen: GateScreen) => void;
}

/** Entry / Staff / Log / Parcels / More — `repeat(5,1fr)`. "Verify" is deliberately not a tab (README.md). */
export function TabBar({ screen, heldCount, moreCount, onTab }: Props) {
  const insets = useSafeAreaInsets();
  // The design's 22px is a browser-mockup value with no real home-indicator to
  // clear. On an actual device the safe-area bottom inset already reserves
  // that space (and varies by gesture-nav vs 3-button-nav vs no inset at all),
  // so this bar owns the bottom edge itself instead of stacking a flat 22px
  // underneath whatever the OS also reserves (that stacking is what produced
  // the oversized gap under the tab bar).
  const paddingBottom = Math.max(insets.bottom + 10, 16);
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: 8,
        paddingBottom,
        paddingHorizontal: 6,
      }}
    >
      {TABS.map((t) => {
        const active = screen === t.k;
        const fg = active ? colors.go : colors.dim;
        const count = t.k === "parcels" ? heldCount : t.k === "more" ? moreCount : 0;
        const badge = count > 0;
        return (
          <Pressable
            key={t.k}
            onPress={() => onTab(t.k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={badge ? `${t.label}, ${count}` : t.label}
            style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 7, minHeight: 52, position: "relative" }}>
            <Icon d={t.d} color={fg} size={21} strokeWidth={active ? 2.3 : 1.8} />
            <GateText variant="tabLabel" color={fg} style={{ fontSize: 10.5 }}>
              {t.label}
            </GateText>
            {badge ? (
              <View
                style={{
                  position: "absolute",
                  top: 2,
                  right: "18%",
                  minWidth: 16,
                  height: 17,
                  paddingHorizontal: 4,
                  borderRadius: 999,
                  backgroundColor: colors.go,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GateText variant="label" color={colors.goInk} style={{ fontSize: 10, lineHeight: 17 }}>
                  {String(count)}
                </GateText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
