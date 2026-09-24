import React from "react";
import { View, TextInput } from "react-native";
import { ticketDuplicateCounts } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";
import { Toggle } from "../../components/Toggle";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

const CATEGORIES: { key: "Plumbing" | "Electrical" | "Lift" | "Housekeeping" | "Security" | "Other"; labelKey: "plumbing" | "electrical" | "lift" | "security" | "housekeeping" | "other" }[] = [
  { key: "Plumbing", labelKey: "plumbing" },
  { key: "Electrical", labelKey: "electrical" },
  { key: "Lift", labelKey: "lift" },
  { key: "Security", labelKey: "security" },
  { key: "Housekeeping", labelKey: "housekeeping" },
  { key: "Other", labelKey: "other" },
];

export function NewTicketScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, num } = useT();
  const category = state.ticketForm.category === "Lift" ? "Lift" : state.ticketForm.category;
  const duplicates = ticketDuplicateCounts[category] ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("newTicketTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="label" style={{ marginBottom: 8 }}>
          {t("category")}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 14 }}>
          {CATEGORIES.map((cat, i) => (
            <StaggerItem key={cat.key} index={i} tier="listRow">
              <OptionButton label={t(cat.labelKey)} active={state.ticketForm.category === cat.key} onPress={() => actions.setTicketCategory(cat.key)} flex={0} height={38} />
            </StaggerItem>
          ))}
        </View>

        {duplicates > 0 ? (
          <View style={{ borderWidth: 1, borderColor: colors.infoBorder, borderRadius: 12, backgroundColor: colors.infoWash, padding: 13, flexDirection: "row", gap: 11, marginBottom: 16 }}>
            <Icon d={iconPaths.bell} size={17} color={colors.infoInk} strokeWidth={2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" color={colors.infoInk} style={{ fontSize: 12.5, marginBottom: 3 }}>
                {duplicates === 1 ? t("duplicateLine", { n: num(duplicates), category: t(CATEGORIES.find((c) => c.key === category)?.labelKey ?? "other") }) : t("duplicateLineN", { n: num(duplicates), category: t(CATEGORIES.find((c) => c.key === category)?.labelKey ?? "other") })}
              </AppText>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {t("duplicateDetail")}
              </AppText>
            </View>
          </View>
        ) : null}

        <AppText variant="label" style={{ marginBottom: 8 }}>
          {t("whatIsWrong")}
        </AppText>
        <TextInput
          value={state.ticketForm.issue}
          onChangeText={actions.setTicketIssue}
          placeholder={t("whatIsWrongPh")}
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={4}
          style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface, padding: 13, minHeight: 96, color: colors.ink, fontSize: 14, textAlignVertical: "top" }}
        />

        <View style={{ marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="cardTitle" style={{ fontSize: 13, marginBottom: 2 }}>
              {t("urgent")}
            </AppText>
            <AppText variant="meta" color={colors.inkSoft}>
              {t("urgentSub")}
            </AppText>
          </View>
          <Toggle on={state.ticketForm.urgent} onPress={actions.toggleTicketUrgent} />
        </View>

        {state.ticketFormError ? (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: colors.badBorder, borderRadius: 12, backgroundColor: colors.badWash, padding: 13 }}>
            <AppText variant="bodySmall" color={colors.badInk}>
              {t("ticketRequiredError")}
            </AppText>
          </View>
        ) : null}

        <Button label={state.submittingTicket ? t("sending") : t("submitTicket")} loading={state.submittingTicket} onPress={actions.submitTicket} style={{ marginTop: 22 }} />
      </ScreenScroll>
    </View>
  );
}
