import React from "react";
import { View, Pressable } from "react-native";
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

  return (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", paddingTop: 8, paddingBottom: 22, paddingHorizontal: 8 }}>
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
