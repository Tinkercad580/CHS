import React from "react";
import { View, TextInput } from "react-native";
import { residentName, residentMobile, residentMemberSince, FOCUS_UNIT_OWNER } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { RevealItem } from "../../components/RevealItem";

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function PersonalDetailsScreen() {
  const { state, actions } = useResident();
  const { colors, type } = useTheme();
  const { t, num } = useT();
  const unit = currentUnit(state);
  const editing = state.editingPersonalDetails;

  const contactRows: { label: string; value: string; locked?: boolean; editable?: boolean; onChange?: (v: string) => void }[] = [
    { label: t("mobileNumber"), value: residentMobile, locked: true },
    { label: t("email"), value: state.me.email, editable: editing, onChange: (v) => actions.setPersonalField("email", v) },
    { label: t("alternatePhone"), value: state.me.alt, editable: editing, onChange: (v) => actions.setPersonalField("alt", v) },
    { label: t("emergencyContact"), value: state.me.emergency, editable: editing, onChange: (v) => actions.setPersonalField("emergency", v) },
  ];

  const residenceRows = [
    { label: t("flatLabel"), value: unit.code },
    { label: t("societyLabel"), value: "Shanti Vihar CHS" },
    { label: t("heldAs"), value: unit.tag },
    { label: t("carpetArea"), value: unit.code === FOCUS_UNIT_OWNER ? "1,180 sq ft" : "850 sq ft" },
    { label: t("parkingSlots"), value: t("slotsAllotted", { n: num(state.vehicles.filter((v) => v.unit === unit.code).length) }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader
        title={t("personalTitle")}
        onBack={actions.back}
        right={<Button label={editing ? t("cancelEdit") : t("edit")} kind="secondary" height={36} fontSize={12.5} weight={600} onPress={actions.toggleEditPersonal} style={{ paddingHorizontal: 13 }} />}
      />
      <ScreenScroll>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
            <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 20 }} forceLatin>
              {initialsOf(residentName)}
            </AppText>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitleLarge" style={{ fontSize: 18 }}>
              {residentName}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft}>
              {residentMemberSince}
            </AppText>
          </View>
        </View>

        <AppText variant="label" color={colors.inkSoft} style={{ marginBottom: 10 }}>
          {t("contact")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
          {contactRows.map((row, i) => (
            <RevealItem key={row.label} tier="listRow">
              <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === contactRows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <AppText variant="meta" color={colors.inkMuted}>
                    {row.label}
                  </AppText>
                  {row.locked ? (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.subtle }}>
                      <AppText variant="meta" color={colors.inkSoft} style={{ fontSize: 10 }}>
                        {t("setByOffice")}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                {row.editable ? (
                  <TextInput
                    value={row.value}
                    onChangeText={row.onChange}
                    style={[{ height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.accent, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink }, type("body")]}
                  />
                ) : (
                  <AppText variant="body" style={{ color: colors.ink }} forceLatin>
                    {row.value}
                  </AppText>
                )}
              </View>
            </RevealItem>
          ))}
        </View>

        <AppText variant="label" color={colors.inkSoft} style={{ marginBottom: 10 }}>
          {t("residence")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
          {residenceRows.map((row, i) => (
            <RevealItem key={row.label} tier="listRow">
              <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === residenceRows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <AppText variant="bodySmall" color={colors.inkSoft}>
                  {row.label}
                </AppText>
                <AppText variant="cardTitle" style={{ fontSize: 13.5 }} forceLatin>
                  {row.value}
                </AppText>
              </View>
            </RevealItem>
          ))}
        </View>

        {editing ? (
          <>
            <Button label={t("saveChanges")} onPress={actions.savePersonalDetails} />
            <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
              {t("mobileIsLoginNote")}
            </AppText>
          </>
        ) : null}
      </ScreenScroll>
    </View>
  );
}
