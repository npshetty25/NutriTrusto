import { NextResponse } from "next/server";
import { resolveDateKind } from "@/lib/date-kind";
import { daysBetween, resolvePrintedDate } from "@/lib/printed-date";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { validateUpload } from "@/lib/upload-validation";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MAX_DAYS_LEFT = 3650;

/**
 * The phone's own today. This server runs in UTC, which in India is still
 * yesterday until 5:30 am; a date from the phone is accepted only within a
 * day of the server's, so a wrong clock cannot move a pack's date far.
 */
function resolveToday(fromClient: unknown): string {
  const server = new Date().toISOString().slice(0, 10);
  if (typeof fromClient === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fromClient)) {
    if (Math.abs(daysBetween(server, fromClient)) <= 1) return fromClient;
  }
  return server;
}

type ParsedExpiryFields = {
  expiry_date_iso?: string | null;
  mfd_date_iso?: string | null;
  shelf_life_value?: number | string | null;
  shelf_life_unit?: "days" | "months" | "years" | null;
  raw_text_found?: string | null;
  confidence?: "high" | "medium" | "low";
  date_kind?: string | null;
};

const PROMPT = `You are a precise expiry-date extraction engine trained on Indian (FSSAI) and international packaged food labels.

Your ONLY job is to locate printed manufacturing/packaging and expiry information on the packaging and return it exactly as printed. You must NEVER invent, estimate, or assume a date that is not visible in the image.

═══════════════════════════════════
STEP 1 — LOCATE THE DATE STAMP
═══════════════════════════════════
Look for text near a barcode, cap, seal, pouch edge, or bottom of the package. FSSAI allows these marks:
- Manufacture or packing: "MFD", "Mfd.", "Mfg. date", "Mfg. dt.", "Manufactured On", "Packed On", "PKD", "Pkd.", "Pkg. date"
- Expiry: "EXP", "Exp.", "Exp. date", "Expiry Date", "EXD", "ED", "E", "Ex"
- Use by: "Use By", "UB", "UBD", "U. By"
- Best before: "Best Before", "Best Before End", "BB", "BBD", "BB date"
- Shelf-life statements like "Best Before 6 Months From Packaging" or "Best Before 9 Months From Mfg"
If you cannot find any such text at all, return every field null immediately — do not guess.

═══════════════════════════════════
STEP 2 — EXTRACT VALUES EXACTLY AS PRINTED
═══════════════════════════════════
- If an absolute expiry / use-by / best-before date is printed, return it as "expiry_date_iso".
- If only a manufacturing/packaging date is printed (no absolute expiry date), return it as "mfd_date_iso".
- Write a date that has a day as YYYY-MM-DD. If ONLY a month and year are printed (FSSAI allows this on products that keep longer than three months: "EXP MAY 2027", "BB 05/27", "Best before end 05/2027", "Mfg.date: AUG 2026"), write YYYY-MM with NO day. Never invent a day.
- If a shelf-life duration is printed instead of (or in addition to) a date (e.g. "Best Before 6 Months From Packaging"), return "shelf_life_value" (e.g. 6) and "shelf_life_unit" ("days", "months", or "years").
- Indian labels use DD/MM/YY, DD/MM/YYYY, DD/MMM/YY or DD MMM YYYY (MMM = first three letters of the month, e.g. AUG). If the first number is > 12, it must be the day. If genuinely ambiguous, read it as day first.
- A date with only two numbers, like "05/27" or "11/2026", is month and year.
- If the year is printed with 2 digits (e.g. "25"), expand it to the correct 4-digit year assuming the 2000s.
- If any date is blurry, cut off, or ambiguous, leave that specific field null instead of guessing.

═══════════════════════════════════
STEP 3 — RETURN JSON
═══════════════════════════════════
Return ONLY this JSON object, nothing else. No markdown formatting, no explanation.

{
  "expiry_date_iso": "YYYY-MM-DD" or "YYYY-MM" or null,
  "mfd_date_iso": "YYYY-MM-DD" or "YYYY-MM" or null,
  "shelf_life_value": number or null,
  "shelf_life_unit": "days" or "months" or "years" or null,
  "raw_text_found": "short excerpt of the actual printed date/shelf-life text" or null,
  "confidence": "high" or "medium" or "low",
  "date_kind": "use_by" or "best_before" or null
}

"date_kind" says which kind of date is printed:
- "use_by" when the label says "Use by", "UB", "UBD", "Expiry", "Exp", "EXD", "ED", or "Expires"
- "best_before" when it says "Best before", "Best before end", "BB", "BBD", or "Best before N months from packing"
- null when the label does not say which

The "confidence" field is your honest assessment:
- "high" = date text clearly visible and unambiguous
- "medium" = partially visible, or a format assumption (like DD/MM/YYYY) had to be made
- "low" = no reliable date information found`;

export async function POST(req: Request) {
  // Gemini costs money per call. Without this, anyone with the URL
  // could spend the project's quota from a terminal.
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  // Auth stops a stranger; this stops one account looping the call.
  const limit = checkRateLimit("scan-expiry-date", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/scan-expiry-date");
  log.info("Request received");

  try {
    const formData = await req.formData();
    const file = formData.get("label") as File | null;

    // Size and magic-byte check before anything is paid for. file.type is
    // copied from the client's multipart headers and cannot be trusted.
    const upload = await validateUpload(file);
    if (!upload.ok) return upload.response;

    if (!genAI) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const arrayBuffer = await upload.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: upload.mime,
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

    const today = resolveToday(formData.get("today"));
    const resolved = resolvePrintedDate(
      {
        expiry: parsed.expiry_date_iso,
        mfd: parsed.mfd_date_iso,
        shelfLifeValue: parsed.shelf_life_value,
        shelfLifeUnit: parsed.shelf_life_unit,
      },
      today
    );

    // The phone recomputes this from expiry_date in its own calendar; it is
    // kept for older clients.
    const daysLeft = resolved.expiryDate
      ? Math.max(0, Math.min(MAX_DAYS_LEFT, daysBetween(today, resolved.expiryDate)))
      : null;

    const modelConfidence: "high" | "medium" | "low" =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "low";
    // A date that needs checking is never reported as certain.
    const confidence = resolved.needsCheck && modelConfidence === "high" ? "medium" : modelConfidence;

    log.info("Expiry resolved", { source: resolved.source, daysLeft, confidence });

    return NextResponse.json({
      success: true,
      expiry: {
        days_left: daysLeft,
        expiry_date: resolved.expiryDate,
        source: resolved.source,
        confidence,
        notes: resolved.notes,
        raw_text_found: typeof parsed.raw_text_found === "string" ? parsed.raw_text_found : null,
        date_kind: resolveDateKind(parsed.date_kind, parsed.raw_text_found),
      },
    });
  } catch (error: unknown) {
    log.error("Expiry date scan failed", {
      message: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json({ success: false, error: "Failed to read expiry date" }, { status: 500 });
  }
}
