import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { getUser } })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const URL_ = "https://project.supabase.test";
const ANON = "anon-key";

type AuthModule = typeof import("./api-auth");
async function load(env: { url?: string; anon?: string } = { url: URL_, anon: ANON }): Promise<AuthModule> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.url ?? "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", env.anon ?? "");
  return import("./api-auth");
}

const requestWith = (authorization?: string) =>
  new Request("http://localhost/api/x", { headers: authorization ? { authorization } : {} });

beforeEach(() => {
  getUser.mockReset();
  createClient.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("getRequestUser", () => {
  it("returns null without calling Supabase when there is no Authorization header", async () => {
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith())).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["Basic dXNlcjpwYXNz", "Token abc", "Bearer", "Bearer    "])(
    "returns null for a header that is not a usable bearer token: %j",
    async (header) => {
      const { getRequestUser } = await load();
      expect(await getRequestUser(requestWith(header))).toBeNull();
      expect(getUser).not.toHaveBeenCalled();
    }
  );

  it("verifies the token with Supabase and returns the id and e-mail", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1", email: "a@example.test" } }, error: null });
    const { getRequestUser } = await load();
    const user = await getRequestUser(requestWith("Bearer tok-123"));
    expect(user).toEqual({ id: "u-1", email: "a@example.test" });
    expect(getUser).toHaveBeenCalledWith("tok-123");
  });

  it("accepts the scheme in any case and trims the token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-2" } }, error: null });
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith("bearer   tok-9  "))).toEqual({ id: "u-2", email: undefined });
    expect(getUser).toHaveBeenCalledWith("tok-9");
  });

  it("builds a fresh client per request so one caller's session never leaks into the next", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    const { getRequestUser } = await load();
    await getRequestUser(requestWith("Bearer first"));
    await getRequestUser(requestWith("Bearer second"));
    expect(createClient).toHaveBeenCalledTimes(2);
    const calls = createClient.mock.calls as unknown as Array<[string, string, { global: { headers: { Authorization: string } }; auth: { persistSession: boolean } }]>;
    expect(calls[0][2].global.headers.Authorization).toBe("Bearer first");
    expect(calls[1][2].global.headers.Authorization).toBe("Bearer second");
    expect(calls[0][2].auth.persistSession).toBe(false);
  });

  it("returns null when Supabase rejects the token", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } });
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith("Bearer expired"))).toBeNull();
  });

  it("returns null when Supabase reports an error even if it also returned a user object", async () => {
    // Defence in depth: the error wins. A partial or stale user must not pass.
    getUser.mockResolvedValue({ data: { user: { id: "stale" } }, error: { message: "session revoked" } });
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith("Bearer x"))).toBeNull();
  });

  it("returns null when Supabase answers with no user and no error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith("Bearer x"))).toBeNull();
  });

  it("fails closed when the Supabase call throws", async () => {
    getUser.mockRejectedValue(new Error("network down"));
    const { getRequestUser } = await load();
    expect(await getRequestUser(requestWith("Bearer x"))).toBeNull();
  });

  it("fails closed when Supabase is not configured at all", async () => {
    const { getRequestUser } = await load({});
    expect(await getRequestUser(requestWith("Bearer anything"))).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("unauthorized", () => {
  it("is a 401 that does not say why", async () => {
    const { unauthorized } = await load();
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: "You need to be signed in to do that." });
  });
});
