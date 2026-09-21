import React from "react";
import { View, Pressable } from "react-native";
import { GateText } from "./GateText";
import { colors } from "../theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"];

interface Props {
  onKey: (key: string) => void;
  keyHeight?: number;
  fontSize?: number;
}

/** The 3×4 keypad — digits, C (clear, in stop red) and ← (backspace) — used for both the duty PIN and the visitor code. */
export function Keypad({ onKey, keyHeight = 58, fontSize = 22 }: Props) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {KEYS.map((k) => {
        const isClear = k === "clear";
        const isDel = k === "del";
        const label = isClear ? "C" : isDel ? "←" : k;
        return (
          <Pressable
            key={k}
            onPress={() => onKey(k)}
            style={({ pressed }) => ({
              flexBasis: "31%",
              flexGrow: 1,
              height: keyHeight,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: isClear || isDel ? "transparent" : colors.card,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <GateText variant="gateCodeKeypad" color={isClear ? colors.stop : isDel ? colors.soft : colors.ink} style={{ fontSize, lineHeight: fontSize }}>
              {label}
            </GateText>
          </Pressable>
        );
      })}
    </View>
  );
}
