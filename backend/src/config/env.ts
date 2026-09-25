import "dotenv/config";
import { z } from "zod";

/**
 * Every setting the process reads, validated once at start-up. A missing or
 * malformed value stops the server with a message naming it, rather than
 * surfacing later as an undefined somewhere in a request.
 */
const Env = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    HOST: z.string().default("0.0.0.0"),
    APP_VERSION: z.string().default(process.env.npm_package_version ?? "0.0.0"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:5273,http://localhost:8181,http://localhost:8182")
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
    REDIS_URL: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
    JWT_ACCESS_SECRET: z.string().min(32).optional(),
    JWT_RESTRICTED_SECRET: z.string().min(32).optional(),
    DATA_ENCRYPTION_KEY: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** MASTER_SPEC A2.2: failed sign-ins per IP per hour before the IP is throttled. Raise it where many residents share one network. */
    LOGIN_IP_FAILURES_PER_HOUR: z.coerce.number().int().min(1).default(10),
    MESSAGING_PROVIDER: z.enum(["log", "none"]).default("log"),

    // ── Push (Firebase Cloud Messaging, HTTP v1) — resident and gate apps ──
    /** `log` records pushes without sending; `fcm` delivers. */
    PUSH_PROVIDER: z.enum(["log", "fcm"]).default("log"),
    /**
     * The service-account JSON exactly as Firebase downloads it (Project
     * settings → Service accounts → Generate new private key). Not
     * google-services.json: that only lets a device receive.
     */
    FIREBASE_SERVICE_ACCOUNT_FILE: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

    // ── Email (nodemailer over SMTP) — reports and updates ──
    /** `log` prints emails instead of sending; `smtp` sends. */
    MAIL_PROVIDER: z.enum(["log", "smtp"]).default("log"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    /** true for port 465 (implicit TLS); false uses STARTTLS on 587. */
    SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default("Sahaj <no-reply@localhost>"),
    /** Links in emails point here (the admin console). */
    PUBLIC_WEB_URL: z.string().default("http://localhost:5273"),

    // ── Payments ──
    /** Only `dummy` exists today: a simulated gateway for building and testing the flow end to end. */
    PAYMENT_GATEWAY: z.enum(["dummy"]).default("dummy"),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16).optional(),
    RUN_JOBS: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    for (const key of ["JWT_ACCESS_SECRET", "JWT_RESTRICTED_SECRET", "DATA_ENCRYPTION_KEY", "PAYMENT_WEBHOOK_SECRET"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required in production" });
    }
    if (env.MAIL_PROVIDER === "smtp" && !env.SMTP_HOST) ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "required when MAIL_PROVIDER=smtp" });
  });

function load() {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    // Logger depends on env, so this one message goes straight to stderr.
    process.stderr.write(`Invalid environment:\n${lines}\n`);
    process.exit(1);
  }
  const env = parsed.data;
  // Development and test get fixed, clearly-labelled secrets so the server
  // starts without setup; production refuses to start without real ones.
  const devSecret = (name: string) => `dev-only-${name}-not-for-production-use-0000`;
  return {
    ...env,
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET ?? devSecret("access"),
    JWT_RESTRICTED_SECRET: env.JWT_RESTRICTED_SECRET ?? devSecret("restricted"),
    DATA_ENCRYPTION_KEY: env.DATA_ENCRYPTION_KEY ?? devSecret("encryption"),
    PAYMENT_WEBHOOK_SECRET: env.PAYMENT_WEBHOOK_SECRET ?? devSecret("webhook"),
    isProd: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
  };
}

export const env = load();
export type AppEnv = typeof env;
