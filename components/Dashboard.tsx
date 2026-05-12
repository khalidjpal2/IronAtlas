"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BodySVG from "@/components/BodySVG";
import Legend from "@/components/Legend";
import MuscleDetailPanel from "@/components/MuscleDetailPanel";
import {
  HeatmapColorProvider,
} from "@/components/HeatmapColorContext";
import HeatmapColorPicker from "@/components/HeatmapColorPicker";
import PRCards, { type PR } from "@/components/PRCards";
import {
  EXPERIENCE_LABEL,
  LEVEL_RANK,
  SEX_LABEL,
  ZONES,
  ZONE_LABEL,
  type Sex,
  type StandardRow,
  type StrengthLevel,
  type TrainingExperience,
  type Zone,
} from "@/lib/strength";
import { JOURNEY_BASE_GOAL } from "@/lib/scoring";

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  ageGroup: string;
  sex: Sex | null;
  bodyweight?: number | null;
  height?: number | null;
  experience: TrainingExperience;
  profileComplete: boolean;
  zoneLevels: Partial<Record<Zone, StrengthLevel>>;
  muscleLevels: Record<string, StrengthLevel>;
  muscleBest: Record<
    string,
    {
      exercise: string;
      weight: number;
      reps?: number;
      sets?: number;
      score?: number;
    } | null
  >;
  standards: StandardRow[];
  prs: PR[];
  debug?: {
    setsCount: number;
    standardsCount: number;
    standardsLikelyOutdated: boolean;
    standardNames: string[];
    ageGroup: string;
    experience: TrainingExperience;
    chestZoneLevel: StrengthLevel;
    sampleSets: unknown[];
    setAudit: Array<{
      exercise: string;
      weight: number;
      reps: number;
      sets: number;
      inExerciseOptions: boolean;
      hasStandard: boolean;
    }>;
    chestMuscleBest: Record<string, unknown>;
  };
  liftingOverview: {
    workoutsThisWeek: number;
    setsThisWeek: number;
    mostTrainedZone: string | null;
    lastWorkoutDate: string | null;
    lastWorkoutZone: string | null;
  };
  stepsOverview: {
    today: number;
    goal: number;
  };
  nutritionOverview: {
    today: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    } | null;
    goals: {
      calories: number;
      protein: number | null;
      carbs: number | null;
      fat: number | null;
    };
  };
  recentActivity: Array<{
    exercise: string;
    muscleGroup: string;
    weight: number;
    reps: number;
    sets: number;
    date: string;
  }>;
  todaysSets: Array<{
    exercise: string;
    muscleGroup: string;
    weight: number;
    reps: number;
    sets: number;
  }>;
  scores: {
    atlas: number;
    journey: number;
    sustenance: number;
    overall: number;
    rank: string;
    rankLabel: string;
  };
  zoneDecay: Record<
    string,
    { daysSinceLastTrained: number | null; warning: boolean; decayed: boolean }
  >;
  dailyQuests: {
    atlas: {
      id: string;
      text: string;
      done: boolean;
      progress: {
        current: number;
        label: string;
        isRestDay: boolean;
      };
    };
    journey: {
      id: string;
      text: string;
      done: boolean;
      progress: { current: number; target: number; label: string };
    };
    sustenance: {
      id: string;
      text: string;
      done: boolean;
      progress: {
        current: number;
        target: number;
        label: string;
        mode: "bulk" | "cut" | "maintain";
      };
    };
    allDone: boolean;
  };
  earnedBadges: string[];
  newlyEarned: string[];
  enrichedSets: Array<{
    exercise: string;
    zone: string;
    weight: number;
    reps: number;
    sets: number;
    date: string;
    score: number;
    level: StrengthLevel;
  }>;
};

