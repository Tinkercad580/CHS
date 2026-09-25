import React, { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { colors, textStyle } from "../theme";

interface Props extends TextInputProps {
  mono?: boolean;
  height?: number;
  multiline?: boolean;
}

/**
 * The standard gate-app text field — name/flat/note inputs on a dark card-2
 * ground. Focus turns the border go (the visitor form's focused field); on web
 * that replaces the browser's white outline, which read as a glare in the dark.
 */
export function GateInput({ mono = false, height = 52, multiline = false, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.dim}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        textStyle(mono ? "gateCodeKeypad" : "body"),
        {
          height: multiline ? undefined : height,
          minHeight: multiline ? 88 : undefined,
          paddingHorizontal: 15,
          paddingVertical: multiline ? 13 : 0,
          borderWidth: 1,
          borderColor: focused ? colors.go : colors.line,
          borderRadius: 13,
          outlineStyle: "solid",
          outlineWidth: 0,
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
