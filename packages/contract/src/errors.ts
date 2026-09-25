/**
 * Stable, machine-readable error codes — MASTER_SPEC E3. Clients branch on
 * `code`, never on `message`. Adding a code is fine; renaming one is a
 * breaking change.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  REFRESH_TOKEN_INVALID: 401,
  TWO_FACTOR_REQUIRED: 401,
  TWO_FACTOR_INVALID: 401,
  PASSWORD_CHANGE_REQUIRED: 403,
  FORBIDDEN: 403,
  SURFACE_NOT_ALLOWED: 403,
  SOCIETY_ACCESS_DENIED: 403,
  ACCOUNT_SUSPENDED: 403,
  NOT_FOUND: 404,
  MOBILE_NOT_REGISTERED: 404,
  CONFLICT: 409,
  MOBILE_ALREADY_EXISTS: 409,
  PASSWORD_ALREADY_SET: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  UNIT_IN_USE: 409,
  PRECONDITION_FAILED: 412,
  GO_LIVE_BLOCKED: 412,
  RESOLUTION_REQUIRED: 422,
  INTEREST_RATE_EXCEEDS_CAP: 422,
  FUND_BELOW_MINIMUM: 422,
  PASSWORD_POLICY_VIOLATION: 422,
  TEMP_PASSWORD_EXPIRED: 422,
  BUSINESS_RULE_VIOLATION: 422,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: { requestId?: string };
}
