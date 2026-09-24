import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { GateButton } from "../../components/GateButton";
import { RevealItem } from "../../components/RevealItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { heldParcelsCount } from "../../state/selectors";
import { ParcelCard } from "./ParcelCard";

export function ParcelsScreen() {
  const { state, actions } = useGate();
  const held = heldParcelsCount(state);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Parcels held
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {held} waiting for collection · {state.parcels.length} today
        </GateText>
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ marginBottom: 16 }}>
        <GateButton label="Log a new parcel" height={52} radius={15} fontSize={15.5} onPress={actions.openLogParcel} />
      </RevealItem>

      <RevealItem tier="screenBlock">
        <View style={{ gap: 9 }}>
          {state.parcels.map((parcel, i) => (
            <RevealItem key={parcel.id} tier="listRow">
              <ParcelCard
                parcel={parcel}
                preference={actions.unitDeliveryPref(parcel.unit) ?? "No standing preference"}
                onCollect={() => actions.collectParcel(parcel)}
              />
            </RevealItem>
          ))}
        </View>
      </RevealItem>
    </ScrollView>
  );
}
