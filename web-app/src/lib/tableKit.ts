import { useCallback, useEffect, useState, type CSSProperties } from "react";

/**
 * The non-visual half of ApiTable: cursor paging, search settling, row
 * keyboard behaviour and the header button styles, shared by the API-backed
 * list pages.
 */

export interface Pager {
  pageNo: number;
  /** Pages the user can jump to: every page already visited, plus the next one if the server has it. */
  pageCount: number;
  onPage: (n: number) => void;
}

/**
 * Cursor pagination as numbered pages. The server only knows "the page after
 * this cursor", so page N is reachable once pages 1..N-1 have been seen; the
 * cursor for each is remembered. Changing a filter starts again at page 1.
 */
export function useCursorPager(resetKey: string) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageNo, setPageNo] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);

  // Reset during render rather than in an effect, so the stale cursor is never requested.
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setCursors([undefined]);
    setPageNo(1);
  }

  const cursor = cursors[pageNo - 1];

  /** Call with the current page's `nextCursor` once it arrives. */
  const learn = useCallback(
    (nextCursor: string | null | undefined) => {
      if (nextCursor === undefined) return;
      setCursors((cur) => {
        const want = cur.slice(0, pageNo);
        if (nextCursor) want.push(nextCursor);
        return want.length === cur.length && want.every((c, i) => c === cur[i]) ? cur : want;
      });
    },
    [pageNo],
  );

  return {
    cursor,
    pageNo,
    learn,
    pager: (hasNext: boolean): Pager => ({
      pageNo,
      pageCount: Math.max(pageNo + (hasNext ? 1 : 0), cursors.length),
      onPage: (n: number) => {
        if (n >= 1 && n <= cursors.length) setPageNo(n);
      },
    }),
  };
}

/**
 * The search box's value, settled. Typing does not wait on this — the input
 * updates on every key — it only stops each keystroke from being a request.
 */
export function useSettled<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export const secondaryBtnStyle: CSSProperties = {
  height: 38,
  padding: "0 15px",
  border: "1px solid var(--border-strong,#CCD6D2)",
  borderRadius: 10,
  background: "var(--surface,#fff)",
  color: "var(--ink,#0F1A17)",
  font: "600 13.5px/1 Figtree, sans-serif",
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
};

export const primaryBtnStyle: CSSProperties = {
  height: 38,
  padding: "0 16px",
  border: 0,
  borderRadius: 10,
  background: "#0E6B5C",
  color: "#fff",
  font: "600 13.5px/1 Figtree, sans-serif",
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
};

/** A clickable table row that also opens on Enter, so the list is usable without a mouse. */
export function rowProps(open: () => void) {
  return {
    onClick: open,
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Enter") {
        e.preventDefault();
        open();
      }
    },
    tabIndex: 0,
    className: "row-hover focus-row",
    style: { borderTop: "1px solid var(--border-soft,#F1F4F3)", cursor: "pointer" } as CSSProperties,
  };
}
