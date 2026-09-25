import { api } from "@chs/contract";
import { useApiQuery } from "@chs/api-client/react";
import { useSocietyId } from "./billing";

/** The society's own profile (society.get) — its name, address and the office's contact details. */
export function useSocietyProfile() {
  const societyId = useSocietyId();
  return useApiQuery(api.society.get, { params: { societyId } }, { enabled: societyId !== "" });
}

/**
 * A phone number the way it is dialled in India: "02027291100" → "020 2729 1100",
 * "9822041155" → "98220 41155". Anything else is shown as stored.
 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return raw;
}

/** The `tel:` link for a stored number: digits, and a leading + if it had one. */
export function telUrl(raw: string): string {
  return `tel:${raw.trim().startsWith("+") ? "+" : ""}${raw.replace(/\D/g, "")}`;
}
