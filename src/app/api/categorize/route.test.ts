import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogs, TEST_USER } from "@/test/route-helpers";

const getRequestUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser,
}));

import { POST } from "./route";

const fetchMock = vi.fn();
let userSeq = 0;

beforeEach(() => {
  silenceLogs();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`cat-user-${++userSeq}`));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const call = async (payload: unknown) => {
  const res = await POST(
    new Request("http://localhost/api/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );
  return { res, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const modelAnswer = (preds: Array<{ name: string; category: string; confidence: number }>) =>
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ model_version: "category-v1", predictions: preds }) });

describe("POST /api/categorize — with the model service", () => {
  beforeEach(() => vi.stubEnv("ML_SERVICE_URL", "http://ml:8000/"));

  it("returns the model's predictions and says they came from the model", async () => {
    modelAnswer([{ name: "Amul Butter", category: "dairy", confidence: 0.91 }]);
    const { res, body } = await call({ names: ["Amul Butter"] });
    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      source: "model",
      modelVersion: "category-v1",
      predictions: [{ name: "Amul Butter", category: "dairy", confidence: 0.91 }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://ml:8000/predict");
  });

  it.each([
    ["a 5xx", () => fetchMock.mockResolvedValue({ ok: false, status: 503 })],
    ["a network error", () => fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))],
    ["a malformed body", () => fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) })],
    ["the wrong number of predictions", () =>
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ model_version: "v", predictions: [] }) })],
  ])("falls back to keyword rules, and says so, on %s", async (_label, arrange) => {
    arrange();
    const { res, body } = await call({ names: ["Basmati Rice"] });
    expect(res.status).toBe(200);
    expect(body.source).toBe("rules");
    expect(body.modelVersion).toBeNull();
    expect(body.predictions[0]).toEqual({ name: "Basmati Rice", category: "grain", confidence: null });
  });
});

describe("POST /api/categorize — without the model service", () => {
  it("answers from keyword rules and never contacts a service", async () => {
    vi.stubEnv("ML_SERVICE_URL", "");
    const { body } = await call({ names: ["Full Cream Milk"] });
    expect(body.source).toBe("rules");
    expect(body.predictions[0].category).toBe("dairy");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/categorize — input and access", () => {
  it("trims and caps names, dropping blanks and non-strings", async () => {
    vi.stubEnv("ML_SERVICE_URL", "");
    const { body } = await call({ names: ["  Milk  ", "", 42, null, "x".repeat(500)] });
    expect(body.predictions).toHaveLength(2);
    expect(body.predictions[0].name).toBe("Milk");
    expect(body.predictions[1].name).toHaveLength(200);
  });

  it.each([[{ names: [] }], [{ names: "milk" }], [{}], [{ names: Array(21).fill("milk") }]])(
    "400 for %j",
    async (payload) => {
      const { res } = await call(payload);
      expect(res.status).toBe(400);
    }
  );

  it("400 for a body that is not JSON", async () => {
    const { res } = await call("{nope");
    expect(res.status).toBe(400);
  });

  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { res } = await call({ names: ["milk"] });
    expect(res.status).toBe(401);
  });

  it("429 once one account exceeds the default 30 a minute", async () => {
    vi.stubEnv("ML_SERVICE_URL", "");
    getRequestUser.mockResolvedValue(TEST_USER("cat-burst"));
    for (let i = 0; i < 30; i++) expect((await call({ names: ["milk"] })).res.status).toBe(200);
    expect((await call({ names: ["milk"] })).res.status).toBe(429);
  });
});
