import { t, c, num, type CopyKey } from "@sahaj/shared";
import { useResident } from "../state/ResidentProvider";

/** `t()`/`c()`/`num()` pre-bound to the current language — README's `t(key, n)` and `c(id, field, fallback)` helpers. */
export function useT() {
  const { state } = useResident();
  const lang = state.language;
  return {
    t: (key: CopyKey, vars?: Record<string, string | number>) => t(lang, key, vars),
    c: (id: string, field: string, fallback: string) => c(lang, id, field, fallback),
    cList: (id: string, field: string, fallback: string[]) => c(lang, id, field, fallback),
    num: (n: number) => num(n, lang),
    lang,
  };
}
