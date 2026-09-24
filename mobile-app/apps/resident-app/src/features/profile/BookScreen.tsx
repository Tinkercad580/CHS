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
import { RevealItem } from "../../components/RevealItem";

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
        {/* A single non-wrapping row of equal-width cells — flex:1 is only safe to
            combine with flexWrap when the row is guaranteed to fill exactly, which
            a fixed 4-day set on a 390px phone is; see OptionButton's doc comment. */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          {bookableDays.map((d, i) => (
            <RevealItem key={d} tier="listRow" style={{ flex: 1 }}>
              <OptionButton label={d} active={state.bookDay === d} onPress={() => actions.setBookDay(d)} height={52} fontSize={12.5} />
            </RevealItem>
          ))}
        </View>

        <AppText variant="label" style={{ marginBottom: 9 }}>
          {t("slot")}
        </AppText>
        <View style={{ gap: 8, marginBottom: 18 }}>
          {bookableSlots.map((slot, i) => {
            const taken = i === preTakenSlot.slotIndex && state.bookDay === preTakenSlot.day;
            return (
              <RevealItem key={slot} tier="listRow">
                <OptionButton
                  label={slot}
                  sub={taken ? t("takenLabel") : t("freeLabel")}
                  active={state.bookSlot === i}
                  onPress={() => actions.setBookSlot(i, taken)}
                  height={50}
                  fontSize={13.5}
                />
              </RevealItem>
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
