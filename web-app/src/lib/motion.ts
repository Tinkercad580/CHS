import type { CSSProperties } from "react";

/**
 * Admin-web motion.
 *
 * The per-item stagger that used to live here is gone. It applied a `cardIn`
 * keyframe with a delay computed from each item's index — up to .78s for list
 * rows and .9s for screen blocks — so the further down the page something was,
 * the longer it withheld itself. Admin Web.dc.html does not do this: across the
 * design's tables there is not one animated row, `cardIn` never appears, and the
 * only `animation-delay` in the file is the reduced-motion reset. It was also
 * the wrong idea for the surface, since a staggered reveal is a first-run
 * flourish and this is a screen the committee opens every day.
 *
 * What the design does use on entry is a single short fade, which is what is
 * left: `fadeUp .26s` for a screen block, applied once to the block rather than
 * to each of its children.
 */

const EASE = "cubic-bezier(.2,.7,.3,1)";

/**
 * One fade for a whole screen block, matching the design's
 * `animation:fadeUp .26s cubic-bezier(.2,.7,.3,1)`.
 *
 * It takes no index: every block on a screen fades together. The old version
 * took one and multiplied it into a delay, which is precisely the effect being
 * removed.
 */
export function blockStyle(): CSSProperties {
  return { animation: `fadeUp .26s ${EASE} both` };
}
