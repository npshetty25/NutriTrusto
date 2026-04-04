import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type ExtractedItem = {
  name?: string;
  days_left?: number | string;
  risk?: string;
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

const deriveRiskFromDays = (daysLeft: number): "high" | "medium" | "low" => {
  if (daysLeft <= 4) return "high";
  if (daysLeft <= 13) return "medium";
  return "low";
};

export async function POST(req: Request) {
  const log = createRequestContext("api/extract");
  log.info("Request received");

  try {
    const formData = await req.formData();
    const file = formData.get("receipt") as File | null;
    log.info("Parsed multipart form-data", { hasFile: Boolean(file) });

    if (!file) {
      log.warn("Validation failed: missing receipt file");
      return NextResponse.json({ success: false, error: "No receipt file provided" }, { status: 400 });
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    log.info("Receipt file accepted", {
      fileName: file.name,
      mimeType: file.type || "unknown",
      fileSizeBytes: file.size,
    });

    // Convert file to array buffer and base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a smart grocery receipt parsing AI.
Analyze the provided receipt/invoice image. It may be a physical piece of paper or a screenshot of an online order (like Instacart/Swiggy Instamart/Zepto/Blinkit etc).
  Extract ALL edible food/grocery products purchased. Do NOT skip lines. Include packaged, produce, dairy, frozen, bakery, beverages, and staples.
  Exclude taxes, delivery fees, discounts, order IDs, coupons, and non-food household goods.
For each item, infer a sensible "days_left" before expiry based on general knowledge (e.g., fresh milk = 7 days, rice = 365, vegetables = 5-7).
Assign a "risk" level: "high" if it spoils very quickly (under 5 days), "medium" (under 14 days), "low" (pantry staples).

  Rules:
  - Return one entry per product line item from the receipt.
  - If confidence is low for shelf life, still include the item and default days_left to 7.
  - Use integer days_left only.

Return a JSON object in exactly this format:
{
  "items": [
    { "name": "Item Name", "days_left": 10, "risk": "low" }
  ]
}
Return ONLY the raw JSON string, with no markdown formatting.`;

    const imageParts = [
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type || "image/jpeg",
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

    log.info("Receipt extraction completed", {
      normalizedItemsCount: items.length,
    });

    return NextResponse.json({
      success: true,
      items
    });
  } catch (error: any) {
    log.error("Unhandled extraction error", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return NextResponse.json({ success: false, error: "Failed to parse receipt" }, { status: 500 });
  }
}
