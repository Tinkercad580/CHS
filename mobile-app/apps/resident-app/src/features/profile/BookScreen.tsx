import React from "react";
import { View } from "react-native";
import { formatInr, bookableDays, bookableSlots, preTakenSlot } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";

export function BookScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const amenity = state.amenities.find((a) => a.id === state.bookAmenityId) ?? state.amenities[0];
  if (!amenity) return null;
  const name = c(amenity.id, "name", amenity.name);
  const detail = c(amenity.id, "detail", `${amenity.capacity} capacity · ${amenity.hours}`);
  const depositLabel = amenity.deposit > 0 ? t("refundable", { amount: amenity.deposit }) : t("noDeposit");

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("bookTitle")} onBack={actions.back} />
      <ScreenScroll>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 17, marginBottom: 18 }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 18, marginBottom: 4 }}>
            {name}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {detail} · {depositLabel}
          </AppText>
        </View>

        <AppText variant="label" style={{ marginBottom: 9 }}>
          {t("day")}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {bookableDays.map((d) => (
            <OptionButton key={d} label={d} active={state.bookDay === d} onPress={() => actions.setBookDay(d)} height={52} flex={1} />
          ))}
        </View>

        <AppText variant="label" style={{ marginBottom: 9 }}>
          {t("slot")}
        </AppText>
        <View style={{ gap: 8, marginBottom: 18 }}>
          {bookableSlots.map((slot, i) => {
            const taken = i === preTakenSlot.slotIndex && state.bookDay === preTakenSlot.day;
            return (
              <OptionButton
                key={slot}
                label={slot}
                sub={taken ? t("takenLabel") : t("freeLabel")}
                active={state.bookSlot === i}
                onPress={() => actions.setBookSlot(i, taken)}
                height={50}
              />
            );
          })}
        </View>

        <Button label={t("confirmBooking")} onPress={actions.confirmBooking} />
        <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
          {t("chargeNote")}
        </AppText>
      </ScreenScroll>
    </View>
  );
}
