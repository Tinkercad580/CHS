import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { GateButton } from "../../components/GateButton";
import { StaggerItem } from "../../components/StaggerItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { heldParcelsCount } from "../../state/selectors";
import { ParcelCard } from "./ParcelCard";

export function ParcelsScreen() {
  const { state, actions } = useGate();
  const held = heldParcelsCount(state);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <StaggerItem index={0} tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Parcels held
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {held} waiting for collection · {state.parcels.length} today
        </GateText>
      </StaggerItem>

      <StaggerItem index={1} tier="screenBlock" style={{ marginBottom: 16 }}>
        <GateButton label="Log a new parcel" height={52} onPress={actions.openLogParcel} />
      </StaggerItem>

      <StaggerItem index={2} tier="screenBlock">
        <View style={{ gap: 9 }}>
          {state.parcels.map((parcel, i) => (
            <StaggerItem key={parcel.id} index={i} tier="listRow">
              <ParcelCard
                parcel={parcel}
                preference={actions.unitDeliveryPref(parcel.unit) ?? "No standing preference"}
                onCollect={() => actions.collectParcel(parcel)}
              />
            </StaggerItem>
          ))}
        </View>
      </StaggerItem>
    </ScrollView>
  );
}
