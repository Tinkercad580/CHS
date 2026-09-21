import type { TextStyle } from "react-native";
import { getGateColors, typeScale, fontFamily, spacing, radius, type TypeScaleKey, type TypeSpec } from "@sahaj/shared";
import { fontFamilyFor } from "./fonts";

/**
 * The gate handset is permanently dark in both themes (README.md, "Gate app palette") —
 * there is no in-app light/dark switch, so the app renders with the dark variant always.
 */
export const colors = getGateColors("dark");

export { spacing, radius };

function familyKey(cssFamily: string): "sans" | "mono" | "devanagari" {
  if (cssFamily === fontFamily.mono) return "mono";
  if (cssFamily === fontFamily.devanagari) return "devanagari";
  return "sans";
}

/** Converts a shared type-scale entry into a concrete React Native text style, with the right per-weight font family selected. */
export function textStyle(key: TypeScaleKey): TextStyle {
  const spec = typeScale[key] as TypeSpec;
  return {
    fontFamily: fontFamilyFor(familyKey(spec.fontFamily), spec.fontWeight),
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
  };
}

/** "#19B888" + 0.16 -> "rgba(25,136,...,.16)" — the tinted chip/icon-tile backgrounds used throughout the gate screens. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
