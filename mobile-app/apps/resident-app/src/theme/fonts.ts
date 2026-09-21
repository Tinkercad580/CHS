import { useFonts } from "expo-font";
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from "@expo-google-fonts/figtree";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono";
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from "@expo-google-fonts/noto-sans-devanagari";

/**
 * Loads all three type families the design requires (README.md "Typography") before
 * anything renders — Noto Sans Devanagari is required, not optional, for Marathi/Hindi
 * (see README's Localisation section). Same pattern as the gate app's fonts.ts.
 */
export function useResidentFonts() {
  return useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });
}

const FIGTREE: Record<number, string> = {
  400: "Figtree_400Regular",
  500: "Figtree_500Medium",
  600: "Figtree_600SemiBold",
  700: "Figtree_700Bold",
  800: "Figtree_800ExtraBold",
};
const PLEX: Record<number, string> = {
  400: "IBMPlexMono_400Regular",
  500: "IBMPlexMono_500Medium",
  600: "IBMPlexMono_600SemiBold",
  700: "IBMPlexMono_700Bold",
};
const DEVANAGARI: Record<number, string> = {
  400: "NotoSansDevanagari_400Regular",
  500: "NotoSansDevanagari_500Medium",
  600: "NotoSansDevanagari_600SemiBold",
  700: "NotoSansDevanagari_700Bold",
};

/** Native text needs the exact per-weight family name — "bold" alone won't select a variant file. */
export function fontFamilyFor(family: "sans" | "mono" | "devanagari", weight: number): string {
  const table = family === "mono" ? PLEX : family === "devanagari" ? DEVANAGARI : FIGTREE;
  return table[weight] ?? table[400] ?? table[600] ?? Object.values(table)[0];
}
