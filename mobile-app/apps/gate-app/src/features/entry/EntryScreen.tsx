import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { DigitBoxes } from "../../components/DigitBoxes";
import { Keypad } from "../../components/Keypad";
import { GateButton } from "../../components/GateButton";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { expectedPasses } from "../../state/selectors";
import { ExpectedPassRow } from "./ExpectedPassRow";

export function EntryScreen() {
  const { state, actions } = useGate();
  const expected = expectedPasses();
  const canVerify = state.code.length === 4 && !state.checking;

  const hint = state.checking ? "Checking against live passes…" : state.code.length === 0 ? "Four digits, from the resident" : state.code.length < 4 ? `${4 - state.code.length} more` : "Ready to verify";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <RevealItem tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Verify a visitor
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 20 }}>
          Type the four digits the resident shared, or search a name.
        </GateText>

        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.card, padding: 20, marginBottom: 16 }}>
          <View style={{ marginBottom: 6, alignItems: "center" }}>
            <DigitBoxes value={state.code} boxWidth={60} boxHeight={72} fontSize={30} emptyBg="transparent" gap={11} />
          </View>
          <GateText variant="body" color={state.checking ? colors.go : colors.dim} style={{ fontSize: 12, textAlign: "center", minHeight: 20 }}>
            {hint}
          </GateText>
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <Keypad onKey={actions.codeKey} keyHeight={62} fontSize={24} />

        <AnimatedPressable
          onPress={actions.startWalkin}
          style={({ pressed }) => ({
            marginTop: 12,
            height: 48,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 14,
            backgroundColor: pressed ? colors.card2 : colors.card,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          })}
        >
          <Icon d={iconPaths.entryTab} color={colors.soft} size={17} />
          <GateText variant="cardTitle" style={{ fontSize: 14 }}>
            No code? Log a walk-in
          </GateText>
        </AnimatedPressable>

        <View style={{ marginTop: 14 }}>
          <GateButton
            label={state.checking ? "Checking…" : "Verify"}
            loading={state.checking}
            variant={canVerify ? "primary" : "disabled"}
            height={58}
            radius={16}
            fontSize={17}
            onPress={() => actions.submitCode(state.code)}
          />
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <View style={{ marginTop: 22, marginBottom: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <GateText variant="label" color={colors.soft} style={{ fontSize: 12.5 }}>
            Expected in the next hour
          </GateText>
          <GateText variant="gateCodeKeypad" color={colors.dim} style={{ fontSize: 11.5 }}>
            {expected.length} passes
          </GateText>
        </View>

        {expected.length === 0 ? (
          <EmptyState title="Nobody expected right now" detail="Walk-ins still work. Punch the flat number and call the resident." />
        ) : (
          <View style={{ gap: 9 }}>
            {expected.map((pass, i) => (
              <RevealItem key={pass.id} tier="listRow">
                <ExpectedPassRow pass={pass} onPress={() => actions.tapExpectedPass(pass.code, pass.name)} />
              </RevealItem>
            ))}
          </View>
        )}
      </RevealItem>
    </ScrollView>
  );
}
