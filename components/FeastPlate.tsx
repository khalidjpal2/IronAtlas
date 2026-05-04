"use client";

/**
 * Provisions Feast Plate — fantasy-feast pie plate visualization for the
 * day's macros.
 *
 *  • Three wedges on a circular plate:
 *      Carbs   — top, 40% of the plate (144°), green.
 *      Protein — bottom-left, 30% (108°), red.
 *      Fat     — bottom-right, 30% (108°), amber.
 *  • Each wedge has a dim "track" beneath it; the fill grows radially
 *    from the inner rim out to the plate edge as consumption climbs
 *    toward the macro goal.
 *  • Goal-met wedges glow; over-goal wedges tint ember-orange.
 *  • Center medallion shows the calorie total / goal.
 *  • Decorative fork & knife flank the plate; a small candle floats
 *    above the rim.
 */

const SIZE = 400;
const CENTER = SIZE / 2;
const PLATE_RIM_OUT = 196;
const PLATE_RIM_IN = 178;
const WEDGE_OUT = 168;
const WEDGE_IN = 88;
const MEDAL_R = 78;

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

// Wedge angular extents — degrees measured clockwise from 12 o'clock.
const SLICES = {
  carbs: { start: -72, end: 72 }, // 144° centered on top
  fat: { start: 72, end: 180 }, // 108° on bottom-right
  protein: { start: 180, end: 288 }, // 108° on bottom-left
} as const;

const COLOR = {
  carbs: { track: "rgba(45, 80, 50, 0.35)", fill: "#4d9e58", over: "#d97706" },
  fat: { track: "rgba(80, 60, 25, 0.35)", fill: "#d4a020", over: "#d97706" },
  protein: { track: "rgba(80, 35, 35, 0.35)", fill: "#c8443a", over: "#d97706" },
} as const;

