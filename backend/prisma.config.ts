import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` never connects, so it must work without a database — on a
 * fresh clone and in the Docker build stage. The placeholder is only ever seen
 * by generate; migrate and the app need the real DATABASE_URL and fail loudly
 * (connection refused to "unset") if it is missing.
 */
export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://unset:unset@127.0.0.1:1/unset",
  },
});