export default function Dashboard({
  userId,
  username,
  isAdmin,
  ageGroup,
  sex,
  bodyweight,
  height,
  experience,
  profileComplete,
  zoneLevels,
  muscleLevels,
  muscleBest,
  standards,
  prs,
  debug,
  liftingOverview,
  stepsOverview,
  nutritionOverview,
  scores,
  zoneDecay,
  dailyQuests,
  earnedBadges,
  newlyEarned,
  recentActivity,
  todaysSets,
  enrichedSets,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"front" | "back">("front");
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  return (
    <HeatmapColorProvider>
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader
        username={username}
        isAdmin={isAdmin}
        profile={{ bodyweight, height, sex, ageGroup, experience }}
      />

      <main className="flex-1 w-full px-6 lg:px-10 py-4 lg:py-5 flex flex-col gap-4">
        {debug?.standardsLikelyOutdated && (
          <div className="bg-gold/10 border border-gold/40 rounded px-4 py-2 shrink-0">
            <div className="text-xs font-medium text-gold">
              Strength standards table looks incomplete (
              {debug.standardsCount} rows for{" "}
              <span className="font-mono">{debug.ageGroup}</span>). Re-run{" "}
              <span className="font-mono">supabase/schema.sql</span>.
            </div>
          </div>
        )}

        {!profileComplete && (
          <Link
            href="/settings"
            prefetch
            className="lift tablet block rounded px-4 py-2.5 transition shrink-0"
          >
            <span className="corner-bl" />
            <span className="corner-br" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <div
                  className="text-[11px] uppercase tracking-[0.18em] text-gold font-bold"
                  style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
                >
                  Forge your character
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  Bodyweight, sex, and experience set the standards by which
                  your strength is measured.
                </div>
              </div>
              <span className="text-gold text-base">→</span>
            </div>
          </Link>
        )}

        {/* === MAIN HUD GRID — Crest · Heatmap · Stats =========== */}
        <section className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* LEFT — Medieval crest box */}
          <MedievalCrest
            scores={scores}
            zoneLevels={zoneLevels}
            zoneDecay={zoneDecay}
            stepsOverview={stepsOverview}
            nutritionOverview={nutritionOverview}
          />

          {/* CENTER — Body heatmap (hero) */}
          <div
            className="tablet tablet-arcane relative rounded p-3 flex flex-col min-h-[600px] lg:min-h-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 55% 45% at 50% 38%, rgba(50, 38, 70, 0.55) 0%, rgba(20, 14, 30, 0.35) 35%, rgba(8, 8, 16, 0) 70%), var(--noise-bg)",
            }}
          >
            <span className="corner-bl" />
            <span className="corner-br" />

            <div className="relative w-full flex items-center justify-between mb-1 shrink-0">
              <div className="text-[11px] text-muted">
                {ageGroup}
                {sex ? ` · ${SEX_LABEL[sex]}` : ""}
                {" · "}
                {EXPERIENCE_LABEL[experience]}
              </div>
              <div className="flex items-center gap-2">
                <HeatmapColorPicker size={22} />
              <div
                className="inline-flex bg-bg border border-bronze-deep rounded p-0.5 text-[10px] uppercase tracking-[0.18em]"
                style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)" }}
              >
                <button
                  onClick={() => setView("front")}
                  className={`px-3 py-1 rounded-sm transition font-semibold ${
                    view === "front"
                      ? "bg-bronze-deep text-ink-strong"
                      : "text-muted hover:text-ink"
                  }`}
                  style={{
                    fontFamily: "var(--font-cinzel), Georgia, serif",
                    boxShadow:
                      view === "front"
                        ? "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.4)"
                        : undefined,
                  }}
                >
                  Front
                </button>
                <button
                  onClick={() => setView("back")}
                  className={`px-3 py-1 rounded-sm transition font-semibold ${
                    view === "back"
                      ? "bg-bronze-deep text-ink-strong"
                      : "text-muted hover:text-ink"
                  }`}
                  style={{
                    fontFamily: "var(--font-cinzel), Georgia, serif",
                    boxShadow:
                      view === "back"
                        ? "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.4)"
                        : undefined,
                  }}
                >
                  Back
                </button>
              </div>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 w-full">
              <BodySVG
                view={view}
                levels={zoneLevels}
                onMuscleClick={setSelectedZone}
              />
            </div>

            <div className="mt-1 w-full shrink-0 flex justify-center">
              <Legend />
            </div>
          </div>

          {/* RIGHT — Today's stats, today's workout, daily quests */}
          <aside className="flex flex-col gap-4 min-h-0">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <TodayMini
                href="/steps"
                label="Steps"
                value={stepsOverview.today.toLocaleString()}
                goal={`/ ${stepsOverview.goal.toLocaleString()}`}
                pct={
                  stepsOverview.goal > 0
                    ? stepsOverview.today / stepsOverview.goal
                    : 0
                }
                color="#a855f7"
              />
              <TodayMini
                href="/calories"
                label="Calories"
                value={
                  nutritionOverview.today
                    ? nutritionOverview.today.calories.toLocaleString()
                    : "—"
                }
                goal={`/ ${nutritionOverview.goals.calories.toLocaleString()}`}
                pct={
                  nutritionOverview.today &&
                  nutritionOverview.goals.calories > 0
                    ? nutritionOverview.today.calories /
                      nutritionOverview.goals.calories
                    : 0
                }
                color="#f59e0b"
              />
            </div>

            <TodaysWorkoutCard
              todaysSets={todaysSets}
              isRestDay={dailyQuests.atlas.progress.isRestDay}
            />

            <DailyQuestsList quests={dailyQuests} />
          </aside>
        </section>

        {/* === RANK PROGRESSION === */}
        <RankProgression score={scores.overall} rank={scores.rank} />

        {/* The Hall of Achievements lives at /achievements (its own
            page reachable via the nav). Atlas keeps the rank, body,
            today overview, quests, recent activity, and rank progression. */}

        {process.env.NODE_ENV === "development" && debug && (
          <details className="bg-panel border border-border rounded-2xl px-5 py-3 text-xs">
            <summary className="cursor-pointer text-muted hover:text-white transition">
              Debug · {debug.setsCount} sets · {debug.standardsCount} standards
              · chest = {debug.chestZoneLevel}
            </summary>
            <div className="mt-3 grid sm:grid-cols-2 gap-4 font-mono text-[11px] leading-snug">
              <div>
                <div className="text-muted mb-1">Inputs</div>
                <pre className="bg-bg border border-border rounded-md p-2 overflow-auto whitespace-pre-wrap break-words">
{JSON.stringify(
  {
    setsCount: debug.setsCount,
    standardsCount: debug.standardsCount,
    ageGroup: debug.ageGroup,
    experience: debug.experience,
  },
  null,
  2
)}
                </pre>
              </div>
              <div>
                <div className="text-muted mb-1">Set audit</div>
                <pre className="bg-bg border border-border rounded-md p-2 overflow-auto whitespace-pre-wrap break-words max-h-72">
{debug.setAudit.length === 0
  ? "no sets"
  : debug.setAudit
      .map(
        (s) =>
          `${s.inExerciseOptions ? "[OK]" : "[--]"}EX ${
            s.hasStandard ? "[OK]" : "[--]"
          }STD  ${s.exercise} — ${s.weight}x${s.reps}x${s.sets}`
      )
      .join("\n")}
                </pre>
              </div>
            </div>
          </details>
        )}
      </main>

      <MuscleDetailPanel
        zone={selectedZone}
        zoneLevel={
          selectedZone ? zoneLevels[selectedZone] ?? "untrained" : "untrained"
        }
        ageGroup={ageGroup}
        sex={sex}
        bodyweight={bodyweight ?? null}
        standards={standards}
        muscleLevels={muscleLevels}
        muscleBest={muscleBest}
        enrichedSets={enrichedSets}
        onClose={() => setSelectedZone(null)}
        onLogWorkout={(targetZone) => {
          setSelectedZone(null);
          router.push(`/lifting?zone=${encodeURIComponent(targetZone)}`);
        }}
      />
    </div>
    </HeatmapColorProvider>
  );
}