function pointAt(cx: number, cy: number, r: number, deg: number) {
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

function ratio(value: number, goal: number | null): number {
  if (!goal || goal <= 0) return 0;
  return value / goal;
}

function Wedge({
  slice,
  value,
  goal,
  palette,
  label,
}: {
  slice: { start: number; end: number };
  value: number;
  goal: number | null;
  palette: { track: string; fill: string; over: string };
  label: string;
}) {
  const r = ratio(value, goal);
  const visualR = Math.min(1, r);
  const fillR = WEDGE_IN + (WEDGE_OUT - WEDGE_IN) * visualR;
  const goalMet = goal != null && r >= 1;
  const over = goal != null && r > 1.05;
  const fillColor = over ? palette.over : palette.fill;

  return (
    <g aria-label={label}>
      {/* Track */}
      <path
        d={wedgePath(CENTER, CENTER, WEDGE_IN, WEDGE_OUT, slice.start, slice.end)}
        fill={palette.track}
        stroke="#3a2a18"
        strokeWidth="0.6"
      />
      {/* Fill */}
      {visualR > 0 && (
        <path
          d={wedgePath(CENTER, CENTER, WEDGE_IN, fillR, slice.start, slice.end)}
          fill={fillColor}
          stroke={fillColor}
          strokeWidth="0.4"
          style={
            goalMet
              ? { filter: `drop-shadow(0 0 8px ${fillColor})` }
              : undefined
          }
        >
          <title>
            {label}: {Math.round(value)}
            {goal != null ? ` / ${Math.round(goal)}` : ""} g
          </title>
        </path>
      )}
    </g>
  );
}

export default function FeastPlate({
  calories,
  calorieGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
}: {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number | null;
  carbs: number;
  carbsGoal: number | null;
  fat: number;
  fatGoal: number | null;
}) {
  const calRatio = calorieGoal > 0 ? calories / calorieGoal : 0;
  const calOver = calRatio > 1.05;
  const calMet = calRatio >= 0.95 && calRatio <= 1.05;

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 w-full h-full"
        aria-label="Provisions feast plate"
      >
        <defs>
          <radialGradient id="plate-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(38, 26, 18, 0.95)" />
            <stop offset="80%" stopColor="rgba(20, 12, 8, 0.95)" />
            <stop offset="100%" stopColor="rgba(8, 4, 4, 1)" />
          </radialGradient>
          <radialGradient id="medallion-bg" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(30, 20, 30, 0.95)" />
            <stop offset="100%" stopColor="rgba(8, 6, 12, 1)" />
          </radialGradient>
          <radialGradient id="candle-flame" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
          </radialGradient>
        </defs>

        {/* Decorative fork (left) */}
        <g transform={`translate(${CENTER - 240}, ${CENTER - 90})`}>
          <Fork />
        </g>
        {/* Decorative knife (right) */}
        <g transform={`translate(${CENTER + 200}, ${CENTER - 90})`}>
          <Knife />
        </g>
        {/* Candle (top) */}
        <g transform={`translate(${CENTER - 18}, ${CENTER - 230})`}>
          <Candle />
        </g>

        {/* Plate rim — outer ornate ring */}
        <circle cx={CENTER} cy={CENTER} r={PLATE_RIM_OUT} fill="url(#plate-bg)" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={PLATE_RIM_OUT}
          fill="none"
          stroke="#6b4f3a"
          strokeWidth="2"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={PLATE_RIM_OUT - 5}
          fill="none"
          stroke="#b8860b"
          strokeOpacity="0.55"
          strokeWidth="0.7"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={PLATE_RIM_IN}
          fill="rgba(20, 14, 10, 0.55)"
          stroke="#3a2a18"
          strokeWidth="1.2"
        />

        {/* Ornamental rim pips (12 small marks around the plate) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 360) / 12;
          const p = pointAt(CENTER, CENTER, (PLATE_RIM_OUT + PLATE_RIM_IN) / 2, angle);
          return (
            <circle
              key={`pip-${i}`}
              cx={p.x}
              cy={p.y}
              r="1.2"
              fill="#b8860b"
              opacity="0.6"
            />
          );
        })}

        {/* Wedges */}
        <Wedge
          slice={SLICES.carbs}
          value={carbs}
          goal={carbsGoal}
          palette={COLOR.carbs}
          label="Carbs"
        />
        <Wedge
          slice={SLICES.fat}
          value={fat}
          goal={fatGoal}
          palette={COLOR.fat}
          label="Fat"
        />
        <Wedge
          slice={SLICES.protein}
          value={protein}
          goal={proteinGoal}
          palette={COLOR.protein}
          label="Protein"
        />

        {/* Wedge dividers */}
        {Object.values(SLICES).map((s, i) => {
          const p1 = pointAt(CENTER, CENTER, WEDGE_IN, s.start);
          const p2 = pointAt(CENTER, CENTER, WEDGE_OUT, s.start);
          return (
            <line
              key={`div-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#1a0f06"
              strokeWidth="2"
            />
          );
        })}

        {/* Wedge labels (near outer rim) */}
        <WedgeLabel angle={0} text="Carbs" value={carbs} goal={carbsGoal} />
        <WedgeLabel angle={126} text="Fat" value={fat} goal={fatGoal} />
        <WedgeLabel angle={234} text="Protein" value={protein} goal={proteinGoal} />

        {/* Center medallion */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={MEDAL_R + 4}
          fill="#1a0f06"
          stroke={calMet ? "#d4a020" : calOver ? "#a0432a" : "#6b4f3a"}
          strokeWidth="1.5"
          style={
            calMet
              ? { filter: "drop-shadow(0 0 12px rgba(212, 160, 32, 0.55))" }
              : undefined
          }
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={MEDAL_R}
          fill="url(#medallion-bg)"
          stroke="rgba(184, 134, 11, 0.4)"
          strokeWidth="0.6"
        />
        <text
          x={CENTER}
          y={CENTER - 8}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill={calMet ? "#d4a020" : calOver ? "#e07050" : "#d8d2c2"}
          style={{
            ...fontDisplay,
            textShadow: calMet
              ? "0 0 12px rgba(212, 160, 32, 0.6)"
              : "0 1px 0 rgba(0,0,0,0.7)",
          }}
        >
          {calories.toLocaleString()}
        </text>
        <text
          x={CENTER}
          y={CENTER + 12}
          textAnchor="middle"
          fontSize="9"
          fill="#8b8275"
          style={{
            ...fontDisplay,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          / {calorieGoal.toLocaleString()} cal
        </text>
        <text
          x={CENTER}
          y={CENTER + 28}
          textAnchor="middle"
          fontSize="9"
          fill={calMet ? "#d4a020" : calOver ? "#e07050" : "#5a5246"}
          style={{
            ...fontDisplay,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {calOver ? "Over" : calMet ? "On Track" : `${Math.round(calRatio * 100)}%`}
        </text>
      </svg>
    </div>
  );
}

function WedgeLabel({
  angle,
  text,
  value,
  goal,
}: {
  angle: number;
  text: string;
  value: number;
  goal: number | null;
}) {
  const labelR = WEDGE_OUT - 18;
  const p = pointAt(CENTER, CENTER, labelR, angle);
  return (
    <g style={{ pointerEvents: "none" }}>
      <text
        x={p.x}
        y={p.y - 4}
        textAnchor="middle"
        fontSize="9"
        fill="#0c0c18"
        style={{
          ...fontDisplay,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontWeight: 700,
          paintOrder: "stroke",
          stroke: "rgba(255,240,200,0.5)",
          strokeWidth: 0.6,
        }}
      >
        {text}
      </text>
      <text
        x={p.x}
        y={p.y + 8}
        textAnchor="middle"
        fontSize="11"
        fill="#0c0c18"
        style={{
          ...fontDisplay,
          fontWeight: 700,
          paintOrder: "stroke",
          stroke: "rgba(255,240,200,0.5)",
          strokeWidth: 0.6,
        }}
      >
        {Math.round(value)}
        {goal != null ? `/${Math.round(goal)}` : ""}g
      </text>
    </g>
  );
}

function Fork() {
  return (
    <g>
      {/* tines */}
      <rect x="0" y="0" width="3" height="40" fill="#a08560" rx="0.5" />
      <rect x="6" y="0" width="3" height="40" fill="#a08560" rx="0.5" />
      <rect x="12" y="0" width="3" height="40" fill="#a08560" rx="0.5" />
      <rect x="18" y="0" width="3" height="40" fill="#a08560" rx="0.5" />
      {/* yoke */}
      <rect x="-1" y="38" width="23" height="8" fill="#a08560" rx="2" />
      {/* shaft */}
      <rect x="9" y="46" width="3" height="135" fill="#7a6044" />
      {/* handle */}
      <rect x="6" y="180" width="9" height="35" fill="#3a2a18" rx="3" />
      <circle cx="10.5" cy="220" r="5" fill="#b8860b" opacity="0.7" />
    </g>
  );
}

function Knife() {
  return (
    <g>
      {/* blade */}
      <path
        d="M 18 0 L 22 0 L 22 130 L 0 140 Z"
        fill="#c0c0c8"
        stroke="#5a5050"
        strokeWidth="0.6"
      />
      {/* edge highlight */}
      <line x1="2" y1="139" x2="22" y2="129" stroke="#e8e8ee" strokeWidth="0.5" />
      {/* bolster */}
      <rect x="14" y="138" width="12" height="8" fill="#6b4f3a" />
      {/* handle */}
      <rect x="15" y="146" width="10" height="55" fill="#3a2a18" rx="3" />
      <circle cx="20" cy="205" r="5" fill="#b8860b" opacity="0.7" />
    </g>
  );
}

function Candle() {
  return (
    <g>
      {/* flame */}
      <ellipse
        cx="18"
        cy="14"
        rx="9"
        ry="14"
        fill="url(#candle-flame)"
        style={{
          filter: "drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))",
        }}
      >
        <animate
          attributeName="ry"
          values="14;13;14;15;14"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </ellipse>
      <ellipse cx="18" cy="16" rx="3" ry="6" fill="#fcd34d" />
      {/* wick */}
      <line
        x1="18"
        y1="22"
        x2="18"
        y2="30"
        stroke="#1a0f06"
        strokeWidth="1.5"
      />
      {/* candle body */}
      <rect x="12" y="28" width="12" height="32" fill="#e8d5a0" rx="1.5" />
      {/* dripping wax */}
      <path
        d="M 12 32 Q 11 38 13 42 L 13 30 Z"
        fill="#d4c08a"
      />
      {/* candle holder */}
      <ellipse cx="18" cy="60" rx="14" ry="3" fill="#6b4f3a" />
      <ellipse cx="18" cy="58" rx="13" ry="2" fill="#8a6843" />
    </g>
  );
}
