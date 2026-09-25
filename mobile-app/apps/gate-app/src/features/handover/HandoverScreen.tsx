import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateInput } from "../../components/GateInput";
import { GateButton } from "../../components/GateButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { RevealItem } from "../../components/RevealItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { insideCount, heldParcelsCount, staffInsideCount, receivingGuard as receivingGuardOf } from "../../state/selectors";
import { stamp } from "../../utils/time";

/**
 * The counts, the note and the receiving guard are still local (no gate module
 * in the API yet — the name comes from the prototype's roster, via
 * `receivingGuard`). Nothing is sent anywhere, and the note is cleared when this
 * guard signs out, so the screen tells them to pass it on in person. Handing
 * over is where this guard's shift ends, so once it is done the handset offers
 * the one real step: signing out, so the next guard signs in as themselves.
 */
export function HandoverScreen({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }) {
  const { state, actions } = useGate();
  const receivingGuard = receivingGuardOf(state);

  const stats = [
    { value: String(state.entries.length), label: "Movements logged", fg: colors.ink },
    { value: String(insideCount(state)), label: "Still inside", fg: colors.go },
    { value: String(heldParcelsCount(state)), label: "Parcels held", fg: colors.hold },
    { value: String(staffInsideCount(state)), label: "Staff on site", fg: colors.ink },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <RevealItem tier="screenBlock">
        <ScreenHeader title="Shift handover" onBack={() => actions.goBack()} />
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {state.shiftStartedAt ? `On duty since ${stamp(new Date(state.shiftStartedAt))}` : "On duty"} · a summary to pass on to the next guard
        </GateText>
      </RevealItem>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        {stats.map((s) => (
          <RevealItem key={s.label} tier="listRow" style={{ flexBasis: "47%", flexGrow: 1 }}>
            <GateCard padding={15}>
              <GateText variant="gateCodeDisplay" color={s.fg} style={{ fontSize: 26, lineHeight: 26, marginBottom: 6, letterSpacing: 0 }}>
                {s.value}
              </GateText>
              <GateText variant="body" color={colors.soft} style={{ fontSize: 12 }}>
                {s.label}
              </GateText>
            </GateCard>
          </RevealItem>
        ))}
      </View>

      <RevealItem tier="screenBlock">
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
      </RevealItem>

      <RevealItem tier="screenBlock">
        {state.handoverDone ? (
          <View style={{ gap: 12 }}>
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
                  Recorded on this handset only. Nothing was sent, and your note is cleared when you sign out, so tell {receivingGuard} in person.
                </GateText>
              </View>
            </View>
            <GateButton label={signingOut ? "Signing out…" : "Sign out of the handset"} variant="secondary" loading={signingOut} onPress={onSignOut} />
          </View>
        ) : (
          <GateButton label="Hand over the shift" onPress={() => actions.completeHandover(state)} />
        )}
      </RevealItem>
    </ScrollView>
  );
}
