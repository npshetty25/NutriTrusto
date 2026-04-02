import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No receipt file provided" }, { status: 400 });
    }

    if (!genAI) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Convert file to array buffer and base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a smart grocery receipt parsing AI. 
Analyze the provided receipt/invoice image. It may be a physical piece of paper or a screenshot of an online order (like Instacart/Swiggy Instamart/Zepto/Blinkit etc).
Extract all the food/grocery items purchased.
For each item, infer a sensible "days_left" before expiry based on general knowledge (e.g., fresh milk = 7 days, rice = 365, vegetables = 5-7).
Assign a "risk" level: "high" if it spoils very quickly (under 5 days), "medium" (under 14 days), "low" (pantry staples).

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

    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text().trim();
    
    // Strip markdown formatting if Gemini wrapped it
    const jsonStr = text.replace(/^```json/m, '').replace(/```$/m, '').trim();
    
    const parsedData = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      items: parsedData.items || []
    });
  } catch (error) {
    console.error("Receipt Extraction Error:", error);
    return NextResponse.json({ success: false, error: "Failed to parse receipt" }, { status: 500 });
  }
}
