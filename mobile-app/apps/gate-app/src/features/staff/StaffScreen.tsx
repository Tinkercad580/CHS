import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { FilterPill } from "../../components/FilterPill";
import { RevealItem } from "../../components/RevealItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { filteredStaff, staffInsideCount } from "../../state/selectors";
import { StaffCard } from "./StaffCard";

const FILTERS: { key: "all" | "inside" | "out"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inside", label: "Inside" },
  { key: "out", label: "Out" },
];

export function StaffScreen() {
  const { state, actions } = useGate();
  const list = filteredStaff(state);
  const inside = staffInsideCount(state);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Daily staff
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {inside} on the premises · {state.staff.length} registered
        </GateText>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {FILTERS.map((f) => (
            <FilterPill key={f.key} label={f.label} active={state.staffFilter === f.key} onPress={() => actions.setStaffFilter(f.key)} />
          ))}
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <View style={{ gap: 9 }}>
          {list.map((member, i) => (
            <RevealItem key={member.passNo} tier="listRow">
              <StaffCard
                member={member}
                inside={!!state.staffInside[member.passNo]}
                sinceLabel={state.staffSince[member.passNo] ?? "Not in today"}
                onToggle={() => actions.toggleStaff(member, !!state.staffInside[member.passNo])}
              />
            </RevealItem>
          ))}
        </View>
      </RevealItem>
    </ScrollView>
  );
}
