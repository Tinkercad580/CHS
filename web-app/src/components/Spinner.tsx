/**
 * The in-place spinner for an action the user just triggered — "Creating pass…",
 * "Sending…", "Checking…" (README, "Loading").
 *
 * This is the counterpart to Skeleton, not an alternative to it. A skeleton
 * answers "what is coming and where"; this answers "did my click register". It
 * belongs inside the button that was pressed, never over a page or a table,
 * and the button's label carries the status so the meaning does not rest on a
 * rotating shape alone.
 */
export function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      className="spinner"
      role="progressbar"
      aria-label="Working"
      style={{ width: size, height: size, borderColor: color, borderTopColor: "transparent" }}
    />
  );
}
