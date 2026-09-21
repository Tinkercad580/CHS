import React from "react";
import { View, ScrollView } from "react-native";
import { guards } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { DigitBoxes } from "../../components/DigitBoxes";
import { Keypad } from "../../components/Keypad";
import { GateButton } from "../../components/GateButton";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { initials } from "../../utils/time";
import { useGate } from "../../state/GateProvider";

export const SHIFT_LINE = "Main gate · shift 2pm–10pm";
const ROSTERED_GUARD = guards[0]; // the card shown before typing a PIN — whoever ends up signing in is read from the PIN itself.

/**
 * The locked handset. "Sign in to start your shift", the rostered guard's name, a 4-digit
 * duty PIN keypad. This is the ONLY thing that mounts while `!onDuty` — see _layout.tsx —
 * so no other screen can leak a live visitor code before a guard signs in.
 */
export function SignInScreen() {
  const { state, actions } = useGate();

  const hint = state.pinError ? state.pinError : state.pin.length === 0 ? "Four digits · yours is 4291" : state.pin.length < 4 ? `${4 - state.pin.length} more` : "Ready to sign in";

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: 26, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.go, alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
        <Icon d={iconPaths.shield} color={colors.goInk} size={24} strokeWidth={2.1} />
      </View>

      <GateText variant="screenTitleMobile" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.7, marginBottom: 8 }}>
        Sign in to start your shift
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 24 }}>
        The handset is locked until a guard on the roster signs in. Everything you do is recorded against your name.
      </GateText>

      <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.card, padding: 15, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 20 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
          <GateText variant="cardTitleLarge" color={colors.go} style={{ fontSize: 14 }}>
            {initials(ROSTERED_GUARD.name)}
          </GateText>
        </View>
        <View style={{ flex: 1 }}>
          <GateText variant="cardTitle" style={{ marginBottom: 2 }}>
            {ROSTERED_GUARD.name}
          </GateText>
          <GateText variant="meta" color={colors.soft}>
            On the roster for {SHIFT_LINE}
          </GateText>
        </View>
      </View>

      <GateText variant="label" color={colors.soft} style={{ marginBottom: 10 }}>
        Duty PIN
      </GateText>
      <View style={{ marginBottom: 8 }}>
        <DigitBoxes value={state.pin} mask error={!!state.pinError} />
      </View>
      <GateText variant="body" color={state.pinError ? "#F7B5AE" : colors.dim} style={{ fontSize: 12, minHeight: 20, marginBottom: 14 }}>
        {hint}
      </GateText>

      <View style={{ marginBottom: 16 }}>
        <Keypad onKey={actions.pinKey} />
      </View>

      <GateButton
        label="Start shift"
        variant={state.pin.length === 4 ? "primary" : "disabled"}
        onPress={() => actions.startShift(state.pin)}
      />

      <GateText variant="meta" color={colors.dim} style={{ textAlign: "center", marginTop: 14 }}>
        Forgot it? The security desk can reset your PIN over the intercom.
      </GateText>
    </ScrollView>
  );
}
