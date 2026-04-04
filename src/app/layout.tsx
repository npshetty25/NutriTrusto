import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nutri-Trust | Automated Pantry System",
  description: "Stop wasting food and track your groceries intelligently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} min-h-screen antialiased`}>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <AuthProvider>
          <main className="flex-1 w-full max-w-md mx-auto min-h-screen relative shadow-2xl bg-card/30">
            {children}
            <Toaster position="top-center" theme="system" toastOptions={{ className: 'border-foreground/10 rounded-2xl' }} />
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
