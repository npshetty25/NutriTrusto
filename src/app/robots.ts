import type { MetadataRoute } from "next";

// The API routes are not content, and /recipes is generated per pantry, so
// neither belongs in an index. Everything else is public and crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: "https://nutri-trusto.vercel.app/sitemap.xml",
  };
}
