import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";
import { colors } from "../theme";
import type { AppToast } from "../state/types";

const KIND_BG: Record<AppToast["kind"], string> = { ok: colors.go, warn: colors.hold, bad: colors.stop };
const KIND_FG: Record<AppToast["kind"], string> = { ok: colors.goInk, warn: colors.goInk, bad: "#fff" };

/** Bottom-centre, max 3, each dismissed by its own 2.8s timer (owned by useGateActions' toast()) — never a shared one. */
export function ToastStack({ toasts }: { toasts: AppToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 18, right: 18, bottom: 96, zIndex: 30, gap: 8 }}>
      {toasts.map((t) => {
        const bg = KIND_BG[t.kind];
        const fg = KIND_FG[t.kind];
        return (
          <View
            key={t.id}
            style={{
              borderRadius: 13,
              backgroundColor: bg,
              paddingHorizontal: 15,
              paddingVertical: 13,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.6,
              shadowRadius: 30,
              elevation: 6,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon d={t.kind === "ok" ? iconPaths.check : iconPaths.alertTriangle} size={13} color={fg} strokeWidth={2.6} />
            </View>
            <GateText variant="cardTitle" color={fg} style={{ flex: 1, fontSize: 13 }}>
              {t.message}
            </GateText>
          </View>
        );
      })}
    </View>
  );
}
