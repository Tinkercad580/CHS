import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Toggle } from "../../components/Toggle";

/** The notification *preference* toggles (Profile → Notifications) — distinct from the feed at Home's bell icon (`NotifsFeedScreen`). */
export function NotificationsScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("notifTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("notifIntro")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
          {state.prefs.map((pref, i) => (
            <View
              key={pref.key}
              style={{ padding: 15, paddingHorizontal: 16, borderBottomWidth: i === state.prefs.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 2 }}>
                  {pref.label}
                </AppText>
                <AppText variant="meta" color={colors.inkSoft}>
                  {pref.detail}
                </AppText>
              </View>
              <Toggle on={pref.on} onPress={() => actions.toggleNotifPref(pref.key)} />
            </View>
          ))}
        </View>
      </ScreenScroll>
    </View>
  );
}
