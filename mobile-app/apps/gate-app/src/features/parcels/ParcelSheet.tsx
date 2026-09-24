import React from "react";
import { View, Pressable } from "react-native";
import { GateText } from "../../components/GateText";
import { GateInput } from "../../components/GateInput";
import { GateButton } from "../../components/GateButton";
import { BottomSheet } from "../../components/BottomSheet";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { COURIERS } from "../../mock/gateSeed";

export function ParcelSheet() {
  const { state, actions } = useGate();
  const pref = actions.unitDeliveryPref(state.parcelUnit);

  return (
    <BottomSheet onDismissScrim={actions.closeParcel}>
      <GateText variant="cardTitleLarge" style={{ fontSize: 20, marginBottom: 18 }}>
        Log a parcel
      </GateText>

      <GateText variant="label" color={colors.soft} style={{ marginBottom: 8 }}>
        Flat number
      </GateText>
      <GateInput mono placeholder="A-1204" value={state.parcelUnit} onChangeText={actions.setParcelUnit} autoCapitalize="characters" />

      {pref ? (
        <View style={{ marginTop: 12, borderWidth: 1, borderColor: "rgba(232,163,61,0.32)", borderRadius: 12, backgroundColor: "rgba(232,163,61,0.1)", padding: 13 }}>
          <GateText variant="label" color={colors.hold} style={{ fontSize: 12.5, lineHeight: 18 }}>
            {pref} — this flat's standing instruction
          </GateText>
        </View>
      ) : null}

      <GateText variant="label" color={colors.soft} style={{ marginTop: 16, marginBottom: 8 }}>
        Courier
      </GateText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {COURIERS.map((c) => {
          const active = state.courier === c;
          return (
            <Pressable
              key={c}
              onPress={() => actions.setCourier(c)}
              style={{
                flexBasis: "31%",
                flexGrow: 1,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? colors.go : colors.line,
                backgroundColor: active ? "rgba(25,184,136,0.16)" : colors.card2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GateText variant="label" color={active ? colors.go : colors.soft} style={{ fontSize: 12.5 }}>
                {c}
              </GateText>
            </Pressable>
          );
        })}
      </View>

      {state.parcelError ? (
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: "rgba(224,74,60,0.4)", borderRadius: 12, backgroundColor: "rgba(224,74,60,0.12)", padding: 13 }}>
          <GateText variant="body" color="#F7B5AE" style={{ fontSize: 12.5, lineHeight: 18 }}>
            A parcel needs a flat number before it can be logged.
          </GateText>
        </View>
      ) : null}

      <View style={{ marginTop: 20, marginBottom: 10 }}>
        <GateButton label="Save and notify resident" height={54} radius={15} fontSize={16} onPress={() => actions.saveParcel(state.parcelUnit, state.courier)} />
      </View>
      <GateButton label="Cancel" variant="outline" height={48} radius={13} fontSize={14.5} weight={600} onPress={actions.closeParcel} />
    </BottomSheet>
  );
}
