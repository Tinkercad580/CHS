import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Button } from "../../components/Button";

export function PassDoneScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const code = state.newPassCode ?? "";
  const pass = state.passes.find((p) => p.code === code);
  const standing = pass?.kind === "standing";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: 44, paddingHorizontal: 26, alignItems: "center" }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.okWash, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Icon d={iconPaths.check} size={36} color={colors.okInk} strokeWidth={2.6} />
      </View>
      <AppText variant="screenTitleMobile" style={{ marginBottom: 8, textAlign: "center" }}>
        {standing ? t("standingPassIssued") : t("passCreatedTitle")}
      </AppText>
      <AppText variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginBottom: 26 }}>
        {pass ? `${pass.name} can enter with this ${standing ? "pass" : "code"}. ${pass.purpose}.` : ""}
      </AppText>
      <View style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 18, backgroundColor: colors.accentWash, padding: 24, marginBottom: 24, alignSelf: "stretch", alignItems: "center" }}>
        <AppText variant="eyebrow" color={colors.accentInk} forceLatin style={{ marginBottom: 12 }}>
          {(standing ? t("staffPass") : t("gateCode")).toUpperCase()}
        </AppText>
        <AppText variant="moneyHero" style={{ fontSize: 40, letterSpacing: 6 }} forceLatin>
          {code}
        </AppText>
      </View>
      <Button label={standing ? t("sendPassToThem") : t("shareWithGuest")} onPress={actions.sharePass} style={{ alignSelf: "stretch", marginBottom: 11 }} />
      <Button label={standing ? t("seeAttendance") : t("backToVisitors")} kind="secondary" onPress={actions.goAfterPassDone} style={{ alignSelf: "stretch" }} />
    </View>
  );
}
