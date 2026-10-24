import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fileWithHeader, geminiText, multipartRequest, silenceLogs, TEST_USER } from "@/test/route-helpers";

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

// "Today" for every test. The route measures from UTC midnight of this date.
const NOW = new Date("2026-10-10T15:30:00Z");

beforeAll(async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  silenceLogs();
  generateContent.mockReset();
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`expiry-user-${++userSeq}`));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const label = () => multipartRequest("label", fileWithHeader());
const scan = async (modelJson: Record<string, unknown>) => {
  generateContent.mockResolvedValue(geminiText(JSON.stringify(modelJson)));
  const res = await POST(label());
  return { res, body: (await res.json()) as { success: boolean; expiry: Record<string, unknown> } };
};

describe("POST /api/scan-expiry-date — resolving a date", () => {
  it("uses a printed expiry date directly", async () => {
    const { res, body } = await scan({ expiry_date_iso: "2026-10-20", confidence: "high", raw_text_found: "EXP 20/10/2026" });
    expect(res.status).toBe(200);
    expect(body.expiry).toEqual({
      days_left: 10,
      expiry_date: "2026-10-20",
      source: "printed_expiry",
      confidence: "high",
      raw_text_found: "EXP 20/10/2026",
      // "EXP" on the pack is a use-by (safety) date, read from the excerpt.
      date_kind: "use_by",
    });
  });

  it("says when the printed date is a best-before rather than a use-by", async () => {
    const { body } = await scan({ expiry_date_iso: "2026-10-20", confidence: "high", raw_text_found: "Best Before 20/10/2026" });
    expect(body.expiry).toMatchObject({ date_kind: "best_before" });
    const told = await scan({ expiry_date_iso: "2026-10-20", confidence: "high", raw_text_found: "20/10/2026", date_kind: "use_by" });
    expect(told.body.expiry).toMatchObject({ date_kind: "use_by" });
  });

  it("adds a printed shelf life to the manufacture date when there is no expiry date", async () => {
    // 1 Sep 2026 + 6 months (180 days) = 28 Feb 2027, which is 141 days after 10 Oct 2026.
    const { body } = await scan({ mfd_date_iso: "2026-09-01", shelf_life_value: 6, shelf_life_unit: "months", confidence: "medium" });
    expect(body.expiry).toMatchObject({ source: "mfd_plus_shelf_life", expiry_date: "2027-02-28", days_left: 141, confidence: "medium" });
  });

  it("counts a bare shelf life from today", async () => {
    const { body } = await scan({ shelf_life_value: 9, shelf_life_unit: "days", confidence: "medium" });
    expect(body.expiry).toMatchObject({ source: "shelf_life_from_today", expiry_date: "2026-10-19", days_left: 9 });
  });

  it("prefers a printed expiry over a shelf life when both are present", async () => {
    const { body } = await scan({
      expiry_date_iso: "2026-10-15",
      mfd_date_iso: "2026-01-01",
      shelf_life_value: 2,
      shelf_life_unit: "years",
      confidence: "high",
    });
    expect(body.expiry).toMatchObject({ source: "printed_expiry", days_left: 5 });
  });

  it("clamps an already-passed date to 0 days rather than going negative", async () => {
    const { body } = await scan({ expiry_date_iso: "2026-09-01", confidence: "high" });
    expect(body.expiry).toMatchObject({ source: "printed_expiry", days_left: 0, expiry_date: "2026-09-01" });
  });

  it("caps an absurd shelf life at 3650 days", async () => {
    const { body } = await scan({ shelf_life_value: 50, shelf_life_unit: "years", confidence: "low" });
    expect(body.expiry).toMatchObject({ source: "shelf_life_from_today", days_left: 3650 });
  });

  it("converts years and months with 365- and 30-day approximations", async () => {
    const years = await scan({ shelf_life_value: 1, shelf_life_unit: "years" });
    expect(years.body.expiry).toMatchObject({ days_left: 365 });
    const months = await scan({ shelf_life_value: 3, shelf_life_unit: "months" });
    expect(months.body.expiry).toMatchObject({ days_left: 90 });
  });
});

describe("POST /api/scan-expiry-date — refusing to invent a date", () => {
  it("reports unknown when the model found nothing", async () => {
    const { body } = await scan({ expiry_date_iso: null, mfd_date_iso: null, shelf_life_value: null, shelf_life_unit: null, confidence: "low" });
    expect(body.expiry).toEqual({ days_left: null, expiry_date: null, source: "unknown", confidence: "low", raw_text_found: null, date_kind: null });
  });

  it("ignores a date that is not valid ISO", async () => {
    const { body } = await scan({ expiry_date_iso: "31/02/2026", confidence: "high" });
    expect(body.expiry).toMatchObject({ source: "unknown", days_left: null });
  });

  it("ignores a non-positive or unit-less shelf life", async () => {
    const zero = await scan({ shelf_life_value: 0, shelf_life_unit: "days" });
    expect(zero.body.expiry).toMatchObject({ source: "unknown" });
    const noUnit = await scan({ shelf_life_value: 6 });
    expect(noUnit.body.expiry).toMatchObject({ source: "unknown" });
    const badUnit = await scan({ shelf_life_value: 6, shelf_life_unit: "fortnights" });
    expect(badUnit.body.expiry).toMatchObject({ source: "unknown" });
  });

  it("treats a missing or unrecognised confidence as low", async () => {
    const { body } = await scan({ expiry_date_iso: "2026-10-20", confidence: "very sure" });
    expect(body.expiry).toMatchObject({ confidence: "low" });
  });
});

describe("POST /api/scan-expiry-date — gatekeeping and failure", () => {
  it("401 without a signed-in user, and Gemini is never called", async () => {
    getRequestUser.mockResolvedValue(null);
    const res = await POST(label());
    expect(res.status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects a non-image before spending a model call", async () => {
    const res = await POST(multipartRequest("label", fileWithHeader([0x4d, 0x5a, 0x90, 0x00], { name: "photo.jpg" }))); // a Windows exe
    expect(res.status).toBe(415);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("500 with a generic message when the model output is not JSON", async () => {
    generateContent.mockResolvedValue(geminiText("I cannot read this."));
    const res = await POST(label());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "Failed to read expiry date" });
  });
});
