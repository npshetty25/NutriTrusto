import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface PantryItemContext {
  name?: string;
  daysLeft?: number;
  risk?: string;
  ingredientsText?: string | null;
}

export async function POST(req: Request) {
  // Gemini costs money per call. Without this, anyone with the URL
  // could spend the project's quota from a terminal.
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  const log = createRequestContext("api/pantry-chat");
  log.info("Request received");

  try {
    const { question, items, dietaryPreference } = (await req.json()) as {
      question?: string;
      items?: PantryItemContext[];
      dietaryPreference?: string;
    };

    const trimmedQuestion = String(question || "").trim().slice(0, 500);
    if (!trimmedQuestion) {
      return NextResponse.json({ success: false, error: "No question provided" }, { status: 400 });
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const pantryList = Array.isArray(items) && items.length > 0
      ? items
          .map((item) => {
            const name = String(item?.name || "Unknown item");
            const daysLeft = Number.isFinite(item?.daysLeft) ? item?.daysLeft : "?";
            const risk = item?.risk || "unknown";
            const ingredients = item?.ingredientsText ? ` | ingredients: ${item.ingredientsText}` : "";
            return `- ${name}: ${daysLeft} day(s) left, ${risk} risk${ingredients}`;
          })
          .join("\n")
      : "The pantry is currently empty.";

    log.info("Payload parsed", { itemCount: Array.isArray(items) ? items.length : 0, questionLength: trimmedQuestion.length });

    const prompt = `You are a helpful, concise kitchen assistant inside a smart pantry app called Nutri-Trust.

Here is the user's ACTUAL current pantry inventory — this is the only data you know about what they have:
${pantryList}

Dietary preference: ${dietaryPreference || "none specified"}.

Rules:
- Only reference items that are actually listed above. Never invent an item that isn't there.
- If asked what to cook, prioritize items with fewer days left first, and respect the dietary preference.
- If asked about allergens/ingredients, only answer using the "ingredients:" text shown for that item — if no ingredients text is shown for it, say you don't have ingredient data for that item, don't guess.
- If the pantry is empty, or doesn't contain what's needed to answer, say so plainly instead of making something up.
- Keep the answer short and conversational (2-4 sentences) — like a text from a helpful friend, not a formal report. No markdown formatting.

User's question: "${trimmedQuestion}"`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();

    log.info("Chat answer generated", { answerLength: answer.length });

    return NextResponse.json({ success: true, answer });
  } catch (error: unknown) {
    log.error("Unhandled pantry chat error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ success: false, error: "Failed to answer your question" }, { status: 500 });
  }
}
