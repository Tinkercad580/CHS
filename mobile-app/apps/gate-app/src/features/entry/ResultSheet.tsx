import React from "react";
import { View } from "react-native";
import type { VerifyResult } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateButton } from "../../components/GateButton";
import { BottomSheet } from "../../components/BottomSheet";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { hostForUnit, passValidityLabel } from "../../utils/gate";
import { useGate } from "../../state/GateProvider";

interface Row {
  label: string;
  value: string;
}

interface ResultView {
  icon: string;
  iconColor: string;
  iconBg: string;
  titleFg: string;
  title: string;
  blurb: string;
  rows: Row[];
  allow: boolean;
  retry: boolean;
}

function buildView(result: VerifyResult, code: string): ResultView {
  if (result.type === "valid" && result.pass) {
    const p = result.pass;
    return {
      icon: iconPaths.check,
      iconColor: colors.go,
      iconBg: withAlpha(colors.go, 0.16),
      titleFg: colors.go,
      title: "Pass is valid",
      blurb: `${p.name} is expected at ${p.unit}.`,
      allow: true,
      retry: false,
      rows: [
        { label: "Visitor", value: p.name },
        { label: "Flat", value: p.unit },
        { label: "Host", value: hostForUnit(p.unit) },
        { label: "Purpose", value: p.purpose },
        { label: "Valid", value: passValidityLabel(p) },
      ],
    };
  }
  if (result.type === "expired" && result.pass) {
    const p = result.pass;
    return {
      icon: iconPaths.clock,
      iconColor: colors.hold,
      iconBg: withAlpha(colors.hold, 0.16),
      titleFg: colors.hold,
      title: "Pass has expired",
      blurb: "The code was real but its window has closed. Ring the flat before letting anyone in.",
      allow: false,
      retry: true,
      rows: [
        { label: "Visitor", value: p.name },
        { label: "Flat", value: p.unit },
        { label: "Host", value: hostForUnit(p.unit) },
        { label: "Status", value: passValidityLabel(p) },
      ],
    };
  }
  return {
    icon: iconPaths.cross,
    iconColor: colors.stop,
    iconBg: withAlpha(colors.stop, 0.16),
    titleFg: colors.stop,
    title: "No such pass",
    blurb: `Code ${code} does not match any live pass. Do not let this person in on the code alone.`,
    allow: false,
    retry: true,
    rows: [],
  };
}

/** The bottom-sheet verdict — Valid / Expired / Unknown, each with its own treatment and actions (README.md's table). */
export function ResultSheet() {
  const { state, actions } = useGate();
  if (!state.result) return null;
  const view = buildView(state.result, state.code);

  return (
    <BottomSheet>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <View style={{ width: 78, height: 78, borderRadius: 26, backgroundColor: view.iconBg, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Icon d={view.icon} color={view.iconColor} size={38} strokeWidth={2.6} />
        </View>
        <GateText variant="cardTitleLarge" color={view.titleFg} style={{ fontSize: 23, marginBottom: 7, textAlign: "center" }}>
          {view.title}
        </GateText>
        <GateText variant="body" color={colors.soft} style={{ fontSize: 13.5, textAlign: "center", maxWidth: 280 }}>
          {view.blurb}
        </GateText>
      </View>

      {view.rows.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.card2, overflow: "hidden", marginBottom: 18 }}>
          {view.rows.map((r, i) => (
            <View
              key={r.label}
              style={{
                paddingHorizontal: 15,
                paddingVertical: 13,
                borderBottomWidth: i === view.rows.length - 1 ? 0 : 1,
                borderBottomColor: colors.line,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <GateText variant="body" color={colors.soft} style={{ fontSize: 12.5 }}>
                {r.label}
              </GateText>
              <GateText variant="cardTitle" style={{ fontSize: 13, textAlign: "right", flexShrink: 1 }}>
                {r.value}
              </GateText>
            </View>
          ))}
        </View>
      ) : null}

      {view.allow ? (
        <>
          <View style={{ marginBottom: 10 }}>
            <GateButton label="Allow in" pulsing onPress={() => actions.allowIn(state)} />
          </View>
          <GateButton label="Turn away" variant="dangerOutline" height={50} onPress={() => actions.denyIn(state)} />
        </>
      ) : null}

      {view.retry ? (
        <>
          <View style={{ marginBottom: 10 }}>
            <GateButton label="Try another code" variant="secondary" height={54} onPress={actions.closeResult} />
          </View>
          <GateButton label="Call the flat instead" variant="outline" height={50} onPress={actions.callResident} />
        </>
      ) : null}
    </BottomSheet>
  );
}
