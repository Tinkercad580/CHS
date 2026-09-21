import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { GateButton } from "../../components/GateButton";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { heldParcelsCount } from "../../state/selectors";
import { ParcelCard } from "./ParcelCard";

export function ParcelsScreen() {
  const { state, actions } = useGate();
  const held = heldParcelsCount(state);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
        Parcels held
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
        {held} waiting for collection · {state.parcels.length} today
      </GateText>

      <View style={{ marginBottom: 16 }}>
        <GateButton label="Log a new parcel" height={52} onPress={actions.openLogParcel} />
      </View>

      <View style={{ gap: 9 }}>
        {state.parcels.map((parcel) => (
          <ParcelCard
            key={parcel.id}
            parcel={parcel}
            preference={actions.unitDeliveryPref(parcel.unit) ?? "No standing preference"}
            onCollect={() => actions.collectParcel(parcel)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
