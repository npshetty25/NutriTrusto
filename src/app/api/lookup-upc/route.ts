import { NextResponse } from "next/server";
import { createRequestContext } from "@/lib/server-logger";

export async function GET(req: Request) {
  const log = createRequestContext("api/lookup-upc");
  log.info("Request received");

  try {
    const { searchParams } = new URL(req.url);
    const upc = searchParams.get("upc");
    log.info("Query parsed", { hasUpc: Boolean(upc), upc: upc || null });
    
    if (!upc) {
      log.warn("Validation failed: no UPC provided");
      return NextResponse.json({ error: "No UPC provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
    log.info("UPC upstream responded", { status: res.status, ok: res.ok });
    
    if (!res.ok) {
      log.warn("UPC upstream returned non-OK status", { status: res.status });
      return NextResponse.json({ error: "API limit or error" }, { status: res.status });
    }

    const data = await res.json();
    log.info("UPC lookup successful", {
      itemsCount: Array.isArray(data?.items) ? data.items.length : 0,
    });
    return NextResponse.json(data);
    
  } catch (error: any) {
    log.error("Unhandled UPC lookup error", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return NextResponse.json({ error: "Failed to fetch from UPC registry" }, { status: 500 });
  }
}
