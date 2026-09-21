import React from "react";
import { Text, type TextProps } from "react-native";
import { textStyle, colors } from "../theme";
import type { TypeScaleKey } from "@sahaj/shared";

interface Props extends TextProps {
  variant: TypeScaleKey;
  color?: string;
}

/** Text pre-styled from the shared type scale — every screen reaches for this instead of ad hoc font props. */
export function GateText({ variant, color = colors.ink, style, children, ...rest }: Props) {
  return (
    <Text style={[textStyle(variant), { color }, style]} {...rest}>
      {children}
    </Text>
  );
}
