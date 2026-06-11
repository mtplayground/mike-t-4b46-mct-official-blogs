import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "myClawTeam Official Blogs",
    template: "%s | myClawTeam Official Blogs",
  },
  description: "Updates, announcements, and engineering notes from myClawTeam.",
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
