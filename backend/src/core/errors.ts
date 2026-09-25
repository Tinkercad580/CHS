import { ERROR_CODES, type ErrorCode } from "@chs/contract";

/**
 * The one error type services throw. Its code maps to a fixed HTTP status and
 * crosses the wire unchanged; the message is written for the person using the
 * app, since clients display it as-is.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found.`);
export const forbidden = (message = "You don't have permission to do that.") => new AppError("FORBIDDEN", message);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", message, details);
export const rule = (message: string, details?: unknown) => new AppError("BUSINESS_RULE_VIOLATION", message, details);
