import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-screen antialiased" suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <AuthProvider>
          <main className="flex-1 w-full max-w-md mx-auto min-h-screen relative shadow-2xl bg-card/30">
            {children}
            <Toaster position="top-center" theme="system" style={{ zIndex: 45 }} toastOptions={{ className: 'border-foreground/10 rounded-2xl' }} />
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
