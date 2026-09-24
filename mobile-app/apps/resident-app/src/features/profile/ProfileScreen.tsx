import React from "react";
import { View } from "react-native";
import { residentName, num, FOCUS_UNIT_OWNER, FOCUS_UNIT_LET_OUT, type Role } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const ROLES: { key: Role; labelKey: "owner" | "tenant" | "ownerAndTenant"; detailKey: "ownerDetail" | "tenantDetail" | "bothDetail" }[] = [
  { key: "owner", labelKey: "owner", detailKey: "ownerDetail" },
  { key: "tenant", labelKey: "tenant", detailKey: "tenantDetail" },
  { key: "owner_tenant", labelKey: "ownerAndTenant", detailKey: "bothDetail" },
];

export function ProfileScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, lang } = useT();

  const currentRole = ROLES.find((r) => r.key === state.role) ?? ROLES[0];
  const unitCode = state.role === "tenant" ? state.unit : FOCUS_UNIT_OWNER;

  const notifOnCount = state.prefs.filter((p) => p.on).length;

  const settings: { label: string; value: string; go: () => void }[] = [
    { label: t("personal"), value: "Name, phone, email", go: () => actions.go("personal", true) },
    { label: t("myTenants"), value: state.role === "owner_tenant" ? t("oneActive") : t("none"), go: () => actions.go("tenants", true) },
    { label: t("dailyHelpRow"), value: t("nPeople", { n: num(state.dailyHelp.length, lang) }), go: () => actions.go("dailyHelp", true) },
    { label: t("deliveries"), value: state.deliveryPref, go: () => actions.go("deliveries", true) },
    { label: t("householdRow"), value: num(state.household.length, lang), go: () => actions.go("household", true) },
    { label: t("vehiclesRow"), value: num(state.vehicles.length, lang), go: () => actions.go("vehicles", true) },
    { label: t("notifRow"), value: t("nOf4On", { n: num(notifOnCount, lang) }), go: () => actions.go("notifPrefs", true) },
    { label: t("languageRow"), value: lang === "mr" ? "मराठी" : lang === "hi" ? "हिंदी" : "English", go: () => actions.go("language", true) },
  ];

  return (
    <ScreenScroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
          <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 19 }} forceLatin>
            {initialsOf(residentName)}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 19 }}>
            {residentName}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {t(currentRole.labelKey)} · {unitCode}
          </AppText>
        </View>
      </View>

      <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
        {t("viewAs")}
      </AppText>
      <View style={{ gap: 9, marginBottom: 24 }}>
        {ROLES.map((r, i) => {
          const active = state.role === r.key;
          return (
            <RevealItem key={r.key} tier="listRow">
              <AnimatedPressable
                onPress={() => actions.setRole(r.key)}
                style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentWash : colors.surface, borderRadius: 15, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? colors.accent : colors.borderStrong, alignItems: "center", justifyContent: "center" }}>
                  {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="cardTitle" style={{ marginBottom: 2 }}>
                    {t(r.labelKey)}
                  </AppText>
                  <AppText variant="meta" color={colors.inkSoft}>
                    {t(r.detailKey, { unit: r.key === "tenant" ? state.unit : FOCUS_UNIT_OWNER, letOut: FOCUS_UNIT_LET_OUT })}
                  </AppText>
                </View>
              </AnimatedPressable>
            </RevealItem>
          );
        })}
      </View>

      <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
        {t("settings")}
      </AppText>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
        {settings.map((row, i) => (
          <RevealItem key={row.label} tier="prefRow">
            <AnimatedPressable
              onPress={row.go}
              style={{ padding: 15, paddingHorizontal: 16, borderBottomWidth: i === settings.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <AppText variant="body" style={{ flex: 1, fontWeight: "500" as const }}>
                {row.label}
              </AppText>
              <AppText variant="meta" color={colors.inkMuted} forceLatin>
                {row.value}
              </AppText>
              <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />
            </AnimatedPressable>
          </RevealItem>
        ))}
      </View>
    </ScreenScroll>
  );
}
