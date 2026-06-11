import type { Metadata } from "next";
import "./globals.css";

import { absoluteSiteUrl, defaultDescription, siteName } from "@/lib/metadata";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  openGraph: {
    title: siteName,
    description: defaultDescription,
    siteName,
    type: "website",
    url: absoluteSiteUrl(),
    images: [
      {
        url: absoluteSiteUrl("/images/editorial-hero.png"),
        width: 1744,
        height: 902,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: [absoluteSiteUrl("/images/editorial-hero.png")],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
