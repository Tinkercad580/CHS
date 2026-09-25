import type { ErrorCode } from "@chs/contract";

/** Every failed call rejects with this. Branch on `code`; show `message`. */
export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK_ERROR" | "TIMEOUT";
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(init: { code: ApiError["code"]; status: number; message: string; details?: unknown; requestId?: string }) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  /** Field-level messages from a VALIDATION_FAILED response, keyed by dotted path. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_FAILED" || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const issue of this.details as { path?: (string | number)[]; message?: string }[]) {
      const key = (issue.path ?? []).join(".");
      if (key && issue.message && !out[key]) out[key] = issue.message;
    }
    return out;
  }

  /** Worth retrying automatically: the request may not have reached the server, or it was overloaded. */
  get retryable(): boolean {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT" || this.status === 503 || this.status === 429;
  }
}
