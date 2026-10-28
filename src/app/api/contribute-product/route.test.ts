import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogs, TEST_USER } from "@/test/route-helpers";

const getRequestUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser,
}));

const fetchMock = vi.fn();
let userSeq = 0;

type RouteModule = typeof import("./route");
// The route reads its credentials and target host at import time.
async function load(env: { id?: string; password?: string; staging?: boolean } = { id: "contributor", password: "s3cret" }): Promise<RouteModule> {
  vi.resetModules();
  vi.stubEnv("OFF_USER_ID", env.id ?? "");
  vi.stubEnv("OFF_PASSWORD", env.password ?? "");
  vi.stubEnv("OFF_USE_STAGING", env.staging ? "true" : "");
  return import("./route");
}

const post = (body: unknown) =>
  new Request("http://localhost/api/contribute-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  silenceLogs();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`contrib-user-${++userSeq}`));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/contribute-product", () => {
  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { POST } = await load();
    expect((await POST(post({ barcode: "8901719101200", productName: "x" }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ barcode: "8901719101200" }],
    [{ productName: "Parle-G" }],
    [{ barcode: "8901719101200", productName: "   " }],
  ])("400 when the barcode or name is missing or blank: %j", async (payload) => {
    const { POST } = await load();
    const res = await POST(post(payload));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ barcode: "8901", productName: "Parle-G" }],
    [{ barcode: "../cgi/x", productName: "Parle-G" }],
    [{ barcode: "8901719101200", productName: "x".repeat(151) }],
  ])("400, before anything is sent to Open Food Facts, for a non-barcode or an oversized name: %j", async (payload) => {
    const { POST } = await load();
    expect((await POST(post(payload))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("500 with setup guidance when contributor credentials are not configured", async () => {
    const { POST } = await load({});
    const res = await POST(post({ barcode: "8901719101200", productName: "Parle-G" }));
    const body = (await res.json()) as { error: string };
    expect(res.status).toBe(500);
    expect(body.error).toMatch(/OFF_USER_ID and OFF_PASSWORD/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a form-encoded product with the trimmed name and reports success", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ status: 1, status_verbose: "fields saved" }) });
    const { POST } = await load();
    const res = await POST(post({ barcode: "8901719101200", productName: "  Parle-G Gold  " }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://world.openfoodfacts.org/cgi/product_jqm2.pl");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const sent = new URLSearchParams(init.body);
    expect(sent.get("code")).toBe("8901719101200");
    expect(sent.get("product_name")).toBe("Parle-G Gold");
    expect(sent.get("user_id")).toBe("contributor");
    expect(sent.get("app_name")).toBe("Nutri-Trust");
  });

  it("accepts the upstream status as the string '1' too", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ status: "1" }) });
    const { POST } = await load();
    expect((await POST(post({ barcode: "8901719101200", productName: "x" }))).status).toBe(200);
  });

  it("posts to the staging mirror when OFF_USE_STAGING is set, never production", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ status: 1 }) });
    const { POST } = await load({ id: "off", password: "off", staging: true });
    await POST(post({ barcode: "8901719101200", productName: "x" }));
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://world.openfoodfacts.net/cgi/product_jqm2.pl");
  });

  it("502 with Open Food Facts' own reason when it declines the submission", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ status: 0, status_verbose: "no permission to edit" }) });
    const { POST } = await load();
    const res = await POST(post({ barcode: "8901719101200", productName: "x" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: "no permission to edit" });
  });

  it("500 with a generic message, and no credentials in the body, when the upstream call throws", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const { POST } = await load();
    const res = await POST(post({ barcode: "8901719101200", productName: "x" }));
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(500);
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("ECONNREFUSED");
  });

  it("500 on a malformed JSON body", async () => {
    const { POST } = await load();
    expect((await POST(post("{not json"))).status).toBe(500);
  });
});
