"use client";

import { useEffect, useState } from "react";

/**
 * Toggle between Dark Fantasy (default) and Light Fantasy themes by
 * adding a class to <html>:
 *   .dark-fantasy   — default; matches the bare :root variables.
 *   .light-fantasy  — overrides the same variables with parchment hues.
 *
 * The chosen theme is persisted to localStorage so it survives reloads
 * and applies before paint via a tiny inline script in app/layout.tsx
 * (set during initial HTML response, no flash).
 */

type Theme = "dark-fantasy" | "light-fantasy";

const STORAGE_KEY = "ironatlas.theme";

function readInitial(): Theme {
  if (typeof document === "undefined") return "dark-fantasy";
  return document.documentElement.classList.contains("light-fantasy")
    ? "light-fantasy"
    : "dark-fantasy";
}

function apply(theme: Theme) {
  const html = document.documentElement;
  html.classList.toggle("light-fantasy", theme === "light-fantasy");
  html.classList.toggle("dark-fantasy", theme === "dark-fantasy");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — ignore */
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark-fantasy");
  const [mounted, setMounted] = useState(false);

  // Sync state to whatever the inline-init script applied.
  useEffect(() => {
    setTheme(readInitial());
    setMounted(true);
  }, []);

  function flip() {
    const next: Theme = theme === "dark-fantasy" ? "light-fantasy" : "dark-fantasy";
    setTheme(next);
    apply(next);
  }

  // Render an invisible-but-sized placeholder on the server so the
  // header layout stays identical and the swap happens once mounted.
  if (!mounted) {
    return (
      <button
        aria-hidden
        className="h-9 w-9 rounded border border-bronze-deep opacity-0"
        tabIndex={-1}
      />
    );
  }

  const isLight = theme === "light-fantasy";
  return (
    <button
      type="button"
      onClick={flip}
      title={isLight ? "Switch to Dark Fantasy" : "Switch to Light Fantasy"}
      aria-label="Toggle theme"
      className="h-9 w-9 rounded border border-bronze-deep hover:border-bronze flex items-center justify-center text-gold transition"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      {isLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
