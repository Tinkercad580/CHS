import { useEffect, useRef, useState } from "react";

/** README "Loading": a filter or search change flashes a 520ms skeleton shimmer. */
export const SKELETON_MS = 520;

/**
 * Briefly show a skeleton over a table when its filter changes.
 *
 * The rows are already in memory, so nothing is actually being fetched — the flash
 * exists because an instant swap gives no feedback that the filter did anything.
 * The resident app does the same on the Dues All/Unpaid/Paid filters, and this is
 * the web equivalent for the admin tables.
 *
 * Shared rather than repeated per page: the timer has to be cleared both on a
 * re-trigger and on unmount, and three private copies of that is three chances to
 * leak one.
 */
export function useFlashRefresh(): [boolean, () => void] {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = () => {
    setRefreshing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), SKELETON_MS);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return [refreshing, flash];
}
