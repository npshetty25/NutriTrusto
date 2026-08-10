import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/auth-context";
import { AppToaster } from "@/components/app-toaster";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutri-Trust | Automated Pantry System",
  description: "Stop wasting food and track your groceries intelligently.",
  other: {
    // Inter font loaded via CSS link to avoid next/font/google network fetch at build time
    // (known Turbopack bug in Next.js 16.2.x)
  },
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
