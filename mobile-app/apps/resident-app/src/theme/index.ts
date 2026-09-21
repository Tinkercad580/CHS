import type { TextStyle } from "react-native";
import { getColors, typeScale, fontFamily, spacing, radius, motionDurationsMs, easing, type TypeScaleKey, type TypeSpec, type ThemeName } from "@sahaj/shared";
import { fontFamilyFor } from "./fonts";

export { spacing, radius, motionDurationsMs, easing };
export type { ThemeName };

/** Resident app supports both themes (unlike the gate handset, which is permanently dark) — see README's colour tables. */
export function colorsFor(theme: ThemeName) {
  return getColors(theme);
}

function familyKey(cssFamily: string): "sans" | "mono" | "devanagari" {
  if (cssFamily === fontFamily.mono) return "mono";
  if (cssFamily === fontFamily.devanagari) return "devanagari";
  return "sans";
}

/**
 * Converts a shared type-scale entry into a concrete React Native text style.
 * `useDevanagari` swaps the sans family for Noto Sans Devanagari — RN has no CSS-style
 * font-stack fallback, so Marathi/Hindi text must explicitly pick a face that has the
 * glyphs (README's "Noto Sans Devanagari is required, not optional"). Mono contexts
 * (codes, currency, timers) stay in IBM Plex Mono regardless of language.
 */
export function textStyle(key: TypeScaleKey, useDevanagari = false): TextStyle {
  const spec = typeScale[key] as TypeSpec;
  const fam = familyKey(spec.fontFamily);
  const resolved = fam === "sans" && useDevanagari ? "devanagari" : fam;
  return {
    fontFamily: fontFamilyFor(resolved, spec.fontWeight),
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
  };
}

/** "#19B888" + 0.16 -> "rgba(25,136,...,.16)" — tinted chip/tile backgrounds used throughout. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
