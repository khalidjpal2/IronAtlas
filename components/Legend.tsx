"use client";

import { useHeatmapPalette } from "@/components/HeatmapColorContext";

// Continuous gradient bar — communicates that the heatmap is a single
// hue ramp (Untrained → Elite) rather than discrete colored buckets.
// Reads the active palette from context so picking a new color in the
// header redraws this bar in the chosen hue.
export default function Legend() {
  const { scale } = useHeatmapPalette();
  const gradient = `linear-gradient(90deg, ${scale.untrained} 0%, ${scale.below} 20%, ${scale.average} 40%, ${scale.above} 60%, ${scale.exceptional} 80%, ${scale.elite} 100%)`;
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 bg-elevated border border-bronze-deep rounded"
      style={{
        fontFamily: "var(--font-cinzel), Georgia, serif",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.20em] font-bold shrink-0"
        style={{ color: "#8a7c92", letterSpacing: "0.20em" }}
      >
        Untrained
      </span>
      <div
        className="flex-1 rounded-full"
        style={{
          height: 8,
          minWidth: 120,
          background: gradient,
          boxShadow:
            "inset 0 1px 2px rgba(0,0,0,0.55), 0 0 8px rgba(168,85,247,0.18)",
        }}
        aria-label="Strength level scale: Untrained on the left, Elite on the right"
      />
      <span
        className="text-[9px] uppercase tracking-[0.20em] font-bold shrink-0"
        style={{
          color: scale.elite,
          letterSpacing: "0.20em",
          textShadow: `0 0 6px ${scale.elite}66`,
        }}
      >
        Elite
      </span>
    </div>
  );
}
