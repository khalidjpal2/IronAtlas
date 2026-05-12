"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_BASE_COLOR,
  generateGlowScale,
  generateGradientScale,
  generateMonochromeScale,
  isValidHex,
  normalizeHex,
} from "@/lib/heatmap-color";
import type { StrengthLevel } from "@/lib/strength";

const STORAGE_KEY = "ironatlas.heatmapColor";

type HeatmapPalette = {
  base: string;
  scale: Record<StrengthLevel, string>;
  glow: Record<StrengthLevel, string>;
  gradient: Record<StrengthLevel, string>;
  setBase: (hex: string) => void;
};

const HeatmapContext = createContext<HeatmapPalette | null>(null);

export function HeatmapColorProvider({
  children,
  initialColor,
}: {
  children: ReactNode;
  initialColor?: string;
}) {
  // Default to the SSR-safe constant. The first useEffect below reads
  // localStorage and updates if the user has a stored choice.
  const [base, setBaseState] = useState<string>(
    initialColor && isValidHex(initialColor)
      ? normalizeHex(initialColor)
      : DEFAULT_BASE_COLOR
  );

  // On mount, hydrate from localStorage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isValidHex(stored)) {
        setBaseState(normalizeHex(stored));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Cross-tab + cross-component sync — listen to storage events so a
  // change made in another tab (or via the picker on the dashboard)
  // updates everywhere.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      if (isValidHex(e.newValue)) setBaseState(normalizeHex(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setBase = useCallback((hex: string) => {
    if (!isValidHex(hex)) return;
    const next = normalizeHex(hex);
    setBaseState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<HeatmapPalette>(
    () => ({
      base,
      scale: generateMonochromeScale(base),
      glow: generateGlowScale(base),
      gradient: generateGradientScale(base),
      setBase,
    }),
    [base, setBase]
  );

  return (
    <HeatmapContext.Provider value={value}>{children}</HeatmapContext.Provider>
  );
}

/**
 * Returns the active heatmap palette. Falls back to the default purple
 * scale when used outside a provider so static / prerendered consumers
 * still render something coherent.
 */
export function useHeatmapPalette(): HeatmapPalette {
  const ctx = useContext(HeatmapContext);
  // Stable fallback for cases where the provider isn't mounted (e.g.
  // very deep test renders).
  const fallback = useMemo<HeatmapPalette>(
    () => ({
      base: DEFAULT_BASE_COLOR,
      scale: generateMonochromeScale(DEFAULT_BASE_COLOR),
      glow: generateGlowScale(DEFAULT_BASE_COLOR),
      gradient: generateGradientScale(DEFAULT_BASE_COLOR),
      setBase: () => {},
    }),
    []
  );
  return ctx ?? fallback;
}
