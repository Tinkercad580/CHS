import React from "react";
import { View } from "react-native";
import type { StaffMember } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateButton } from "../../components/GateButton";
import { StatusPill } from "../../components/StatusPill";
import { colors } from "../../theme";
import { initials } from "../../utils/time";

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  member: StaffMember;
  inside: boolean;
  sinceLabel: string;
  onToggle: () => void;
}

export function StaffCard({ member, inside, sinceLabel, onToggle }: Props) {
  const flats = member.flatsServed.length > 0 ? member.flatsServed.join(", ") : "Common areas";
  return (
    <GateCard edgeColor={inside ? colors.go : colors.line}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
          <GateText variant="cardTitle" color={colors.soft} style={{ fontSize: 13 }}>
            {initials(member.name)}
          </GateText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GateText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
            {member.name}
          </GateText>
          <GateText variant="meta" color={colors.soft}>
            {titleCase(member.role)} · {member.passNo}
          </GateText>
        </View>
        <StatusPill label={inside ? "IN" : "OUT"} color={inside ? colors.go : colors.soft} />
      </View>
      <GateText variant="meta" color={colors.dim} style={{ marginBottom: 11 }}>
        Works at {flats} · {sinceLabel}
      </GateText>
      <GateButton label={inside ? "Mark out" : "Mark in"} variant={inside ? "secondary" : "primary"} height={44} onPress={onToggle} />
    </GateCard>
  );
}
