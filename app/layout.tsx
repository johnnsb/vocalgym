import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Serif_4, Public_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { AnalyticsProvider } from "./providers";

// Design-system type: Source Serif 4 for headlines / moments of address,
// Public Sans for body + all UI. Exposed as CSS vars consumed by app/styles/tokens.css.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-source-serif",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "VocalGym",
  description:
    "Practice for the conversations that matter. Generate a tailored script for any situation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${publicSans.variable}`}>
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        <AnalyticsProvider>
          <SiteHeader />
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
