import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();
const get = (qs = "") => GET(new Request(`http://localhost/api/health${qs}`));

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

describe("GET /api/health", () => {
  it("is 200 and ok when PostgREST answers", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const res = await get();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.supabase.ok).toBe(true);
    expect(typeof body.checks.supabase.latencyMs).toBe("number");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("calls PostgREST's root with the anon key and no doubled slash", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await get();
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://project.supabase.test/rest/v1/");
    expect(init.headers.apikey).toBe("anon");
  });

  it("is 503 and degraded when the dependency answers with an error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const res = await get();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", checks: { supabase: { ok: false, error: "HTTP 502" } } });
  });

  it("reports a timeout distinctly from an unreachable host", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect((await (await get()).json()).checks.supabase.error).toBe("timeout");
    fetchMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    expect((await (await get()).json()).checks.supabase.error).toBe("unreachable");
  });

  it("is degraded, without calling out, when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await get();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.supabase.error).toBe("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("liveness never touches a dependency, even when it is down", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const res = await get("?probe=live");
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak the Supabase URL or key", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const text = JSON.stringify(await (await get()).json());
    expect(text).not.toContain("project.supabase.test");
    expect(text).not.toContain("anon");
  });
});
