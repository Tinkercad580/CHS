import React, { useEffect } from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
import { motionDurationsMs } from "@sahaj/shared";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from "react-native-reanimated";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { RevealItem } from "../../components/RevealItem";
import { Dot, Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { GateButton } from "../../components/GateButton";
import { colors, withAlpha } from "../../theme";
import { useSocietyPhone } from "../../api/society";
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

/** Whole seconds left on the hold, never shown as 0 while the thumb is still down. */
function secondsToGo(pct: number): string {
  const n = Math.max(1, Math.ceil(((100 - pct) / 100) * (motionDurationsMs.holdToConfirm / 1000)));
  return `${n} ${n === 1 ? "second" : "seconds"} to go`;
}

/**
 * Raising an alert is recorded on this handset only: there is no SOS in the API
 * yet (MASTER_SPEC C9), so nobody is told. The screen says so before the guard
 * holds the button, and puts the society office's number (society.get) one tap
 * away — or, when the office has none on file, says who to phone instead.
 *
 * The hold is two seconds, computed from elapsed wall-clock time (see
 * useGateActions.holdStart), so a slip of the thumb doesn't record a false alert.
 */
export function AlertScreen() {
  const { state, actions } = useGate();
  const currentKind = state.alertKind ?? ALERT_KINDS[0];
  const officePhone = useSocietyPhone();

  const callOffice = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => actions.toast(`This handset can't place the call. Dial ${phone}.`, "warn"));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <ScreenHeader title="Raise an alert" onBack={() => actions.goBack()} />
        <View
          accessibilityRole="alert"
          style={{ borderWidth: 1, borderColor: withAlpha(colors.stop, 0.45), borderRadius: 16, backgroundColor: withAlpha(colors.stop, 0.12), padding: 15, marginBottom: 20 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <Icon d={iconPaths.alertTriangle} color="#F7B5AE" size={17} strokeWidth={2.2} />
            <GateText variant="cardTitle" color="#F7B5AE" style={{ fontSize: 14, flex: 1 }}>
              This does not call anyone yet
            </GateText>
          </View>
          <GateText variant="body" color={colors.ink} style={{ fontSize: 12.5, lineHeight: 18, marginBottom: officePhone ? 12 : 0 }}>
            {officePhone
              ? "An alert raised here is recorded on this handset only. Nobody is notified. Phone the society office yourself, then raise it so the shift has a record."
              : "An alert raised here is recorded on this handset only. Nobody is notified. Phone the committee secretary or your security supervisor yourself, then raise it so the shift has a record."}
          </GateText>
          {officePhone ? (
            <GateButton label={`Call the society office · ${officePhone}`} variant="dangerOutline" height={48} radius={13} fontSize={14.5} weight={700} onPress={() => callOffice(officePhone)} />
          ) : null}
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
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
      </RevealItem>

      <RevealItem tier="screenBlock">
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
          {state.holding ? secondsToGo(state.holdPct) : "Two seconds. Recorded on this handset only."}
        </GateText>
      </Pressable>
      </RevealItem>

      <RevealItem tier="screenBlock">
      <GateText variant="label" color={colors.soft} style={{ marginTop: 22, marginBottom: 11, fontSize: 12.5 }}>
        Recent alerts
      </GateText>
      <View style={{ gap: 9 }}>
        {state.alerts.map((alert, i) => (
          <RevealItem key={alert.id} tier="taggedCard">
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
          </RevealItem>
        ))}
      </View>
      </RevealItem>
    </ScrollView>
  );
}
