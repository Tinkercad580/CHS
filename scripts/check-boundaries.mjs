#!/usr/bin/env node
/**
 * Layering rules — MASTER_SPEC A4.1 — checked on every CI run.
 *
 *   1. domain/ code imports no repositories, integrations, Express or Prisma.
 *   2. Route files don't touch the database directly for writes (they call services).
 *   3. No money arithmetic on paise outside core/money.
 *   4. No raw SQL outside core/ (numbering, db) and migrations.
 *   5. No statutory numeric literal in billing or compliance code.
 *   6. The contract package imports nothing from backend or apps.
 *
 * A regex check, deliberately simple: it catches the drift that happens one
 * convenient import at a time. Exceptions carry a `boundary-ok:` comment with a reason.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const failures = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "generated" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function check(file, rule, pattern, message) {
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (pattern.test(line) && !line.includes("boundary-ok:")) failures.push(`${relative(root, file)}:${i + 1}  [${rule}] ${message}\n    ${line.trim()}`);
  });
}

const backend = walk(join(root, "backend", "src"));
for (const f of backend) {
  const rel = relative(join(root, "backend", "src"), f).split(sep).join("/");
  if (rel.includes("/domain/")) {
    check(f, "1", /from\s+["'](express|.*\/db|.*repository|.*integrations\/)/, "domain code must stay pure");
  }
  if (rel.endsWith(".routes.ts") && !rel.startsWith("modules/auth/") && !rel.startsWith("modules/platform/")) {
    check(f, "2", /prisma\.\w+\.(create|update|delete|upsert)/, "route files call services; they don't write to the database");
  }
  if (!rel.startsWith("core/money")) {
    check(f, "3", /[pP]aise\s*[-+*/]\s*\d|\d\s*[*/]\s*\w*[pP]aise/, "money arithmetic belongs in core/money");
  }
  if (!rel.startsWith("core/")) {
    check(f, "4", /\$(queryRawUnsafe|executeRawUnsafe)\(/, "raw SQL belongs in core/");
  }
  if (rel.startsWith("modules/billing/") || rel.startsWith("modules/compliance/")) {
    check(f, "5", /(?<![\w.])(12|0\.25|0\.75|7500|20_00_000|2000000)(?![\w.])/, "statutory numbers come from statutory_config");
  }
}

for (const f of walk(join(root, "packages", "contract", "src"))) {
  check(f, "6", /from\s+["'](\.\.\/)+(backend|web-app|mobile-app)|from\s+["']@chs\/backend/, "the contract depends on nothing but zod");
}

if (failures.length) {
  console.error(`Layering violations (${failures.length}):\n\n${failures.join("\n\n")}`);
  process.exit(1);
}
console.log(`layering: ok (${backend.length} backend files)`);
