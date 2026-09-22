import React from "react";
import { View, Pressable } from "react-native";
import { GateText } from "../../components/GateText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { initials } from "../../utils/time";
import { useOffline } from "../../hooks/useOffline";

interface Props {
  guardName: string;
  shiftLine: string;
  onSignOut: () => void;
  onAlert: () => void;
}

/** Guard identity + sign-out + quick alert access — only mounted once signed in. */
export function GuardHeader({ guardName, shiftLine, onSignOut, onAlert }: Props) {
  const offline = useOffline();
  return (
    <View style={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
        <GateText variant="cardTitleLarge" color={colors.go} style={{ fontSize: 13 }}>
          {initials(guardName)}
        </GateText>
      </View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GateText variant="cardTitle" style={{ fontSize: 14 }}>
            {guardName}
          </GateText>
          <GateText variant="meta" color={colors.soft}>
            {shiftLine}
          </GateText>
        </View>
        {offline ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(232,163,61,0.18)" }}>
            <GateText variant="label" color={colors.hold} style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
              OFFLINE
            </GateText>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onSignOut}
        style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}
      >
        <Icon d={iconPaths.signOut} color={colors.soft} size={17} strokeWidth={2} />
      </Pressable>
      <Pressable
        onPress={onAlert}
        style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}
      >
        <Icon d={iconPaths.alertTriangle} color={colors.stop} size={18} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
