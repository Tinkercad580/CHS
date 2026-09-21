import { useMemo } from "react";
import type { TypeScaleKey } from "@sahaj/shared";
import { useResident } from "../state/ResidentProvider";
import { colorsFor, textStyle } from "../theme";

/** Reads theme + language off resident state and returns ready-to-use colours and a text-style helper. */
export function useTheme() {
  const { state } = useResident();
  const colors = useMemo(() => colorsFor(state.dark ? "dark" : "light"), [state.dark]);
  const useDevanagari = state.language !== "en";
  const type = (key: TypeScaleKey) => textStyle(key, useDevanagari);
  return { colors, dark: state.dark, language: state.language, type, useDevanagari };
}
