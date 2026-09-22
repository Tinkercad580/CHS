import React from "react";
import { View } from "react-native";
import type { EntryLogRow } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { StatusPill } from "../../components/StatusPill";
import { colors } from "../../theme";
import { stamp } from "../../utils/time";

const STATE_LABEL: Record<EntryLogRow["status"], string> = { inside: "INSIDE", exited: "EXITED", turned_away: "TURNED AWAY" };

function edgeColor(status: EntryLogRow["status"]) {
  if (status === "inside") return colors.go;
  if (status === "turned_away") return colors.stop;
  return colors.line;
}
function pillColor(status: EntryLogRow["status"]) {
  if (status === "inside") return colors.go;
  if (status === "turned_away") return colors.stop;
  return colors.soft;
}

function stampLine(entry: EntryLogRow): string {
  const entered = stamp(new Date(entry.enteredAt));
  if (entry.status === "exited" && entry.exitedAt) return `${entered} – ${stamp(new Date(entry.exitedAt))}`;
  if (entry.status === "inside") return `Entered ${entered}`;
  return entered;
}

interface Props {
  entry: EntryLogRow;
  onExit: () => void;
}

export function LogEntryCard({ entry, onExit }: Props) {
  const meta = [entry.purpose, entry.unit, entry.note].filter(Boolean).join(" · ");
  return (
    <GateCard edgeColor={edgeColor(entry.status)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GateText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
            {entry.visitorName}
          </GateText>
          <GateText variant="meta" color={colors.soft}>
            {meta}
          </GateText>
        </View>
        <StatusPill label={STATE_LABEL[entry.status]} color={pillColor(entry.status)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <GateText variant="gateCodeKeypad" color={colors.dim} style={{ flex: 1, fontSize: 11.5 }}>
          {stampLine(entry)}
        </GateText>
        {entry.status === "inside" ? (
          <AnimatedPressable
            onPress={onExit}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}
          >
            <GateText variant="label" style={{ fontSize: 12.5 }}>
              Mark exit
            </GateText>
          </AnimatedPressable>
        ) : null}
      </View>
    </GateCard>
  );
}
