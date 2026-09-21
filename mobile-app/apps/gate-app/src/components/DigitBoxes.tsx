import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { colors } from "../theme";

interface Props {
  value: string;
  length?: number;
  error?: boolean;
  mask?: boolean;
  boxWidth?: number;
  boxHeight?: number;
  fontSize?: number;
  emptyBg?: string;
  gap?: number;
}

/** The 4-digit code/PIN boxes, active-outlined on the next empty slot — shared by sign-in and Entry. */
export function DigitBoxes({
  value,
  length = 4,
  error = false,
  mask = false,
  boxWidth,
  boxHeight = 64,
  fontSize = 26,
  emptyBg = colors.card,
  gap = 11,
}: Props) {
  return (
    <View style={{ flexDirection: "row", gap, justifyContent: boxWidth ? "center" : undefined }}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        const isActive = value.length === i;
        const borderColor = error ? colors.stop : isActive ? colors.go : colors.line;
        return (
          <View
            key={i}
            style={{
              flex: boxWidth ? undefined : 1,
              width: boxWidth,
              height: boxHeight,
              borderWidth: 2,
              borderColor,
              borderRadius: 14,
              backgroundColor: filled ? colors.card2 : emptyBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GateText variant="gateCodeKeypad" style={{ fontSize, lineHeight: fontSize }}>
              {filled ? (mask ? "•" : value[i]) : ""}
            </GateText>
          </View>
        );
      })}
    </View>
  );
}
