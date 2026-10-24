import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { findDietViolations, normalizeDiet } from "@/lib/diet-check";
import { ANIMAL_TERMS } from "@/lib/diet";
import { matchesTerm, isPluralNoun } from "@/lib/text-match";
import { detectAllergens } from "@/lib/allergens";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface PantryItem {
  name: string;
  daysLeft: number;
  /** How much is left, as the person typed it ("500 g"). Optional. */
  quantity?: string;
  /**
   * Days elapsed beyond the item's estimated shelf life, 0 when still within
   * it. Sent separately because `daysLeft` is clamped at zero on the client,
   * which makes "due today" and "a month gone" the same number.
   */
  daysPastEstimate?: number;
  risk?: string;
  /**
   * Confidence of the shelf-life row the day count came from. Only 4 of 70
   * rows carry a published activation energy; the rest are household figures
   * or extrapolations, and "low" means the number beside the item is a rough
   * guess rather than a sourced one.
   */
  confidence?: "high" | "medium" | "low";
}

/**
 * Animal-derived terms that are not something a cook brings to doneness —
 * they arrive already rendered or processed, so a "cook it through" line
 * against them would be nonsense.
 */
const NOT_COOKED_THROUGH = new Set(["gelatin", "gelatine", "lard"]);

/**
 * Flesh and egg: the pantry items whose under-cooking is the actual hazard.
 * Derived from ANIMAL_TERMS rather than re-typed, so a fish added there for
 * the vegetarian check is covered here too and the two lists cannot drift —
 * the drift that once let a haddock curry pass as vegetarian.
 */
const RAW_PROTEIN_TERMS = [
  ...ANIMAL_TERMS.filter((t) => !NOT_COOKED_THROUGH.has(t)),
  "egg", "eggs", "anda",
];

/**
 * The shape Gemini must answer in. With a response schema the model is
 * constrained to valid JSON of this shape, instead of being asked nicely and
 * then having its code fences stripped by regex — which failed outright on
 * any stray sentence before or after the JSON.
 */
const ingredientRow: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    item: { type: SchemaType.STRING },
    quantity: { type: SchemaType.STRING },
  },
  required: ["item", "quantity"],
};

