import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { GateText } from "../../components/GateText";
import { GateInput } from "../../components/GateInput";
import { GateButton } from "../../components/GateButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { RevealItem } from "../../components/RevealItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { WALKIN_PURPOSES } from "../../mock/gateSeed";

/**
 * A visitor with no code. The guard fills in who and which flat, then rings the
 * flat and records the answer. There is no approval over the network yet (C9
 * pushes Allow / Deny to the occupants), so nothing here waits on a reply, and
 * nobody is let in except by the guard saying the flat agreed.
 */
export function WalkinScreen() {
  const { state, actions } = useGate();
  const { walkin, walkinStage } = state;
  const unitLabel = walkin.unit ? walkin.unit.toUpperCase() : "the flat";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Walk-in" onBack={() => actions.goBack()} />

      {walkinStage === "form" ? (
        <RevealItem tier="screenBlock">
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
        </RevealItem>
      ) : null}

      {walkinStage === "waiting" ? (
        <RevealItem tier="screenBlock">
          <View style={{ borderWidth: 1, borderColor: withAlpha(colors.hold, 0.32), borderRadius: 18, backgroundColor: colors.card, padding: 20, paddingVertical: 24, alignItems: "center" }}>
            <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: withAlpha(colors.hold, 0.16), alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon d={iconPaths.phone} color={colors.hold} size={26} strokeWidth={2.2} />
            </View>
            <GateText variant="cardTitleLarge" style={{ fontSize: 19, marginBottom: 8, textAlign: "center" }}>
              Ring {unitLabel} and ask
            </GateText>
            <GateText variant="body" color={colors.soft} style={{ fontSize: 13, textAlign: "center", maxWidth: 280 }}>
              {walkin.name} is waiting at the gate. The handset can't reach the resident yet, so call the flat on the intercom or phone, then record what they said.
            </GateText>
          </View>
          <View style={{ marginTop: 16, gap: 10 }}>
            <GateButton label="Resident approved · allow in" onPress={() => actions.answerWalkin(walkin, true)} />
            <GateButton label="Resident refused · turn away" variant="dangerOutline" height={50} radius={14} fontSize={14.5} weight={600} onPress={() => actions.answerWalkin(walkin, false)} />
            <GateButton label="Cancel the request" variant="outline" height={48} radius={13} fontSize={14} weight={600} onPress={actions.cancelWalkin} />
          </View>
        </RevealItem>
      ) : null}
    </ScrollView>
  );
}
