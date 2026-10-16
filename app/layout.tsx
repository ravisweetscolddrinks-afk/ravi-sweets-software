import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ravi Sweets Chirala - Management Software",
  description: "Retail POS, Manufacturing, Stock & Employee Management Console",
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