const RECIPE_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    baseDish: { type: SchemaType.STRING },
    prepTime: { type: SchemaType.STRING },
    fromPantry: { type: SchemaType.ARRAY, items: ingredientRow },
    toBuy: { type: SchemaType.ARRAY, items: ingredientRow },
    staples: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    rescueNote: { type: SchemaType.STRING },
  },
  required: ["title", "baseDish", "prepTime", "fromPantry", "toBuy", "staples", "steps", "rescueNote"],
};

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
  // Gemini costs money per call. Without this, anyone with the URL
  // could spend the project's quota from a terminal.
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  // Auth stops a stranger; this stops one account looping the call.
  const limit = checkRateLimit("find-recipe", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/find-recipe");
  log.info("Request received");

  try {
    const { items, dietaryPreference, avoidTitles } = (await req.json()) as {
      items?: PantryItem[];
      dietaryPreference?: string;
      avoidTitles?: string[];
    };

    const accepted = (Array.isArray(items) ? items : [])
      .filter((i) => i && typeof i.name === "string" && i.name.trim());

    // The client already withholds these, but the client is not the trust
    // boundary — this route is reachable directly with any body. Food that is
    // past our estimate is dropped from the payload entirely rather than
    // demoted to a gentler bucket: anything that reaches the prompt can reach
    // the recipe, and the recipe tells someone to cook and eat it.
    const withinEstimate = accepted.filter(
      (i) => (i.daysPastEstimate ?? 0) <= 0 && (i.daysLeft ?? 0) >= 0
    );
    // Counted before the slice below, which also removes items — otherwise a
    // pantry of 20 fresh things would report 8 as "past estimate".
    const droppedPastEstimate = accepted.length - withinEstimate.length;

    const pantry = withinEstimate
      // Most urgent first — this ordering is the whole point of the feature,
      // and the prompt below leans on it.
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
      .slice(0, 12);

    if (pantry.length === 0) {
      log.info("Every item was past its estimate", { received: accepted.length });
      return NextResponse.json(
        {
          success: false,
          error:
            accepted.length > 0
              ? "Everything here is past our estimate. Check these yourself before cooking with them."
              : "No pantry items provided",
        },
        { status: 400 }
      );
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Anything at 2 days or less is what the recipe would most like to use —
    // a preference, not a requirement (rule 2 in the prompt).
    const critical = pantry.filter((i) => (i.daysLeft ?? 999) <= 2);
    const soon = pantry.filter((i) => (i.daysLeft ?? 999) > 2 && (i.daysLeft ?? 999) <= 5);
    const rest = pantry.filter((i) => (i.daysLeft ?? 999) > 5);

    // A zero here now means "due today" and nothing else — anything genuinely
    // past its estimate was dropped above. Saying "0 days left" invited the
    // model to treat it as already gone; naming the inspection is the honest
    // version and it carries into rule 9.
    const fmt = (list: PantryItem[]) =>
      list
        .map((i) => {
          // A low-confidence row's day count is a rough guess, and it read
          // in the prompt exactly like a USDA-sourced one. Saying so lets the
          // model pick a method that survives the estimate being wrong.
          const rough = i.confidence === "low" ? ", rough estimate" : "";
          // Only a short, plain amount reaches the prompt — never free text
          // that could carry instructions.
          const amount = typeof i.quantity === "string" && i.quantity.trim()
            ? `, about ${i.quantity.trim().slice(0, 40).replace(/[^\p{L}\p{N} .,/-]/gu, "")} left`
            : "";
          return i.daysLeft === 0
            ? `- ${i.name} (due today — tell the cook to look at it and smell it first${amount}${rough})`
            : `- ${i.name} (${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} left${amount}${rough})`;
        })
        .join("\n");

    const sections = [
      critical.length ? `USE FIRST, if they fit a real dish — these spoil soonest:\n${fmt(critical)}` : "",
      soon.length ? `USE NEXT, if they fit:\n${fmt(soon)}` : "",
      rest.length ? `Also available:\n${fmt(rest)}` : "",
    ].filter(Boolean).join("\n\n");

    const avoid = Array.isArray(avoidTitles) && avoidTitles.length
      ? `\nDo NOT suggest these, they were already shown: ${avoidTitles.slice(0, 6).join(", ")}.\n`
      : "";

    // Rules 1-3 used to say the opposite: every "MUST USE" item had to go into
    // one dish. Handed palak, curd, chicken and bread, the model obeyed and
    // invented a dish nobody cooks — unappetising, and with curd and chicken
    // thrown together, not obviously safe. A real dish that uses two items
    // beats an invented one that "uses" five.
    const prompt = `You are an experienced Indian home cook. Suggest ONE real, everyday Indian dish — ghar ka khana — that uses up some of the food below before it spoils.

${sections}
${avoid}
Dietary preference: ${dietaryPreference || "none"}.

Rules, in order of importance:
1. The dish must be a REAL, established dish that Indian households actually cook and that people recognise by name — the kind found in any ordinary Indian cookbook (Aloo Gobi, Palak Paneer, Dal Tadka, Vegetable Pulao, Poha, Besan Chilla, Jeera Rice, Kadhi). Never invent a new dish, a fusion, or an unusual combination of ingredients.
2. Choose the real dish that uses the "USE FIRST" items best. Only include an item if it genuinely belongs in that dish as it is normally cooked. NEVER force an ingredient in just to use it up — leaving an item out is always better than an odd or unsafe combination. Using a single pantry item is fine.
3. Do not put together ingredients that the real dish does not normally contain.
4. Respect the dietary preference absolutely. "Veg" means no meat, no fish, no egg. "Eggtarian" allows egg but no meat or fish. Never break this.
5. Cook it the way that dish is normally cooked — tadka where it belongs (jeera, rai, hing, curry leaves), bhuna-ing the masala, everyday spices (haldi, dhania, jeera powder, garam masala, lal mirch, amchur).
6. You may assume only these everyday kitchen staples are at home: oil or ghee, salt, sugar, onion, tomato, ginger, garlic, green chilli, the ground spices above, atta, rice and a basic dal. Anything else the dish needs that is not in the lists above goes under "toBuy".
7. Where an item says how much is left, never use more of it than that, and size the dish to it. Use Indian measures and names naturally (katori, tsp, tbsp, grams, ml; jeera, haldi, dhania), with the English term in brackets on first use where it isn't obvious.
8. The title is the dish's ordinary, well-known name — exactly what someone would call it at home (e.g. "Aloo Gobi", "Palak Paneer"). Do not list ingredients in the title, do not add made-up words, keep it under five words.
9. If an item you use is marked "due today", the FIRST step must tell the cook to look at it and smell it before it goes in, and to leave it out if it does not seem right. Nobody has checked it yet, so the step must not contain the words "spoiled", "spoilage", "gone bad", "rotten" or "expired" ANYWHERE — not even conditionally, so "if it is spoiled, throw it away" is also forbidden. Say what to look for instead: soft or slimy patches, discolouration, a sour or unusual smell. Then say to leave it out if any of that is there.
10. Where an item is marked "rough estimate", our day count for it is unreliable. Prefer a real dish that cooks it through (a sabzi, dal or curry) over one that serves it raw (raita, salad, chutney). Do not mention the estimate or its reliability in the recipe.

Split the ingredients into three groups so the cook knows what they already
have and what they must go out and buy:
- "fromPantry": ingredients that come from the numbered lists above. Give the
  pantry item's exact name plus the quantity to use.
- "toBuy": ingredients that are NOT in the lists above and are NOT everyday
  staples — things they genuinely have to buy. ALWAYS give the amount
  needed for this dish separately from the name, so it can go straight onto
  a shopping list.
- "staples": the everyday kitchen basics from rule 6 that you used (oil/ghee, salt,
  onion, tomato, ginger, garlic, green chilli, ground spices, atta, rice).

Answer with this JSON object:
{
  "title": "the dish's ordinary well-known name, e.g. Aloo Gobi",
  "baseDish": "the same dish name exactly as someone would type it into YouTube (e.g. Palak Paneer, Paneer Bhurji, Vegetable Khichdi)",
  "prepTime": "e.g. 25m",
  "fromPantry": [{"item": "exact name from the lists above", "quantity": "200 g, cubed"}],
  "toBuy": [{"item": "Fresh coriander", "quantity": "1 bunch"}],
  "staples": ["2 tbsp oil", "1 tsp jeera", "..."],
  "steps": ["step 1", "step 2", "..."],
  "rescueNote": "one short sentence naming which about-to-spoil items this uses"
}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RECIPE_RESPONSE_SCHEMA,
        // Lower than the default: the same pantry should get a similar, real
        // dish each time, not a creative one. "Try another" still varies it
        // through avoidTitles.
        temperature: 0.4,
      },
    });
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
    // Fall back to the title only if the model skipped the field entirely.
    const baseDish = String(recipe.baseDish || "").trim() || title;

    const fromPantry = (Array.isArray(recipe.fromPantry) ? recipe.fromPantry : [])
      .map((row: unknown) => {
        const r = row as { item?: unknown; quantity?: unknown };
        return { item: String(r?.item ?? "").trim(), quantity: String(r?.quantity ?? "").trim() };
      })
      // Only keep rows that name something genuinely in the pantry, so the
      // card can never credit an ingredient the user doesn't own.
      .filter((r: { item: string }) => r.item && knownNames.has(r.item.toLowerCase()));

    // Appended, never validated against what the model wrote. Asking the model
    // to include a doneness step and then checking whether it did would make
    // the safety line contingent on the model's cooperation; this way the line
    // is there because we put it there. Worst case it restates a step the
    // recipe already has, which is a far cheaper failure than omitting it.
    //
    // The wording carries no temperature or time — the app has no source for a
    // core temperature and will not invent one. It tells the cook what to
    // check and to keep going if unsure.
    const steps = (Array.isArray(recipe.steps) ? recipe.steps : []).map(String).filter(Boolean);

    const rawProteins = fromPantry
      .map((r: { item: string }) => r.item)
      // matchesTerm, not diet.ts's hasWord: a plain word boundary fails on a
      // plural, because the trailing "s" is itself a word character. "Prawns"
      // is how the item is actually named, and \bprawn\b does not match it.
      .filter((name: string) => RAW_PROTEIN_TERMS.some((t) => matchesTerm(name.toLowerCase(), t)));

    if (rawProteins.length > 0) {
      const named = rawProteins.length === 1
        ? rawProteins[0]
        : `${rawProteins.slice(0, -1).join(", ")} and ${rawProteins[rawProteins.length - 1]}`;
      // Agreement keys on the NOUN, not on how many proteins there are. The
      // first fix counted proteins, which got "check the Chicken Breast and
      // Eggs is cooked" right but still produced "check the Eggs is cooked"
      // for a single item with a plural name.
      const plural = rawProteins.length > 1 || isPluralNoun(rawProteins[0]);
      steps.push(
        !plural
          ? `Before serving, check the ${named} is cooked all the way through. If you are not sure it is done, give it longer.`
          : `Before serving, check the ${named} are cooked all the way through. If you are not sure they are done, give them longer.`
      );
    }

    const payload = {
      title,
      prepTime: String(recipe.prepTime || "25m"),
      fromPantry,
      usesItems: fromPantry.map((r: { item: string }) => r.item),
      // Older prompts returned toBuy as bare strings ("1 bunch fresh
      // coriander"), which meant the shopping list had to display the amount
      // welded onto the name or drop it. Accept both shapes so a cached or
      // stubborn response still works.
      toBuy: (Array.isArray(recipe.toBuy) ? recipe.toBuy : [])
        .map((row: unknown) => {
          if (typeof row === "string") return { item: row.trim(), quantity: "" };
          const r = row as { item?: unknown; quantity?: unknown };
          return { item: String(r?.item ?? "").trim(), quantity: String(r?.quantity ?? "").trim() };
        })
        .filter((r: { item: string }) => r.item),
      staples: (Array.isArray(recipe.staples) ? recipe.staples : []).map(String).filter(Boolean),
      steps,
      rescueNote: String(recipe.rescueNote || "").trim(),
      baseDish,
      // Searched on the well-known dish rather than the generated title: the
      // title describes this specific combination and often has no videos at
      // all, whereas the base dish reliably does. A search also can't 404 the
      // way a curated link can — one of the provider's Indian videos is
      // already dead after a copyright takedown.
      videoSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(baseDish + " recipe")}`,
      // DISCLOSURE, NOT A FILTER. This says what the dish appears to contain.
      // It does not promise anything was kept out, because nothing was: there
      // is no allergen preference in the app to filter against yet, and the
      // term list behind this is inherited and unaudited (see allergens.ts).
      // The UI copy must not describe this as filtering until an allergen
      // preference exists AND a post-generation check enforces it.
      //
      // Read from the ingredient names the recipe itself returned rather than
      // the whole JSON blob, so the dish title and the prose in the steps
      // cannot introduce a term that is not actually an ingredient.
      containsAllergens: detectAllergens(
        [
          ...fromPantry.map((r: { item: string }) => r.item),
          ...(Array.isArray(recipe.toBuy) ? recipe.toBuy : []).map((row: unknown) =>
            typeof row === "string" ? row : String((row as { item?: unknown })?.item ?? "")
          ),
          ...(Array.isArray(recipe.staples) ? recipe.staples : []).map(String),
        ].join(", ")
      ),
    };

    log.info("Recipe generated", {
      title: payload.title,
      usesCount: payload.usesItems.length,
      toBuyCount: payload.toBuy.length,
      criticalCount: critical.length,
      droppedPastEstimate,
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
