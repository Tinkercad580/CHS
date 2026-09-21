/**
 * Sahaj design tokens — colour.
 * Mirrors the CSS custom properties in design_handoff_sahaj/design-files/Foundation Kit.dc.html
 * (see project/design_handoff_sahaj/README.md, "Design tokens" section).
 */

export interface ColorTokens {
  surface: string;
  canvas: string;
  canvasDeep: string;
  surfaceHover: string;
  subtle: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkDim: string;
  accent: string;
  accentInk: string;
  accentWash: string;
  accent200: string;
  ok: string;
  okInk: string;
  okWash: string;
  warn: string;
  warnInk: string;
  warnWash: string;
  warnBorder: string;
  bad: string;
  badInk: string;
  badWash: string;
  badBorder: string;
  info: string;
  infoInk: string;
  infoWash: string;
  infoBorder: string;
  rail: string;
  railInk: string;
  railSoft: string;
  railLine: string;
  railHover: string;
  railActive: string;
  railActiveInk: string;
  railFoot: string;
}

export const lightColors: ColorTokens = {
  surface: "#FFFFFF",
  canvas: "#F7F9F8",
  canvasDeep: "#EFF3F1",
  surfaceHover: "#FAFCFB",
  subtle: "#EDF1EF",
  border: "#E3E9E6",
  borderSoft: "#F1F4F3",
  borderStrong: "#CCD6D2",
  ink: "#0F1A17",
  inkSoft: "#4A5B56",
  inkMuted: "#6B7A75",
  inkDim: "#A8B5B0",
  accent: "#0E6B5C",
  accentInk: "#0A5749",
  accentWash: "#E6F2EF",
  accent200: "#C9E4DC",
  ok: "#167A3C",
  okInk: "#14663A",
  okWash: "#E8F5EC",
  warn: "#B45309",
  warnInk: "#8F4A0A",
  warnWash: "#FDF3E7",
  warnBorder: "#F5DFBE",
  bad: "#C0342B",
  badInk: "#9B2B22",
  badWash: "#FCEDEC",
  badBorder: "#F6D9D6",
  info: "#1D4ED8",
  infoInk: "#12327A",
  infoWash: "#EAF0FE",
  infoBorder: "#C7D7FB",
  rail: "#FFFFFF",
  railInk: "#0F1A17",
  railSoft: "#5A6B66",
  railLine: "#E3E9E6",
  railHover: "#F2F8F6",
  railActive: "#E6F2EF",
  railActiveInk: "#0A5749",
  railFoot: "#F7F9F8",
};

export const darkColors: ColorTokens = {
  surface: "#151C1A",
  canvas: "#0E1413",
  canvasDeep: "#090E0D",
  surfaceHover: "#1B2422",
  subtle: "#1D2624",
  border: "#2B3532",
  borderSoft: "#222B29",
  borderStrong: "#3A453F",
  ink: "#EEF3F1",
  inkSoft: "#A7B8B2",
  inkMuted: "#8A9B95",
  inkDim: "#6F7E79",
  accent: "#0E6B5C",
  accentInk: "#5FD3B6",
  accentWash: "#113931",
  accent200: "#1A5A4C",
  ok: "#1E8C48",
  okInk: "#7BD69F",
  okWash: "#11311E",
  warn: "#C2650F",
  warnInk: "#F3BE79",
  warnWash: "#33260E",
  warnBorder: "#4A3616",
  bad: "#C93F35",
  badInk: "#F4A39B",
  badWash: "#331916",
  badBorder: "#4A231F",
  info: "#3466E0",
  infoInk: "#A9C2FA",
  infoWash: "#15204A",
  infoBorder: "#23306A",
  rail: "#101715",
  railInk: "#EEF3F1",
  railSoft: "#9DAFA9",
  railLine: "#232D2A",
  railHover: "#1A2321",
  railActive: "#14382F",
  railActiveInk: "#6FDCC0",
  railFoot: "#0C1211",
};

/**
 * The gate handset is permanently dark in both themes (a night-shift device),
 * and uses its own scale rather than the shared light/dark tokens.
 */
export interface GateColorTokens {
  bg: string;
  card: string;
  card2: string;
  line: string;
  ink: string;
  soft: string;
  dim: string;
  go: string;
  goInk: string;
  stop: string;
  hold: string;
}

export const gateColorsLight: GateColorTokens = {
  bg: "#0A1512",
  card: "#122320",
  card2: "#18302B",
  line: "#21403A",
  ink: "#EAF5F1",
  soft: "#8FB0A6",
  dim: "#6A8B81",
  go: "#19B888",
  goInk: "#04231B",
  stop: "#E04A3C",
  hold: "#E8A33D",
};

export const gateColorsDark: GateColorTokens = {
  ...gateColorsLight,
  bg: "#06100D",
  card: "#0D1B18",
  card2: "#132824",
  line: "#1B3630",
};

export type ThemeName = "light" | "dark";

export function getColors(theme: ThemeName): ColorTokens {
  return theme === "dark" ? darkColors : lightColors;
}

export function getGateColors(theme: ThemeName): GateColorTokens {
  return theme === "dark" ? gateColorsDark : gateColorsLight;
}
