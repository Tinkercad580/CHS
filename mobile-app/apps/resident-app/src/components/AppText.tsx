import React from "react";
import { Text, type TextProps } from "react-native";
import type { TypeScaleKey } from "@sahaj/shared";
import { useResident } from "../state/ResidentProvider";
import { colorsFor, textStyle } from "../theme";

interface Props extends TextProps {
  variant: TypeScaleKey;
  color?: string;
  /** Force the Latin/mono face even in mr/hi — currency, codes, timers never render in Devanagari (README's "Currency stays in Latin digits"). */
  forceLatin?: boolean;
}

/** Text primitive that always resolves the right per-weight font family, including the Devanagari swap for mr/hi body text. */
export function AppText({ variant, color, forceLatin, style, ...rest }: Props) {
  const { state } = useResident();
  const colors = colorsFor(state.dark ? "dark" : "light");
  const useDevanagari = !forceLatin && state.language !== "en";
  const base = textStyle(variant, useDevanagari);
  return <Text {...rest} style={[base, { color: color ?? colors.ink }, style]} />;
}
