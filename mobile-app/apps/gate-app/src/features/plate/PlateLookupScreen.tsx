import React from "react";
import { View, ScrollView } from "react-native";
import { vehicles } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateInput } from "../../components/GateInput";
import { StatusPill } from "../../components/StatusPill";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { StaggerItem } from "../../components/StaggerItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";

function normalize(s: string) {
  return s.replace(/\s/g, "").toUpperCase();
}

export function PlateLookupScreen() {
  const { state, actions } = useGate();
  const query = state.plateQuery.trim();
  const results = vehicles.filter((v) => !query || normalize(v.plate).includes(normalize(query)));
  const countLabel = query ? `${results.length} match${results.length === 1 ? "" : "es"}` : `${vehicles.length} plates registered`;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <StaggerItem index={0} tier="screenBlock">
        <ScreenHeader title="Plate lookup" onBack={() => actions.go("more")} />
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 16 }}>
          Type any part of a number. Registered plates open the barrier.
        </GateText>

        <View style={{ marginBottom: 16 }}>
          <GateInput mono placeholder="4471 or MH 12" value={state.plateQuery} onChangeText={actions.setPlateQuery} height={54} />
        </View>
      </StaggerItem>

      <StaggerItem index={1} tier="screenBlock">
        <GateText variant="label" color={colors.soft} style={{ marginBottom: 11 }}>
          {countLabel}
        </GateText>

        {query.length > 0 && results.length === 0 ? (
          <EmptyState title="Not a registered plate" detail="Treat it as a walk-in and ask the flat." />
        ) : (
          <View style={{ gap: 9 }}>
            {results.map((v, i) => (
              <StaggerItem key={v.id} index={i} tier="taggedCard">
                <GateCard edgeColor={colors.go}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
                    <GateText variant="gateCodeKeypad" style={{ fontSize: 16, letterSpacing: 0.8 }}>
                      {v.plate}
                    </GateText>
                    {v.slot ? <StatusPill label={`SLOT ${v.slot}`} color={colors.go} /> : null}
                  </View>
                  <GateText variant="body" color={colors.soft} style={{ fontSize: 12.5 }}>
                    {v.ownerName} · {v.unit} · {v.model ?? v.type}
                  </GateText>
                </GateCard>
              </StaggerItem>
            ))}
          </View>
        )}
      </StaggerItem>
    </ScrollView>
  );
}
