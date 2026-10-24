import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateShelfLife } from "@/lib/shelf-life";
import { deriveRiskFromDaysOnly } from "@/lib/risk-bands";
import { fileWithHeader, geminiText, JPEG_HEADER, multipartRequest, silenceLogs, TEST_USER } from "@/test/route-helpers";

// The route parses a receipt's printed date in *server-local* time and returns
// toISOString(). Vercel runs in UTC; a developer laptop may not. Pin UTC so the
// expected strings below mean the same thing everywhere.
process.env.TZ = "UTC";

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
const nextUser = () => TEST_USER(`extract-user-${++userSeq}`);

beforeAll(async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  silenceLogs();
  generateContent.mockReset();
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(nextUser());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const receipt = () => multipartRequest("receipt", fileWithHeader(JPEG_HEADER));
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe("POST /api/extract — gatekeeping", () => {
  it("returns 401 and never calls Gemini when the caller is not signed in", async () => {
    getRequestUser.mockResolvedValue(null);
    const res = await POST(receipt());
    expect(res.status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After once one account exceeds 10 requests a minute", async () => {
    const user = nextUser();
    getRequestUser.mockResolvedValue(user);
    generateContent.mockResolvedValue(geminiText('{"items":[]}'));
    for (let i = 0; i < 10; i++) expect((await POST(receipt())).status).toBe(200);

    const blocked = await POST(receipt());
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(generateContent).toHaveBeenCalledTimes(10);
  });

  it("rate-limits per account, not globally", async () => {
    generateContent.mockResolvedValue(geminiText('{"items":[]}'));
    const busy = nextUser();
    getRequestUser.mockResolvedValue(busy);
    for (let i = 0; i < 11; i++) await POST(receipt());

    getRequestUser.mockResolvedValue(nextUser());
    expect((await POST(receipt())).status).toBe(200);
  });
});

describe("POST /api/extract — upload validation (nothing is paid for before it passes)", () => {
  it("400 when no file is attached", async () => {
    const res = await POST(multipartRequest("receipt", null));
    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("415 when the bytes are not an image, whatever the client claims", async () => {
    const lie = fileWithHeader([0x50, 0x4b, 0x03, 0x04], { name: "receipt.jpg", type: "image/jpeg" }); // a zip
    const res = await POST(multipartRequest("receipt", lie));
    expect(res.status).toBe(415);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("413 above 10 MB", async () => {
    const big = fileWithHeader(JPEG_HEADER, { size: 10 * 1024 * 1024 + 1 });
    const res = await POST(multipartRequest("receipt", big));
    expect(res.status).toBe(413);
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe("POST /api/extract — turning Gemini output into pantry items", () => {
  it("prefers our sourced figure, then the model's guess, then the category, and drops nameless lines", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    generateContent.mockResolvedValue(
      geminiText(
        JSON.stringify({
          purchase_date_iso: "2026-10-08",
          items: [
            { name: "  Full Cream Milk  ", days_left: 5, risk: "HIGH" },
            { name: "Basmati Rice", days_left: "365", risk: "low" },
            { name: "Zorbix Party Mix", days_left: 45, risk: "low" },
            { name: "Zorbix Mystery", days_left: "not a number", risk: "weird" },
            { name: "Zorbix Overflow", days_left: 99999, risk: "Critical" },
            { name: "Zorbix Zero", days_left: 0, risk: "medium" },
            { name: "   ", days_left: 3, risk: "low" },
            { days_left: 3, risk: "low" },
          ],
        })
      )
    );

    const res = await POST(receipt());
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const known = (name: string) => {
      const days = estimateShelfLife(name).days;
      return { name, days_left: days, risk: deriveRiskFromDaysOnly(days), days_source: "table" };
    };
    const guessFromCategory = (name: string) => {
      const days = estimateShelfLife(name).days;
      return { name, days_left: days, risk: deriveRiskFromDaysOnly(days), days_source: "category" };
    };
    expect(body.items).toEqual([
      // In our table: our sourced figure, not the model's 5 or 365.
      known("Full Cream Milk"),
      known("Basmati Rice"),
      // Not in our table: the model's guess, labelled as such.
      { name: "Zorbix Party Mix", days_left: 45, risk: deriveRiskFromDaysOnly(45), days_source: "ai" },
      // Model gave nothing usable: the category / fallback figure.
      guessFromCategory("Zorbix Mystery"),
      // An absurd model number is still clamped.
      { name: "Zorbix Overflow", days_left: 3650, risk: deriveRiskFromDaysOnly(3650), days_source: "ai" },
      // Zero is not a usable guess.
      guessFromCategory("Zorbix Zero"),
    ]);
    expect(body.estimate_sources).toEqual({ table: 2, ai: 2, category: 2 });
    expect(body.purchase_date).toBe("2026-10-08T00:00:00.000Z");
  });

  it("strips a markdown code fence around the JSON", async () => {
    generateContent.mockResolvedValue(
      geminiText('```json\n{"purchase_date_iso":null,"items":[{"name":"Paneer","days_left":4,"risk":"high"}]}\n```')
    );
    const body = await json(await POST(receipt()));
    expect(body.items).toEqual([
      { name: "Paneer", days_left: estimateShelfLife("Paneer").days, risk: deriveRiskFromDaysOnly(estimateShelfLife("Paneer").days), days_source: "table" },
    ]);
  });

  it("falls back to today when the receipt date is in the future", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    generateContent.mockResolvedValue(geminiText('{"purchase_date_iso":"2026-12-25","items":[]}'));
    const body = await json(await POST(receipt()));
    expect(body.purchase_date).toBe("2026-10-10T12:00:00.000Z");
  });

  it("falls back to today when the date is implausibly old (an OCR year misread)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    generateContent.mockResolvedValue(geminiText('{"purchase_date_iso":"2019-03-04","items":[]}'));
    const body = await json(await POST(receipt()));
    expect(body.purchase_date).toBe("2026-10-10T12:00:00.000Z");
  });

  it("falls back to today when no date is printed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    generateContent.mockResolvedValue(geminiText('{"purchase_date_iso":null,"items":[]}'));
    const body = await json(await POST(receipt()));
    expect(body.purchase_date).toBe("2026-10-10T12:00:00.000Z");
  });

  it("returns an empty list, not an error, when the model finds no items", async () => {
    generateContent.mockResolvedValue(geminiText('{"purchase_date_iso":null,"items":"none"}'));
    const res = await POST(receipt());
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([]);
  });
});

describe("POST /api/extract — failure handling", () => {
  it("500 with a generic message when the model returns something that is not JSON", async () => {
    generateContent.mockResolvedValue(geminiText("Sorry, I could not read that image."));
    const res = await POST(receipt());
    const body = await json(res);
    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Failed to parse receipt" });
  });

  it("500 without leaking the upstream error when Gemini itself throws", async () => {
    generateContent.mockRejectedValue(new Error("429 quota exceeded for project 12345"));
    const res = await POST(receipt());
    const text = JSON.stringify(await json(res));
    expect(res.status).toBe(500);
    expect(text).not.toContain("quota");
    expect(text).not.toContain("12345");
  });
});

describe("POST /api/extract — configuration", () => {
  it("reports a missing GEMINI_API_KEY as a 500 rather than crashing", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_API_KEY", "");
    const { POST: PostWithoutKey } = await import("./route");
    const res = await PostWithoutKey(receipt());
    expect(res.status).toBe(500);
    expect((await json(res)).error).toMatch(/GEMINI_API_KEY/);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
});
