import React from "react";
import { View, ScrollView } from "react-native";
import { guards } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateInput } from "../../components/GateInput";
import { GateButton } from "../../components/GateButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { insideCount, heldParcelsCount, staffInsideCount } from "../../state/selectors";
import { SHIFT_LINE } from "../signin/SignInScreen";

export function HandoverScreen() {
  const { state, actions } = useGate();
  const receivingGuard = guards.find((g) => g.name !== state.guardName)?.name ?? guards[0].name;

  const stats = [
    { value: String(state.entries.length), label: "Movements logged", fg: colors.ink },
    { value: String(insideCount(state)), label: "Still inside", fg: colors.go },
    { value: String(heldParcelsCount(state)), label: "Parcels held", fg: colors.hold },
    { value: String(staffInsideCount(state)), label: "Staff on site", fg: colors.ink },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Shift handover" onBack={() => actions.go("more")} />
      <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
        {SHIFT_LINE} · closing at 10:00pm
      </GateText>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        {stats.map((s) => (
          <GateCard key={s.label} style={{ flexBasis: "47%", flexGrow: 1 }} padding={15}>
            <GateText variant="gateCodeDisplay" color={s.fg} style={{ fontSize: 26, lineHeight: 26, marginBottom: 6, letterSpacing: 0 }}>
              {s.value}
            </GateText>
            <GateText variant="body" color={colors.soft} style={{ fontSize: 12 }}>
              {s.label}
            </GateText>
          </GateCard>
        ))}
      </View>

      <GateText variant="label" color={colors.soft} style={{ marginBottom: 8 }}>
        Note for the next guard
      </GateText>
      <View style={{ marginBottom: 18 }}>
        <GateInput
          multiline
          placeholder="Anything the night shift should know"
          value={state.handoverNote}
          onChangeText={actions.setHandoverNote}
        />
      </View>

      {state.handoverDone ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "rgba(25,184,136,0.35)",
            borderRadius: 15,
            backgroundColor: "rgba(25,184,136,0.1)",
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(25,184,136,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.check} color={colors.go} size={19} strokeWidth={2.8} />
          </View>
          <View style={{ flex: 1 }}>
            <GateText variant="cardTitle" color={colors.go} style={{ fontSize: 14, marginBottom: 2 }}>
              Handed to {receivingGuard}
            </GateText>
            <GateText variant="meta" color={colors.soft}>
              Summary and your note were sent to the security desk.
            </GateText>
          </View>
        </View>
      ) : (
        <GateButton label="Hand over the shift" onPress={actions.completeHandover} />
      )}
    </ScrollView>
  );
}
