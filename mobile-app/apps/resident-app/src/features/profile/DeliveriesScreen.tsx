import React from "react";
import { View } from "react-native";
import type { DeliveryPreference } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { RadioRow } from "../../components/FilterPill";

const OPTIONS: { key: DeliveryPreference; label: string; detail: string }[] = [
  { key: "Leave at door", label: "Leave at the gate", detail: "The guard holds it. No call, no doorbell." },
  { key: "Call before delivery", label: "Call me first", detail: "The gate rings you before sending anyone up." },
  { key: "Hand to security", label: "Send it up", detail: "Couriers may come to your door." },
];

export function DeliveriesScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const current = OPTIONS.find((o) => o.key === state.deliveryPref) ?? OPTIONS[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("deliveriesTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("deliveriesIntro")}
        </AppText>
        <View style={{ gap: 9, marginBottom: 18 }}>
          {OPTIONS.map((o) => (
            <RadioRow key={o.key} label={o.label} detail={o.detail} active={state.deliveryPref === o.key} onPress={() => actions.setDeliveryPref(o.key)} />
          ))}
        </View>
        <View style={{ borderWidth: 1, borderColor: colors.infoBorder, borderRadius: 15, backgroundColor: colors.infoWash, padding: 15 }}>
          <AppText variant="cardTitle" color={colors.infoInk} style={{ fontSize: 13, marginBottom: 4 }}>
            {t("whatGuardSees")}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {t("guardSeesLine", { unit: unit.code, pref: current.label.toLowerCase() })}
          </AppText>
        </View>
      </ScreenScroll>
    </View>
  );
}
