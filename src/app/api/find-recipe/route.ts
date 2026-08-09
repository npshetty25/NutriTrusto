import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { findDietViolations, normalizeDiet } from "@/lib/diet-check";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface PantryItem {
  name: string;
  daysLeft: number;
  risk?: string;
}

const isOverloaded = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  return status === 503 || status === 429;
};

// Gemini intermittently returns 503 "high demand". Retrying briefly turns
// most of those into a slight delay rather than a dead end.
async function generateWithRetry(
  model: { generateContent: (p: string) => Promise<{ response: { text: () => string } }> },
  prompt: string,
  attempts = 3
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;
      if (!isOverloaded(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  const log = createRequestContext("api/find-recipe");
  log.info("Request received");

  try {
    const { items, dietaryPreference, avoidTitles } = (await req.json()) as {
      items?: PantryItem[];
      dietaryPreference?: string;
      avoidTitles?: string[];
    };

    const pantry = (Array.isArray(items) ? items : [])
      .filter((i) => i && typeof i.name === "string" && i.name.trim())
      // Most urgent first — this ordering is the whole point of the feature,
      // and the prompt below leans on it.
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
      .slice(0, 12);

    if (pantry.length === 0) {
      return NextResponse.json({ success: false, error: "No pantry items provided" }, { status: 400 });
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Anything at 2 days or less is what this recipe exists to rescue.
    const critical = pantry.filter((i) => (i.daysLeft ?? 999) <= 2);
    const soon = pantry.filter((i) => (i.daysLeft ?? 999) > 2 && (i.daysLeft ?? 999) <= 5);
    const rest = pantry.filter((i) => (i.daysLeft ?? 999) > 5);

    const fmt = (list: PantryItem[]) =>
      list.map((i) => `- ${i.name} (${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} left)`).join("\n");

    const sections = [
      critical.length ? `MUST USE — these spoil first:\n${fmt(critical)}` : "",
      soon.length ? `SHOULD USE if they fit:\n${fmt(soon)}` : "",
      rest.length ? `Also available:\n${fmt(rest)}` : "",
    ].filter(Boolean).join("\n\n");

    const avoid = Array.isArray(avoidTitles) && avoidTitles.length
      ? `\nDo NOT suggest these, they were already shown: ${avoidTitles.slice(0, 6).join(", ")}.\n`
      : "";

    const prompt = `You are an experienced Indian home cook writing everyday ghar ka khana — the kind of food actually cooked in an Indian kitchen on a weeknight, not restaurant or fusion food.

Someone's food is about to spoil. Write ONE dish that rescues it.

${sections}
${avoid}
Dietary preference: ${dietaryPreference || "none"}.

Rules, in order of importance:
1. Every item under "MUST USE" has to appear in the dish. That is the entire reason this recipe exists — if you leave one out, the food gets thrown away. Only omit one if it genuinely cannot go in the same dish as the others, and if so say nothing about it.
2. Pull in as many "SHOULD USE" items as fit naturally. Ignore anything that would make the dish worse.
3. The dish must be genuinely Indian. Use real formats: sabzi, dal, curry, sukhi bhaji, pulao, khichdi, poha, upma, chilla, paratha, raita, bhurji, kadhi, thoran, poriyal. Never pasta, stir-fry bowls, sandwiches, casseroles or salads.
4. Cook it the Indian way — tadka where it belongs (jeera, rai, hing, curry leaves), bhuna-ing the masala, everyday spices (haldi, dhania, jeera powder, garam masala, lal mirch, amchur).
5. Assume the usual Indian kitchen staples are on hand (oil/ghee, salt, onion, tomato, ginger, garlic, green chilli, basic spices, atta, rice, dal). You may use them freely and they do not need to be in the list above.
6. Respect the dietary preference absolutely. "Veg" means no meat, no fish, no egg. "Eggtarian" allows egg but no meat or fish. Never break this.
7. Use Indian measures and names naturally (katori, tsp, tbsp, grams, ml; jeera, haldi, dhania), with the English term in brackets on first use where it isn't obvious.

Split the ingredients into three groups so the cook knows what they already
have and what they must go out and buy:
- "fromPantry": ingredients that come from the numbered lists above. Give the
  pantry item's exact name plus the quantity to use.
- "toBuy": ingredients that are NOT in the lists above and are NOT everyday
  staples — things they genuinely have to buy.
- "staples": everyday Indian kitchen basics you assumed (oil/ghee, salt,
  onion, tomato, ginger, garlic, green chilli, ground spices, atta, rice).

Return ONLY this JSON object, no markdown fence, no commentary:
{
  "title": "Dish name",
  "prepTime": "e.g. 25m",
  "fromPantry": [{"item": "exact name from the lists above", "quantity": "200 g, cubed"}],
  "toBuy": ["1 bunch fresh coriander", "..."],
  "staples": ["2 tbsp oil", "1 tsp jeera", "..."],
  "steps": ["step 1", "step 2", "..."],
  "rescueNote": "one short sentence naming which about-to-spoil items this saves"
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const diet = normalizeDiet(dietaryPreference);
    const knownNames = new Set(pantry.map((i) => i.name.toLowerCase()));

    let recipe: Record<string, unknown> | null = null;
    let lastViolations: string[] = [];

    // A prompt is a request, not a guarantee. Check the result and try again
    // once before giving up — never serve the violation.
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptPrompt = attempt === 0
        ? prompt
        : `${prompt}

Your previous attempt included ${lastViolations.join(", ")}, which breaks the "${dietaryPreference}" requirement. Write a completely different dish containing no meat, no fish${diet === "veg" ? ", and no egg" : ""} whatsoever.`;

      const result = await generateWithRetry(model, attemptPrompt);
      const text = result.response.text().trim();
      const jsonStr = text
        .replace(/^```json\s*/im, "")
        .replace(/^```\s*/im, "")
        .replace(/```$/m, "")
        .trim();

      const parsed = JSON.parse(jsonStr);
      const violations = findDietViolations(JSON.stringify(parsed), diet);

      if (violations.length === 0) {
        recipe = parsed;
        break;
      }
      lastViolations = violations;
      log.warn("Generated recipe violated dietary preference", { diet, violations, attempt });
    }

    if (!recipe) {
      log.error("Could not produce a diet-safe recipe", { diet, lastViolations });
      return NextResponse.json(
        { success: false, error: `Couldn't put together a ${dietaryPreference} recipe from these items. Please try again.` },
        { status: 502 }
      );
    }

    const title = String(recipe.title || "Pantry Special").trim();

    const fromPantry = (Array.isArray(recipe.fromPantry) ? recipe.fromPantry : [])
      .map((row: unknown) => {
        const r = row as { item?: unknown; quantity?: unknown };
        return { item: String(r?.item ?? "").trim(), quantity: String(r?.quantity ?? "").trim() };
      })
      // Only keep rows that name something genuinely in the pantry, so the
      // card can never credit an ingredient the user doesn't own.
      .filter((r: { item: string }) => r.item && knownNames.has(r.item.toLowerCase()));

    const payload = {
      title,
      prepTime: String(recipe.prepTime || "25m"),
      fromPantry,
      usesItems: fromPantry.map((r: { item: string }) => r.item),
      toBuy: (Array.isArray(recipe.toBuy) ? recipe.toBuy : []).map(String).filter(Boolean),
      staples: (Array.isArray(recipe.staples) ? recipe.staples : []).map(String).filter(Boolean),
      steps: (Array.isArray(recipe.steps) ? recipe.steps : []).map(String).filter(Boolean),
      rescueNote: String(recipe.rescueNote || "").trim(),
      // A search rather than a specific video: TheMealDB's curated links go
      // dead (one of its Indian recipes is already a 404 after a copyright
      // takedown), and a search for the dish can never 404.
      videoSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " recipe")}`,
    };

    log.info("Recipe generated", {
      title: payload.title,
      usesCount: payload.usesItems.length,
      toBuyCount: payload.toBuy.length,
      criticalCount: critical.length,
      diet,
    });

    return NextResponse.json({ success: true, recipe: payload });
  } catch (error: unknown) {
    log.error("Unhandled find-recipe error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    if (isOverloaded(error)) {
      return NextResponse.json(
        { success: false, error: "The recipe service is busy right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to find a recipe" }, { status: 500 });
  }
}
