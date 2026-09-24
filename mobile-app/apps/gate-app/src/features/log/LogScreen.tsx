import React from "react";
import { View, ScrollView } from "react-native";
import { GateText } from "../../components/GateText";
import { FilterPill } from "../../components/FilterPill";
import { EmptyState } from "../../components/EmptyState";
import { RevealItem } from "../../components/RevealItem";
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
      <RevealItem tier="screenBlock">
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
      </RevealItem>

      <RevealItem tier="screenBlock">
        {entries.length === 0 ? (
          <EmptyState title="Nothing in this filter" detail="Verify someone and they appear here instantly." />
        ) : (
          <View style={{ gap: 9 }}>
            {entries.map((entry, i) => (
              <RevealItem key={entry.id} tier="listRow">
                <LogEntryCard entry={entry} onExit={() => actions.markExit(entry)} />
              </RevealItem>
            ))}
          </View>
        )}
      </RevealItem>
    </ScrollView>
  );
}
