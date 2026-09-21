import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { colors } from "../theme";

interface Props {
  title: string;
  detail: string;
  dashed?: boolean;
}

/** "Nothing in this filter" / "Nobody expected right now" — an empty state carries a title, an explanation, and a dashed border, never a blank card. */
export function EmptyState({ title, detail, dashed = true }: Props) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: colors.line,
        borderRadius: 16,
        paddingVertical: 30,
        paddingHorizontal: 18,
        alignItems: "center",
      }}
    >
      <GateText variant="cardTitle" style={{ marginBottom: 5, textAlign: "center" }}>
        {title}
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ textAlign: "center" }}>
        {detail}
      </GateText>
    </View>
  );
}
