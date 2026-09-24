import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { selfMemberId } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

const RELATIONS: { key: "Spouse" | "Child" | "Parent"; labelKey: "spouse" | "child" | "parent" }[] = [
  { key: "Spouse", labelKey: "spouse" },
  { key: "Child", labelKey: "child" },
  { key: "Parent", labelKey: "parent" },
];

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function HouseholdScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const members = state.household.filter((m) => m.unit === unit.code);
  const you = selfMemberId[unit.code];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("householdTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("householdIntro")}
        </AppText>
        <View style={{ gap: 10, marginBottom: 18 }}>
          {members.map((m, i) => (
            <StaggerItem key={m.id} index={i} tier="listRow">
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                  <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 13 }} forceLatin>
                    {initialsOf(m.name)}
                  </AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
                    {m.name}
                  </AppText>
                  <AppText variant="meta" color={colors.inkSoft}>
                    {m.relation} · gate access
                  </AppText>
                </View>
                {m.id === you ? (
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.subtle }}>
                    <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 11 }}>
                      {t("youChip")}
                    </AppText>
                  </View>
                ) : (
                  <Pressable onPress={() => actions.removeHouseholdMember(m)} style={{ width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                    <Icon d={iconPaths.close} size={16} color={colors.badInk} strokeWidth={2} />
                  </Pressable>
                )}
              </View>
            </StaggerItem>
          ))}
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}>
          <AppText variant="cardTitle" style={{ marginBottom: 10 }}>
            {t("addAMember")}
          </AppText>
          <TextInput
            value={state.memberNameInput}
            onChangeText={actions.setMemberNameInput}
            placeholder={t("fullName")}
            placeholderTextColor={colors.inkMuted}
            style={{ height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 11, backgroundColor: colors.surface, color: colors.ink, marginBottom: 10 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {RELATIONS.map((r) => (
              <OptionButton key={r.key} label={t(r.labelKey)} active={state.relationInput === r.key} onPress={() => actions.setRelationInput(r.key)} height={40} />
            ))}
          </View>
          <Button label={t("addToHousehold")} onPress={actions.addHouseholdMember} height={46} />
        </View>
      </ScreenScroll>
    </View>
  );
}
