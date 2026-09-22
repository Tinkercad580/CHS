/**
 * The stagger-timing table from project/design_handoff_sahaj/README.md, "Motion":
 *
 *   screen content blocks:  .5s  cardIn/scIn, delay (n-1) x 0.075s, capped at .9s
 *   list rows inside:       .46s cardIn,      delay 0.14s + (n-1) x 0.065s, capped at .78s
 *   tagged cards:           .56s cardIn,      delay 0.1s + (n-1) x 0.085s, capped at .78s
 *   settings/pref rows:     .56s cardIn,      delay 0.38s + (n-1) x 0.07s
 *
 * "Screen content blocks" (`scIn`/`gIn`) travel a shorter 10px with a subtler .985 scale;
 * repeating cards (`cardIn` — list rows, tagged cards, pref rows) travel 18px from .965.
 */
import { motionDurationsMs } from "@sahaj/shared";

export type StaggerTier = "screenBlock" | "listRow" | "taggedCard" | "prefRow";

interface TierSpec {
  durationMs: number;
  stepMs: number;
  floorMs: number;
  capMs?: number;
  translateY: number;
  scale: number;
}

const TIERS: Record<StaggerTier, TierSpec> = {
  screenBlock: {
    durationMs: motionDurationsMs.screenContentBase,
    stepMs: motionDurationsMs.screenContentStaggerStep,
    floorMs: 0,
    capMs: motionDurationsMs.screenContentStaggerCap,
    translateY: 10,
    scale: 0.985,
  },
  listRow: {
    durationMs: motionDurationsMs.listRowBase,
    stepMs: motionDurationsMs.listRowStaggerStep,
    floorMs: motionDurationsMs.listRowStaggerDelayFloor,
    capMs: motionDurationsMs.listRowStaggerCap,
    translateY: 18,
    scale: 0.965,
  },
  taggedCard: {
    durationMs: motionDurationsMs.taggedCardBase,
    stepMs: motionDurationsMs.taggedCardStaggerStep,
    floorMs: motionDurationsMs.taggedCardStaggerDelayFloor,
    capMs: motionDurationsMs.taggedCardStaggerCap,
    translateY: 18,
    scale: 0.965,
  },
  prefRow: {
    durationMs: motionDurationsMs.prefRowBase,
    stepMs: motionDurationsMs.prefRowStaggerStep,
    floorMs: motionDurationsMs.prefRowStaggerDelayFloor,
    // The README's table gives no cap for settings/pref rows — uncapped by intent.
    translateY: 18,
    scale: 0.965,
  },
};

/** `floor + (n-1) x step`, capped where the table specifies one — `index` is 0-based (n-1 already). */
export function staggerDelayMs(index: number, tier: StaggerTier): number {
  const spec = TIERS[tier];
  const raw = spec.floorMs + Math.max(0, index) * spec.stepMs;
  return spec.capMs !== undefined ? Math.min(raw, spec.capMs) : raw;
}

export function staggerDurationMs(tier: StaggerTier): number {
  return TIERS[tier].durationMs;
}

export function staggerTransform(tier: StaggerTier): { translateY: number; scale: number } {
  const spec = TIERS[tier];
  return { translateY: spec.translateY, scale: spec.scale };
}
