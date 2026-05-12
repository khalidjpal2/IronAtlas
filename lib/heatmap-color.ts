/**
 * User-configurable heatmap color scale.
 *
 * Given any base color (the "Elite" peak), generate a monochrome
 * 6-stop ramp from a near-black untrained state up to the full
 * saturated base. The scale is a linear mix in RGB space against a
 * very dark target color, which matches the user-supplied examples
 * for pink (#ec4899) and produces a clean monochrome heat-map effect
 * for any hue.
 *
 * The user's chosen base color is persisted in localStorage under
 * `ironatlas.heatmapColor`. Use the hook in HeatmapColorContext to
 * subscribe; this module is pure for SSR safety.
 */

import type { StrengthLevel } from "./strength";

export const DEFAULT_BASE_COLOR = "#a855f7";

export type ColorPreset = { id: string; label: string; hex: string };

export const PRESET_COLORS: ColorPreset[] = [
  { id: "purple", label: "Purple", hex: "#a855f7" },
  { id: "pink",   label: "Pink",   hex: "#ec4899" },
  { id: "blue",   label: "Blue",   hex: "#3b82f6" },
  { id: "red",    label: "Red",    hex: "#ef4444" },
  { id: "green",  label: "Green",  hex: "#22c55e" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "gold",   label: "Gold",   hex: "#f59e0b" },
  { id: "teal",   label: "Teal",   hex: "#14b8a6" },
];

// Per-tier (lightness, saturation) — the chosen base color contributes
// only its HUE; saturation and lightness come from this table so every
// shade stays clearly within the same color family. Untrained is a
// very pale pastel of the hue, Elite is a rich dark version. No level
// is allowed to drift toward black or gray.
const TIER_HSL: Record<StrengthLevel, { l: number; s: number }> = {
  untrained:   { l: 90, s: 80 }, // very light pastel
  below:       { l: 78, s: 85 }, // light pastel
  average:     { l: 65, s: 88 }, // medium light
  above:       { l: 52, s: 92 }, // medium / "true" hue
  exceptional: { l: 42, s: 94 }, // darker rich
  elite:       { l: 32, s: 95 }, // deepest, still saturated
};

export function isValidHex(input: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(input.trim());
}

export function normalizeHex(input: string): string {
  const t = input.trim();
  return t.startsWith("#") ? t.toLowerCase() : `#${t.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex).slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (c: number) => clamp255(c).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Convert hex → HSL. h in [0,360), s & l in [0,100].
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r1) h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
    else if (max === g1) h = (b1 - r1) / d + 2;
    else h = (r1 - g1) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

// Convert HSL → hex. Inputs: h in [0,360), s & l in [0,100].
function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Build the full 6-stop monochrome scale from a base color. The base
 * color contributes only its HUE; lightness and saturation come from
 * the TIER_HSL table so every level stays clearly in the same color
 * family — Untrained is a pale pastel, Elite is a deep rich version,
 * no level drifts toward black or gray.
 */
export function generateMonochromeScale(
  baseHex: string
): Record<StrengthLevel, string> {
  if (!isValidHex(baseHex)) baseHex = DEFAULT_BASE_COLOR;
  const { h } = hexToHsl(normalizeHex(baseHex));
  const out = {} as Record<StrengthLevel, string>;
  (Object.entries(TIER_HSL) as Array<
    [StrengthLevel, { l: number; s: number }]
  >).forEach(([level, { l, s }]) => {
    out[level] = hslToHex(h, s, l);
  });
  return out;
}

/**
 * Generate a glow color (rgba) at a per-tier alpha. Used wherever
 * the old LEVEL_GLOW table fed shadow / box-shadow strings.
 */
export function generateGlowScale(
  baseHex: string
): Record<StrengthLevel, string> {
  if (!isValidHex(baseHex)) baseHex = DEFAULT_BASE_COLOR;
  const { r, g, b } = hexToRgb(baseHex);
  const alphas: Record<StrengthLevel, number> = {
    untrained: 0,
    below: 0.18,
    average: 0.24,
    above: 0.30,
    exceptional: 0.38,
    elite: 0.50,
  };
  const out = {} as Record<StrengthLevel, string>;
  (Object.entries(alphas) as Array<[StrengthLevel, number]>).forEach(
    ([lvl, a]) => {
      out[lvl] = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  );
  return out;
}

/**
 * Legacy gradient (top-bright → bottom-dark) per tier. Built from the
 * ramp so XP bars and skill-banner backgrounds match the active hue.
 */
export function generateGradientScale(
  baseHex: string
): Record<StrengthLevel, string> {
  const scale = generateMonochromeScale(baseHex);
  const lighten = (hex: string, t: number) => {
    const c = hexToRgb(hex);
    const blend = (channel: number) => channel * (1 - t) + 255 * t;
    return rgbToHex(blend(c.r), blend(c.g), blend(c.b));
  };
  const out = {} as Record<StrengthLevel, string>;
  (Object.keys(scale) as StrengthLevel[]).forEach((lvl) => {
    const top = lighten(scale[lvl], 0.18);
    const bottom = scale[lvl];
    out[lvl] = `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
  });
  return out;
}
