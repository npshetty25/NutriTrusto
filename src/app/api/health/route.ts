import { NextResponse } from "next/server";

/**
 * Health endpoint for load balancers, container orchestrators and uptime
 * checks. Unauthenticated by design, and it returns nothing sensitive: a
 * status, a build id, and one latency number per dependency.
 *
 *   GET /api/health              readiness: is the database reachable?
 *   GET /api/health?probe=live   liveness: is this process answering at all?
 *
 * Liveness never touches a dependency. A container that restarts because
 * Supabase had a bad minute would turn a partial outage into a total one.
 *
 * Two dependency checks, both with the public anon key the browser already
 * holds, run in parallel:
 *
 *   auth      GET /auth/v1/health, which answers 200 when GoTrue is up.
 *   postgrest GET /rest/v1/<table>?limit=1. Any answer below 500 counts: a
 *             200 (rows), or a 401/403 from row-level security or privileges,
 *             still proves PostgREST accepted the request and could reach
 *             Postgres to authorise it. A 5xx, a timeout or a refused
 *             connection is a real outage.
 *
 * PostgREST's own root (/rest/v1/) is NOT used: current Supabase projects
 * answer it 401 to the anon key, which made an earlier version of this route
 * report "degraded" against a perfectly healthy project.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3000;
const startedAt = Date.now();

type Check = { ok: boolean; latencyMs: number; error?: string };

async function probe(url: string, key: string, accept: (status: number) => boolean): Promise<Check> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - t0);
    return accept(res.status) ? { ok: true, latencyMs } : { ok: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, latencyMs: Math.round(performance.now() - t0), error: timedOut ? "timeout" : "unreachable" };
  }
}

async function checkSupabase(): Promise<{ auth: Check; postgrest: Check }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const missing: Check = { ok: false, latencyMs: 0, error: "not configured" };
    return { auth: missing, postgrest: missing };
  }
  const base = url.replace(/\/$/, "");
  const [auth, postgrest] = await Promise.all([
    probe(`${base}/auth/v1/health`, key, (s) => s === 200),
    probe(`${base}/rest/v1/households?select=id&limit=1`, key, (s) => s < 500),
  ]);
  return { auth, postgrest };
}

export async function GET(req: Request) {
  const base = {
    build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  };
  const headers = { "Cache-Control": "no-store" };

  if (new URL(req.url).searchParams.get("probe") === "live") {
    return NextResponse.json({ status: "ok", ...base }, { headers });
  }

  const checks = await checkSupabase();
  const healthy = checks.auth.ok && checks.postgrest.ok;
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", ...base, checks },
    { status: healthy ? 200 : 503, headers }
  );
}
