"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage can throw in a private window - fall through to system preference.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Per-viewer convenience only - a failed write just means the choice
    // won't persist across reloads, nothing else depends on it.
  }
}

export function ThemeToggle() {
  // Starts null so the very first client render matches the server
  // (neither icon), then resolves to whatever the blocking script in
  // app/layout.tsx already applied - no flash, no hydration mismatch.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Reads localStorage/matchMedia, both browser-only - can't be done in
    // a lazy useState initializer, since this component still renders
    // once on the server first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={theme === null}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
