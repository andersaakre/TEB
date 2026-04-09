import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Execs Brief™ — Executive Intelligence",
  description: "AI-synthesized morning briefing for executives. Latest news, prediction market signals, and topic-driven intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
