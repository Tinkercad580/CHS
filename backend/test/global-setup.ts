import { execSync } from "node:child_process";

/** Bring the test database to the latest migration once per run. */
export default function setup() {
  const url = process.env.DATABASE_URL ?? "";
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) throw new Error(`Refusing to run tests against "${name}": the test database name must end in _test`);
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
