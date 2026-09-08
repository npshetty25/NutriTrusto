import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { findDietViolations, normalizeDiet } from "@/lib/diet-check";
import { ANIMAL_TERMS } from "@/lib/diet";
import { matchesTerm } from "@/lib/text-match";
import { detectAllergens } from "@/lib/allergens";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface PantryItem {
  name: string;
  daysLeft: number;
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
 * Whether an item name reads as a plural, judged on its head noun — the last
 * word, which is what the verb has to agree with. "Eggs" is plural; "Chicken
 * Breast" is not, despite naming a bird.
 *
 * The -ss/-us/-is exceptions are the singular nouns that merely end in s, and
 * three of them are foods that turn up in a pantry: sea bass, octopus,
 * hummus. Without them the line would read "check the Sea Bass are cooked".
 */
const isPluralNoun = (name: string) => {
  const head = name.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return head.endsWith("s") && !/(ss|us|is)$/.test(head);
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

    // Anything at 2 days or less is what this recipe exists to rescue.
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
          return i.daysLeft === 0
            ? `- ${i.name} (due today — tell the cook to look at it and smell it first${rough})`
            : `- ${i.name} (${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} left${rough})`;
        })
        .join("\n");

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
8. Name it like a person would, not like a label. Pick the closest real Indian dish and use that name, adding at most ONE distinguishing word. "Palak Paneer Bhurji" is a name; "Dahi-Doodh Paneer-Palak Bread Bhurji" is an ingredient list with hyphens. Never chain more than two ingredients into the title, never use "&", and keep it under five words.
9. If an item is marked "due today", the FIRST step must tell the cook to look at it and smell it before it goes in, and to leave it out if it does not seem right. Nobody has checked it yet, so the step must not contain the words "spoiled", "spoilage", "gone bad", "rotten" or "expired" ANYWHERE — not even conditionally, so "if it is spoiled, throw it away" is also forbidden. Say what to look for instead: soft or slimy patches, discolouration, a sour or unusual smell. Then say to leave it out if any of that is there.
10. Where an item is marked "rough estimate", our day count for it is unreliable. Prefer a method that survives being wrong about it — cooked through in a sabzi, dal or curry rather than raw in a raita, salad or chutney. Do not mention the estimate or its reliability in the recipe; just cook it the safer way.

Split the ingredients into three groups so the cook knows what they already
have and what they must go out and buy:
- "fromPantry": ingredients that come from the numbered lists above. Give the
  pantry item's exact name plus the quantity to use.
- "toBuy": ingredients that are NOT in the lists above and are NOT everyday
  staples — things they genuinely have to buy. ALWAYS give the amount
  needed for this dish separately from the name, so it can go straight onto
  a shopping list.
- "staples": everyday Indian kitchen basics you assumed (oil/ghee, salt,
  onion, tomato, ginger, garlic, green chilli, ground spices, atta, rice).

Return ONLY this JSON object, no markdown fence, no commentary:
{
  "title": "Dish name — at most five words, at most two ingredients named",
  "baseDish": "the closest well-known Indian dish this is a version of, 2-3 words, exactly as someone would type it into YouTube (e.g. Palak Paneer, Paneer Bhurji, Vegetable Khichdi)",
  "prepTime": "e.g. 25m",
  "fromPantry": [{"item": "exact name from the lists above", "quantity": "200 g, cubed"}],
  "toBuy": [{"item": "Fresh coriander", "quantity": "1 bunch"}],
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
