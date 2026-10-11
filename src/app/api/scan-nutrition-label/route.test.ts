import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fileWithHeader, geminiText, multipartRequest, PNG_HEADER, silenceLogs, TEST_USER } from "@/test/route-helpers";

const generateContent = vi.hoisted(() => vi.fn());
const getRequestUser = vi.hoisted(() => vi.fn());

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent };
    }
  },
}));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser,
}));

let POST: (req: Request) => Promise<Response>;
let userSeq = 0;

beforeAll(async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  silenceLogs();
  generateContent.mockReset();
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`label-user-${++userSeq}`));
});

afterEach(() => vi.restoreAllMocks());

const label = () => multipartRequest("label", fileWithHeader(PNG_HEADER, { name: "label.png", type: "image/png" }));

describe("POST /api/scan-nutrition-label", () => {
  it("passes the parsed nutrition table through unchanged", async () => {
    const table = {
      product_name: "Masala Oats",
      energy_kcal: 380,
      sugars_g: 3.5,
      sodium_mg: 910,
      protein_g: 11,
      per_unit: "100g",
      confidence: "high",
    };
    generateContent.mockResolvedValue(geminiText(JSON.stringify(table)));
    const res = await POST(label());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; nutrition: unknown; scan_id: string };
    expect(body).toMatchObject({ success: true, nutrition: table });
    expect(body.scan_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps nulls as nulls — a value the model could not read is never filled in", async () => {
    generateContent.mockResolvedValue(
      geminiText('{"product_name":null,"sugars_g":null,"sodium_mg":null,"per_unit":"100g","confidence":"low"}')
    );
    const body = (await (await POST(label())).json()) as { nutrition: Record<string, unknown> };
    expect(body.nutrition.sugars_g).toBeNull();
    expect(body.nutrition.sodium_mg).toBeNull();
  });

  it("strips a markdown fence before parsing", async () => {
    generateContent.mockResolvedValue(geminiText('```json\n{"sugars_g":12,"per_unit":"100g","confidence":"medium"}\n```'));
    const res = await POST(label());
    expect(res.status).toBe(200);
  });

  it("sends the proven MIME type, not the one the client claimed", async () => {
    generateContent.mockResolvedValue(geminiText('{"confidence":"low"}'));
    // PNG bytes, but the client says it is a JPEG.
    await POST(multipartRequest("label", fileWithHeader(PNG_HEADER, { name: "x.jpg", type: "image/jpeg" })));
    const parts = generateContent.mock.calls[0][0] as Array<unknown>;
    const image = parts[1] as { inlineData: { mimeType: string } };
    expect(image.inlineData.mimeType).toBe("image/png");
  });

  it("400 when no file is attached", async () => {
    const res = await POST(multipartRequest("label", null));
    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    expect((await POST(label())).status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("500 with a generic message when the model output is not JSON", async () => {
    generateContent.mockResolvedValue(geminiText("no table visible"));
    const res = await POST(label());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "Failed to read label" });
  });
});
