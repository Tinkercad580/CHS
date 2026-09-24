import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

export function NotifsFeedScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader
        title={t("notifTitle")}
        onBack={actions.back}
        right={
          <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 12.5 }} onPress={actions.markAllNotifsRead}>
            {t("markAllRead")}
          </AppText>
        }
      />
      <ScreenScroll>
        <View style={{ gap: 9 }}>
          {state.notifs.map((n, i) => {
            const iconBg = n.kind === "warn" ? colors.warnWash : n.kind === "ok" ? colors.okWash : colors.infoWash;
            const iconFg = n.kind === "warn" ? colors.warnInk : n.kind === "ok" ? colors.okInk : colors.infoInk;
            return (
              <StaggerItem key={n.id} index={i} tier="listRow">
                <View
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: n.unread ? colors.accentWash : colors.surface, padding: 14, flexDirection: "row", gap: 12 }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
                    <Icon d={n.kind === "warn" ? iconPaths.sos : n.kind === "ok" ? iconPaths.check : iconPaths.bell} size={17} color={iconFg} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 3 }}>
                      {n.title}
                    </AppText>
                    <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 4 }}>
                      {n.body}
                    </AppText>
                    <AppText variant="meta" color={colors.inkMuted}>
                      {n.when}
                    </AppText>
                  </View>
                </View>
              </StaggerItem>
            );
          })}
        </View>
      </ScreenScroll>
    </View>
  );
}
