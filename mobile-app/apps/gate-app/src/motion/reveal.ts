/**
 * Entrance motion, from project/design_handoff_sahaj/README.md's "Motion" table.
 *
 * The table also gives each tier a per-item delay — 0.065-0.085s per index,
 * capped at .78s for rows and .9s for blocks. That part is deliberately not
 * implemented: the delay is what makes a list arrive one row at a time, and on
 * a handset a guard uses all shift it reads as lag. Items keep their fade and
 * travel and play together. See docs/LOADING_AND_MOTION.md.
 *
 * Durations and travel still differ by tier. "Screen content blocks"
 * (`scIn`/`gIn`) travel a shorter 10px with a subtler .985 scale; repeating
 * cards (`cardIn`) travel 18px from .965.
 */
import { motionDurationsMs } from "@sahaj/shared";

export type RevealTier = "screenBlock" | "listRow" | "taggedCard" | "prefRow";

interface TierSpec {
  durationMs: number;
  translateY: number;
  scale: number;
}

const TIERS: Record<RevealTier, TierSpec> = {
  screenBlock: {
    durationMs: motionDurationsMs.screenContentBase,
    translateY: 10,
    scale: 0.985,
  },
  listRow: {
    durationMs: motionDurationsMs.listRowBase,
    translateY: 18,
    scale: 0.965,
  },
  taggedCard: {
    durationMs: motionDurationsMs.taggedCardBase,
    translateY: 18,
    scale: 0.965,
  },
  prefRow: {
    durationMs: motionDurationsMs.prefRowBase,
    translateY: 18,
    scale: 0.965,
  },
};


export function revealDurationMs(tier: RevealTier): number {
  return TIERS[tier].durationMs;
}

export function revealTransform(tier: RevealTier): { translateY: number; scale: number } {
  const spec = TIERS[tier];
  return { translateY: spec.translateY, scale: spec.scale };
}
