import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ErrorReporter } from "@/components/ErrorReporter";
import { OpenFromNotification } from "@/components/push/OpenFromNotification";
import "./globals.css";

const marquee = Anton({
  variable: "--font-marquee",
  weight: "400",
  subsets: ["latin"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://moviehorsegame.com"),
  title: "Movie Horse — Don't spell M-O-V-I-E",
  description: "Name the actor. Name the movie. Don't spell M-O-V-I-E. A new chain every day.",
  appleWebApp: { capable: true, title: "Movie Horse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0908",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${marquee.variable} ${body.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        {children}
        <OpenFromNotification />
        <ErrorReporter />
        <Analytics />
      </body>
    </html>
  );
}
