import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsApp Story Optimizer",
  description:
    "Optimize photos and videos in your browser before uploading to WhatsApp Status. No uploads, no server, no account.",
  applicationName: "WhatsApp Story Optimizer",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
