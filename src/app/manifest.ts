import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nutri-Trust — Smart Pantry",
    short_name: "Nutri-Trust",
    description: "Track expiry, scan barcodes, and cut food waste with AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfb",
    theme_color: "#111111",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
