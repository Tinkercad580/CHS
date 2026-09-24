/**
 * Sahaj design tokens — spacing, radius, elevation, motion.
 * Source: project/design_handoff_sahaj/README.md, "Spacing, radius, elevation" and "Motion".
 */

export const spacing = {
  s5: 5, s7: 7, s8: 8, s9: 9, s10: 10, s11: 11, s12: 12, s13: 13, s14: 14,
  s15: 15, s16: 16, s18: 18, s20: 20, s22: 22, s26: 26, s30: 30, s34: 34, s44: 44,
} as const;

export const screenPaddingX = 22;
export const cardPadding = { min: 14, max: 18 };
export const sheetPadding = { top: 10, x: 22, bottom: 28 };

export const radius = {
  chip: 6,
  button: 10,
  card: 14,
  featureCard: 20,
  sheetTop: 26,
  sheetBottom: 38,
  phoneBezel: 40,
  pill: 999,
} as const;

export const elevation = {
  cardLift: { shadowOffset: { width: 0, height: 10 }, shadowRadius: 26, shadowOpacity: 0.3, shadowColor: "rgba(15,26,23,1)" },
  hoverLift: { shadowOffset: { width: 0, height: 14 }, shadowRadius: 28, shadowOpacity: 0.34, shadowColor: "rgba(15,26,23,1)" },
  phoneFrame: { shadowOffset: { width: 0, height: 34 }, shadowRadius: 70, shadowOpacity: 0.5, shadowColor: "rgba(15,26,23,1)" },
  sheet: { shadowOffset: { width: 0, height: 14 }, shadowRadius: 30, shadowOpacity: 0.5, shadowColor: "rgba(9,14,13,1)" },
  toggleKnob: { shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, shadowOpacity: 0.22, shadowColor: "rgba(0,0,0,1)" },
} as const;

export const easing = {
  standard: [0.2, 0.7, 0.3, 1] as const,
  out: [0.22, 1, 0.36, 1] as const,
};

/**
 * The README's motion numbers, transcribed.
 *
 * The `...StaggerStep`, `...StaggerDelayFloor` and `...StaggerCap` entries are
 * kept as the record of what the design specified but are deliberately unread:
 * the per-item delay they describe made lists arrive one row at a time, which is
 * documented in docs/LOADING_AND_MOTION.md. The `...Base` durations are live.
 */
export const motionDurationsMs = {
  screenContentBase: 500,
  screenContentStaggerStep: 75,
  screenContentStaggerCap: 900,
  listRowBase: 460,
  listRowStaggerStep: 65,
  listRowStaggerDelayFloor: 140,
  listRowStaggerCap: 780,
  taggedCardBase: 560,
  taggedCardStaggerStep: 85,
  taggedCardStaggerDelayFloor: 100,
  taggedCardStaggerCap: 780,
  prefRowBase: 560,
  prefRowStaggerStep: 70,
  prefRowStaggerDelayFloor: 380,
  hoverLift: 200,
  press: 150,
  toggleKnob: 220,
  toastDismiss: 2800,
  skeletonShimmer: 520,
  verify: 620,
  createGuestPass: 620,
  walkinPing: 2600,
  holdToConfirm: 2000,
} as const;

/** Toasts appear bottom-centre above the tab bar, max 3, each with its own dismissal timer. */
export const MAX_TOASTS = 3;
