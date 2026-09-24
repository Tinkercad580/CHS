import { Easing } from "react-native-reanimated";
import { easing, motionDurationsMs } from "@sahaj/shared";

/**
 * Entrance motion for a screen's content.
 *
 * The README's motion table gives each tier a per-item delay — 0.065-0.085s per
 * index, capped at .78s for rows and .9s for blocks — and the prototypes do
 * cascade that way. That is deliberately not implemented: the delay is what
 * makes a list arrive one row at a time, and the further down the screen
 * something is, the longer it withholds itself. On a screen opened daily that
 * reads as lag rather than polish, so items keep their fade and rise and all
 * play together. See docs/LOADING_AND_MOTION.md.
 *
 * The four tiers remain because their durations and travel differ:
 *  - screenBlock: top-level sections of a screen — `scIn`, 10px, subtler scale
 *  - listRow:     the common repeating-card tier (bills, notices, tickets) — `cardIn`
 *  - taggedCard:  cards whose own tag is the point (AGM polls) — `cardIn`
 *  - prefRow:     settings/preference rows — `cardIn`
 */
export type RevealTier = "screenBlock" | "listRow" | "taggedCard" | "prefRow";

/** `scIn`/`gIn`: opacity 0→1, translate3d(0,10px,0) scale(.985)→none. */
const SC_IN = { translateY: 10, scale: 0.985 };
/** `cardIn`: opacity 0→1, translate3d(0,18px,0) scale(.965)→none. */
const CARD_IN = { translateY: 18, scale: 0.965 };

const EASE_OUT = Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]);
const EASE_STANDARD = Easing.bezier(easing.standard[0], easing.standard[1], easing.standard[2], easing.standard[3]);

export interface RevealSpec {
  duration: number;
  translateY: number;
  scale: number;
  easing: typeof EASE_OUT;
}

/** Entrance timing for a `tier`. No index: everything in a tier plays together. */
export function revealSpec(tier: RevealTier, prefersReducedMotion: boolean): RevealSpec {
  if (prefersReducedMotion) {
    return { duration: 1, translateY: 0, scale: 1, easing: EASE_OUT };
  }
  switch (tier) {
    case "screenBlock":
      return {
        duration: motionDurationsMs.screenContentBase,
        ...SC_IN,
        easing: EASE_OUT,
      };
    case "listRow":
      return {
        duration: motionDurationsMs.listRowBase,
        ...CARD_IN,
        easing: EASE_OUT,
      };
    case "taggedCard":
      return {
        duration: motionDurationsMs.taggedCardBase,
        ...CARD_IN,
        easing: EASE_OUT,
      };
    case "prefRow":
      return {
        duration: motionDurationsMs.prefRowBase,
        ...CARD_IN,
        easing: EASE_OUT,
      };
  }
}

export { EASE_OUT, EASE_STANDARD };
