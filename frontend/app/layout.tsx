import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/hooks/use-auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Runs before hydration so the correct theme applies on first
            paint - no flash of the wrong theme, and no client/server
            markup mismatch for React to complain about (hence
            suppressHydrationWarning on <html>, scoped to just this). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
