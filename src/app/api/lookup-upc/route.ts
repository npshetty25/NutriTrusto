import { NextResponse } from "next/server";
import { createRequestContext } from "@/lib/server-logger";

const OFF_FIELDS = "product_name,product_name_en,product_name_in,generic_name,brands,brand_owner,quantity,ingredients_text,categories,nutriscore_grade,additives_n,additives_tags,nutriments";

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

    // ── 1. Try UPCItemDB (good for global packaged goods) ──────────
    try {
      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items) && data.items.length > 0) {
          log.info("UPCItemDB hit", { itemsCount: data.items.length });
          return NextResponse.json(data);
        }
      }
      log.warn("UPCItemDB returned no items", { status: res.status });
    } catch (e) {
      log.warn("UPCItemDB fetch failed", { error: String(e) });
    }

    // ── 2. Fallback: India OFF server (better for Indian products) ──
    try {
      const indiaRes = await fetch(
        `https://in.openfoodfacts.org/api/v2/product/${upc}.json?fields=${OFF_FIELDS}`
      );
      if (indiaRes.ok) {
        const indiaData = await indiaRes.json();
        if (indiaData.status === 1 && indiaData.product) {
          const p = indiaData.product;
          const title =
            p.product_name || p.product_name_en || p.product_name_in || p.generic_name || "";
          if (title) {
            log.info("India OFF hit", { title });
            return NextResponse.json({
              items: [{
                title,
                brand: p.brands?.split(",")?.[0]?.trim() || p.brand_owner || "",
                size: p.quantity || "",
                category: p.categories || "",
              }],
            });
          }
        }
      }
      log.warn("India OFF returned no product");
    } catch (e) {
      log.warn("India OFF fetch failed", { error: String(e) });
    }

    // ── 3. Fallback: Global OFF server ──────────────────────────────
    try {
      const globalRes = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${upc}.json?fields=${OFF_FIELDS}`
      );
      if (globalRes.ok) {
        const globalData = await globalRes.json();
        if (globalData.status === 1 && globalData.product) {
          const p = globalData.product;
          const title =
            p.product_name || p.product_name_en || p.product_name_in || p.generic_name || "";
          if (title) {
            log.info("Global OFF hit", { title });
            return NextResponse.json({
              items: [{
                title,
                brand: p.brands?.split(",")?.[0]?.trim() || p.brand_owner || "",
                size: p.quantity || "",
                category: p.categories || "",
              }],
            });
          }
        }
      }
      log.warn("Global OFF returned no product");
    } catch (e) {
      log.warn("Global OFF fetch failed", { error: String(e) });
    }

    // ── All sources exhausted ───────────────────────────────────────
    log.warn("All lookup sources exhausted for UPC", { upc });
    return NextResponse.json({ items: [] });

  } catch (error: any) {
    log.error("Unhandled UPC lookup error", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return NextResponse.json({ error: "Failed to fetch from UPC registry" }, { status: 500 });
  }
}