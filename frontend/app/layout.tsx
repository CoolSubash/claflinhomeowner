import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeReady AI",
  description: "Home-buying readiness assessment platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
