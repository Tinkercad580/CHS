import type { RequestHandler } from "express";
import { env } from "../../config/env";
import { AppError } from "../errors";

/**
 * Fixed-window request limits per client IP and bucket. In-memory per
 * instance, which is right for a single node and a floor for several; the
 * per-account lockout that actually stops password guessing lives in the
 * database (auth service), so it holds across instances regardless.
 */

const LIMITS = {
  default: { windowMs: 60_000, max: 300 },
  auth: { windowMs: 15 * 60_000, max: 50 },
  sensitive: { windowMs: 15 * 60_000, max: 30 },
} as const;

export type Bucket = keyof typeof LIMITS;

const hits = new Map<string, { count: number; resetAt: number }>();

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}, 60_000);
sweeper.unref();

export function rateLimit(bucket: Bucket): RequestHandler {
  const { windowMs, max } = LIMITS[bucket];
  return (req, res, next) => {
    if (env.isTest && req.header("x-test-rate-limit") !== "on") return next();
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new AppError("RATE_LIMITED", "Too many requests. Wait a few minutes and try again."));
    }
    next();
  };
}

export function resetRateLimits(): void {
  hits.clear();
}
