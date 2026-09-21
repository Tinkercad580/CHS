import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { Dot } from "../../components/Icon";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { ALERT_KINDS } from "../../mock/gateSeed";
import { relativeLabel } from "../../utils/time";
import { alertDotColor } from "../../utils/gate";

/** Two seconds, computed from elapsed wall-clock time (see useGateActions.holdStart) — a slip of the thumb should not wake the whole society. */
export function AlertScreen() {
  const { state, actions } = useGate();
  const currentKind = state.alertKind ?? ALERT_KINDS[0];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
        Raise an alert
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 20 }}>
        Hold the button for two seconds. A slip of the thumb should not wake the whole society.
      </GateText>

      <GateText variant="label" color={colors.soft} style={{ marginBottom: 10, fontSize: 12.5 }}>
        What is happening?
      </GateText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 22 }}>
        {ALERT_KINDS.map((kind) => {
          const active = currentKind === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => actions.setAlertKind(kind)}
              style={{
                flexBasis: "47%",
                flexGrow: 1,
                minHeight: 56,
                padding: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: active ? colors.stop : colors.line,
                backgroundColor: active ? "rgba(224,74,60,0.16)" : colors.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GateText variant="cardTitle" color={active ? "#FF9C90" : colors.soft} style={{ fontSize: 13, textAlign: "center" }}>
                {kind}
              </GateText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPressIn={() => actions.holdStart(currentKind)}
        onPressOut={actions.holdEnd}
        style={{
          width: "100%",
          height: 132,
          borderRadius: 22,
          backgroundColor: state.holding ? colors.stop : "rgba(224,74,60,0.82)",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          overflow: "hidden",
        }}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.holdPct}%`, backgroundColor: "rgba(255,255,255,0.2)" }} />
        <GateText variant="cardTitleLarge" color="#fff" style={{ fontSize: 18 }}>
          {state.holding ? "Keep holding…" : `Hold to raise ${currentKind.toLowerCase()}`}
        </GateText>
        <GateText variant="body" color="#fff" style={{ fontSize: 12.5, opacity: 0.85 }}>
          {state.holding ? `${Math.max(0, Math.ceil((100 - state.holdPct) / 50))} second to go` : "Two seconds. Reaches the committee and the security desk."}
        </GateText>
      </Pressable>

      <GateText variant="label" color={colors.soft} style={{ marginTop: 22, marginBottom: 11, fontSize: 12.5 }}>
        Recent alerts
      </GateText>
      <View style={{ gap: 9 }}>
        {state.alerts.map((alert) => (
          <GateCard key={alert.id} padding={13}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 5 }}>
              <Dot color={alertDotColor(alert.raisedAt)} />
              <GateText variant="cardTitle" style={{ fontSize: 13.5, flex: 1 }}>
                {alert.kind}
              </GateText>
              <GateText variant="gateCodeKeypad" color={colors.dim} style={{ fontSize: 11 }}>
                {relativeLabel(alert.raisedAt)}
              </GateText>
            </View>
            {alert.note ? (
              <GateText variant="body" color={colors.soft} style={{ fontSize: 12, paddingLeft: 18 }}>
                {alert.note}
              </GateText>
            ) : null}
          </GateCard>
        ))}
      </View>
    </ScrollView>
  );
}
