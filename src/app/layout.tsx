import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { usingLiveSupabase } from "@/lib/repository";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heavy Highway Estimator",
  description: "DOT roadway bid estimating",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const live = usingLiveSupabase();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Heavy Highway Estimator
              </Link>
              <nav className="flex gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <Link href="/" className="hover:text-zinc-950 dark:hover:text-white">
                  Dashboard
                </Link>
                <Link href="/rates" className="hover:text-zinc-950 dark:hover:text-white">
                  Rate Library
                </Link>
                <Link href="/bid-items" className="hover:text-zinc-950 dark:hover:text-white">
                  Bid Item Library
                </Link>
              </nav>
            </div>
            {!live && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Local demo data (no Supabase configured)
              </span>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
