import { NextResponse } from "next/server";
import { createRequestContext } from "@/lib/server-logger";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";
import { inferItemCategory } from "@/lib/item-category";

/**
 * Predict a pantry category for product names.
 *
 * With ML_SERVICE_URL set, the trained model (ml/service) answers and the
 * response says so, with a probability. Without it, or if the service is down
 * or slow, the existing keyword inferrer answers and the response says THAT,
 * with no confidence. The caller always learns which one it got: a keyword
 * guess must never be shown as a model prediction.
 */
const MAX_NAMES = 20;
const MAX_NAME_LENGTH = 200;
const TIMEOUT_MS = 2000;

type Prediction = { name: string; category: string; confidence: number | null };

async function fromModel(names: string[]): Promise<{ version: string; predictions: Prediction[] } | null> {
  const base = process.env.ML_SERVICE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      model_version: string;
      predictions: Array<{ name: string; category: string; confidence: number }>;
    };
    if (!Array.isArray(data.predictions) || data.predictions.length !== names.length) return null;
    return {
      version: data.model_version,
      predictions: data.predictions.map((p) => ({ name: p.name, category: p.category, confidence: p.confidence })),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  const limit = checkRateLimit("categorize", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/categorize");

  let body: { names?: unknown };
  try {
    body = (await req.json()) as { names?: unknown };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const names = Array.isArray(body.names)
    ? body.names.filter((n): n is string => typeof n === "string").map((n) => n.trim().slice(0, MAX_NAME_LENGTH)).filter(Boolean)
    : [];
  if (names.length === 0 || names.length > MAX_NAMES) {
    return NextResponse.json({ success: false, error: `Send between 1 and ${MAX_NAMES} names` }, { status: 400 });
  }

  const model = await fromModel(names);
  if (model) {
    log.info("Categorised by model", { count: names.length, version: model.version });
    return NextResponse.json({ success: true, source: "model", modelVersion: model.version, predictions: model.predictions });
  }

  log.info("Categorised by keyword rules", { count: names.length, modelConfigured: Boolean(process.env.ML_SERVICE_URL) });
  return NextResponse.json({
    success: true,
    source: "rules",
    modelVersion: null,
    predictions: names.map((name) => ({ name, category: inferItemCategory(name), confidence: null })),
  });
}
