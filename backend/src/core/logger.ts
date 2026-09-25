import pino from "pino";
import { env } from "../config/env";

/**
 * Structured JSON logs (pino). Credentials never reach a log line: the paths
 * below are redacted wherever they appear in a logged object.
 */
export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,
  base: { service: "chs-api", version: env.APP_VERSION },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.newPassword",
      "*.currentPassword",
      "*.confirmPassword",
      "*.refreshToken",
      "*.accessToken",
      "*.tempPassword",
      "*.totpSecret",
    ],
    censor: "[redacted]",
  },
  transport:
    env.NODE_ENV === "development" ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname,service,version" } } : undefined,
});

export type Logger = typeof logger;
