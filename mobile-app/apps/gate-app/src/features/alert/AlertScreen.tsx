import React, { useEffect } from "react";
import { View, ScrollView, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { StaggerItem } from "../../components/StaggerItem";
import { Dot } from "../../components/Icon";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { ALERT_KINDS } from "../../mock/gateSeed";
import { relativeLabel } from "../../utils/time";
import { alertDotColor } from "../../utils/gate";

/**
 * The hold-to-confirm fill bar's width, smoothed between the 60ms wall-clock ticks that
 * drive `state.holdPct` (see state/actions.ts's holdStart — computed from elapsed time,
 * left untouched here) — a short `withTiming` bridges each tick into a continuous sweep
 * instead of the visible step a plain per-tick re-render would produce.
 */
function HoldFillBar({ pct }: { pct: number }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(pct);

  useEffect(() => {
    progress.value = reducedMotion ? pct : withTiming(pct, { duration: 90, easing: Easing.linear });
  }, [pct, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.2)" }, style]} />;
}

/** Two seconds, computed from elapsed wall-clock time (see useGateActions.holdStart) — a slip of the thumb should not wake the whole society. */
export function AlertScreen() {
  const { state, actions } = useGate();
  const currentKind = state.alertKind ?? ALERT_KINDS[0];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <StaggerItem index={0} tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Raise an alert
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 20 }}>
          Hold the button for two seconds. A slip of the thumb should not wake the whole society.
        </GateText>
      </StaggerItem>

      <StaggerItem index={1} tier="screenBlock">
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
      </StaggerItem>

      <StaggerItem index={2} tier="screenBlock">
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
        <HoldFillBar pct={state.holdPct} />
        <GateText variant="cardTitleLarge" color="#fff" style={{ fontSize: 18 }}>
          {state.holding ? "Keep holding…" : `Hold to raise ${currentKind.toLowerCase()}`}
        </GateText>
        <GateText variant="body" color="#fff" style={{ fontSize: 12.5, opacity: 0.85 }}>
          {state.holding ? `${Math.max(0, Math.ceil((100 - state.holdPct) / 50))} second to go` : "Two seconds. Reaches the committee and the security desk."}
        </GateText>
      </Pressable>
      </StaggerItem>

      <StaggerItem index={3} tier="screenBlock">
      <GateText variant="label" color={colors.soft} style={{ marginTop: 22, marginBottom: 11, fontSize: 12.5 }}>
        Recent alerts
      </GateText>
      <View style={{ gap: 9 }}>
        {state.alerts.map((alert, i) => (
          <StaggerItem key={alert.id} index={i} tier="taggedCard">
            <GateCard padding={13}>
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
          </StaggerItem>
        ))}
      </View>
      </StaggerItem>
    </ScrollView>
  );
}
