"use client";

import { useState } from "react";

/**
 * Journey Compass Wheel — fantasy compass-rose visualization for the
 * last 30 days of step data.
 *
 *  • Outer ring: 30 wedge segments. Index 0 = today (top, 12 o'clock).
 *    Each subsequent index moves clockwise into the past.
 *  • Inner ring: last 7 days. Same orientation; today at top.
 *  • Center: today's step count + goal.
 *  • Cardinal markers (N/S/E/W) painted as decorative compass points.
 *  • Slow rotation animation on the segment groups only — the center
 *    text and cardinal markers stay still so today's count remains
 *    legible.
 */
export type CompassDay = {
  date: string;
  steps: number;
};

const SIZE = 400;
const CENTER = SIZE / 2;
const OUTER_R_OUT = 195;
const OUTER_R_IN = 145;
const INNER_R_OUT = 130;
const INNER_R_IN = 80;

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

function colorFor(steps: number, goal: number): {
  fill: string;
  stroke: string;
  glow: boolean;
} {
  if (steps <= 0)
    return { fill: "rgba(58, 51, 64, 0.6)", stroke: "#3a3340", glow: false };
  if (steps >= goal)
    return { fill: "rgba(168, 85, 247, 0.55)", stroke: "#a855f7", glow: true };
  return { fill: "rgba(58, 90, 138, 0.45)", stroke: "#3a5a8a", glow: false };
}

function pointAt(cx: number, cy: number, r: number, deg: number) {
  // 0° at top (12 o'clock), increases clockwise.
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number
): string {
  const p1 = pointAt(cx, cy, rIn, startDeg);
  const p2 = pointAt(cx, cy, rOut, startDeg);
  const p3 = pointAt(cx, cy, rOut, endDeg);
  const p4 = pointAt(cx, cy, rIn, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    "Z",
  ].join(" ");
}

