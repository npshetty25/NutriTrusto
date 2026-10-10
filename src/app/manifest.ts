import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity. Without `id` the browser derives one from start_url,
    // so moving the start URL later would make installs look like a new app.
    id: "/",
    name: "Nutri-Trust — Smart Pantry",
    short_name: "Nutri-Trust",
    description: "Track expiry, scan barcodes, and cut food waste with AI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-IN",
    categories: ["food", "lifestyle", "health"],
    // The splash screen is painted in background_color before the first
    // frame, so it has to be the page's real light background (#e9ebf1 in
    // globals.css) — the old #fbfbfb flashed a different grey.
    background_color: "#e9ebf1",
    theme_color: "#111111",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