/**
 * Horizontal rank progression: Dormant → Legend with the user's
 * current tier highlighted and "X to next" remaining points shown.
 */
function RankProgression({
  score,
  rank,
}: {
  score: number;
  rank: string;
}) {
  const currentIdx = RANK_LADDER.findIndex((r) => r.key === rank);
  const next = RANK_LADDER[currentIdx + 1] ?? null;
  const ptsToNext = next ? Math.max(0, next.threshold - score) : 0;
  return (
    <section className="tablet relative rounded p-4">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          Rank Progression
        </div>
        {next ? (
          <div className="text-[11px] text-muted">
            <span className="text-ink font-semibold tabular-nums">
              {ptsToNext}
            </span>{" "}
            pts to{" "}
            <span style={{ color: rankTheme(next.key).color }}>
              {next.label}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-gold italic">Pinnacle reached.</div>
        )}
      </div>
      <div className="relative">
        {/* Track */}
        <div
          className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.5)" }}
        />
        <div className="grid grid-cols-5 relative gap-2">
          {RANK_LADDER.map((rung, i) => {
            const t = rankTheme(rung.key);
            const reached = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div
                key={rung.key}
                className="flex flex-col items-center"
              >
                <div
                  className={`w-5 h-5 rounded-full ${
                    isCurrent && t.pulse ? "pulse-legendary" : ""
                  }`}
                  style={{
                    background: reached ? t.color : "#2a2630",
                    border: `2px solid ${
                      isCurrent ? t.color : reached ? t.color : "#3a3340"
                    }`,
                    boxShadow: isCurrent
                      ? `0 0 12px ${t.color}, 0 0 4px ${t.color}`
                      : reached
                      ? `0 0 4px ${t.color}88`
                      : undefined,
                  }}
                />
                <div
                  className="mt-1.5 text-[9px] uppercase tracking-[0.18em] font-bold"
                  style={{
                    fontFamily: "var(--font-cinzel), Georgia, serif",
                    color: isCurrent
                      ? t.color
                      : reached
                      ? "#d8d2c2"
                      : "#5a5246",
                    textShadow: isCurrent
                      ? `0 0 8px ${t.color}88`
                      : undefined,
                  }}
                >
                  {rung.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Per-tier rank theme. Each tier owns a full visual identity (deep bg,
 * accent, soft border, flavor line). Used everywhere a rank colors
 * something: the identity card, the rank progression dots, and any
 * pillar bars that should match the user's current rank.
 */
export type RankTheme = {
  color: string;
  bgDeep: string;
  glowSize: number;
  flavor: string;
  pulse: boolean;
};

export function rankTheme(rank: string): RankTheme {
  switch (rank) {
    case "legend":
      return {
        color: "#a855f7",
        bgDeep: "#2a0a4a",
        glowSize: 32,
        flavor: "A name carved in legend.",
        pulse: true,
      };
    case "champion":
      return {
        color: "#f59e0b",
        bgDeep: "#3a2a00",
        glowSize: 24,
        flavor: "Honored across the realm.",
        pulse: false,
      };
    case "warrior":
      return {
        color: "#22c55e",
        bgDeep: "#1a3a1a",
        glowSize: 18,
        flavor: "A blade well-tempered.",
        pulse: false,
      };
    case "initiate":
      return {
        color: "#3b82f6",
        bgDeep: "#1e3a5f",
        glowSize: 14,
        flavor: "Awakened to the path.",
        pulse: false,
      };
    default:
      return {
        color: "#888888",
        bgDeep: "#2a2a2a",
        glowSize: 0,
        flavor: "The forge awaits.",
        pulse: false,
      };
  }
}

const RANK_LADDER: Array<{
  key: "dormant" | "initiate" | "warrior" | "champion" | "legend";
  label: string;
  threshold: number;
}> = [
  { key: "dormant",  label: "Dormant",  threshold: 0  },
  { key: "initiate", label: "Initiate", threshold: 21 },
  { key: "warrior",  label: "Warrior",  threshold: 41 },
  { key: "champion", label: "Champion", threshold: 61 },
  { key: "legend",   label: "Legend",   threshold: 81 },
];

function zoneDot(zone: string): string {
  // Simple per-zone tint for the recent-activity dots — uses tier-ish
  // hues so the row reads at a glance.
  const map: Record<string, string> = {
    chest: "#a855f7",
    back: "#3a5a8a",
    shoulders: "#f59e0b",
    biceps: "#22c55e",
    triceps: "#ef4444",
    forearms: "#8b7355",
    abs: "#a0432a",
    quads: "#5b3993",
    hamstrings: "#3b82f6",
    glutes: "#a83232",
    calves: "#3d6b3a",
  };
  return map[zone] ?? "#5a5246";
}

// ─── Medieval crest box (left rail) ───────────────────────────────
function MedievalCrest({
  scores,
  zoneLevels,
  zoneDecay,
  stepsOverview,
  nutritionOverview,
}: {
  scores: Props["scores"];
  zoneLevels: Props["zoneLevels"];
  zoneDecay: Props["zoneDecay"];
  stepsOverview: Props["stepsOverview"];
  nutritionOverview: Props["nutritionOverview"];
}) {
  const tier = rankTheme(scores.rank);
  const hairlineGold =
    "linear-gradient(90deg, transparent 0%, rgba(184,134,11,0.55) 50%, transparent 100%)";
  const hairlineBronze =
    "linear-gradient(90deg, transparent 0%, rgba(107,79,58,0.55) 25%, rgba(184,134,11,0.45) 50%, rgba(107,79,58,0.55) 75%, transparent 100%)";
  return (
    <aside
      className="relative flex flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0c0c18 0%, #08080f 100%), var(--noise-bg)",
        backgroundBlendMode: "normal",
        border: `1px solid ${tier.color}55`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.6), 0 4px 18px rgba(0,0,0,0.55), 0 0 ${Math.max(8, tier.glowSize / 2)}px ${tier.color}22`,
        clipPath:
          "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
      }}
    >
      {/* ─── Compact rank header — shield + name + overall, one line ─── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
        <RankShield rank={scores.rank} color={tier.color} size={44} />
        <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
          <span
            className="text-[15px] uppercase tracking-[0.20em] font-bold leading-none truncate"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: tier.color,
              textShadow: `0 0 12px ${tier.color}66, 0 1px 0 rgba(0,0,0,0.75)`,
            }}
          >
            {scores.rankLabel}
          </span>
          <span
            className="text-[11px] tabular-nums leading-none shrink-0"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            <span className="text-ink-strong font-semibold">
              {Math.round(scores.overall)}
            </span>
            <span className="text-muted/60">/100</span>
          </span>
        </div>
      </div>

      <div
        className="h-px mx-4 shrink-0"
        style={{ background: hairlineGold }}
      />

      {/* ─── Three pillar rows — fill remaining height equally ─── */}
      <div className="flex-1 flex flex-col min-h-0">
        <PillarRow
          label="Atlas"
          score={scores.atlas}
          tip={atlasTip(scores.atlas, zoneLevels, zoneDecay)}
        />
        <div
          className="h-px mx-4 shrink-0"
          style={{ background: hairlineBronze }}
        />
        <PillarRow
          label="Journey"
          score={scores.journey}
          tip={journeyTip(
            scores.journey,
            stepsOverview.today,
            JOURNEY_BASE_GOAL
          )}
        />
        <div
          className="h-px mx-4 shrink-0"
          style={{ background: hairlineBronze }}
        />
        <PillarRow
          label="Sustenance"
          score={scores.sustenance}
          tip={sustenanceTip(
            scores.sustenance,
            nutritionOverview.today,
            nutritionOverview.goals
          )}
        />
      </div>
    </aside>
  );
}

function pillarColor(score: number): string {
  if (score <= 20) return "#6b7280";
  if (score <= 40) return "#3b82f6";
  if (score <= 60) return "#22c55e";
  if (score <= 80) return "#f59e0b";
  return "#a855f7";
}

function PillarMedallion({
  score,
  label,
  fillToNext,
}: {
  score: number;
  label: string;
  fillToNext: number; // 0..1, score / nextThreshold
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const color = pillarColor(pct);
  const fill = Math.max(0, Math.min(1, fillToNext));
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - fill);
  const glow = pct >= 81 ? 6 : pct >= 61 ? 4 : 2;

  return (
    <div
      className="relative shrink-0"
      style={{ width: 70, height: 70 }}
      aria-label={`${label} score ${pct}`}
    >
      <svg
        viewBox="0 0 70 70"
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        {/* Track ring */}
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="3.5"
          fill="none"
        />
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke={`${color}22`}
          strokeWidth="3.5"
          fill="none"
        />
        {/* Progress arc — score / nextThreshold */}
        {fill > 0 && (
          <circle
            cx="35"
            cy="35"
            r={radius}
            stroke={color}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 35 35)"
            style={{
              filter: `drop-shadow(0 0 ${glow}px ${color})`,
            }}
          />
        )}
      </svg>
      {/* Recessed dark center with score + pillar name */}
      <div
        className="absolute rounded-full flex flex-col items-center justify-center"
        style={{
          inset: 7,
          background:
            "radial-gradient(circle at 50% 32%, #14121c 0%, #0a0a0f 75%)",
          boxShadow:
            "inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(255,255,255,0.04)",
        }}
      >
        <span
          className="font-bold leading-none tabular-nums"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            fontSize: 22,
            color: pct === 0 ? "#6b7280" : color,
            textShadow:
              pct === 0
                ? "0 1px 1px rgba(0,0,0,0.9)"
                : `0 0 8px ${color}aa, 0 1px 1px rgba(0,0,0,0.9)`,
          }}
        >
          {pct}
        </span>
        <span
          className="font-bold uppercase mt-0.5"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            fontSize: 6.5,
            letterSpacing: "0.10em",
            color: "#9a9282",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// Pillar rank ladder — same thresholds as the overall rank, used to
// drive the per-pillar "to next rank" progress bars.
const PILLAR_RANKS: Array<{ min: number; label: string; color: string }> = [
  { min: 0,  label: "Dormant",  color: "#6b7280" },
  { min: 21, label: "Initiate", color: "#3b82f6" },
  { min: 41, label: "Warrior",  color: "#22c55e" },
  { min: 61, label: "Champion", color: "#f59e0b" },
  { min: 81, label: "Legend",   color: "#a855f7" },
];

function nextPillarRank(score: number): {
  current: { min: number; label: string; color: string };
  next: { min: number; label: string; color: string } | null;
  fill: number;
  ptsToNext: number;
} {
  let curIdx = 0;
  for (let i = 0; i < PILLAR_RANKS.length; i++) {
    if (score >= PILLAR_RANKS[i].min) curIdx = i;
  }
  const current = PILLAR_RANKS[curIdx];
  const next = PILLAR_RANKS[curIdx + 1] ?? null;
  const segStart = current.min;
  const segEnd = next?.min ?? 100;
  const fill = next
    ? Math.max(0, Math.min(1, (score - segStart) / (segEnd - segStart)))
    : 1;
  const ptsToNext = next ? Math.max(0, next.min - score) : 0;
  return { current, next, fill, ptsToNext };
}

// Quest-objective tip: icon glyph + concrete action + estimated point gain.
// `pts` is capped at ptsToNext so we never promise more than the rank gap.
type TipResult = { icon: string; action: string; pts: number };

function capPts(pts: number, ptsToNext: number, hasNext: boolean): number {
  if (!hasNext) return 0;
  return Math.max(1, Math.min(pts, ptsToNext));
}

// Atlas — decay > untrained > weakest. Each zone level ≈ 1.82 pts; we
// estimate "train one zone to average" ≈ 4 pts, "push one level" ≈ 2 pts.
function atlasTip(
  score: number,
  zoneLevels: Partial<Record<Zone, StrengthLevel>>,
  zoneDecay: Props["zoneDecay"]
): TipResult {
  const ICON = "⚔"; // ⚔
  const { next, ptsToNext } = nextPillarRank(score);
  const hasNext = !!next;
  if (!hasNext) return { icon: ICON, action: "Forged to legend", pts: 0 };

  const decayed = (ZONES as readonly Zone[]).find(
    (z) => zoneDecay[z]?.decayed
  );
  if (decayed)
    return {
      icon: ICON,
      action: `Restore ${ZONE_LABEL[decayed]} - decaying`,
      pts: capPts(2, ptsToNext, hasNext),
    };

  const warned = (ZONES as readonly Zone[]).find(
    (z) => zoneDecay[z]?.warning
  );
  if (warned)
    return {
      icon: ICON,
      action: `Train ${ZONE_LABEL[warned]} - idle`,
      pts: capPts(2, ptsToNext, hasNext),
    };

  const ranked = (ZONES as readonly Zone[])
    .map((z) => ({
      zone: z,
      rank: LEVEL_RANK[zoneLevels[z] ?? "untrained"],
    }))
    .sort((a, b) => a.rank - b.rank);

  const untrained = ranked.filter((r) => r.rank === 0);
  if (untrained.length > 0) {
    return {
      icon: ICON,
      action: `Train ${ZONE_LABEL[untrained[0].zone]}`,
      pts: capPts(4, ptsToNext, hasNext),
    };
  }
  return {
    icon: ICON,
    action: `Push ${ZONE_LABEL[ranked[0].zone]}`,
    pts: capPts(2, ptsToNext, hasNext),
  };
}

// Journey — ~3 pts per day at the base step goal. Logging today after a
// gap also clears decay, worth a flat ~5 pts of headroom.
function journeyTip(
  score: number,
  todaySteps: number,
  baseGoal: number
): TipResult {
  const ICON = "🏃"; // 🏃
  const { next, ptsToNext } = nextPillarRank(score);
  const hasNext = !!next;
  if (!hasNext) return { icon: ICON, action: "Pinnacle reached", pts: 0 };
  if (todaySteps <= 0)
    return {
      icon: ICON,
      action: "Log today's steps",
      pts: capPts(5, ptsToNext, hasNext),
    };
  if (todaySteps >= baseGoal)
    return {
      icon: ICON,
      action: "On track - keep streak alive",
      pts: capPts(3, ptsToNext, hasNext),
    };
  const days = Math.max(1, Math.ceil(ptsToNext / 3));
  const k = Math.round(baseGoal / 1000);
  return {
    icon: ICON,
    action: `Hit ${k}k steps ${days} more day${days === 1 ? "" : "s"}`,
    pts: capPts(days * 3, ptsToNext, hasNext),
  };
}

// Sustenance — logging today is the urgent ask (clears decay + adds a day);
// otherwise focus on protein or call out the days-to-next.
function sustenanceTip(
  score: number,
  today: Props["nutritionOverview"]["today"],
  goals: Props["nutritionOverview"]["goals"]
): TipResult {
  const ICON = "🍖"; // 🍖
  const { next, ptsToNext } = nextPillarRank(score);
  const hasNext = !!next;
  if (!hasNext) return { icon: ICON, action: "Macros mastered", pts: 0 };
  if (!today)
    return {
      icon: ICON,
      action: "Log nutrition today",
      pts: capPts(5, ptsToNext, hasNext),
    };

  const days = Math.max(1, Math.ceil(ptsToNext / 3));

  if (
    goals.protein != null &&
    goals.protein > 0 &&
    today.protein < goals.protein * 0.7
  ) {
    return {
      icon: ICON,
      action: "Focus on protein today",
      pts: capPts(3, ptsToNext, hasNext),
    };
  }

  if (
    goals.calories > 0 &&
    Math.abs(today.calories - goals.calories) > goals.calories * 0.2
  ) {
    return {
      icon: ICON,
      action: `Hit calorie goal ${days} more day${days === 1 ? "" : "s"}`,
      pts: capPts(days * 3, ptsToNext, hasNext),
    };
  }

  return {
    icon: ICON,
    action: `Log ${days} more clean day${days === 1 ? "" : "s"}`,
    pts: capPts(days * 3, ptsToNext, hasNext),
  };
}

function PillarRow({
  label,
  score,
  tip,
}: {
  label: string;
  score: number;
  tip: TipResult;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const color = pillarColor(pct);
  // Ring fill = score / nextThreshold (resets on rank-up).
  const { next } = nextPillarRank(pct);
  const fillToNext = next ? pct / next.min : 1;

  return (
    <div
      className="flex-1 min-h-[100px] flex items-center gap-4 px-4 py-4"
      style={{
        background: `linear-gradient(90deg, ${color}1a 0%, ${color}08 55%, ${color}03 100%)`,
      }}
    >
      {/* LEFT — circular progress ring with score + pillar name inside */}
      <PillarMedallion
        score={pct}
        label={label.toUpperCase()}
        fillToNext={fillToNext}
      />

      {/* RIGHT — quest objective + thin progress bar */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 self-center">
        {/* Quest objective line */}
        <div
          className="text-[12px] leading-snug"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            color: "#d8d2c2",
          }}
          title={`${tip.icon} ${tip.action}${tip.pts > 0 ? ` · +${tip.pts} pts` : ""}`}
        >
          <span
            className="mr-1.5 inline-block"
            style={{ filter: "saturate(1.1)" }}
            aria-hidden
          >
            {tip.icon}
          </span>
          <span>{tip.action}</span>
          {tip.pts > 0 && (
            <>
              <span className="text-muted/55 mx-1">·</span>
              <span
                className="font-bold tabular-nums"
                style={{
                  color: "#f0c45a",
                  textShadow: "0 0 6px rgba(240,196,90,0.45)",
                }}
              >
                +{tip.pts} pts
              </span>
            </>
          )}
        </div>

        {/* Thin progress bar — same fill as the ring */}
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: 5,
            background: "rgba(0,0,0,0.55)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          {fillToNext > 0 && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(1, fillToNext) * 100}%`,
                background: color,
                boxShadow: `0 0 6px ${color}aa`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RankShield({
  rank,
  color,
  size = 92,
}: {
  rank: string;
  color: string;
  size?: number;
}) {
  // Shield silhouette with a tier-specific glyph carved in the center.
  const height = Math.round((size / 92) * 104);
  return (
    <svg
      viewBox="0 0 88 100"
      width={size}
      height={height}
      style={{
        filter: `drop-shadow(0 0 ${Math.max(4, size / 9)}px ${color}55) drop-shadow(0 2px 4px rgba(0,0,0,0.7))`,
      }}
    >
      <defs>
        <linearGradient id="shield-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1622" />
          <stop offset="100%" stopColor="#0a0810" />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path
        d="M44 4 L80 12 L80 50 Q80 80 44 96 Q8 80 8 50 L8 12 Z"
        fill="url(#shield-fill)"
        stroke={color}
        strokeWidth="2"
      />
      {/* Inner border */}
      <path
        d="M44 10 L74 16 L74 50 Q74 76 44 90 Q14 76 14 50 L14 16 Z"
        fill="none"
        stroke={`${color}66`}
        strokeWidth="0.7"
      />
      <RankGlyph rank={rank} color={color} />
    </svg>
  );
}

function RankGlyph({ rank, color }: { rank: string; color: string }) {
  // Each tier wears a different sigil. Centered in viewBox 88×100,
  // glyph is roughly 44×44 from cx=44 cy=48.
  const cx = 44;
  const cy = 48;
  switch (rank) {
    case "legend": {
      // 8-point star
      const pts: string[] = [];
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 18 : 7;
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
      }
      return (
        <polygon
          points={pts.join(" ")}
          fill={color}
          stroke={color}
          strokeWidth="1"
          opacity="0.95"
        />
      );
    }
    case "champion": {
      // Crown
      return (
        <g fill={color} opacity="0.9">
          <path d={`M${cx - 18},${cy + 6} L${cx + 18},${cy + 6} L${cx + 16},${cy - 4} L${cx + 9},${cy + 2} L${cx + 4},${cy - 12} L${cx},${cy + 1} L${cx - 4},${cy - 12} L${cx - 9},${cy + 2} L${cx - 16},${cy - 4} Z`} />
          <rect x={cx - 18} y={cy + 8} width="36" height="4" />
        </g>
      );
    }
    case "warrior": {
      // Crossed swords
      return (
        <g stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <line x1={cx - 14} y1={cy - 14} x2={cx + 14} y2={cy + 14} />
          <line x1={cx + 14} y1={cy - 14} x2={cx - 14} y2={cy + 14} />
          <circle cx={cx} cy={cy} r="3" fill={color} stroke="none" />
        </g>
      );
    }
    case "initiate": {
      // Flame
      return (
        <path
          d={`M${cx},${cy - 18} Q${cx + 12},${cy - 6} ${cx + 8},${cy + 6} Q${cx + 6},${cy + 14} ${cx},${cy + 16} Q${cx - 6},${cy + 14} ${cx - 8},${cy + 6} Q${cx - 12},${cy - 6} ${cx},${cy - 18} Z`}
          fill={color}
          opacity="0.85"
        />
      );
    }
    default: {
      // Dormant — sleeping rune (circle with a slash)
      return (
        <g stroke={color} strokeWidth="2" fill="none" opacity="0.75">
          <circle cx={cx} cy={cy} r="14" />
          <line x1={cx - 9} y1={cy} x2={cx + 9} y2={cy} />
        </g>
      );
    }
  }
}

// ─── Today's workout card ─────────────────────────────────────────
// Three states only: logged sets, rest day (per schedule), or empty
// train day with a single CTA to log a session.
function TodaysWorkoutCard({
  todaysSets,
  isRestDay,
}: {
  todaysSets: Props["todaysSets"];
  isRestDay: boolean;
}) {
  const logged = todaysSets.length > 0;
  const visible = todaysSets.slice(0, 3);
  const more = Math.max(0, todaysSets.length - visible.length);

  return (
    <section className="tablet relative rounded p-4">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold inline-flex items-center gap-2"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          {!logged && isRestDay && <MoonGlyph />}
          {logged
            ? "Today's Training"
            : isRestDay
            ? "Rest Day"
            : "No Workout Logged Yet"}
        </div>
        {logged && more > 0 && (
          <Link
            href="/lifting"
            prefetch
            className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-gold transition"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            View all ({todaysSets.length})
          </Link>
        )}
      </div>

      {logged ? (
        <ul className="divide-y divide-border">
          {visible.map((s, i) => (
            <li key={i} className="py-2 flex items-center gap-3">
              <span
                className="seal shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  background: zoneDot(s.muscleGroup),
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-ink truncate">
                  {s.exercise}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  {ZONE_LABEL[s.muscleGroup as Zone] ?? s.muscleGroup}
                </div>
              </div>
              <div className="text-[11px] text-gold tabular-nums whitespace-nowrap font-semibold">
                {s.weight} × {s.reps} × {s.sets}
              </div>
            </li>
          ))}
        </ul>
      ) : isRestDay ? (
        <p className="text-[12px] text-muted/85 italic leading-snug">
          Recovery is part of the journey.
        </p>
      ) : (
        <Link
          href="/lifting"
          prefetch
          className="lift block rounded-md text-center font-bold uppercase tracking-[0.20em] transition"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            fontSize: 12,
            padding: "12px 14px",
            color: "#f3e6ff",
            background:
              "linear-gradient(180deg, #6b21a8 0%, #4c1d95 100%)",
            border: "1px solid #a855f7aa",
            boxShadow:
              "0 0 14px rgba(168,85,247,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.45)",
          }}
        >
          Log Session +
        </Link>
      )}
    </section>
  );
}

function MoonGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─── Daily quests — interactive quest cards ────────────────────────
const QUEST_GREEN = "#22c55e";

function DailyQuestsList({
  quests,
}: {
  quests: Props["dailyQuests"];
}) {
  // Convert raw quest payloads into card-ready data: state, progress
  // numbers, accent color, and a "remaining" string for incomplete cards.
  const calories = quests.sustenance.progress;
  const steps = quests.journey.progress;
  const workout = quests.atlas.progress;

  const calorieRemaining = Math.max(0, calories.target - calories.current);
  const stepRemaining = Math.max(0, steps.target - steps.current);

  return (
    <section className="tablet relative rounded p-4 flex-1 flex flex-col">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          Daily Quests
        </div>
        {quests.allDone && (
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: "#b8860b",
              textShadow: "0 0 6px rgba(184,134,11,0.5)",
            }}
          >
            +5 Bonus
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 flex-1">
        <QuestCard
          label="Calorie Goal"
          accent="#f59e0b"
          icon={<FlameIcon color="#f59e0b" />}
          state={quests.sustenance.done ? "done" : "pending"}
          progressText={calories.label}
          remainingText={
            calorieRemaining > 0
              ? `${calorieRemaining.toLocaleString()} cal remaining`
              : "Goal reached"
          }
          pct={
            calories.target > 0
              ? calories.current / calories.target
              : 0
          }
        />
        <QuestCard
          label="Step Goal"
          accent="#3b82f6"
          icon={<BootIcon color="#3b82f6" />}
          state={quests.journey.done ? "done" : "pending"}
          progressText={steps.label}
          remainingText={
            stepRemaining > 0
              ? `${stepRemaining.toLocaleString()} steps remaining`
              : "Goal reached"
          }
          pct={steps.target > 0 ? steps.current / steps.target : 0}
        />
        <QuestCard
          label="Workout"
          accent="#a855f7"
          icon={<SwordIcon color="#a855f7" />}
          state={
            workout.isRestDay
              ? "rest"
              : quests.atlas.done
              ? "done"
              : "pending"
          }
          progressText={workout.isRestDay ? "Rest Day" : workout.label}
          remainingText={
            workout.isRestDay ? "Recover well" : "Not logged today"
          }
          pct={workout.isRestDay ? 1 : quests.atlas.done ? 1 : 0}
        />
      </div>
    </section>
  );
}

function QuestCard({
  label,
  icon,
  accent,
  state,
  progressText,
  remainingText,
  pct,
}: {
  label: string;
  icon: ReactNode;
  accent: string;
  state: "done" | "pending" | "rest";
  progressText: string;
  remainingText: string;
  pct: number;
}) {
  const isDone = state === "done";
  const isRest = state === "rest";
  const ringColor = isDone ? QUEST_GREEN : accent;
  const clamped = Math.max(0, Math.min(1, pct));

  return (
    <div
      className="relative rounded-md flex items-center gap-3 transition"
      style={{
        minHeight: 70,
        padding: "10px 12px",
        background: isDone
          ? "linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)"
          : "rgba(20,18,28,0.55)",
        border: `1px solid ${isDone ? `${QUEST_GREEN}66` : "var(--bronze-deep)"}`,
        boxShadow: isDone
          ? `0 0 14px ${QUEST_GREEN}44, inset 0 1px 0 rgba(255,255,255,0.05)`
          : "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.45)",
      }}
    >
      {/* LEFT — colored icon tile */}
      <div
        className="flex items-center justify-center rounded-md shrink-0"
        style={{
          width: 42,
          height: 42,
          background: `${ringColor}1a`,
          border: `1px solid ${ringColor}55`,
          boxShadow: isDone
            ? `0 0 10px ${QUEST_GREEN}66, inset 0 1px 0 rgba(255,255,255,0.06)`
            : `0 0 6px ${ringColor}33, inset 0 1px 0 rgba(255,255,255,0.04)`,
          color: isDone ? QUEST_GREEN : ringColor,
        }}
      >
        {icon}
      </div>

      {/* CENTER — name + value/remaining + bar */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] uppercase tracking-[0.20em] font-bold leading-none"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: isDone ? QUEST_GREEN : "#d8d2c2",
              textShadow: isDone ? `0 0 6px ${QUEST_GREEN}55` : undefined,
            }}
          >
            {label}
          </span>
          {isDone && (
            <span
              className="text-[9px] uppercase tracking-[0.20em] font-bold leading-none"
              style={{
                fontFamily: "var(--font-cinzel), Georgia, serif",
                color: QUEST_GREEN,
                textShadow: `0 0 6px ${QUEST_GREEN}66`,
              }}
            >
              Complete
            </span>
          )}
        </div>
        <div
          className="text-[10.5px] tabular-nums leading-none truncate"
          style={{
            color: isDone
              ? "rgba(216,210,194,0.85)"
              : isRest
              ? "rgba(155,146,130,0.85)"
              : "rgba(216,210,194,0.85)",
          }}
        >
          {isDone ? progressText : isRest ? remainingText : progressText}
          {!isDone && !isRest && (
            <span className="text-muted/60 ml-1.5">· {remainingText}</span>
          )}
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: 4,
            background: "rgba(0,0,0,0.55)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          {clamped > 0 && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${clamped * 100}%`,
                background: isDone ? QUEST_GREEN : accent,
                boxShadow: `0 0 5px ${isDone ? QUEST_GREEN : accent}aa`,
              }}
            />
          )}
        </div>
      </div>

      {/* RIGHT — status circle */}
      <QuestStatusCircle state={state} />
    </div>
  );
}

