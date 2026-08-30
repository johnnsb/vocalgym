import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { AnalyticsProvider } from "./providers";

export const metadata: Metadata = {
  title: "VocalGym",
  description:
    "Practice for the conversations that matter. Generate a tailored script for any situation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AnalyticsProvider>
          <SiteHeader />
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
