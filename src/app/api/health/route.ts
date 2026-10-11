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
 * The dependency check is PostgREST's root, with the public anon key the
 * browser already holds. It proves the project is up and PostgREST can answer;
 * it does not run a query against a table.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3000;
const startedAt = Date.now();

type Check = { ok: boolean; latencyMs: number; error?: string };

async function checkSupabase(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, latencyMs: 0, error: "not configured" };

  const t0 = performance.now();
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - t0);
    return res.ok ? { ok: true, latencyMs } : { ok: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, latencyMs: Math.round(performance.now() - t0), error: timedOut ? "timeout" : "unreachable" };
  }
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

  const supabase = await checkSupabase();
  const healthy = supabase.ok;
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", ...base, checks: { supabase } },
    { status: healthy ? 200 : 503, headers }
  );
}
