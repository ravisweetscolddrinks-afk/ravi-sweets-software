import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sora",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#348bdd",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Ravi Sweets Chirala - Management Software",
  description: "Retail POS, Manufacturing, Stock & Employee Management Console",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo.png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: [
      { url: "/logo.png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ravi Sweets",
  },
  other: {
    "msapplication-TileImage": "/logo.png",
    "msapplication-TileColor": "#348bdd",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="min-h-screen antialiased bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
