import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/auth-context";
import { AppToaster } from "@/components/app-toaster";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// metadataBase resolves every relative URL below (canonical, OG image) to an
// absolute one. Without it Next emits relative og:image paths, which every
// social and chat unfurler rejects.
const SITE_URL = "https://nutri-trusto.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nutri-Trust — Smart Pantry for Indian Households",
    template: "%s | Nutri-Trust",
  },
  description:
    "Scan a barcode to understand what is in packaged food, track what is already in your pantry, and cook it before it spoils. Built for Indian kitchens.",
  applicationName: "Nutri-Trust",
  // Stops the www/non-www and trailing-slash variants competing with each
  // other for the same content.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Nutri-Trust",
    url: SITE_URL,
    title: "Nutri-Trust — Smart Pantry for Indian Households",
    description:
      "Scan packaged food, track expiry, and get Indian recipes that use what is about to spoil.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nutri-Trust — Smart Pantry for Indian Households",
    description:
      "Scan packaged food, track expiry, and get Indian recipes that use what is about to spoil.",
  },
  other: {
    // Inter font loaded via CSS link to avoid next/font/google network fetch at build time
    // (known Turbopack bug in Next.js 16.2.x)
  },
};

// Machine-readable facts for search and AI answer engines. Deliberately
// SoftwareApplication and not LocalBusiness: this is a free web app built as
// a university minor project, not a business with a storefront, and claiming
// otherwise would put a false address and phone number into the graph.
//
// No aggregateRating either. The app has no reviews, and inventing one is the
// exact failure mode the product's first principle exists to prevent.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Nutri-Trust",
      url: SITE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any (web browser)",
      description:
        "A smart pantry web app for Indian households: scan packaged food barcodes for a nutrition reading, track what is on the shelf and when it expires, and generate Indian recipes that use up what is about to spoil.",
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: [
        "Barcode scanning with nutrition interpretation",
        "Receipt and nutrition-label scanning",
        "Pantry expiry tracking",
        "Allergen detection from ingredient text",
        "Indian recipe generation from expiring items",
        "Household sharing and shopping list",
      ],
    },
    {
      "@type": "WebSite",
      name: "Nutri-Trust",
      url: SITE_URL,
      inLanguage: "en-IN",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

// Registered client-side (not via next-pwa or similar). Only included in
// production builds — decided here at render time via NODE_ENV, not with
// a client-side hostname check, since a LAN IP in dev (see
// allowedDevOrigins in next.config.ts) wouldn't match "localhost" either.
// A service worker intercepting fetches during `next dev` fights
// Turbopack's own HMR and caches stale modules.
// updateViaCache:'none' forces the browser to revalidate sw.js itself on
// every check instead of serving it from the HTTP cache — without it a new
// worker can go unnoticed for up to 24h. The controllerchange reload is
// guarded on there having been a controller already, because clients.claim()
// fires the same event on a first-ever install, where a reload would be a
// pointless flash on someone's first visit.
const SW_REGISTER_SCRIPT = `if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (reg) {
      reg.update();
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', function () {
        var next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', function () {
          if (next.state === 'installed' && navigator.serviceWorker.controller) next.postMessage('SKIP_WAITING');
        });
      });
      setInterval(function () { reg.update(); }, 900000);
    }).catch(function () {});
  });
}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-screen antialiased" suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {process.env.NODE_ENV === "production" && (
          <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <AuthProvider>
          <main className="flex-1 w-full max-w-md mx-auto min-h-screen relative">
            {children}
            <AppToaster />
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
