import { Easing } from "react-native-reanimated";
import { easing, motionDurationsMs } from "@sahaj/shared";

/**
 * The design's signature entrance choreography (README's "Motion" → the stagger-timing
 * table). Screens do not animate as one block — content cascades top to bottom, and
 * repeating cards cascade again inside each block, on their own faster clock.
 *
 * Four tiers, each mapped straight off `motionDurationsMs` (already the README's numbers):
 *  - screenBlock: top-level sections of a screen (Home's header/dues-card/quick-actions/…) — `scIn`
 *  - listRow:     the common repeating-card tier (bills, notices, passes, tickets, …) — `cardIn`
 *  - taggedCard:  cards whose own tag is the point (AGM poll cards, poll options) — `cardIn`
 *  - prefRow:     settings/preference rows, delay floor 0.38s — `cardIn`
 */
export type StaggerTier = "screenBlock" | "listRow" | "taggedCard" | "prefRow";

/** `scIn`/`gIn`: opacity 0→1, translate3d(0,10px,0) scale(.985)→none. */
const SC_IN = { translateY: 10, scale: 0.985 };
/** `cardIn`: opacity 0→1, translate3d(0,18px,0) scale(.965)→none. */
const CARD_IN = { translateY: 18, scale: 0.965 };

const EASE_OUT = Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]);
const EASE_STANDARD = Easing.bezier(easing.standard[0], easing.standard[1], easing.standard[2], easing.standard[3]);

export interface StaggerSpec {
  duration: number;
  delay: number;
  translateY: number;
  scale: number;
  easing: typeof EASE_OUT;
}

/**
 * Computes the entrance timing for the `index`-th (0-based) item of a `tier`, per the
 * README's table. `prefersReducedMotion` collapses duration *and* delay to near-zero —
 * duration alone is insufficient for a stagger, since the delay is the timing.
 */
export function staggerSpec(tier: StaggerTier, index: number, prefersReducedMotion: boolean): StaggerSpec {
  if (prefersReducedMotion) {
    return { duration: 1, delay: 0, translateY: 0, scale: 1, easing: EASE_OUT };
  }
  switch (tier) {
    case "screenBlock":
      return {
        duration: motionDurationsMs.screenContentBase,
        delay: Math.min(index * motionDurationsMs.screenContentStaggerStep, motionDurationsMs.screenContentStaggerCap),
        ...SC_IN,
        easing: EASE_OUT,
      };
    case "listRow":
      return {
        duration: motionDurationsMs.listRowBase,
        delay: Math.min(
          motionDurationsMs.listRowStaggerDelayFloor + index * motionDurationsMs.listRowStaggerStep,
          motionDurationsMs.listRowStaggerCap
        ),
        ...CARD_IN,
        easing: EASE_OUT,
      };
    case "taggedCard":
      return {
        duration: motionDurationsMs.taggedCardBase,
        delay: Math.min(
          motionDurationsMs.taggedCardStaggerDelayFloor + index * motionDurationsMs.taggedCardStaggerStep,
          motionDurationsMs.taggedCardStaggerCap
        ),
        ...CARD_IN,
        easing: EASE_OUT,
      };
    case "prefRow":
      return {
        duration: motionDurationsMs.prefRowBase,
        delay: motionDurationsMs.prefRowStaggerDelayFloor + index * motionDurationsMs.prefRowStaggerStep,
        ...CARD_IN,
        easing: EASE_OUT,
      };
  }
}

export { EASE_OUT, EASE_STANDARD };
