import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { useGuard } from "../../api/guard";
import { shiftLine } from "../signin/shiftLine";
import { stamp } from "../../utils/time";

/**
 * The prototype's five rows, plus "From the office" — the notices the society
 * sends staff, which the gate design never had a place for. Its unread count
 * is the same badge the More tab carries.
 */
export function MoreScreen({ unreadNotices, onSignOut, signingOut }: { unreadNotices: number; onSignOut: () => void; signingOut: boolean }) {
  const { state, actions } = useGate();
  const { me, membership } = useGuard();
  const since = state.shiftStartedAt ? `On duty since ${stamp(new Date(state.shiftStartedAt))}` : "On duty";

  const items = [
    { key: "alert", label: "Raise an alert", detail: "Medical, fire, security or other", icon: iconPaths.alertTriangle, color: colors.stop, badge: 0, go: () => actions.go("alert", "Opened the alert screen") },
    {
      key: "notices",
      label: "From the office",
      detail: unreadNotices > 0 ? `${unreadNotices} not opened yet` : "Notices from the society office",
      icon: iconPaths.notice,
      color: colors.go,
      badge: unreadNotices,
      go: () => actions.go("notices", "Opened the office notices"),
    },
    { key: "plate", label: "Plate lookup", detail: "Search the society's vehicle register", icon: iconPaths.plate, color: colors.go, badge: 0, go: () => actions.go("plate", "Opened plate lookup") },
    {
      key: "handover",
      label: "Shift handover",
      detail: state.handoverDone ? "Handed over" : since,
      icon: iconPaths.handover,
      color: colors.soft,
      badge: 0,
      go: () => actions.go("handover", "Opened shift handover"),
    },
    { key: "walkin", label: "Walk-in entry", detail: "No code, ask the flat", icon: iconPaths.entryTab, color: colors.hold, badge: 0, go: actions.startWalkin },
    {
      key: "signout",
      label: signingOut ? "Signing out…" : "End shift and sign out",
      detail: "The next guard signs in with their own number",
      icon: iconPaths.signOut,
      color: colors.stop,
      badge: 0,
      go: signingOut ? undefined : onSignOut,
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          More
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {state.guardName ?? me.name} · {shiftLine(membership.societyName, state.shiftStartedAt)}
        </GateText>
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ gap: 10 }}>
        {items.map((item) => (
          <RevealItem key={item.key} tier="listRow">
            <AnimatedPressable
              onPress={item.go}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                backgroundColor: pressed ? colors.card2 : colors.card,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              })}
            >
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: withAlpha(item.color, 0.16), alignItems: "center", justifyContent: "center" }}>
                <Icon d={item.icon} color={item.color} size={20} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <GateText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
                  {item.label}
                </GateText>
                <GateText variant="meta" color={colors.soft}>
                  {item.detail}
                </GateText>
              </View>
              {item.badge > 0 ? (
                <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 999, backgroundColor: colors.go, alignItems: "center", justifyContent: "center" }}>
                  <GateText variant="label" color={colors.goInk} style={{ fontSize: 11.5, lineHeight: 22 }}>
                    {String(item.badge)}
                  </GateText>
                </View>
              ) : null}
              <Icon d={iconPaths.forwardChevron} color={colors.dim} size={17} strokeWidth={2.2} />
            </AnimatedPressable>
          </RevealItem>
        ))}
      </RevealItem>
    </ScrollView>
  );
}
