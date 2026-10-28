import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fileWithHeader, geminiText, multipartRequest, silenceLogs, TEST_USER } from "@/test/route-helpers";
import { cleanNames } from "@/lib/produce-names";

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
  getRequestUser.mockResolvedValue(TEST_USER(`produce-user-${++userSeq}`));
});
afterEach(() => vi.restoreAllMocks());

const photo = () => multipartRequest("photo", fileWithHeader());
const scan = async (modelText: string) => {
  generateContent.mockResolvedValue(geminiText(modelText));
  const res = await POST(photo());
  return { res, body: (await res.json()) as { success: boolean; items?: string[]; error?: string } };
};

describe("POST /api/scan-produce", () => {
  it("returns the names of what the model saw", async () => {
    const { res, body } = await scan('{"items":[{"name":"Tomatoes"},{"name":"Bhindi (Okra)"}]}');
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, items: ["Tomatoes", "Bhindi (Okra)"] });
  });

  it("strips a markdown fence around the JSON", async () => {
    const { body } = await scan('```json\n{"items":[{"name":"Bananas"}]}\n```');
    expect(body.items).toEqual(["Bananas"]);
  });

  it("returns an empty list, not an error, for a photo with no food", async () => {
    const { res, body } = await scan('{"items":[]}');
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("asks the model to name only what it can see", async () => {
    await scan('{"items":[]}');
    expect(String(generateContent.mock.calls[0][0])).toContain("Never guess");
  });

  it("401 without a signed-in user, and Gemini is never called", async () => {
    getRequestUser.mockResolvedValue(null);
    expect((await POST(photo())).status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects a non-image before spending a model call", async () => {
    const res = await POST(multipartRequest("photo", fileWithHeader([0x4d, 0x5a, 0x90, 0x00], { name: "photo.jpg" })));
    expect(res.status).toBe(415);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("500 with a generic message when the model's reply is not JSON", async () => {
    const { res, body } = await scan("I can see some vegetables.");
    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to read the photo");
  });

  it("429 after 10 photos a minute from one account", async () => {
    getRequestUser.mockResolvedValue(TEST_USER("produce-burst"));
    generateContent.mockResolvedValue(geminiText('{"items":[]}'));
    for (let i = 0; i < 10; i++) expect((await POST(photo())).status).toBe(200);
    expect((await POST(photo())).status).toBe(429);
  });
});

describe("cleanNames", () => {
  it("trims, collapses spaces, drops blanks and non-strings, and removes repeats", () => {
    expect(cleanNames({ items: [{ name: "  Green   Chillies " }, { name: "green chillies" }, { name: "" }, { name: 7 }, null, "Onions"] })).toEqual([
      "Green Chillies",
      "Onions",
    ]);
  });

  it("caps the list and each name, whatever the model returns", () => {
    const many = { items: Array.from({ length: 50 }, (_, i) => ({ name: `Item ${i}` })) };
    expect(cleanNames(many)).toHaveLength(20);
    expect(cleanNames({ items: [{ name: "x".repeat(200) }] })[0]).toHaveLength(60);
  });

  it("gives an empty list for anything that is not a list", () => {
    expect(cleanNames(null)).toEqual([]);
    expect(cleanNames({ items: "tomatoes" })).toEqual([]);
  });
});
