"use client";

import { useEffect, useState } from "react";

/**
 * Returns the active theme by watching the class on <html>. Re-renders
 * any consumer when the theme toggle flips. SSR-safe (defaults to
 * "dark" until the client mounts and reads the actual class).
 */
export type Theme = "dark" | "light";

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light-fantasy")
    ? "light"
    : "dark";
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(read());
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return theme;
}
