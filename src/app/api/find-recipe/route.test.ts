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
  getRequestUser.mockResolvedValue(TEST_USER(`recipe-user-${++userSeq}`));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Item = { name: string; daysLeft: number; daysPastEstimate?: number; confidence?: "high" | "medium" | "low" };
const PANTRY: Item[] = [
  { name: "Paneer", daysLeft: 1 },
  { name: "Spinach", daysLeft: 3 },
  { name: "Rice", daysLeft: 200 },
];

const recipeJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Palak Paneer",
    baseDish: "Palak Paneer",
    prepTime: "30m",
    fromPantry: [
      { item: "Paneer", quantity: "200 g" },
      { item: "Spinach", quantity: "1 bunch" },
    ],
    toBuy: [{ item: "Cream", quantity: "2 tbsp" }, "1 onion"],
    staples: ["salt", "oil"],
    steps: ["Blanch the spinach.", "Cook with paneer."],
    rescueNote: "Uses the paneer before it turns.",
    ...over,
  });

const call = async (payload: Record<string, unknown>) => {
  const res = await POST(
    new Request("http://localhost/api/find-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  return { res, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const promptOf = (n = 0) => String(generateContent.mock.calls[n][0]);

describe("POST /api/find-recipe — what reaches the model", () => {
  it("never sends food that is past the app's estimate, and says so when that leaves nothing", async () => {
    const { res, body } = await call({
      items: [
        { name: "Old yoghurt", daysLeft: 0, daysPastEstimate: 4 },
        { name: "Bad milk", daysLeft: -2 },
      ],
    });
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/past our estimate/);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("drops the past-estimate items from a mixed pantry before building the prompt", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson()));
    await call({ items: [...PANTRY, { name: "Spoiled curd", daysLeft: 0, daysPastEstimate: 3 }] });
    expect(promptOf()).toContain("Paneer");
    expect(promptOf()).not.toContain("Spoiled curd");
  });

  it("400 for an empty pantry", async () => {
    const { res, body } = await call({ items: [] });
    expect(res.status).toBe(400);
    expect(body.error).toBe("No pantry items provided");
  });

  it("ignores rows without a usable name", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson()));
    const { res } = await call({ items: [null, { name: "  ", daysLeft: 2 }, { daysLeft: 1 }, ...PANTRY] });
    expect(res.status).toBe(200);
  });

  it("groups by urgency and labels due-today and low-confidence items honestly", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson({ fromPantry: [] })));
    await call({
      items: [
        { name: "Paneer", daysLeft: 0 },
        { name: "Mushrooms", daysLeft: 2, confidence: "low" },
        { name: "Spinach", daysLeft: 4 },
        { name: "Rice", daysLeft: 200 },
      ],
    });
    const prompt = promptOf();
    expect(prompt).toMatch(/USE FIRST[\s\S]*Paneer \(due today — tell the cook to look at it and smell it first\)/);
    expect(prompt).toContain("- Mushrooms (2 days left, rough estimate)");
    expect(prompt).toMatch(/USE NEXT[\s\S]*- Spinach \(4 days left\)/);
    expect(prompt).toMatch(/Also available:[\s\S]*- Rice \(200 days left\)/);
  });

  it("sends at most the 12 most urgent items", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson({ fromPantry: [] })));
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Item${i}`, daysLeft: i + 1 }));
    await call({ items: many.reverse() });
    expect(promptOf()).toContain("Item0");
    expect(promptOf()).toContain("Item11");
    expect(promptOf()).not.toContain("Item12");
  });
});

describe("POST /api/find-recipe — shaping the response", () => {
  it("returns a normalised recipe", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson()));
    const { res, body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recipe).toMatchObject({
      title: "Palak Paneer",
      prepTime: "30m",
      usesItems: ["Paneer", "Spinach"],
      toBuy: [{ item: "Cream", quantity: "2 tbsp" }, { item: "1 onion", quantity: "" }],
      staples: ["salt", "oil"],
      rescueNote: "Uses the paneer before it turns.",
      videoSearchUrl: "https://www.youtube.com/results?search_query=Palak%20Paneer%20recipe",
    });
  });

  it("credits only ingredients that are really in the pantry", async () => {
    generateContent.mockResolvedValue(
      geminiText(recipeJson({ fromPantry: [{ item: "Paneer", quantity: "1" }, { item: "Saffron", quantity: "1 pinch" }] }))
    );
    const { body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(body.recipe.usesItems).toEqual(["Paneer"]);
  });

  it("fills in defaults when the model omits fields", async () => {
    generateContent.mockResolvedValue(geminiText(JSON.stringify({ fromPantry: [], steps: ["Mix."] })));
    const { body } = await call({ items: PANTRY });
    expect(body.recipe.title).toBe("Pantry Special");
    expect(body.recipe.baseDish).toBe("Pantry Special");
    expect(body.recipe.prepTime).toBe("25m");
  });

  it("discloses allergen groups found in the ingredient names", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson({ staples: ["peanut oil"] })));
    const { body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(body.recipe.containsAllergens).toEqual(expect.arrayContaining(["nuts", "dairy"])); // peanut oil; paneer
  });

  it("does not take an allergen from the prose of the steps", async () => {
    generateContent.mockResolvedValue(
      geminiText(recipeJson({ staples: ["salt"], steps: ["Serve with a side of almonds and peanut chutney."] }))
    );
    const { body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(body.recipe.containsAllergens).not.toContain("nuts");
  });
});

describe("POST /api/find-recipe — the doneness line is added by us, not the model", () => {
  const withProtein = async (item: string[], dietaryPreference = "Non-veg") => {
    generateContent.mockResolvedValue(
      geminiText(recipeJson({ title: "Curry", fromPantry: item.map((i) => ({ item: i, quantity: "1" })) }))
    );
    return call({ items: item.map((name) => ({ name, daysLeft: 1 })), dietaryPreference });
  };

  it("appends a singular line for one animal-protein item", async () => {
    const { body } = await withProtein(["Chicken Breast"]);
    const last = body.recipe.steps.at(-1) as string;
    expect(last).toBe(
      "Before serving, check the Chicken Breast is cooked all the way through. If you are not sure it is done, give it longer."
    );
  });

  it("uses plural agreement for a plural noun like Eggs", async () => {
    const { body } = await withProtein(["Eggs"], "Eggtarian");
    expect((body.recipe.steps.at(-1) as string)).toMatch(/check the Eggs are cooked.*give them longer\./);
  });

  it("names two proteins and agrees with the plural", async () => {
    const { body } = await withProtein(["Chicken Breast", "Eggs"]);
    expect(body.recipe.steps.at(-1)).toContain("check the Chicken Breast and Eggs are cooked");
  });

  it("adds nothing for a vegetarian dish", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson()));
    const { body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(body.recipe.steps).toEqual(["Blanch the spinach.", "Cook with paneer."]);
  });

  it("never states a temperature or a time for doneness", async () => {
    const { body } = await withProtein(["Chicken Breast"]);
    expect(body.recipe.steps.at(-1)).not.toMatch(/°|degrees|\d+\s*(min|minutes|c\b|f\b)/i);
  });
});

describe("POST /api/find-recipe — the diet check", () => {
  const violating = recipeJson({ title: "Chicken Curry", fromPantry: [{ item: "Paneer", quantity: "1" }], steps: ["Add chicken."] });
  const clean = recipeJson();

  it("regenerates once, naming the offending term, and serves the clean second attempt", async () => {
    generateContent.mockResolvedValueOnce(geminiText(violating)).mockResolvedValueOnce(geminiText(clean));
    const { res, body } = await call({ items: PANTRY, dietaryPreference: "Veg" });

    expect(res.status).toBe(200);
    expect(body.recipe.title).toBe("Palak Paneer");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(promptOf(1)).toMatch(/previous attempt included .*chicken/i);
  });

  it("returns a 502, and no recipe, when both attempts break the preference", async () => {
    generateContent.mockResolvedValue(geminiText(violating));
    const { res, body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.recipe).toBeUndefined();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("treats egg as a violation for vegetarian but not for eggtarian", async () => {
    const eggDish = recipeJson({ title: "Egg Bhurji", steps: ["Scramble the egg."] });
    generateContent.mockResolvedValue(geminiText(eggDish));
    const veg = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(veg.res.status).toBe(502);

    generateContent.mockReset();
    generateContent.mockResolvedValue(geminiText(eggDish));
    const eggtarian = await call({ items: PANTRY, dietaryPreference: "Eggtarian" });
    expect(eggtarian.res.status).toBe(200);
  });

  it("does not trip on look-alike words (eggplant is not egg)", async () => {
    generateContent.mockResolvedValue(geminiText(recipeJson({ title: "Baingan Bharta", steps: ["Roast the eggplant."] })));
    const { res } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(res.status).toBe(200);
  });

  it("applies no restriction for non-veg", async () => {
    generateContent.mockResolvedValue(geminiText(violating));
    const { res } = await call({ items: PANTRY, dietaryPreference: "Non-veg" });
    expect(res.status).toBe(200);
    expect(generateContent).toHaveBeenCalledOnce();
  });
});

describe("POST /api/find-recipe — upstream trouble", () => {
  const overloaded = Object.assign(new Error("model overloaded"), { status: 503 });

  it("retries a 503 and succeeds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    generateContent.mockRejectedValueOnce(overloaded).mockResolvedValueOnce(geminiText(recipeJson()));
    const pending = call({ items: PANTRY, dietaryPreference: "Veg" });
    await vi.advanceTimersByTimeAsync(900);
    const { res } = await pending;
    expect(res.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("gives up after three overloaded attempts with a 503 the UI can word kindly", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    generateContent.mockRejectedValue(overloaded);
    const pending = call({ items: PANTRY, dietaryPreference: "Veg" });
    await vi.advanceTimersByTimeAsync(900 + 1800);
    const { res, body } = await pending;
    expect(res.status).toBe(503);
    expect(body.error).toMatch(/busy right now/);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry an error that is not about load", async () => {
    generateContent.mockRejectedValue(new Error("invalid api key"));
    const { res, body } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(res.status).toBe(500);
    expect(generateContent).toHaveBeenCalledOnce();
    expect(JSON.stringify(body)).not.toContain("api key");
  });

  it("500 when the model returns text that is not JSON", async () => {
    generateContent.mockResolvedValue(geminiText("Here is a lovely recipe!"));
    const { res } = await call({ items: PANTRY, dietaryPreference: "Veg" });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/find-recipe — gatekeeping", () => {
  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { res } = await call({ items: PANTRY });
    expect(res.status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("429 after 15 recipes a minute from one account", async () => {
    getRequestUser.mockResolvedValue(TEST_USER("recipe-burst"));
    generateContent.mockResolvedValue(geminiText(recipeJson()));
    for (let i = 0; i < 15; i++) expect((await call({ items: PANTRY, dietaryPreference: "Veg" })).res.status).toBe(200);
    expect((await call({ items: PANTRY, dietaryPreference: "Veg" })).res.status).toBe(429);
  });
});
