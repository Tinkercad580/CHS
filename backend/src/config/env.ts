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
    RUN_JOBS: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    for (const key of ["JWT_ACCESS_SECRET", "JWT_RESTRICTED_SECRET", "DATA_ENCRYPTION_KEY"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required in production" });
    }
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
    isProd: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
  };
}

export const env = load();
export type AppEnv = typeof env;
