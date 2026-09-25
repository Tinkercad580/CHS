import { ApiError } from "@chs/api-client";

/**
 * Splits a failed call into what goes under each field and what goes above
 * the button. Field messages come from the server's validation details;
 * anything else is the server's own message, unedited.
 */
export function splitError(err: unknown, fields: readonly string[]): { field: Record<string, string>; form: string | null } {
  if (!(err instanceof ApiError)) return { field: {}, form: "Something went wrong. Try again." };
  const all = err.fieldErrors;
  const field: Record<string, string> = {};
  for (const f of fields) if (all[f]) field[f] = all[f];
  const unplaced = Object.keys(all).filter((k) => !fields.includes(k));
  // A validation failure whose every issue landed on a field needs no banner too.
  const form = Object.keys(field).length && !unplaced.length ? null : unplaced.length ? all[unplaced[0]] : err.message;
  return { field, form };
}
