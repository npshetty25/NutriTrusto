import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { deriveRiskFromDaysOnly } from "@/lib/risk-bands";
import { validateUpload } from "@/lib/upload-validation";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type ExtractedItem = {
  name?: string;
  days_left?: number | string;
  risk?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The receipt's own transaction date, not "today", so freshness tracking
// is correct for receipts scanned days after the actual purchase.
const resolveReceiptDate = (isoDate: unknown): Date => {
  const today = new Date();
  if (typeof isoDate === "string" && isoDate.trim()) {
    const parsed = new Date(`${isoDate.trim()}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      const twoYearsAgo = new Date(today.getTime() - 2 * 365 * MS_PER_DAY);
      // Guard against OCR misreads: a receipt can't be dated in the
      // future, and a date wildly in the past is more likely a
      // misread year than a genuinely ancient receipt.
      if (parsed.getTime() <= today.getTime() && parsed.getTime() >= twoYearsAgo.getTime()) {
        return parsed;
      }
    }
  }
  return today;
};

const normalizeRisk = (risk?: string): "high" | "medium" | "low" => {
  const value = (risk || "").toLowerCase().trim();
  if (["high", "critical", "urgent"].includes(value)) return "high";
  if (["medium", "med", "soon"].includes(value)) return "medium";
  return "low";
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
        const days_left = normalizeDaysLeft(item?.days_left);
        if (!name) return null;

        const modelRisk = normalizeRisk(item?.risk);
        const risk = modelRisk || deriveRiskFromDays(days_left);

        return { name, days_left, risk };
      })
      .filter((item): item is { name: string; days_left: number; risk: "high" | "medium" | "low" } => Boolean(item));

    const receiptDate = resolveReceiptDate(parsedData?.purchase_date_iso);
    // Returned to the client, which writes it straight into pantry_items.
    // ISO so every row in that column has one shape.
    const purchase_date = receiptDate.toISOString();

    log.info("Receipt extraction completed", {
      normalizedItemsCount: items.length,
      purchase_date,
      rawPurchaseDateIso: parsedData?.purchase_date_iso ?? null,
    });

    return NextResponse.json({
      success: true,
      items,
      purchase_date,
    });
  } catch (error: any) {
    log.error("Unhandled extraction error", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return NextResponse.json({ success: false, error: "Failed to parse receipt" }, { status: 500 });
  }
}
