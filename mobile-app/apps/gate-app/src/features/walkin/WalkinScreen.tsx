import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { GateText } from "../../components/GateText";
import { GateInput } from "../../components/GateInput";
import { GateButton } from "../../components/GateButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Spinner } from "../../components/Spinner";
import { StaggerItem } from "../../components/StaggerItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { WALKIN_PURPOSES } from "../../mock/gateSeed";

export function WalkinScreen() {
  const { state, actions } = useGate();
  const { walkin, walkinStage } = state;
  const unitLabel = walkin.unit ? walkin.unit.toUpperCase() : "the flat";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Walk-in" onBack={() => actions.go("entry")} />

      {walkinStage === "form" ? (
        <StaggerItem index={0} tier="screenBlock">
          <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
            No code and no standing pass. Ask the flat before anyone goes up.
          </GateText>

          <GateText variant="label" color={colors.soft} style={{ marginBottom: 8 }}>
            Who is at the gate?
          </GateText>
          <View style={{ marginBottom: 16 }}>
            <GateInput placeholder="Name as stated" value={walkin.name} onChangeText={actions.setWalkinName} />
          </View>

          <GateText variant="label" color={colors.soft} style={{ marginBottom: 8 }}>
            Which flat?
          </GateText>
          <View style={{ marginBottom: 16 }}>
            <GateInput mono placeholder="A-1204" value={walkin.unit} onChangeText={actions.setWalkinUnit} autoCapitalize="characters" />
          </View>

          <GateText variant="label" color={colors.soft} style={{ marginBottom: 8 }}>
            Purpose
          </GateText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
            {WALKIN_PURPOSES.map((x) => {
              const active = walkin.purpose === x;
              return (
                <Pressable
                  key={x}
                  onPress={() => actions.setWalkinPurpose(x)}
                  style={{
                    flexBasis: "31%",
                    flexGrow: 1,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? colors.go : colors.line,
                    backgroundColor: active ? "rgba(25,184,136,0.16)" : colors.card,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GateText variant="label" color={active ? colors.go : colors.soft} style={{ fontSize: 12.5 }}>
                    {x}
                  </GateText>
                </Pressable>
              );
            })}
          </View>

          <GateButton label="Ask the resident" onPress={() => actions.askResident(walkin.name, walkin.unit)} />
        </StaggerItem>
      ) : null}

      {walkinStage === "waiting" ? (
        <StaggerItem index={0} tier="screenBlock">
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.card, padding: 20, paddingVertical: 26, alignItems: "center" }}>
            <View style={{ marginBottom: 20 }}>
              <Spinner />
            </View>
            <GateText variant="cardTitleLarge" style={{ fontSize: 19, marginBottom: 8, textAlign: "center" }}>
              Asking {unitLabel}
            </GateText>
            <GateText variant="body" color={colors.soft} style={{ fontSize: 13, textAlign: "center", maxWidth: 260, marginBottom: 6 }}>
              {walkin.name} is waiting at the gate. The resident has been pinged on their phone.
            </GateText>
            <GateText variant="gateCodeKeypad" color={colors.dim} style={{ fontSize: 12 }}>
              Ringing intercom as backup
            </GateText>
          </View>
          <View style={{ marginTop: 16 }}>
            <GateButton label="Cancel the request" variant="outline" height={50} radius={14} fontSize={14.5} weight={600} onPress={actions.cancelWalkin} />
          </View>
        </StaggerItem>
      ) : null}

      {walkinStage === "approved" ? (
        <StaggerItem index={0} tier="screenBlock">
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(25,184,136,0.35)",
              borderRadius: 18,
              backgroundColor: "rgba(25,184,136,0.1)",
              padding: 20,
              paddingVertical: 24,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View style={{ width: 66, height: 66, borderRadius: 22, backgroundColor: "rgba(25,184,136,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon d={iconPaths.check} color={colors.go} size={32} strokeWidth={2.6} />
            </View>
            <GateText variant="cardTitleLarge" color={colors.go} style={{ fontSize: 20, marginBottom: 8, textAlign: "center" }}>
              {unitLabel} approved
            </GateText>
            <GateText variant="body" color={colors.soft} style={{ fontSize: 13, textAlign: "center" }}>
              {walkin.name} may go up. {walkin.purpose} · approved just now.
            </GateText>
          </View>
          <GateButton label="Allow in and log" pulsing onPress={() => actions.allowWalkin(walkin)} />
        </StaggerItem>
      ) : null}
    </ScrollView>
  );
}
