import { hash, verify } from "@node-rs/argon2";
import { schemas } from "@chs/contract";
import type { Tx } from "../db";
import { AppError } from "../errors";

const PASSWORD_MIN_LENGTH = schemas.auth.PASSWORD_MIN_LENGTH;

/**
 * argon2id, OWASP's recommended parameters (19 MiB, t=2, p=1). Hashes carry
 * their own parameters, so raising these later only affects new hashes.
 */
// `algorithm: 2` is Algorithm.Argon2id — a const enum, which isolated modules can't import.
const ARGON = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON);
}

export async function verifyPassword(hashed: string | null | undefined, plain: string): Promise<boolean> {
  if (!hashed) {
    // Spend the same time as a real check so response timing doesn't reveal
    // whether the account has a password.
    await hash(plain, ARGON);
    return false;
  }
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** The most-used passwords that pass the length/letter/digit rules. Lower-case compare. */
const COMMON = new Set([
  "password1", "password12", "password123", "passw0rd", "passw0rd1", "abcd1234", "abc12345", "abcdef12",
  "qwerty12", "qwerty123", "qwerty1234", "asdf1234", "zxcv1234", "iloveyou1", "welcome1", "welcome123",
  "admin123", "admin1234", "letmein1", "monkey123", "dragon123", "sunshine1", "princess1", "football1",
  "baseball1", "master123", "shadow123", "superman1", "trustno1", "test1234", "hello123", "india123",
  "india@123", "pass1234", "pass@123", "secret123", "changeme1", "computer1", "internet1", "mumbai123",
  "pune1234", "society1", "society123", "a1b2c3d4", "1q2w3e4r", "1qaz2wsx", "q1w2e3r4", "12345abc",
  "123456ab", "123abc456", "1234abcd", "11111111a", "aa123456", "a12345678", "password@1", "p@ssw0rd",
  "p@ssword1", "welcome@1", "admin@123", "user1234", "login123", "qazwsx123", "google123", "whatsapp1",
]);

export function assertPasswordPolicy(plain: string, ctx: { mobile: string }): void {
  const problems: string[] = [];
  if (plain.length < PASSWORD_MIN_LENGTH) problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (!/[A-Za-z]/.test(plain)) problems.push("Include at least one letter.");
  if (!/\d/.test(plain)) problems.push("Include at least one number.");
  if (plain.replace(/\D/g, "").includes(ctx.mobile) || plain === ctx.mobile) problems.push("Don't use your mobile number.");
  if (COMMON.has(plain.toLowerCase())) problems.push("That password is too common. Choose something less predictable.");
  if (/^(.)\1+$/.test(plain)) problems.push("Don't repeat a single character.");
  if (problems.length) throw new AppError("PASSWORD_POLICY_VIOLATION", problems[0]!, problems);
}

/** Reject any of the last three passwords (MASTER_SPEC A2.2). */
export async function assertNotReused(db: Tx, userId: string, plain: string, currentHash: string | null): Promise<void> {
  const history = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { passwordHash: true },
  });
  const candidates = [currentHash, ...history.map((h) => h.passwordHash)].filter((h): h is string => !!h).slice(0, 3);
  for (const h of candidates) {
    if (await verify(h, plain).catch(() => false)) {
      throw new AppError("PASSWORD_POLICY_VIOLATION", "Choose a password you haven't used recently.");
    }
  }
}
