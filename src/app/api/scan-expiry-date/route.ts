import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS_LEFT = 3650;

type ExpirySource = "printed_expiry" | "mfd_plus_shelf_life" | "shelf_life_from_today" | "unknown";

type ParsedExpiryFields = {
  expiry_date_iso?: string | null;
  mfd_date_iso?: string | null;
  shelf_life_value?: number | string | null;
  shelf_life_unit?: "days" | "months" | "years" | null;
  raw_text_found?: string | null;
  confidence?: "high" | "medium" | "low";
};

const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(`${value.trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const shelfLifeToDays = (value: unknown, unit: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "days") return Math.round(n);
  if (unit === "months") return Math.round(n * 30);
  if (unit === "years") return Math.round(n * 365);
  return null;
};

const PROMPT = `You are a precise expiry-date extraction engine trained on Indian (FSSAI) and international packaged food labels.

Your ONLY job is to locate printed manufacturing/packaging and expiry information on the packaging and return it exactly as printed. You must NEVER invent, estimate, or assume a date that is not visible in the image.

═══════════════════════════════════
STEP 1 — LOCATE THE DATE STAMP
═══════════════════════════════════
Look for text near a barcode, cap, seal, pouch edge, or bottom of the package such as:
- "MFD" / "Mfg Date" / "Manufactured On" / "Packed On" / "PKD"
- "EXP" / "Expiry Date" / "Use By" / "Best Before" / "Best Before End"
- Combined shelf-life statements like "Best Before 6 Months From Packaging" or "Best Before 9 Months From Mfg"
If you cannot find any such text at all, return every field null immediately — do not guess.

═══════════════════════════════════
STEP 2 — EXTRACT VALUES EXACTLY AS PRINTED
═══════════════════════════════════
- If an absolute expiry / use-by / best-before-end date is printed, return it as "expiry_date_iso" in YYYY-MM-DD format.
- If only a manufacturing/packaging date is printed (no absolute expiry date), return it as "mfd_date_iso" in YYYY-MM-DD format.
- If a shelf-life duration is printed instead of (or in addition to) a date (e.g. "Best Before 6 Months From Packaging"), return "shelf_life_value" (e.g. 6) and "shelf_life_unit" ("days", "months", or "years").
- Indian labels are usually DD/MM/YYYY. If the first number is > 12, it must be DD/MM/YYYY. If genuinely ambiguous, use DD/MM/YYYY as the default assumption.
- If the year is printed with 2 digits (e.g. "25"), expand it to the correct 4-digit year assuming the 2000s.
- If any date is blurry, cut off, or ambiguous, leave that specific field null instead of guessing.

═══════════════════════════════════
STEP 3 — RETURN JSON
═══════════════════════════════════
Return ONLY this JSON object, nothing else. No markdown formatting, no explanation.

{
  "expiry_date_iso": "YYYY-MM-DD" or null,
  "mfd_date_iso": "YYYY-MM-DD" or null,
  "shelf_life_value": number or null,
  "shelf_life_unit": "days" or "months" or "years" or null,
  "raw_text_found": "short excerpt of the actual printed date/shelf-life text" or null,
  "confidence": "high" or "medium" or "low"
}

The "confidence" field is your honest assessment:
- "high" = date text clearly visible and unambiguous
- "medium" = partially visible, or a format assumption (like DD/MM/YYYY) had to be made
- "low" = no reliable date information found`;

export async function POST(req: Request) {
  const log = createRequestContext("api/scan-expiry-date");
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

    const result = await model.generateContent([
      PROMPT,
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

    const parsed = JSON.parse(jsonStr) as ParsedExpiryFields;
    log.info("Expiry date fields parsed", parsed);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const expiryDate = parseIsoDate(parsed.expiry_date_iso);
    const mfdDate = parseIsoDate(parsed.mfd_date_iso);
    const shelfLifeDays = shelfLifeToDays(parsed.shelf_life_value, parsed.shelf_life_unit);

    let resolvedExpiry: Date | null = null;
    let source: ExpirySource = "unknown";

    if (expiryDate) {
      resolvedExpiry = expiryDate;
      source = "printed_expiry";
    } else if (mfdDate && shelfLifeDays) {
      resolvedExpiry = new Date(mfdDate.getTime() + shelfLifeDays * MS_PER_DAY);
      source = "mfd_plus_shelf_life";
    } else if (shelfLifeDays) {
      resolvedExpiry = new Date(today.getTime() + shelfLifeDays * MS_PER_DAY);
      source = "shelf_life_from_today";
    }

    const daysLeft = resolvedExpiry
      ? Math.max(0, Math.min(MAX_DAYS_LEFT, Math.round((resolvedExpiry.getTime() - today.getTime()) / MS_PER_DAY)))
      : null;

    const confidence: "high" | "medium" | "low" =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "low";

    log.info("Expiry resolved", { source, daysLeft, confidence });

    return NextResponse.json({
      success: true,
      expiry: {
        days_left: daysLeft,
        expiry_date: resolvedExpiry ? resolvedExpiry.toISOString().slice(0, 10) : null,
        source,
        confidence,
        raw_text_found: typeof parsed.raw_text_found === "string" ? parsed.raw_text_found : null,
      },
    });
  } catch (error: unknown) {
    log.error("Expiry date scan failed", {
      message: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json({ success: false, error: "Failed to read expiry date" }, { status: 500 });
  }
}
