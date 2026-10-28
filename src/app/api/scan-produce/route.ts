import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { validateUpload } from "@/lib/upload-validation";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";
import { cleanNames } from "@/lib/produce-names";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const PROMPT = `You are looking at a photo of groceries with no packaging or barcode: loose vegetables, fruit, eggs, herbs, bread or similar, as bought from a sabzi-wala or market.

List each different kind of food you can clearly identify. Use the name an Indian household would use, in English (for example "Tomatoes", "Bhindi (Okra)", "Coriander Leaves", "Bananas", "Palak (Spinach)").

Rules:
- Only name what you can actually see. If you are unsure what something is, leave it out. Never guess.
- One entry per kind of food, even if there are many of them.
- Do not include containers, bags, scales, hands or anything that is not food.
- If the photo has no identifiable food, return an empty list.

Return ONLY this JSON, no markdown:
{ "items": [ { "name": "Tomatoes" } ] }`;

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  const limit = checkRateLimit("scan-produce", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/scan-produce");
  log.info("Request received");

  try {
    const formData = await req.formData();
    const upload = await validateUpload(formData.get("photo") as File | null);
    if (!upload.ok) return upload.response;

    if (!genAI) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const buffer = Buffer.from(await upload.file.arrayBuffer());
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      PROMPT,
      { inlineData: { data: buffer.toString("base64"), mimeType: upload.mime } },
    ]);

    const jsonStr = result.response
      .text()
      .trim()
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```$/m, "")
      .trim();

    const names = cleanNames(JSON.parse(jsonStr));
    log.info("Produce photo read", { count: names.length });
    return NextResponse.json({ success: true, items: names });
  } catch (error: unknown) {
    log.error("Produce scan failed", { message: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ success: false, error: "Failed to read the photo" }, { status: 500 });
  }
}
