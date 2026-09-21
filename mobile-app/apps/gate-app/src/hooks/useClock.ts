import { useEffect, useState } from "react";
import { clockLabel } from "../utils/time";

/** The handset's top-left clock, ticking every 20s like the prototype — no need for per-second precision. */
export function useClock(): string {
  const [clock, setClock] = useState(() => clockLabel());
  useEffect(() => {
    const id = setInterval(() => setClock(clockLabel()), 20_000);
    return () => clearInterval(id);
  }, []);
  return clock;
}
