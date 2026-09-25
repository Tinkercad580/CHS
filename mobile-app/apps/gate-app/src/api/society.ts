import { api } from "@chs/contract";
import { useApiQuery } from "@chs/api-client/react";
import { useGuard } from "./guard";

/**
 * The society office's phone number, from `society.get` (surface `common`; the
 * server blanks the tax and registration ids for a guard). The alert screen shows
 * it because raising an alert on the handset doesn't reach anyone yet — the guard
 * has to phone for help. It rarely changes, so it is fetched once a shift: the
 * shell asks for it on mount so it is already cached if the alert screen is opened.
 *
 * `null` while loading, on an error, or when the office has no number on file;
 * the alert screen then falls back to a plain instruction.
 */
export function useSocietyPhone(): string | null {
  const { societyId } = useGuard();
  const society = useApiQuery(api.society.get, { params: { societyId } }, { staleTime: 60 * 60_000 });
  const phone = society.data?.contactPhone?.trim();
  return phone ? phone : null;
}
