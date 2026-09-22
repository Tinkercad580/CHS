import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { FilterPill } from "../../components/FilterPill";
import { EmptyState } from "../../components/EmptyState";
import { StaggerItem } from "../../components/StaggerItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { filteredEntries, insideCount } from "../../state/selectors";
import { LogEntryCard } from "./LogEntryCard";

const FILTERS: { key: "all" | "inside" | "turned_away"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inside", label: "Inside" },
  { key: "turned_away", label: "Turned away" },
];

export function LogScreen() {
  const { state, actions } = useGate();
  const entries = filteredEntries(state);
  const inside = insideCount(state);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <StaggerItem index={0} tier="screenBlock">
        <GateText variant="screenTitleGate" style={{ marginBottom: 6 }}>
          Today at the gate
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 18 }}>
          {inside} inside now · {state.entries.length} movements logged
        </GateText>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {FILTERS.map((f) => (
            <FilterPill key={f.key} label={f.label} active={state.logFilter === f.key} onPress={() => actions.setLogFilter(f.key)} />
          ))}
        </View>
      </StaggerItem>

      <StaggerItem index={1} tier="screenBlock">
        {entries.length === 0 ? (
          <EmptyState title="Nothing in this filter" detail="Verify someone and they appear here instantly." />
        ) : (
          <View style={{ gap: 9 }}>
            {entries.map((entry, i) => (
              <StaggerItem key={entry.id} index={i} tier="listRow">
                <LogEntryCard entry={entry} onExit={() => actions.markExit(entry)} />
              </StaggerItem>
            ))}
          </View>
        )}
      </StaggerItem>
    </ScrollView>
  );
}
