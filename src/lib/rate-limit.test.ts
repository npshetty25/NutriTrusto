import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, LIMITS, rateLimited } from "@/lib/rate-limit";

// The buckets live in module memory and survive between tests, so every test
// uses its own user id rather than relying on a reset.
let seq = 0;
const user = () => `rl-user-${++seq}`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("checkRateLimit", () => {
  it("allows up to the route's maximum, then blocks", () => {
    const u = user();
    const { max } = LIMITS["extract"];
    for (let i = 0; i < max; i++) expect(checkRateLimit("extract", u).ok).toBe(true);
    expect(checkRateLimit("extract", u).ok).toBe(false);
  });

  it("reports how long until the oldest hit leaves the window", () => {
    const u = user();
    const { max, windowMs } = LIMITS["extract"];
    for (let i = 0; i < max; i++) checkRateLimit("extract", u);
    vi.setSystemTime(Date.now() + 20_000);

    const blocked = checkRateLimit("extract", u);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(Math.ceil((windowMs - 20_000) / 1000)); // 40
  });

  it("is a sliding window, not a fixed bucket", () => {
    const u = user();
    const { max } = LIMITS["analyze-food"]; // 20
    // Ten hits at t0, ten at t0+30s.
    for (let i = 0; i < max / 2; i++) checkRateLimit("analyze-food", u);
    vi.setSystemTime(Date.now() + 30_000);
    for (let i = 0; i < max / 2; i++) checkRateLimit("analyze-food", u);
    expect(checkRateLimit("analyze-food", u).ok).toBe(false);

    // At t0+61s the first ten have aged out, the second ten have not.
    vi.setSystemTime(Date.now() + 31_000);
    for (let i = 0; i < max / 2; i++) expect(checkRateLimit("analyze-food", u).ok).toBe(true);
    expect(checkRateLimit("analyze-food", u).ok).toBe(false);
  });

  it("does not count a blocked attempt against the user", () => {
    const u = user();
    const { max } = LIMITS["extract"];
    for (let i = 0; i < max; i++) checkRateLimit("extract", u);
    for (let i = 0; i < 50; i++) checkRateLimit("extract", u); // hammering while blocked
    vi.setSystemTime(Date.now() + 60_001);
    expect(checkRateLimit("extract", u).ok).toBe(true);
  });

  it("tracks users independently", () => {
    const a = user();
    const b = user();
    for (let i = 0; i < LIMITS["extract"].max; i++) checkRateLimit("extract", a);
    expect(checkRateLimit("extract", a).ok).toBe(false);
    expect(checkRateLimit("extract", b).ok).toBe(true);
  });

  it("tracks routes independently for the same user", () => {
    const u = user();
    for (let i = 0; i < LIMITS["extract"].max; i++) checkRateLimit("extract", u);
    expect(checkRateLimit("extract", u).ok).toBe(false);
    expect(checkRateLimit("find-recipe", u).ok).toBe(true);
  });

  it("applies a default of 30 a minute to a route with no explicit limit", () => {
    const u = user();
    for (let i = 0; i < 30; i++) expect(checkRateLimit("some-new-route", u).ok).toBe(true);
    expect(checkRateLimit("some-new-route", u).ok).toBe(false);
  });

  it("gives the most expensive routes the tightest ceilings", () => {
    expect(LIMITS["extract"].max).toBeLessThan(LIMITS["lookup-upc"].max);
    expect(LIMITS["contribute-product"].max).toBeLessThanOrEqual(LIMITS["extract"].max);
  });
});

describe("rateLimited response", () => {
  it("is a 429 with a Retry-After header", async () => {
    const res = rateLimited(12);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(((await res.json()) as { error: string }).error).toMatch(/12 seconds/);
  });

  it("uses the singular for one second", async () => {
    const res = rateLimited(1);
    expect(((await res.json()) as { error: string }).error).toMatch(/1 second\./);
  });
});
