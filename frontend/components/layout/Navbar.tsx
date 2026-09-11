"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { CloseIcon, MenuIcon, Spinner } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assessments", label: "Assessments" },
  { href: "/history", label: "My Progress" },
  { href: "/chat", label: "AI Assistant" },
  { href: "/profile", label: "Profile" },
];

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Navbar() {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const authenticated = status === "authenticated";
  const links = authenticated ? APP_LINKS : PUBLIC_LINKS;
  const homeHref = authenticated ? "/dashboard" : "/";

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    setMobileOpen(false);
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6" aria-label="Primary">
        <Link href={homeHref} className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            H
          </span>
          HomeReady AI
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          {status === "loading" && <Spinner className="h-5 w-5 text-slate-400" />}

          {status === "unauthenticated" && (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Get started
              </Link>
            </>
          )}

          {authenticated && user && (
            <>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 dark:bg-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {initials(user.first_name, user.last_name)}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {user.first_name}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {signingOut && <Spinner className="h-4 w-4" />}
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 sm:hidden"
        >
          {mobileOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            {status === "unauthenticated" && (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Get started
                </Link>
              </>
            )}

            {authenticated && user && (
              <>
                <div className="flex items-center gap-2 px-3 py-1 text-sm text-slate-600 dark:text-slate-300">
                  Signed in as <span className="font-medium">{user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                >
                  {signingOut && <Spinner className="h-4 w-4" />}
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
