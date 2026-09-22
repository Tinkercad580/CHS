import React from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ResidentScreen } from "@sahaj/shared";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AppText } from "../../components/AppText";

const TABS: { key: ResidentScreen; icon: keyof typeof iconPaths; labelKey: "home" | "dues" | "notices" | "visitors" | "profile" }[] = [
  { key: "home", icon: "home", labelKey: "home" },
  { key: "dues", icon: "dues", labelKey: "dues" },
  { key: "notices", icon: "notices", labelKey: "notices" },
  { key: "visitors", icon: "visitors", labelKey: "visitors" },
  { key: "profile", icon: "profile", labelKey: "profile" },
];

/** 5-item tab bar (README's tab-bar table) — icons 21px, stroke 1.8 rest / 2.3 active, ink-muted → accent-ink. */
export function TabBar({ screen, onTab }: { screen: ResidentScreen; onTab: (screen: ResidentScreen) => void }) {
  const { colors } = useTheme();
  const { t } = useT();

  const activeGroup: Record<ResidentScreen, ResidentScreen> = {
    home: "home", dues: "dues", bill: "dues", notices: "notices", notice: "notices",
    visitors: "visitors", invite: "visitors", passDone: "visitors",
    profile: "profile", helpdesk: "profile", newTicket: "profile", ticket: "profile",
    personal: "profile", tenants: "profile", dailyHelp: "profile", household: "profile", vehicles: "profile",
    deliveries: "profile", notifPrefs: "profile", language: "profile", notifs: "profile",
    amenities: "profile", book: "profile", statement: "profile", polls: "profile", poll: "profile", utilities: "profile", sos: "profile",
  };
  const active = activeGroup[screen] ?? "home";
  const insets = useSafeAreaInsets();
  // The design's 22px is a browser-mockup value with no real home-indicator to
  // clear. On an actual device the safe-area bottom inset already reserves
  // that space (and varies by gesture-nav vs 3-button-nav vs no inset at all),
  // so this bar owns the bottom edge itself instead of stacking a flat 22px
  // underneath whatever the OS also reserves.
  const paddingBottom = Math.max(insets.bottom + 10, 16);

  return (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", paddingTop: 8, paddingBottom, paddingHorizontal: 8 }}>
      {TABS.map((tab) => {
        const on = active === tab.key;
        const color = on ? colors.accentInk : colors.inkMuted;
        return (
          <Pressable key={tab.key} onPress={() => onTab(tab.key)} style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 7, minHeight: 52, justifyContent: "center" }}>
            <Icon d={iconPaths[tab.icon]} size={21} color={color} strokeWidth={on ? 2.3 : 1.8} />
            <AppText variant="tabLabel" color={color}>
              {t(tab.labelKey)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
