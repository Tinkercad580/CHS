import React from "react";
import { Pressable, View } from "react-native";
import type { SosKind } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";

const KINDS: { key: SosKind; labelKey: "medical" | "fire" | "security" | "other" }[] = [
  { key: "Medical", labelKey: "medical" },
  { key: "Fire", labelKey: "fire" },
  { key: "Security", labelKey: "security" },
  { key: "Other", labelKey: "other" },
];

export function EmergencyScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const kind = state.sosKind ?? "Medical";
  const secondsToGo = Math.max(1, Math.ceil((100 - state.sosPct) / 50));

  const contacts = [
    { label: t("mainGate"), value: "Ramesh Yadav · on duty" },
    { label: t("committee"), value: t("committeeNotified") },
    { label: t("yourEmergencyContact"), value: state.me.emergency.split(" · ")[0] },
    { label: t("nearestHospital"), value: t("hospitalDistance") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("emergencyTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 20 }}>
          {t("emergencyIntro")}
        </AppText>

        <AppText variant="label" style={{ marginBottom: 10 }}>
          {t("whatIsHappening")}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 22 }}>
          {KINDS.map((k, i) => {
            const active = kind === k.key;
            return (
              <RevealItem key={k.key} tier="listRow" style={{ width: "48%" }}>
                <Pressable
                  onPress={() => actions.setSosKind(k.key)}
                  style={{ height: 52, borderRadius: 13, borderWidth: 1, borderColor: active ? colors.bad : colors.borderStrong, backgroundColor: active ? colors.badWash : colors.surface, alignItems: "center", justifyContent: "center" }}
                >
                  <AppText variant="cardTitle" color={active ? colors.badInk : colors.ink} style={{ fontSize: 13.5 }}>
                    {t(k.labelKey)}
                  </AppText>
                </Pressable>
              </RevealItem>
            );
          })}
        </View>

        <Pressable
          onPressIn={actions.sosStart}
          onPressOut={actions.sosEnd}
          style={{ width: "100%", height: 136, borderRadius: 22, backgroundColor: state.holdingSos ? colors.bad : "#CF4137", overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.sosPct}%`, backgroundColor: "rgba(255,255,255,0.22)" }} />
          <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 19 }}>
            {state.holdingSos ? t("keepHolding") : t("holdToRaise", { kind: t(KINDS.find((k) => k.key === kind)?.labelKey ?? "medical").toLowerCase() })}
          </AppText>
          <AppText variant="cardTitle" color="rgba(255,255,255,0.88)" style={{ fontSize: 12.5, fontWeight: "500" as const }}>
            {state.holdingSos ? t("secondsToGo", { n: secondsToGo }) : t("twoSecondsUnit", { unit: unit.code })}
          </AppText>
        </Pressable>

        {state.sosSent ? (
          <View style={{ marginTop: 18, borderWidth: 1, borderColor: colors.badBorder, borderRadius: 15, backgroundColor: colors.badWash, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.bad, alignItems: "center", justifyContent: "center" }}>
              <Icon d={iconPaths.sos} size={19} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" color={colors.badInk} style={{ fontSize: 14, marginBottom: 2 }}>
                {t("alertRaisedFrom", { kind: t(KINDS.find((k) => k.key === kind)?.labelKey ?? "medical"), unit: unit.code })}
              </AppText>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {t("gateAcknowledged")}
              </AppText>
            </View>
          </View>
        ) : null}

        <AppText variant="label" color={colors.inkSoft} style={{ marginTop: 20, marginBottom: 10 }}>
          {t("reachesImmediately")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
          {contacts.map((row, i) => (
            <RevealItem key={row.label} tier="listRow">
              <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === contacts.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <AppText variant="body" style={{ fontWeight: "500" as const, fontSize: 13.5 }}>
                  {row.label}
                </AppText>
                <AppText variant="bodySmall" color={colors.inkSoft} style={{ textAlign: "right" }} forceLatin>
                  {row.value}
                </AppText>
              </View>
            </RevealItem>
          ))}
        </View>
      </ScreenScroll>
    </View>
  );
}
