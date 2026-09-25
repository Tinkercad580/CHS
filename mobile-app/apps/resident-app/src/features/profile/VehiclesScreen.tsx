import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { api } from "@chs/contract";
import { useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { formatPlate, pendingFor, unitByLabel, useResidentAccount } from "../../api/identity";
import { splitError } from "../../api/errors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { PendingRow } from "./PendingRow";

const TYPE_TO_API = { Car: "CAR", "Two-wheeler": "TWO_WHEELER" } as const;

/** The flat's registered vehicles (myHome → vehicles). Registering one is a request the office approves; the sticker and slot follow from them. */
export function VehiclesScreen() {
  const { state, actions } = useResident();
  const { colors, type } = useTheme();
  const { t } = useT();
  const { membership, home } = useResidentAccount();
  const unit = currentUnit(state);
  const [plateError, setPlateError] = useState<string | null>(null);
  const addVehicle = useApiMutation(api.members.addVehicle);
  const removeVehicle = useApiMutation(api.members.removeVehicle);

  const overview = home.status === "ready" ? unitByLabel(home.data, unit.code) : undefined;
  const pending = home.status === "ready" && overview ? pendingFor(home.data, overview.unit.id, "VEHICLE_ADD") : [];
  const societyId = membership?.societyId ?? "";
  const livesHere = unit.code === state.identity?.homeUnit;

  const register = () => {
    const plate = state.plateInput.replace(/[\s-]/g, "");
    if (plate.length < 6) {
      setPlateError("Enter the full registration number.");
      return;
    }
    if (!overview || addVehicle.isPending) return;
    setPlateError(null);
    addVehicle.mutate(
      { params: { societyId, unitId: overview.unit.id }, body: { plate, type: TYPE_TO_API[state.vehicleTypeInput] } },
      {
        onSuccess: (res) => {
          actions.setPlateInput("");
          actions.toast("approvalId" in res ? `${formatPlate(plate)} sent to the society office for approval.` : `${formatPlate(plate)} registered. Slot follows from the office.`);
        },
        onError: (err) => {
          const { fields, message } = splitError(err);
          if (fields.plate) setPlateError(fields.plate);
          else actions.toast(message ?? "Could not register this vehicle.", "warn");
        },
      }
    );
  };

  const remove = (id: string, plate: string) => {
    if (removeVehicle.isPending) return;
    removeVehicle.mutate(
      { params: { societyId, vehicleId: id } },
      {
        onSuccess: () => actions.toast(`${formatPlate(plate)} removed.`, "warn"),
        onError: (err) => actions.toast(splitError(err).message ?? "Could not remove this vehicle.", "warn"),
      }
    );
  };

  let list: React.ReactNode;
  if (home.status === "loading") {
    // Card: 40px tile row + 11px gap + 40px button, inside 14px padding and a 1px border.
    list = (
      <View style={{ gap: 10, marginBottom: 18 }}>
        <Skeleton height={121} />
        <Skeleton height={121} />
      </View>
    );
  } else if (home.status === "error") {
    list = (
      <View style={{ marginBottom: 18 }}>
        <LoadError title="Couldn't load your vehicles" message={home.message} onRetry={home.retry} />
      </View>
    );
  } else {
    const vehicles = overview?.vehicles ?? [];
    list = (
      <View style={{ gap: 10, marginBottom: 18 }}>
        {vehicles.length === 0 && pending.length === 0 ? (
          <EmptyState iconPath={iconPaths.vehicle} title="No vehicles registered" body={`Nothing is registered against ${unit.code}. A registered plate is what lets the gate wave a car through.`} />
        ) : null}
        {vehicles.map((v) => {
          const removing = removeVehicle.isPending && removeVehicle.variables?.params.vehicleId === v.id;
          const detail = [v.make, v.colour?.toLowerCase()].filter(Boolean).join(" · ") || (v.type === "CAR" ? t("car") : v.type === "TWO_WHEELER" ? t("twoWheeler") : "Vehicle");
          return (
            <RevealItem key={v.id} tier="listRow">
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}>
                    <Icon d={v.type === "TWO_WHEELER" ? iconPaths.bike : iconPaths.vehicle} size={19} color={colors.inkSoft} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="cardTitleLarge" style={{ fontSize: 15, letterSpacing: 1, marginBottom: 2 }} forceLatin>
                      {formatPlate(v.plate)}
                    </AppText>
                    <AppText variant="meta" color={colors.inkSoft}>
                      {detail}
                    </AppText>
                  </View>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: v.parkingSlotCode ? colors.okWash : colors.subtle }}>
                    <AppText variant="cardTitle" color={v.parkingSlotCode ? colors.okInk : colors.inkSoft} style={{ fontSize: 11 }} forceLatin>
                      {v.parkingSlotCode ?? t("slotPending")}
                    </AppText>
                  </View>
                </View>
                {livesHere ? (
                  <Button
                    label={removing ? "Removing…" : "Remove vehicle"}
                    kind="danger"
                    fontSize={12.5}
                    weight={600}
                    loading={removing}
                    disabled={removeVehicle.isPending && !removing}
                    onPress={() => remove(v.id, v.plate)}
                    height={40}
                  />
                ) : null}
              </View>
            </RevealItem>
          );
        })}
        {pending.map((a) => (
          <RevealItem key={a.id} tier="listRow">
            <PendingRow
              mono
              title={typeof a.payload.plate === "string" ? formatPlate(a.payload.plate) : a.summary}
              detail={a.payload.type === "TWO_WHEELER" ? t("twoWheeler") : a.payload.type === "CAR" ? t("car") : "Vehicle"}
            />
          </RevealItem>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("vehiclesTitle")} onBack={actions.back} />
      <ScreenScroll keyboardShouldPersistTaps="handled">
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("vehiclesIntro")}
        </AppText>
        {list}

        {/* A let-out flat's vehicles are the tenant's; the landlord sees them but doesn't register or remove them. */}
        {livesHere && home.status !== "error" ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}>
            <AppText variant="cardTitle" style={{ marginBottom: 10 }}>
              {t("registerVehicle")}
            </AppText>
            <TextInput
              value={state.plateInput}
              onChangeText={(v) => {
                actions.setPlateInput(v);
                if (plateError) setPlateError(null);
              }}
              placeholder={t("plateNumber")}
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel={t("plateNumber")}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={register}
              maxLength={14}
              style={[
                { height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: plateError ? colors.bad : colors.borderStrong, borderRadius: 11, backgroundColor: colors.surface, color: colors.ink, marginBottom: plateError ? 6 : 10, letterSpacing: 1 },
                type("moneyMono"),
              ]}
            />
            {plateError ? (
              <AppText variant="meta" color={colors.badInk} style={{ marginBottom: 10 }}>
                {plateError}
              </AppText>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <OptionButton label={t("car")} active={state.vehicleTypeInput === "Car"} onPress={() => actions.setVehicleTypeInput("Car")} flex={1} height={40} />
              <OptionButton label={t("twoWheeler")} active={state.vehicleTypeInput === "Two-wheeler"} flex={1} onPress={() => actions.setVehicleTypeInput("Two-wheeler")} height={40} />
            </View>
            <Button label={addVehicle.isPending ? "Sending…" : t("register")} onPress={register} loading={addVehicle.isPending} disabled={!overview} height={46} fontSize={14.5} weight={700} />
          </View>
        ) : null}
      </ScreenScroll>
    </View>
  );
}
