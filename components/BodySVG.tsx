"use client";

import { LEVEL_COLOR, type StrengthLevel, type MuscleGroup } from "@/lib/strength";

type Props = {
  view: "front" | "back";
  levels: Partial<Record<MuscleGroup, StrengthLevel>>;
  onMuscleClick?: (muscle: MuscleGroup) => void;
};

const baseFill = "#1f1f23";
const baseStroke = "#2e2e35";

function fillFor(muscle: MuscleGroup, levels: Props["levels"]) {
  const lvl = levels[muscle] ?? "untrained";
  return LEVEL_COLOR[lvl];
}

export default function BodySVG({ view, levels, onMuscleClick }: Props) {
  const handle = (m: MuscleGroup) => () => onMuscleClick?.(m);
  const common = {
    stroke: baseStroke,
    strokeWidth: 1,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 200 500"
      className="w-full max-w-[340px] mx-auto select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body silhouette base */}
      <g fill={baseFill} stroke={baseStroke} strokeWidth={1.2} strokeLinejoin="round">
        {/* Head */}
        <circle cx="100" cy="38" r="22" />
        {/* Neck */}
        <rect x="92" y="55" width="16" height="14" />
        {/* Torso */}
        <path d="M 60 72 Q 70 68 100 70 Q 130 68 140 72 L 146 130 L 140 220 L 60 220 L 54 130 Z" />
        {/* Hips/pelvis */}
        <path d="M 60 220 L 140 220 L 138 260 Q 100 272 62 260 Z" />
        {/* Left arm (viewer left = body right) */}
        <path d="M 54 80 Q 42 100 42 150 L 38 220 L 46 230 L 56 220 L 60 150 Z" />
        {/* Right arm */}
        <path d="M 146 80 Q 158 100 158 150 L 162 220 L 154 230 L 144 220 L 140 150 Z" />
        {/* Left leg */}
        <path d="M 62 260 L 70 360 L 72 470 L 88 480 L 96 470 L 96 360 L 100 260 Z" />
        {/* Right leg */}
        <path d="M 138 260 L 130 360 L 128 470 L 112 480 L 104 470 L 104 360 L 100 260 Z" />
        {/* Feet */}
        <ellipse cx="80" cy="488" rx="14" ry="6" />
        <ellipse cx="120" cy="488" rx="14" ry="6" />
      </g>

      {view === "front" ? (
        <g {...common}>
          {/* Shoulders (front delts) */}
          <path
            id="shoulders-l"
            className="muscle-zone"
            onClick={handle("shoulders")}
            d="M 56 76 Q 50 80 52 100 Q 60 108 72 102 Q 78 92 74 78 Q 64 72 56 76 Z"
            fill={fillFor("shoulders", levels)}
          />
          <path
            id="shoulders-r"
            className="muscle-zone"
            onClick={handle("shoulders")}
            d="M 144 76 Q 150 80 148 100 Q 140 108 128 102 Q 122 92 126 78 Q 136 72 144 76 Z"
            fill={fillFor("shoulders", levels)}
          />
          {/* Chest (pec L+R) */}
          <path
            id="chest"
            className="muscle-zone"
            onClick={handle("chest")}
            d="M 76 92 Q 100 86 124 92 Q 132 110 124 130 Q 110 138 100 132 Q 90 138 76 130 Q 68 110 76 92 Z"
            fill={fillFor("chest", levels)}
          />
          {/* Biceps */}
          <path
            id="biceps-l"
            className="muscle-zone"
            onClick={handle("biceps")}
            d="M 46 108 Q 40 130 44 152 Q 52 156 60 152 Q 62 130 58 108 Q 52 104 46 108 Z"
            fill={fillFor("biceps", levels)}
          />
          <path
            id="biceps-r"
            className="muscle-zone"
            onClick={handle("biceps")}
            d="M 154 108 Q 160 130 156 152 Q 148 156 140 152 Q 138 130 142 108 Q 148 104 154 108 Z"
            fill={fillFor("biceps", levels)}
          />
          {/* Abs */}
          <path
            id="abs"
            className="muscle-zone"
            onClick={handle("abs")}
            d="M 84 138 L 116 138 L 118 218 Q 100 224 82 218 Z"
            fill={fillFor("abs", levels)}
          />
          {/* Quads */}
          <path
            id="quads-l"
            className="muscle-zone"
            onClick={handle("quads")}
            d="M 70 268 Q 64 320 74 358 Q 86 360 94 356 Q 98 320 96 268 Q 84 264 70 268 Z"
            fill={fillFor("quads", levels)}
          />
          <path
            id="quads-r"
            className="muscle-zone"
            onClick={handle("quads")}
            d="M 130 268 Q 136 320 126 358 Q 114 360 106 356 Q 102 320 104 268 Q 116 264 130 268 Z"
            fill={fillFor("quads", levels)}
          />
          {/* Calves (front shows shins/tibialis — labeled calves for unified group) */}
          <path
            id="calves-l"
            className="muscle-zone"
            onClick={handle("calves")}
            d="M 76 388 Q 72 420 78 460 Q 88 462 94 458 Q 96 420 92 388 Q 84 386 76 388 Z"
            fill={fillFor("calves", levels)}
          />
          <path
            id="calves-r"
            className="muscle-zone"
            onClick={handle("calves")}
            d="M 124 388 Q 128 420 122 460 Q 112 462 106 458 Q 104 420 108 388 Q 116 386 124 388 Z"
            fill={fillFor("calves", levels)}
          />
        </g>
      ) : (
        <g {...common}>
          {/* Rear delts */}
          <path
            id="shoulders-l-back"
            className="muscle-zone"
            onClick={handle("shoulders")}
            d="M 56 76 Q 50 80 52 100 Q 60 108 72 102 Q 78 92 74 78 Q 64 72 56 76 Z"
            fill={fillFor("shoulders", levels)}
          />
          <path
            id="shoulders-r-back"
            className="muscle-zone"
            onClick={handle("shoulders")}
            d="M 144 76 Q 150 80 148 100 Q 140 108 128 102 Q 122 92 126 78 Q 136 72 144 76 Z"
            fill={fillFor("shoulders", levels)}
          />
          {/* Back (traps + lats as one zone) */}
          <path
            id="back"
            className="muscle-zone"
            onClick={handle("back")}
            d="M 78 76 Q 100 70 122 76 L 130 130 Q 134 180 124 218 Q 100 224 76 218 Q 66 180 70 130 Z"
            fill={fillFor("back", levels)}
          />
          {/* Triceps */}
          <path
            id="triceps-l"
            className="muscle-zone"
            onClick={handle("triceps")}
            d="M 46 108 Q 40 132 44 156 Q 52 160 60 156 Q 62 132 58 108 Q 52 104 46 108 Z"
            fill={fillFor("triceps", levels)}
          />
          <path
            id="triceps-r"
            className="muscle-zone"
            onClick={handle("triceps")}
            d="M 154 108 Q 160 132 156 156 Q 148 160 140 156 Q 138 132 142 108 Q 148 104 154 108 Z"
            fill={fillFor("triceps", levels)}
          />
          {/* Glutes */}
          <path
            id="glutes"
            className="muscle-zone"
            onClick={handle("glutes")}
            d="M 64 224 Q 80 218 100 222 Q 120 218 136 224 Q 138 252 120 264 Q 100 268 80 264 Q 62 252 64 224 Z"
            fill={fillFor("glutes", levels)}
          />
          {/* Hamstrings */}
          <path
            id="hamstrings-l"
            className="muscle-zone"
            onClick={handle("hamstrings")}
            d="M 70 270 Q 64 320 74 358 Q 86 360 94 356 Q 98 320 96 270 Q 84 266 70 270 Z"
            fill={fillFor("hamstrings", levels)}
          />
          <path
            id="hamstrings-r"
            className="muscle-zone"
            onClick={handle("hamstrings")}
            d="M 130 270 Q 136 320 126 358 Q 114 360 106 356 Q 102 320 104 270 Q 116 266 130 270 Z"
            fill={fillFor("hamstrings", levels)}
          />
          {/* Calves */}
          <path
            id="calves-l-back"
            className="muscle-zone"
            onClick={handle("calves")}
            d="M 74 386 Q 68 420 78 462 Q 88 464 94 460 Q 98 420 92 386 Q 82 382 74 386 Z"
            fill={fillFor("calves", levels)}
          />
          <path
            id="calves-r-back"
            className="muscle-zone"
            onClick={handle("calves")}
            d="M 126 386 Q 132 420 122 462 Q 112 464 106 460 Q 102 420 108 386 Q 118 382 126 386 Z"
            fill={fillFor("calves", levels)}
          />
        </g>
      )}
    </svg>
  );
}
