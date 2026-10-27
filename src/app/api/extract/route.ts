import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { deriveRiskFromDaysOnly } from "@/lib/risk-bands";
import { validateUpload } from "@/lib/upload-validation";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";
import { estimateShelfLife } from "@/lib/shelf-life";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type ExtractedItem = {
  name?: string;
  days_left?: number | string;
  risk?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The receipt's own transaction date, not "today", so freshness tracking
// is correct for receipts scanned days after the actual purchase. Null when
// the receipt gave none: the client then uses its own today, because this
// server's today is UTC and a day behind in India until 5:30 am.
// UTC midnight of the date as written, so toISOString() gives that date back; null for "2026-02-31" and the like.
const calendarDate = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
};

const resolveReceiptDate = (isoDate: unknown): Date | null => {
  const today = new Date();
  if (typeof isoDate === "string" && isoDate.trim()) {
    // Not `${iso}T00:00:00`: that is the server's own midnight, which anywhere east of UTC is the day before.
    const parsed = calendarDate(isoDate);
    if (parsed) {
      const twoYearsAgo = new Date(today.getTime() - 2 * 365 * MS_PER_DAY);
      // Guard against OCR misreads: a receipt can't be dated in the
      // future, and a date wildly in the past is more likely a
      // misread year than a genuinely ancient receipt.
      if (parsed.getTime() <= today.getTime() && parsed.getTime() >= twoYearsAgo.getTime()) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeDaysLeft = (value: number | string | undefined): number => {
  const raw = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(raw)) return 7;
  return Math.max(1, Math.min(3650, Math.round(raw)));
};

// Was a byte-identical copy of the rule in page.tsx. Both now call the one
// definition in lib/risk-bands.ts.
const deriveRiskFromDays = (daysLeft: number): "high" | "medium" | "low" =>
  deriveRiskFromDaysOnly(daysLeft);

export async function POST(req: Request) {
  // Gemini costs money per call. Without this, anyone with the URL
  // could spend the project's quota from a terminal.
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  // Auth stops a stranger; this stops one account looping the call.
  const limit = checkRateLimit("extract", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/extract");
  log.info("Request received");

  try {
    const formData = await req.formData();
    const file = formData.get("receipt") as File | null;
    log.info("Parsed multipart form-data", { hasFile: Boolean(file) });

    // Size and magic-byte check before anything is paid for. file.type is
    // copied from the client's multipart headers and cannot be trusted.
    const upload = await validateUpload(file);
    if (!upload.ok) {
      log.warn("Upload rejected", { size: file?.size ?? 0, claimedType: file?.type || "none" });
      return upload.response;
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    log.info("Receipt file accepted", {
      fileName: upload.file.name,
      mimeType: upload.mime,
      fileSizeBytes: upload.file.size,
    });

    // Convert file to array buffer and base64
    const arrayBuffer = await upload.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a smart grocery receipt parsing AI.
Analyze the provided receipt/invoice image. It may be a physical piece of paper or a screenshot of an online order (like Instacart/Swiggy Instamart/Zepto/Blinkit etc).
  Extract ALL edible food/grocery products purchased. Do NOT skip lines. Include packaged, produce, dairy, frozen, bakery, beverages, and staples.
  Exclude taxes, delivery fees, discounts, order IDs, coupons, and non-food household goods.
For each item, infer a sensible "days_left" before expiry based on general knowledge (e.g., fresh milk = 7 days, rice = 365, vegetables = 5-7).
Assign a "risk" level: "high" if it spoils very quickly (under 5 days), "medium" (under 14 days), "low" (pantry staples).

Also find the date this purchase/order was actually made — this is the
transaction date printed on the receipt, NOT today's date. For a physical
receipt this is usually near the top or bottom (e.g. "Date:", "Bill Date").
For an online order screenshot, use the order/delivered date, not a "print"
or "download" timestamp if those differ. Indian receipts are usually
DD/MM/YYYY — if the first number is > 12, it must be DD/MM/YYYY; if
genuinely ambiguous, assume DD/MM/YYYY. Expand 2-digit years assuming the
2000s. Return it as "purchase_date_iso" in YYYY-MM-DD format, or null if no
date is visible anywhere on the receipt — never guess.

  Rules:
  - Return one entry per product line item from the receipt.
  - If confidence is low for shelf life, still include the item and default days_left to 7.
  - Use integer days_left only.

Return a JSON object in exactly this format:
{
  "purchase_date_iso": "YYYY-MM-DD" or null,
  "items": [
    { "name": "Item Name", "days_left": 10, "risk": "low" }
  ]
}
Return ONLY the raw JSON string, with no markdown formatting.`;

    const imageParts = [
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: upload.mime,
        },
      },
    ];

    log.info("Calling Gemini model", { model: "gemini-2.5-flash" });
    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text().trim();
    
    // Strip markdown formatting if Gemini wrapped it
    const jsonStr = text
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```$/m, "")
      .trim();
    
    const parsedData = JSON.parse(jsonStr);
    const rawItems = Array.isArray(parsedData?.items) ? (parsedData.items as ExtractedItem[]) : [];
    log.info("Model response parsed", { rawItemsCount: rawItems.length });

    const items = rawItems
      .map((item) => {
        const name = String(item?.name || "").trim();
        if (!name) return null;

        // Same order of trust as every other way an item gets in: a sourced
        // figure (our table, or FSSAI for sweets) first; the model's general-
        // knowledge guess only when nothing sourced matches; the category
        // average only when the model gave nothing usable either. This used
        // to be the model's guess for every line, which made receipts — the
        // way most items are added — the least accurate path in the app.
        const estimate = estimateShelfLife(name);
        const rawModelDays = typeof item?.days_left === "number" ? item.days_left : Number.parseInt(String(item?.days_left ?? ""), 10);
        const modelGaveDays = Number.isFinite(rawModelDays) && rawModelDays > 0;

        let days_left: number;
        let days_source: "table" | "ai" | "category";
        if (estimate.source === "known") {
          days_left = estimate.days;
          days_source = "table";
        } else if (modelGaveDays) {
          days_left = normalizeDaysLeft(rawModelDays);
          days_source = "ai";
        } else {
          days_left = estimate.days;
          days_source = "category";
        }

        // Risk follows the number actually used, not the model's own label,
        // which was judged against its own guess.
        const risk = deriveRiskFromDays(days_left);
        return { name, days_left, risk, days_source };
      })
      .filter((item): item is { name: string; days_left: number; risk: "high" | "medium" | "low"; days_source: "table" | "ai" | "category" } => Boolean(item));

    const receiptDate = resolveReceiptDate(parsedData?.purchase_date_iso);
    // Returned to the client, which writes it straight into pantry_items.
    // ISO so every row in that column has one shape.
    const purchase_date = (receiptDate ?? new Date()).toISOString();

    log.info("Receipt extraction completed", {
      normalizedItemsCount: items.length,
      purchase_date,
      rawPurchaseDateIso: parsedData?.purchase_date_iso ?? null,
    });

    return NextResponse.json({
      success: true,
      items,
      purchase_date,
      purchase_date_from_receipt: receiptDate !== null,
      // How many day counts came from where, so the app can say so.
      estimate_sources: {
        table: items.filter((i) => i.days_source === "table").length,
        ai: items.filter((i) => i.days_source === "ai").length,
        category: items.filter((i) => i.days_source === "category").length,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string } | null;
    log.error("Unhandled extraction error", {
      message: err?.message || "Unknown error",
      stack: err?.stack || null,
    });
    return NextResponse.json({ success: false, error: "Failed to parse receipt" }, { status: 500 });
  }
}
