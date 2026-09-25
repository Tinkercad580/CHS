import React from "react";
import { Pressable, View } from "react-native";
import { GateText } from "./GateText";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";
import { colors } from "../theme";
import type { AppToast } from "../state/types";

const KIND_BG: Record<AppToast["kind"], string> = { ok: colors.go, warn: colors.hold, bad: colors.stop };
const KIND_FG: Record<AppToast["kind"], string> = { ok: colors.goInk, warn: colors.goInk, bad: "#fff" };

/**
 * Bottom-centre, max 3, each dismissed by its own timer (owned by useGateActions'
 * toast()) — never a shared one. Ordinary toasts last 2.8s and let touches through.
 * An urgent one (an emergency) is drawn heavier, with a white ring and an
 * EMERGENCY kicker, stays up for 8s and is dismissed by a tap — it is the one
 * toast a guard must not miss by glancing away.
 */
export function ToastStack({ toasts, onDismiss }: { toasts: AppToast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <View style={{ pointerEvents: "box-none", position: "absolute", left: 18, right: 18, bottom: 96, zIndex: 30, gap: 8 }}>
      {toasts.map((t) => {
        const bg = KIND_BG[t.kind];
        const fg = KIND_FG[t.kind];
        const body = (
          <View
            style={{
              borderRadius: 13,
              backgroundColor: bg,
              borderWidth: t.urgent ? 2 : 0,
              borderColor: "rgba(255,255,255,0.7)",
              paddingHorizontal: 15,
              paddingVertical: t.urgent ? 15 : 13,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              boxShadow: "0 14px 30px rgba(0,0,0,0.6)",
            }}
          >
            <View
              style={{
                width: t.urgent ? 30 : 22,
                height: t.urgent ? 30 : 22,
                borderRadius: t.urgent ? 9 : 7,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon d={t.kind === "ok" ? iconPaths.check : iconPaths.alertTriangle} size={t.urgent ? 17 : 13} color={fg} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              {t.urgent ? (
                <GateText variant="label" color={fg} style={{ fontSize: 10.5, letterSpacing: 0.8, marginBottom: 3 }}>
                  EMERGENCY · TAP TO DISMISS
                </GateText>
              ) : null}
              <GateText variant="cardTitle" color={fg} style={{ fontSize: t.urgent ? 14.5 : 13 }}>
                {t.message}
              </GateText>
            </View>
          </View>
        );
        return t.urgent ? (
          <Pressable key={t.id} onPress={() => onDismiss(t.id)} accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityHint="Dismisses this emergency message">
            {body}
          </Pressable>
        ) : (
          <View key={t.id} style={{ pointerEvents: "none" }} accessibilityLiveRegion="polite">
            {body}
          </View>
        );
      })}
    </View>
  );
}