export default function CompassWheel({
  days30,
  days7,
  todaySteps,
  goal,
}: {
  /** Newest first. days30[0] = today. */
  days30: CompassDay[];
  /** Newest first. days7[0] = today. */
  days7: CompassDay[];
  todaySteps: number;
  goal: number;
}) {
  const [hovered, setHovered] = useState<{
    label: string;
    steps: number;
    x: number;
    y: number;
  } | null>(null);

  const goalPct = goal > 0 ? Math.min(1, todaySteps / goal) : 0;
  const goalMet = todaySteps >= goal;

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 w-full h-full"
        aria-label="Journey compass — last 30 days of steps"
      >
        <defs>
          <radialGradient id="compass-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(40, 30, 60, 0.55)" />
            <stop offset="70%" stopColor="rgba(20, 14, 30, 0.35)" />
            <stop offset="100%" stopColor="rgba(8, 8, 16, 0)" />
          </radialGradient>
        </defs>

        {/* Aged-stone backdrop */}
        <circle cx={CENTER} cy={CENTER} r={SIZE / 2 - 4} fill="url(#compass-bg)" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={SIZE / 2 - 6}
          fill="none"
          stroke="#6b4f3a"
          strokeWidth="1.5"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={SIZE / 2 - 18}
          fill="none"
          stroke="rgba(139, 115, 85, 0.45)"
          strokeWidth="0.6"
        />

        {/* Slow rotation only on the segment groups */}
        <g className="compass-rotate">
          {/* Outer ring — 30 day-segments */}
          {Array.from({ length: 30 }).map((_, i) => {
            const segStart = i * 12;
            const segEnd = (i + 1) * 12;
            const day = days30[i] ?? { date: "", steps: 0 };
            const c = colorFor(day.steps, goal);
            const path = wedgePath(
              CENTER,
              CENTER,
              OUTER_R_IN,
              OUTER_R_OUT,
              segStart,
              segEnd
            );
            // Place tooltip anchor at the wedge's mid radius.
            const mid = pointAt(
              CENTER,
              CENTER,
              (OUTER_R_IN + OUTER_R_OUT) / 2,
              segStart + 6
            );
            return (
              <path
                key={`out-${i}`}
                d={path}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="0.5"
                style={
                  c.glow
                    ? { filter: `drop-shadow(0 0 4px ${c.stroke})` }
                    : undefined
                }
                onMouseEnter={() =>
                  setHovered({
                    label: day.date || `${i}d ago`,
                    steps: day.steps,
                    x: mid.x,
                    y: mid.y,
                  })
                }
                onMouseLeave={() => setHovered(null)}
              >
                <title>
                  {day.date || `${i}d ago`}: {day.steps.toLocaleString()} steps
                </title>
              </path>
            );
          })}

          {/* Inner ring — 7 week-segments */}
          {Array.from({ length: 7 }).map((_, i) => {
            const segStart = (i / 7) * 360;
            const segEnd = ((i + 1) / 7) * 360;
            const day = days7[i] ?? { date: "", steps: 0 };
            const c = colorFor(day.steps, goal);
            const path = wedgePath(
              CENTER,
              CENTER,
              INNER_R_IN,
              INNER_R_OUT,
              segStart,
              segEnd
            );
            return (
              <path
                key={`in-${i}`}
                d={path}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="0.7"
                style={
                  c.glow
                    ? { filter: `drop-shadow(0 0 6px ${c.stroke})` }
                    : undefined
                }
              >
                <title>
                  {day.date || `${i}d ago`}: {day.steps.toLocaleString()} steps
                </title>
              </path>
            );
          })}
        </g>

        {/* Cardinal markers (do NOT rotate) */}
        {(["N", "E", "S", "W"] as const).map((dir, i) => {
          const angle = i * 90;
          const p = pointAt(CENTER, CENTER, OUTER_R_OUT + 14, angle);
          return (
            <text
              key={dir}
              x={p.x}
              y={p.y}
              fill="#b8860b"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="700"
              style={{
                ...fontDisplay,
                letterSpacing: "0.2em",
                textShadow: "0 0 8px rgba(184,134,11,0.55)",
              }}
            >
              {dir}
            </text>
          );
        })}

        {/* Center medallion — today's count */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R_IN - 4}
          fill="#0c0c18"
          stroke={goalMet ? "#a855f7" : "#6b4f3a"}
          strokeWidth="1.5"
          style={
            goalMet
              ? { filter: "drop-shadow(0 0 14px rgba(168, 85, 247, 0.5))" }
              : undefined
          }
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R_IN - 8}
          fill="none"
          stroke={goalMet ? "#a855f7" : "#3a3340"}
          strokeOpacity="0.5"
          strokeWidth="0.6"
        />

        <text
          x={CENTER}
          y={CENTER - 8}
          textAnchor="middle"
          fontSize="32"
          fontWeight="700"
          fill={goalMet ? "#d4a020" : "#d8d2c2"}
          style={{
            ...fontDisplay,
            textShadow: goalMet
              ? "0 0 12px rgba(184,134,11,0.7)"
              : "0 1px 0 rgba(0,0,0,0.7)",
          }}
        >
          {todaySteps.toLocaleString()}
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          fontSize="10"
          fill="#8b8275"
          style={{
            ...fontDisplay,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          / {goal.toLocaleString()} goal
        </text>
        <text
          x={CENTER}
          y={CENTER + 30}
          textAnchor="middle"
          fontSize="10"
          fill={goalMet ? "#a855f7" : "#5a5246"}
          style={{
            ...fontDisplay,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {Math.round(goalPct * 100)}%
        </text>
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[10px] uppercase tracking-[0.18em] font-bold"
          style={{
            ...fontDisplay,
            left: hovered.x,
            top: hovered.y,
            transform: "translate(-50%, -120%)",
            background: "#0c0c18",
            border: "1px solid #6b4f3a",
            color: "#d8d2c2",
            boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }}
        >
          {hovered.label}{" "}
          <span className="text-gold tabular-nums">
            · {hovered.steps.toLocaleString()}
          </span>
        </div>
      )}

      {/* Slow rotation animation, scoped to this component. */}
      <style jsx>{`
        :global(.compass-rotate) {
          transform-origin: ${CENTER}px ${CENTER}px;
          animation: compass-spin 21600s linear infinite;
        }
        @keyframes compass-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.compass-rotate) { animation: none; }
        }
      `}</style>
    </div>
  );
}
