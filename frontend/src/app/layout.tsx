import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SupabaseAuthSync } from "@/components/SupabaseAuthSync";
import type { CSSProperties } from "react";

const plusJakarta = localFont({
  src: [
    {
      path: "./fonts/PlusJakartaSans-VariableFont_wght.ttf",
      style: "normal",
      weight: "200 800",
    },
    {
      path: "./fonts/PlusJakartaSans-Italic-VariableFont_wght.ttf",
      style: "italic",
      weight: "200 800",
    },
  ],
  variable: "--font-jakarta",
});

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
          @import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200");
        `}</style>
      </head>
      <body
        className={`${plusJakarta.variable} antialiased`}
        style={{
          "--font-headline": "var(--font-jakarta), sans-serif",
          "--font-body": "var(--font-jakarta), sans-serif",
          "--font-label": "var(--font-jakarta), sans-serif",
        } as CSSProperties}
      >
        <SupabaseAuthSync />
        {children}
      </body>
    </html>
  );
}
