"use client";

import { useTheme } from "./useTheme";

export type ChartPalette = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  cursor: string;

  barMet: string;
  barUnder: string;
  barOver: string;

  line: string;
  areaStroke: string;
  areaFillFrom: string;
  areaFillTo: string;
  goalLine: string;

  protein: string;
  carbs: string;
  fat: string;

  /**
   * Vivid macro colors used by the combined Provisions weekly chart
   * (each bar segment painted as its caloric contribution). Distinct
   * from `protein/carbs/fat` so the dashboard cards can stay subtle.
   */
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
};

const DARK: ChartPalette = {
  grid: "#1e1e3a",
  axis: "#5a5246",
  tooltipBg: "#0c0c18",
  tooltipBorder: "#2a2a4a",
  tooltipText: "#d8d2c2",
  cursor: "rgba(184, 134, 11, 0.06)",

  barMet: "#5b3993",
  barUnder: "#3a5a8a",
  barOver: "#a0432a",

  line: "#8b5cf6",
  areaStroke: "#a878d0",
  areaFillFrom: "rgba(139, 92, 246, 0.40)",
  areaFillTo: "rgba(139, 92, 246, 0)",
  goalLine: "#b8860b",

  protein: "#4a72a8",
  carbs: "#4d7e4a",
  fat: "#b8860b",

  macroProtein: "#ef4444",
  macroCarbs: "#22c55e",
  macroFat: "#eab308",
};

const LIGHT: ChartPalette = {
  grid: "#e8dfd0",
  axis: "#6b5a47",
  tooltipBg: "#fffdf7",
  tooltipBorder: "#d4b896",
  tooltipText: "#1c1410",
  cursor: "rgba(217, 119, 6, 0.10)",

  barMet: "#7c3aed",
  barUnder: "#059669",
  barOver: "#d97706",

  line: "#7c3aed",
  areaStroke: "#7c3aed",
  areaFillFrom: "rgba(124, 58, 237, 0.18)",
  areaFillTo: "rgba(124, 58, 237, 0)",
  goalLine: "#d97706",

  protein: "#2563eb",
  carbs: "#059669",
  fat: "#d97706",

  macroProtein: "#dc2626",
  macroCarbs: "#16a34a",
  macroFat: "#d97706",
};

export function useChartPalette(): ChartPalette {
  const t = useTheme();
  return t === "light" ? LIGHT : DARK;
}

export function tooltipStyle(p: ChartPalette): React.CSSProperties {
  return {
    background: p.tooltipBg,
    border: `1px solid ${p.tooltipBorder}`,
    borderRadius: 6,
    fontSize: 12,
    color: p.tooltipText,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.18)",
  };
}
