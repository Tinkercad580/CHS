/**
 * Sahaj design tokens — type scale.
 * Source: project/design_handoff_sahaj/README.md, "Typography".
 *
 * Font families are loaded from Google Fonts in each app:
 * Figtree (UI text), IBM Plex Mono (codes/plates/currency/timers), Noto Sans Devanagari (mr/hi).
 * Noto Sans Devanagari is required, not optional — Marathi/Hindi must not fall back silently.
 */

export const fontFamily = {
  sans: "Figtree",
  mono: "IBM Plex Mono",
  devanagari: "Noto Sans Devanagari",
} as const;

export interface TypeSpec {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typeScale = {
  pageTitleWeb: { fontFamily: fontFamily.sans, fontWeight: 800, fontSize: 34, lineHeight: 37, letterSpacing: -0.03 * 34 },
  screenTitleMobile: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 24, lineHeight: 29, letterSpacing: -0.024 * 24 },
  screenTitleGate: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 25, lineHeight: 29, letterSpacing: -0.026 * 25 },
  sectionHeading: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 25, lineHeight: 30, letterSpacing: -0.022 * 25 },
  cardTitleLarge: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 19, lineHeight: 24, letterSpacing: -0.02 * 19 },
  moneyHero: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 34, lineHeight: 34, letterSpacing: -0.03 * 34 },
  moneyHeroSmall: { fontFamily: fontFamily.sans, fontWeight: 700, fontSize: 30, lineHeight: 30, letterSpacing: -0.03 * 30 },
  moneyMono: { fontFamily: fontFamily.mono, fontWeight: 700, fontSize: 16, lineHeight: 19.2 },
  cardTitle: { fontFamily: fontFamily.sans, fontWeight: 600, fontSize: 14.5, lineHeight: 18.85 },
  body: { fontFamily: fontFamily.sans, fontWeight: 400, fontSize: 14.5, lineHeight: 23.5 },
  bodySmall: { fontFamily: fontFamily.sans, fontWeight: 400, fontSize: 13, lineHeight: 19.5 },
  label: { fontFamily: fontFamily.sans, fontWeight: 600, fontSize: 12.5, lineHeight: 12.5 },
  meta: { fontFamily: fontFamily.sans, fontWeight: 400, fontSize: 11.5, lineHeight: 15.5 },
  eyebrow: { fontFamily: fontFamily.mono, fontWeight: 600, fontSize: 11.5, lineHeight: 11.5, letterSpacing: 0.1 * 11.5 },
  tabLabel: { fontFamily: fontFamily.sans, fontWeight: 600, fontSize: 10.5, lineHeight: 10.5 },
  gateCodeDisplay: { fontFamily: fontFamily.mono, fontWeight: 700, fontSize: 40, lineHeight: 40, letterSpacing: 0.2 * 40 },
  gateCodeKeypad: { fontFamily: fontFamily.mono, fontWeight: 700, fontSize: 30, lineHeight: 30 },
  statusPill: { fontFamily: fontFamily.sans, fontWeight: 600, fontSize: 10.5, lineHeight: 13.65 },
  statusPillGate: { fontFamily: fontFamily.sans, fontWeight: 600, fontSize: 11, lineHeight: 14.3, letterSpacing: 0.04 * 11 },
} as const satisfies Record<string, TypeSpec>;

export type TypeScaleKey = keyof typeof typeScale;
