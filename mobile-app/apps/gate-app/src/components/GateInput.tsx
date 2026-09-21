import React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { colors, textStyle } from "../theme";

interface Props extends TextInputProps {
  mono?: boolean;
  height?: number;
  multiline?: boolean;
}

/** The standard gate-app text field — name/flat/note inputs on a dark card-2 ground. */
export function GateInput({ mono = false, height = 52, multiline = false, style, ...rest }: Props) {
  return (
    <TextInput
      placeholderTextColor={colors.dim}
      multiline={multiline}
      style={[
        textStyle(mono ? "gateCodeKeypad" : "body"),
        {
          height: multiline ? undefined : height,
          minHeight: multiline ? 88 : undefined,
          paddingHorizontal: 15,
          paddingVertical: multiline ? 13 : 0,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 13,
          backgroundColor: colors.card2,
          color: colors.ink,
          fontSize: mono ? 16 : 15,
        },
        style,
      ]}
      {...rest}
    />
  );
}
