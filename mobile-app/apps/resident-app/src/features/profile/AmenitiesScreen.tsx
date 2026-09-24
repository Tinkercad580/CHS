import React from "react";
import { View } from "react-native";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { StaggerItem } from "../../components/StaggerItem";

const AMENITY_ICON: Record<string, keyof typeof iconPaths> = { clubhouse: "amenity", gym: "bolt", terrace: "household", court: "vote" };

export function AmenitiesScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c, num } = useT();
  const unit = currentUnit(state);
  const myBookings = state.bookings.filter((b) => b.unit === unit.code);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader title={t("amenitiesTitle")} subtitle={t("amenitySummary", { n: num(myBookings.length), s: myBookings.length === 1 ? "" : "s" })} />
      <ScreenScroll>
        {myBookings.length > 0 ? (
          <>
            <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
              {t("yourBookings")}
            </AppText>
            <View style={{ gap: 10, marginBottom: 22 }}>
              {myBookings.map((b, i) => {
                const amenity = state.amenities.find((a) => a.id === b.amenityId);
                const name = amenity ? c(amenity.id, "name", amenity.name) : b.amenityId;
                return (
                  <StaggerItem key={b.id} index={i} tier="listRow">
                  <View style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 15, backgroundColor: colors.accentWash, padding: 15 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <AppText variant="cardTitle" style={{ flex: 1, fontSize: 14 }}>
                        {name}
                      </AppText>
                      <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.surface }}>
                        <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 11 }}>
                          {b.status === "confirmed" ? "Confirmed" : "Pending"}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 11 }}>
                      {b.day} · {b.charge > 0 ? formatInr(b.charge) : t("free")}
                    </AppText>
                    <Button label={t("cancelBooking")} kind="secondary" height={40} fontSize={12.5} weight={600} onPress={() => actions.cancelBooking(b, name)} />
                  </View>
                  </StaggerItem>
                );
              })}
            </View>
          </>
        ) : null}

        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("bookAnAmenity")}
        </AppText>
        <View style={{ gap: 10 }}>
          {state.amenities.map((a, i) => (
            <StaggerItem key={a.id} index={i} tier="listRow">
              <AnimatedPressable onPress={() => actions.openAmenity(a.id)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                  <Icon d={iconPaths[AMENITY_ICON[a.id] ?? "amenity"]} size={21} color={colors.accentInk} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
                    {c(a.id, "name", a.name)}
                  </AppText>
                  <AppText variant="meta" color={colors.inkSoft}>
                    {c(a.id, "detail", `${a.capacity} capacity · ${a.hours} · ${a.rate > 0 ? formatInr(a.rate) : t("free")}`)}
                  </AppText>
                </View>
                <Icon d={iconPaths.chevronRight} size={17} color={colors.inkDim} strokeWidth={2.2} />
              </AnimatedPressable>
            </StaggerItem>
          ))}
        </View>
      </ScreenScroll>
    </View>
  );
}
