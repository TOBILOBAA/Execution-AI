import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupabaseAuthSync } from "@/components/SupabaseAuthSync";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Execution AI",
  description: "AI-assisted execution and accountability platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Execution AI",
  },
};

export const viewport: Viewport = {
  themeColor: "#006c4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap");
          @import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200");
        `}</style>
      </head>
      <body
        className="antialiased"
        style={{
          "--font-headline": "Manrope, sans-serif",
          "--font-body": "Inter, sans-serif",
          "--font-label": "Inter, sans-serif",
        } as CSSProperties}
      >
        <SupabaseAuthSync />
        {children}
      </body>
    </html>
  );
}
