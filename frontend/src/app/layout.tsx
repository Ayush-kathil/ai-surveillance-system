import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { WorkflowProvider } from "./workflow-provider";

const sora = Sora({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ui-mono",
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${sora.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-black">
        <WorkflowProvider>{children}</WorkflowProvider>
      </body>
    </html>
  );
}
