import React from "react";
import { View, TextInput } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";
import { Toggle } from "../../components/Toggle";
import { RevealItem } from "../../components/RevealItem";
import { LocalOnlyNote } from "../../components/LocalOnlyNote";

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
  const { t } = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("newTicketTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="label" style={{ marginBottom: 8 }}>
          {t("category")}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 14 }}>
          {CATEGORIES.map((cat, i) => (
            <RevealItem key={cat.key} tier="listRow" style={{ flexGrow: 1, flexBasis: "45%" }}>
              <OptionButton label={t(cat.labelKey)} active={state.ticketForm.category === cat.key} onPress={() => actions.setTicketCategory(cat.key)} height={44} />
            </RevealItem>
          ))}
        </View>

        {/* The design shows how many neighbours reported the same thing today; that count was fixture data with no helpdesk behind it, so it is left out until there is one. */}
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
              Flags it on this phone. No one is paged yet.
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

        <View style={{ marginTop: 16 }}>
          <LocalOnlyNote marginBottom={0}>The helpdesk isn't connected yet. This ticket is saved on this phone and the office won't see it, so call them if it's urgent.</LocalOnlyNote>
        </View>
        <Button label={state.submittingTicket ? t("sending") : t("submitTicket")} loading={state.submittingTicket} onPress={actions.submitTicket} style={{ marginTop: 22 }} />
      </ScreenScroll>
    </View>
  );
}
