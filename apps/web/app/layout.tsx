import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "./components/app-providers";
import "./globals.css";

/** DB-backed pages need request-time env; avoid build-time static collection failures. */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Vela",
  description: "Cloud-native operating system for AI agents",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  themeColor: "#07090c",
  appleWebApp: {
    capable: true,
    title: "Vela",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Vela",
    description: "Cloud-native operating system for AI agents",
    type: "website",
    siteName: "Vela",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vela",
    description: "Cloud-native operating system for AI agents",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
