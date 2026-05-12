"use client";

import { useMemo, useState } from "react";
import Model, { type IExerciseData, type Muscle } from "react-body-highlighter";
import {
  ZONE_LABEL,
  type MuscleGroup,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";
import { useHeatmapPalette } from "@/components/HeatmapColorContext";

type Props = {
  view: "front" | "back";
  levels: Partial<Record<MuscleGroup, StrengthLevel>>;
  onMuscleClick?: (muscle: MuscleGroup) => void;
};

// =====================================================================
// Visual layer — heatmap colors driven by react-body-highlighter
// =====================================================================
const ZONE_TO_MUSCLES: Record<Zone, Muscle[]> = {
  chest: ["chest"],
  back: ["trapezius", "upper-back", "lower-back"],
  shoulders: ["front-deltoids", "back-deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

// HIGHLIGHTED_COLORS is now derived per-render from the active
// heatmap palette inside the component below.

const LEVEL_TO_FREQ: Record<StrengthLevel, number> = {
  untrained: 0,
  below: 1,
  average: 2,
  above: 3,
  exceptional: 4,
  elite: 5,
};

function buildData(
  zoneLevels: Partial<Record<Zone, StrengthLevel>>
): IExerciseData[] {
  const data: IExerciseData[] = [];
  (Object.keys(ZONE_TO_MUSCLES) as Zone[]).forEach((zone) => {
    const lvl = zoneLevels[zone] ?? "untrained";
    const freq = LEVEL_TO_FREQ[lvl];
    if (freq === 0) return;
    data.push({
      name: zone,
      muscles: ZONE_TO_MUSCLES[zone],
      frequency: freq,
    });
  });
  return data;
}

// =====================================================================
// Hitbox layer — invisible ellipses, ONE region per zone.
// Coordinates are in the same 100 x 200 viewBox the visual layer uses.
// =====================================================================
type Region = {
  zone: Zone;
  // Each region has 1+ ellipse hitboxes (limbs have L+R, central zones have one)
  ellipses: Array<{ cx: number; cy: number; rx: number; ry: number }>;
};

const FRONT_REGIONS: Region[] = [
  { zone: "chest", ellipses: [{ cx: 50, cy: 49, rx: 22, ry: 11 }] },
  { zone: "abs", ellipses: [{ cx: 50, cy: 84, rx: 17, ry: 27 }] },
  {
    zone: "shoulders",
    ellipses: [
      { cx: 24, cy: 44, rx: 8, ry: 9 },
      { cx: 76, cy: 44, rx: 8, ry: 9 },
    ],
  },
  {
    zone: "biceps",
    ellipses: [
      { cx: 24, cy: 62, rx: 8, ry: 11 },
      { cx: 76, cy: 62, rx: 8, ry: 11 },
    ],
  },
  {
    zone: "forearms",
    ellipses: [
      { cx: 11, cy: 87, rx: 10, ry: 16 },
      { cx: 89, cy: 87, rx: 10, ry: 16 },
    ],
  },
  {
    zone: "quads",
    ellipses: [
      { cx: 33, cy: 122, rx: 11, ry: 26 },
      { cx: 67, cy: 122, rx: 11, ry: 26 },
    ],
  },
  {
    zone: "calves",
    ellipses: [
      { cx: 29, cy: 175, rx: 10, ry: 22 },
      { cx: 71, cy: 175, rx: 10, ry: 22 },
    ],
  },
];

const BACK_REGIONS: Region[] = [
  { zone: "back", ellipses: [{ cx: 50, cy: 62, rx: 22, ry: 42 }] },
  { zone: "glutes", ellipses: [{ cx: 50, cy: 112, rx: 22, ry: 14 }] },
  {
    zone: "shoulders",
    ellipses: [
      { cx: 23, cy: 46, rx: 8, ry: 10 },
      { cx: 77, cy: 46, rx: 8, ry: 10 },
    ],
  },
  {
    zone: "triceps",
    ellipses: [
      { cx: 22, cy: 66, rx: 9, ry: 17 },
      { cx: 78, cy: 66, rx: 9, ry: 17 },
    ],
  },
  {
    zone: "forearms",
    ellipses: [
      { cx: 11, cy: 93, rx: 10, ry: 16 },
      { cx: 89, cy: 93, rx: 10, ry: 16 },
    ],
  },
  {
    zone: "hamstrings",
    ellipses: [
      { cx: 35, cy: 145, rx: 11, ry: 22 },
      { cx: 65, cy: 145, rx: 11, ry: 22 },
    ],
  },
  {
    zone: "calves",
    ellipses: [
      { cx: 32, cy: 178, rx: 9, ry: 20 },
      { cx: 68, cy: 178, rx: 9, ry: 20 },
    ],
  },
];

export default function BodySVG({ view, levels, onMuscleClick }: Props) {
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const palette = useHeatmapPalette();
  const highlightedColors = useMemo(
    () => [
      palette.scale.below,
      palette.scale.average,
      palette.scale.above,
      palette.scale.exceptional,
      palette.scale.elite,
    ],
    [palette]
  );
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;

  return (
    <div className="relative h-full w-full select-none flex items-center justify-center">
      {/* Mystical energy emanating from the character — deep, subtle, purple. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 30% 45% at 50% 50%, rgba(91,57,147,0.28) 0%, rgba(40,30,60,0.10) 45%, transparent 75%)",
          filter: "blur(24px)",
        }}
      />

      {/* Tooltip */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 top-2 z-30 px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-semibold text-gold bg-panel border border-bronze rounded pointer-events-none transition-opacity duration-150 ${
          hoveredZone ? "opacity-100" : "opacity-0"
        }`}
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {hoveredZone ? ZONE_LABEL[hoveredZone] : ""}
      </div>

      {/* Figure: height-driven box. The library's intrinsic SVG already
         includes head, hands, and feet — letting it render at natural
         scale (no transform) keeps the entire figure inside the box. */}
      <div
        className="relative h-full"
        style={{ aspectRatio: "0.5 / 1" }}
      >
        {/* LAYER 1 — visual figure */}
        <div
          className="body-visual absolute inset-0"
          style={{
            filter:
              "drop-shadow(0 0 18px rgba(91, 57, 147, 0.22)) drop-shadow(0 6px 24px rgba(0, 0, 0, 0.75))",
          }}
        >
          <Model
            type={view === "front" ? "anterior" : "posterior"}
            data={buildData(levels)}
            bodyColor="#0a0a0f"
            highlightedColors={highlightedColors}
            style={{ width: "100%", height: "100%" }}
            svgStyle={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* LAYER 2 — hitbox SVG, sits flush over the figure */}
        <svg
          viewBox="0 0 100 200"
          className="absolute inset-0 w-full h-full z-10"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          {regions.map((r) => {
            const isHovered = hoveredZone === r.zone;
            return (
              <g
                key={`${view}-${r.zone}`}
                onMouseEnter={() => setHoveredZone(r.zone)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => onMuscleClick?.(r.zone)}
                style={{ cursor: "pointer" }}
              >
                {r.ellipses.map((e, i) => (
                  <ellipse
                    key={i}
                    cx={e.cx}
                    cy={e.cy}
                    rx={e.rx}
                    ry={e.ry}
                    fill={
                      isHovered
                        ? "rgba(184, 134, 11, 0.14)"
                        : "transparent"
                    }
                    /* Keep stroke geometry constant — only the color
                       toggles on hover. Changing strokeWidth on hover
                       caused the stroke to snap into existence and
                       flicker as the cursor crossed shape edges. */
                    stroke={
                      isHovered
                        ? "rgba(139, 115, 85, 0.7)"
                        : "transparent"
                    }
                    strokeWidth={0.5}
                    style={{
                      pointerEvents: "all",
                      transition: "fill 150ms ease, stroke 150ms ease",
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
