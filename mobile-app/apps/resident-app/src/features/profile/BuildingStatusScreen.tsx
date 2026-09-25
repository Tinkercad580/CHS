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
import { RevealItem } from "../../components/RevealItem";
import { LocalOnlyNote } from "../../components/LocalOnlyNote";

const UTILITY_ICON: Record<string, keyof typeof iconPaths> = { u_water: "water", u_liftb: "liftDoors", u_lifta: "liftDoors", u_power: "bolt", u_gen: "gauge" };

export function BuildingStatusScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const down = state.utilities.filter((u) => u.state === "down").length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("buildingStatusTitle")} onBack={actions.back} />
      <ScreenScroll>
        <LocalOnlyNote>Sample status. Building status isn't connected to the society yet.</LocalOnlyNote>
        <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {down > 0 ? t("thingsDown", { n: down }) : t("allNormal")}
        </AppText>
        <View style={{ gap: 10 }}>
          {state.utilities.map((u, i) => {
            const kind = u.state === "down" ? "bad" : u.state === "degraded" ? "warn" : "ok";
            const edge = kind === "bad" ? colors.bad : kind === "warn" ? colors.warn : colors.ok;
            const bg = kind === "bad" ? colors.badWash : kind === "warn" ? colors.warnWash : colors.okWash;
            const fg = kind === "bad" ? colors.badInk : kind === "warn" ? colors.warnInk : colors.okInk;
            return (
              <RevealItem key={u.id} tier="listRow">
                <View style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: edge, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                      <Icon d={iconPaths[UTILITY_ICON[u.id] ?? "bolt"]} size={19} color={fg} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
                        {c(u.id, "name", u.name)}
                      </AppText>
                      <AppText variant="meta" color={colors.inkMuted}>
                        {c(u.id, "updatedAt", u.updatedAt)}
                      </AppText>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: bg }}>
                      <AppText variant="statusPill" color={fg}>
                        {c(u.id, "state", u.state).toUpperCase()}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="bodySmall" color={colors.inkSoft}>
                    {c(u.id, "cause", u.cause ?? "")}
                  </AppText>
                </View>
              </RevealItem>
            );
          })}
        </View>
      </ScreenScroll>
    </View>
  );
}
