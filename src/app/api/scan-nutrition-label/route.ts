import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  const log = createRequestContext("api/scan-nutrition-label");
  log.info("Request received");

  try {
    const formData = await req.formData();
    const file = formData.get("label") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
    }

    if (!genAI) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a precise nutrition data extraction engine trained on Indian packaged food labels.

Your ONLY job is to read the nutrition information table visible in the image and return the numbers exactly as printed. You must NEVER invent, estimate, interpolate, or assume any value.

═══════════════════════════════════
STEP 1 — LOCATE THE NUTRITION TABLE
═══════════════════════════════════
Look for a table on the packaging that contains rows like:
- Energy / Calories / kcal
- Protein
- Carbohydrate / Total Carbs
- Total Sugars / Sugars
- Total Fat / Fat
- Saturated Fat / Saturated Fatty Acids
- Dietary Fibre / Fiber
- Sodium / Salt

Indian labels (FSSAI format) often say "Nutritional Information per 100g" or "Nutrition Facts".
If you cannot clearly see such a table, return all nulls immediately — do not guess.

═══════════════════════════════════
STEP 2 — IDENTIFY THE SERVING UNIT
═══════════════════════════════════
Check if the table shows values per 100g, per 100ml, or per serving.
- If per 100g or per 100ml: use those values directly.
- If per serving: you MUST convert to per 100g using this formula:
  value_per_100g = (value_per_serving / serving_size_in_grams) × 100
  Only convert if the serving size in grams is clearly printed. If not, set per_unit to "serving" and return the raw per-serving values.

═══════════════════════════════════
STEP 3 — EXTRACT VALUES
═══════════════════════════════════
Read each row carefully. Common label variations for Indian products:
- "Energy" may be in kcal or kJ. If kJ, convert: kcal = kJ ÷ 4.184
- "Sodium" may be listed as "Salt" — if so, convert: sodium_mg = salt_g × 393
- "Dietary Fibre" and "Fiber" are the same thing
- "Total Sugars" and "Sugars" are the same thing
- Ignore "of which" sub-rows unless it's saturated fat or sugars

CRITICAL RULES — read these carefully:
❌ If a number is blurry, cut off, or unclear → set it to null. Do NOT guess.
❌ Do NOT hallucinate values based on what you know about this type of product.
❌ Do NOT fill in typical values for "soup" or "chips" or any category.
❌ If the image shows no nutrition table at all → return all nulls.
✅ Only return numbers you can actually read in the image.
✅ Return decimal values exactly as shown (e.g., 3.5, not 4).
✅ Sodium must always be in mg. Fat and protein must always be in grams.

═══════════════════════════════════
STEP 4 — RETURN JSON
═══════════════════════════════════
Return ONLY this JSON object, nothing else. No markdown. No explanation. No units inside values.

{
  "product_name": "exact product name from label or null",
  "energy_kcal": number or null,
  "carbohydrates_g": number or null,
  "sugars_g": number or null,
  "total_fat_g": number or null,
  "saturated_fat_g": number or null,
  "fibre_g": number or null,
  "protein_g": number or null,
  "sodium_mg": number or null,
  "per_unit": "100g" or "100ml" or "serving",
  "confidence": "high" or "medium" or "low"
}

The "confidence" field is your honest assessment:
- "high" = table clearly visible, all major values readable
- "medium" = table partially visible, some values unclear
- "low" = table hard to read, most values are null`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type || "image/jpeg",
        },
      },
    ]);

    const text = result.response.text().trim();
    const jsonStr = text
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```$/m, "")
      .trim();

    const parsed = JSON.parse(jsonStr);
    log.info("Nutrition label parsed", parsed);

    return NextResponse.json({ success: true, nutrition: parsed });
  } catch (error: unknown) {
    log.error("Nutrition label scan failed", {
      message: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json({ success: false, error: "Failed to read label" }, { status: 500 });
  }
}
