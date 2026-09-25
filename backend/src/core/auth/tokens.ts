import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { env } from "../../config/env";
import { AppError } from "../errors";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
// Restricted and 2FA-challenge tokens use a separate key, so no bug in claim
// checking can ever make one pass as an access token.
const restrictedKey = new TextEncoder().encode(env.JWT_RESTRICTED_SECRET);

const ISSUER = "chs-api";

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session id
  ver: number; // user.tokenVersion at issue
}

export async function signAccessToken(claims: AccessClaims): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({ sid: claims.sid, ver: claims.ver, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(accessKey);
  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sub !== "string" || typeof payload.sid !== "string") throw new Error("bad claims");
    return { sub: payload.sub, sid: payload.sid, ver: Number(payload.ver ?? 0) };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw new AppError("TOKEN_EXPIRED", "Your session has expired.");
    throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  }
}

export type RestrictedPurpose = "password_change" | "two_factor";

export async function signRestrictedToken(
  userId: string,
  purpose: RestrictedPurpose,
  ver: number,
  ttlSeconds = 10 * 60,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const token = await new SignJWT({ typ: purpose, ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(restrictedKey);
  return { token, expiresAt };
}

export async function verifyRestrictedToken(token: string, purpose: RestrictedPurpose): Promise<{ userId: string; ver: number }> {
  try {
    const { payload } = await jwtVerify(token, restrictedKey, { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.typ !== purpose || typeof payload.sub !== "string") throw new Error("bad claims");
    return { userId: payload.sub, ver: Number(payload.ver ?? 0) };
  } catch {
    throw new AppError(
      purpose === "two_factor" ? "TWO_FACTOR_INVALID" : "UNAUTHENTICATED",
      "This step has expired. Sign in again.",
    );
  }
}

/** Distinguishes the two token kinds without verifying, to pick the right key. */
export function peekTokenType(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { typ?: string };
    return payload.typ ?? null;
  } catch {
    return null;
  }
}
