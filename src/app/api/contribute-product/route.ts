import { NextResponse } from "next/server";
import { createRequestContext } from "@/lib/server-logger";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { checkRateLimit, rateLimited } from "@/lib/rate-limit";

// Requires a real Open Food Facts contributor account — production writes
// are not anonymous (confirmed against their API docs). Create a free
// account at https://world.openfoodfacts.org/cgi/user.pl and set
// OFF_USER_ID / OFF_PASSWORD to enable this route; until then it responds
// with a clear "not configured" error rather than silently no-opping.
const OFF_USER_ID = process.env.OFF_USER_ID;
const OFF_PASSWORD = process.env.OFF_PASSWORD;

// Staging mirror Open Food Facts documents specifically for testing writes
// without touching the real production database (shared off/off login).
// Flip via env so this can be verified safely before ever pointing at prod.
const OFF_WRITE_BASE_URL = process.env.OFF_USE_STAGING === "true"
  ? "https://world.openfoodfacts.net"
  : "https://world.openfoodfacts.org";

export async function POST(req: Request) {
  // Gemini costs money per call. Without this, anyone with the URL
  // could spend the project's quota from a terminal.
  const user = await getRequestUser(req);
  if (!user) return unauthorized();

  // Auth stops a stranger; this stops one account looping the call.
  const limit = checkRateLimit("contribute-product", user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const log = createRequestContext("api/contribute-product");
  log.info("Request received");

  try {
    const { barcode, productName } = (await req.json()) as { barcode?: string; productName?: string };

    if (!barcode || !productName?.trim()) {
      return NextResponse.json({ success: false, error: "Barcode and product name are required" }, { status: 400 });
    }

    if (!OFF_USER_ID || !OFF_PASSWORD) {
      log.warn("Open Food Facts credentials not configured");
      return NextResponse.json(
        { success: false, error: "Open Food Facts contribution isn't set up yet — add OFF_USER_ID and OFF_PASSWORD to enable this." },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      code: barcode,
      user_id: OFF_USER_ID,
      password: OFF_PASSWORD,
      product_name: productName.trim(),
      lang: "en",
      app_name: "Nutri-Trust",
      comment: "Added via Nutri-Trust: unknown barcode manually identified by a user",
    });

    log.info("Submitting to Open Food Facts", { barcode, staging: OFF_WRITE_BASE_URL.includes(".net") });

    const response = await fetch(`${OFF_WRITE_BASE_URL}/cgi/product_jqm2.pl`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();
    log.info("Open Food Facts response", { status: data?.status, statusVerbose: data?.status_verbose });

    if (String(data?.status) === "1") {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: data?.status_verbose || "Open Food Facts didn't accept the submission" },
      { status: 502 }
    );
  } catch (error: unknown) {
    log.error("Unhandled contribution error", {
      message: error instanceof Error ? error.message : "Unknown",
    });
    return NextResponse.json({ success: false, error: "Failed to submit to Open Food Facts" }, { status: 500 });
  }
}
