import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiText, silenceLogs, TEST_USER } from "@/test/route-helpers";

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
  getRequestUser.mockResolvedValue(TEST_USER(`chat-user-${++userSeq}`));
  generateContent.mockResolvedValue(geminiText("  Use the paneer first.  "));
});
afterEach(() => vi.restoreAllMocks());

const ask = async (payload: unknown) => {
  const res = await POST(
    new Request("http://localhost/api/pantry-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  return { res, body: (await res.json()) as Record<string, unknown> };
};
const promptSent = () => String(generateContent.mock.calls[0][0]);

describe("POST /api/pantry-chat", () => {
  it("returns the model's answer, trimmed", async () => {
    const { res, body } = await ask({ question: "What should I cook?", items: [] });
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, answer: "Use the paneer first." });
  });

  it("puts the user's real inventory in the prompt, in a stable line format", async () => {
    await ask({
      question: "What is expiring?",
      dietaryPreference: "vegetarian",
      items: [
        { name: "Paneer", daysLeft: 2, risk: "high", ingredientsText: "milk, citric acid" },
        { name: "Rice", daysLeft: 300, risk: "low" },
        { daysLeft: Number.NaN },
      ],
    });
    const prompt = promptSent();
    expect(prompt).toContain("- Paneer: 2 day(s) left, high risk | ingredients: milk, citric acid");
    expect(prompt).toContain("- Rice: 300 day(s) left, low risk");
    expect(prompt).toContain("- Unknown item: ? day(s) left, unknown risk");
    expect(prompt).toContain("Dietary preference: vegetarian.");
  });

  it("tells the model the pantry is empty rather than sending a blank list", async () => {
    await ask({ question: "What can I make?", items: [] });
    expect(promptSent()).toContain("The pantry is currently empty.");
    expect(promptSent()).toContain("Dietary preference: none specified.");
  });

  it("truncates the question to 500 characters", async () => {
    await ask({ question: "x".repeat(900), items: [] });
    const quoted = promptSent().match(/User's question: "(x+)"/);
    expect(quoted?.[1]).toHaveLength(500);
  });

  it("400 for a blank question, without a model call", async () => {
    const { res, body } = await ask({ question: "   ", items: [] });
    expect(res.status).toBe(400);
    expect(body.error).toBe("No question provided");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { res } = await ask({ question: "hi" });
    expect(res.status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("429 after 20 questions a minute from one account", async () => {
    getRequestUser.mockResolvedValue(TEST_USER("chat-burst"));
    for (let i = 0; i < 20; i++) expect((await ask({ question: "hi" })).res.status).toBe(200);
    expect((await ask({ question: "hi" })).res.status).toBe(429);
  });

  it("500 with a generic message when the model fails", async () => {
    generateContent.mockRejectedValue(new Error("quota exceeded: project 99"));
    const { res, body } = await ask({ question: "hi" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("99");
  });
});
