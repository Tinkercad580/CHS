import { useNavigate } from "react-router-dom";

/**
 * Back to wherever the admin came from — a bill opened from a unit's ledger
 * returns to the ledger, from the bills list to the list. A record opened
 * straight from a link has no in-app history, and goes to `fallback`.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  };
}
