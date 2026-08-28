import { NextResponse } from "next/server";

/**
 * Per-user sliding-window rate limit for the Gemini-backed routes.
 *
 * Authentication stops a stranger spending the project's quota, but it does
 * not stop one signed-in account looping a request. A scan endpoint that
 * costs a model call per hit needs a ceiling regardless of who is calling.
 *
 * HONEST LIMITATION: this counter lives in the memory of one serverless
 * instance. Vercel keeps instances warm, so in practice it catches the case
 * this is built for — a single user hammering a button or a script. It is
 * NOT a distributed limit: a burst spread across cold starts can exceed the
 * quota below. A real deployment would keep these counters in Redis. This is
 * documented rather than hidden because the difference matters.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

// Highest-cost routes get the tightest ceiling. The numbers are set well
// above real human use: nobody scans 20 labels in a minute by hand.
export const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "analyze-food": { max: 20, windowMs: 60_000 },
  "find-recipe": { max: 15, windowMs: 60_000 },
  "pantry-chat": { max: 20, windowMs: 60_000 },
  "extract": { max: 10, windowMs: 60_000 },
  "scan-nutrition-label": { max: 15, windowMs: 60_000 },
  "scan-expiry-date": { max: 15, windowMs: 60_000 },
  "lookup-upc": { max: 40, windowMs: 60_000 },
  "contribute-product": { max: 10, windowMs: 60_000 },
};

const DEFAULT_LIMIT = { max: 30, windowMs: 60_000 };

// Without this the map grows for the lifetime of the instance, one entry per
// user per route, and never releases anything.
const sweep = (now: number) => {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 600_000) {
      buckets.delete(key);
    }
  }
};

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(route: string, userId: string): RateLimitResult {
  const { max, windowMs } = LIMITS[route] ?? DEFAULT_LIMIT;
  const now = Date.now();
  sweep(now);

  const key = `${route}:${userId}`;
  const bucket = buckets.get(key) ?? { hits: [] };
  // Sliding window: drop anything that has aged out, then judge what's left.
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfterSeconds: 0 };
}

export const rateLimited = (retryAfterSeconds: number) =>
  NextResponse.json(
    {
      success: false,
      error: `That's a lot of requests at once. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
