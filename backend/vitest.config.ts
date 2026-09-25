import "dotenv/config";
import { defineConfig } from "vitest/config";

/**
 * Tests run against a real PostgreSQL database — never mocks — so constraint,
 * transaction and query behaviour is exactly production's. The database is
 * TEST_DATABASE_URL, or DATABASE_URL with the database name suffixed "_test";
 * it is wiped between test files, so it must never be a database you care about.
 */
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL or DATABASE_URL to run tests");
  const url = new URL(base);
  const name = url.pathname.slice(1);
  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url.toString();
}

const url = testDatabaseUrl();
process.env.DATABASE_URL = url;

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    env: { NODE_ENV: "test", DATABASE_URL: url, LOG_LEVEL: "silent", RUN_JOBS: "false", MESSAGING_PROVIDER: "none" },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
