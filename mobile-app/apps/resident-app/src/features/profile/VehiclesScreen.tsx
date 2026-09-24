import React from "react";
import { TextInput, View } from "react-native";
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

export function VehiclesScreen() {
  const { state, actions } = useResident();
  const { colors, type } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const vehicles = state.vehicles.filter((v) => v.unit === unit.code);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("vehiclesTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("vehiclesIntro")}
        </AppText>
        <View style={{ gap: 10, marginBottom: 18 }}>
          {vehicles.map((v, i) => (
            <StaggerItem key={v.id} index={i} tier="listRow">
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}>
                    <Icon d={v.type === "Car" ? iconPaths.vehicle : iconPaths.bike} size={19} color={colors.inkSoft} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="cardTitleLarge" style={{ fontSize: 15, letterSpacing: 1, marginBottom: 2 }} forceLatin>
                      {v.plate}
                    </AppText>
                    <AppText variant="meta" color={colors.inkSoft}>
                      {v.model ?? v.type}
                    </AppText>
                  </View>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.okWash }}>
                    <AppText variant="cardTitle" color={colors.okInk} style={{ fontSize: 11 }} forceLatin>
                      {v.slot ?? t("slotPending")}
                    </AppText>
                  </View>
                </View>
                <Button label="Remove vehicle" kind="danger" fontSize={12.5} weight={600} onPress={() => actions.removeVehicle(v)} height={40} />
              </View>
            </StaggerItem>
          ))}
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}>
          <AppText variant="cardTitle" style={{ marginBottom: 10 }}>
            {t("registerVehicle")}
          </AppText>
          <TextInput
            value={state.plateInput}
            onChangeText={actions.setPlateInput}
            placeholder={t("plateNumber")}
            placeholderTextColor={colors.inkMuted}
            style={[{ height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 11, backgroundColor: colors.surface, color: colors.ink, marginBottom: 10, letterSpacing: 1 }, type("moneyMono")]}
          />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <OptionButton label={t("car")} active={state.vehicleTypeInput === "Car"} onPress={() => actions.setVehicleTypeInput("Car")} flex={1} height={40} />
            <OptionButton label={t("twoWheeler")} active={state.vehicleTypeInput === "Two-wheeler"} flex={1} onPress={() => actions.setVehicleTypeInput("Two-wheeler")} height={40} />
          </View>
          <Button label={t("register")} onPress={actions.addVehicle} height={46} fontSize={14.5} weight={700} />
        </View>
      </ScreenScroll>
    </View>
  );
}
