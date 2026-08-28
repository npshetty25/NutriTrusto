import type { MetadataRoute } from "next";

const SITE_URL = "https://nutri-trusto.vercel.app";

// Only the two routes that render something meaningful without an account.
// The dashboard is behind auth, so listing it would put a sign-in wall in
// the index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
