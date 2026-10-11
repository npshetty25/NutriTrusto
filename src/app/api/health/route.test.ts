import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();
const get = (qs = "") => GET(new Request(`http://localhost/api/health${qs}`));

const res = (status: number) => ({ ok: status >= 200 && status < 300, status });
/** Answer by URL so each dependency can be set independently. */
const answer = (auth: number | Error, rest: number | Error) =>
  fetchMock.mockImplementation(async (url: string) => {
    const r = String(url).includes("/auth/v1/health") ? auth : rest;
    if (r instanceof Error) throw r;
    return res(r);
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test/");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/health — readiness", () => {
  it("is 200 and ok when Auth is healthy and PostgREST returns rows", async () => {
    answer(200, 200);
    const response = await get();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.auth.ok).toBe(true);
    expect(body.checks.postgrest.ok).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  // The production failure: the PostgREST root answers 401 to the anon key.
  // This route no longer asks the root, and a 401 from a table is healthy.
  it.each([401, 403, 404])("treats a %i from PostgREST as up: it answered and authorised the request", async (status) => {
    answer(200, status);
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).checks.postgrest.ok).toBe(true);
  });

  it("calls Auth's health endpoint and a table, never PostgREST's root, with the anon key", async () => {
    answer(200, 200);
    await get();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("https://project.supabase.test/auth/v1/health");
    expect(urls.some((u) => u.startsWith("https://project.supabase.test/rest/v1/households"))).toBe(true);
    expect(urls).not.toContain("https://project.supabase.test/rest/v1/");
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as { headers: Record<string, string> }).headers.apikey).toBe("anon");
    }
  });

  it("is 503 when PostgREST answers 5xx (Postgres or its pool is down)", async () => {
    answer(200, 503);
    const response = await get();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", checks: { postgrest: { ok: false, error: "HTTP 503" } } });
  });

  it("is 503 when Auth is down even though PostgREST is up", async () => {
    answer(502, 200);
    const response = await get();
    expect(response.status).toBe(503);
    expect((await response.json()).checks.auth).toMatchObject({ ok: false, error: "HTTP 502" });
  });

  it("reports a timeout distinctly from an unreachable host", async () => {
    answer(Object.assign(new Error("t"), { name: "TimeoutError" }), new Error("ENOTFOUND"));
    const body = await (await get()).json();
    expect(body.checks.auth.error).toBe("timeout");
    expect(body.checks.postgrest.error).toBe("unreachable");
  });

  it("is degraded, without calling out, when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await get();
    expect(response.status).toBe(503);
    expect((await response.json()).checks.auth.error).toBe("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak the Supabase URL or key", async () => {
    answer(500, 500);
    const text = JSON.stringify(await (await get()).json());
    expect(text).not.toContain("project.supabase.test");
    expect(text).not.toContain("anon");
  });
});

describe("GET /api/health?probe=live", () => {
  it("never touches a dependency, even when it is down", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const response = await get("?probe=live");
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ok");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
