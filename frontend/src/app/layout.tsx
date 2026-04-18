import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-ui-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Surveillance System",
  description: "A monochrome missing-person surveillance console with guided uploads, live streams, alerts, and evidence export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-black">{children}</body>
    </html>
  );
}
