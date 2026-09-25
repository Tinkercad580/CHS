import { ApiError } from "@chs/api-client";

/**
 * Splits a failed call into what goes under a field and what goes above the
 * button. Server messages are shown as written; only the routing is ours.
 * `policyField` is where a password-policy refusal lands — the server sends it
 * as a message, not a field error.
 */
export function splitError(err: unknown, policyField?: string): { fields: Record<string, string>; message: string | null } {
  if (!(err instanceof ApiError)) return { fields: {}, message: "Something went wrong. Try again." };
  const fields = err.fieldErrors;
  if (Object.keys(fields).length > 0) return { fields, message: null };
  if (err.code === "PASSWORD_POLICY_VIOLATION" && policyField) return { fields: { [policyField]: err.message }, message: null };
  return { fields: {}, message: err.message };
}