function QuestStatusCircle({
  state,
}: {
  state: "done" | "pending" | "rest";
}) {
  const size = 22;
  if (state === "done") {
    return (
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: size,
          height: size,
          background: QUEST_GREEN,
          boxShadow: `0 0 10px ${QUEST_GREEN}88, inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
        aria-label="Complete"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0a0a0f"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={12}
          height={12}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (state === "rest") {
    return (
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: size,
          height: size,
          border: "1.5px solid rgba(139,130,117,0.55)",
          background: "rgba(0,0,0,0.3)",
          color: "#8b8275",
        }}
        aria-label="Rest day"
      >
        <MoonGlyph />
      </div>
    );
  }
  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        border: "1.5px solid rgba(155,146,130,0.45)",
        background: "rgba(0,0,0,0.3)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
      }}
      aria-label="Incomplete"
    />
  );
}

// ── Daily-quest icons (custom SVGs so we can color them per accent) ──
function FlameIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="0.8"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden
    >
      <path
        d="M12 2 C 9 6, 7 9, 7 13.5 C 7 17.5, 9.2 21, 12 21 C 14.8 21, 17 17.5, 17 13.5 C 17 11, 16 9.5, 14.5 8 C 14.5 10, 13.5 11, 12.5 11 C 12.5 8, 13 5, 12 2 Z"
        opacity="0.95"
      />
      <path
        d="M12 11 C 10.5 13, 10 14.5, 10 16 C 10 18, 11 19.5, 12 19.5 C 13 19.5, 14 18, 14 16 C 14 14.5, 13.5 13, 12 11 Z"
        fill="#ffe8b0"
        opacity="0.65"
        stroke="none"
      />
    </svg>
  );
}

function BootIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden
    >
      <path
        d="M7 4 L 7 14 L 5 14 L 5 19 L 19 19 L 19 16 C 19 14 17 13.5 16 13.5 L 12 13.5 L 12 4 Z"
        fill={`${color}26`}
      />
      <line x1="7" y1="9" x2="12" y2="9" />
      <line x1="5" y1="19" x2="19" y2="19" strokeWidth="2.4" />
    </svg>
  );
}

function SwordIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden
    >
      <path d="M14.5 17.5 L 20 12 L 19 8 L 16 5 L 12 4 L 6.5 9.5 Z" fill={`${color}26`} />
      <line x1="14.5" y1="17.5" x2="20" y2="12" />
      <line x1="6.5" y1="9.5" x2="2.5" y2="13.5" strokeWidth="2.2" />
      <line x1="3.5" y1="20.5" x2="6.5" y2="17.5" />
      <line x1="2.5" y1="13.5" x2="6" y2="17" />
    </svg>
  );
}

function TodayMini({
  href,
  label,
  value,
  goal,
  pct,
  color,
}: {
  href: string;
  label: string;
  value: string;
  goal: string;
  pct: number;
  color: string;
}) {
  const clamped = Math.min(1, Math.max(0, pct));
  return (
    <Link
      href={href}
      prefetch
      className="lift block bg-elevated border rounded-md group transition relative overflow-hidden"
      style={{
        borderColor: `${color}55`,
        padding: "16px 16px 14px",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.45), 0 0 12px ${color}1a`,
        background: `linear-gradient(180deg, ${color}0a 0%, transparent 100%), var(--elevated, #14121c)`,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.22em] font-bold leading-none"
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          color: `${color}cc`,
        }}
      >
        {label}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className="font-bold tabular-nums leading-none"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            fontSize: 28,
            color: "#ece6d5",
            textShadow: `0 0 10px ${color}55, 0 1px 1px rgba(0,0,0,0.85)`,
          }}
        >
          {value}
        </span>
        <span className="text-[10px] text-muted truncate">{goal}</span>
      </div>
      <div
        className="mt-3 rounded-full overflow-hidden"
        style={{
          height: 7,
          background: "rgba(0,0,0,0.55)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.7)",
        }}
      >
        {clamped > 0 && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${clamped * 100}%`,
              background: color,
              boxShadow: `0 0 8px ${color}aa`,
            }}
          />
        )}
      </div>
    </Link>
  );
}

