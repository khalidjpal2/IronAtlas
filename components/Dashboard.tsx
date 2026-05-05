"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BodySVG from "@/components/BodySVG";
import Legend from "@/components/Legend";
import MuscleDetailPanel from "@/components/MuscleDetailPanel";
import PRCards, { type PR } from "@/components/PRCards";
import {
  EXPERIENCE_LABEL,
  LEVEL_COLOR,
  LEVEL_GRADIENT,
  LEVEL_LABEL,
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
  enrichedSets,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"front" | "back">("front");
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  return (
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

        {/* === SCORES STRIP === */}
        <ScoresStrip scores={scores} username={username} />

        {/* === MAIN HUD GRID === */}
        <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4">
          {/* LEFT — Body heatmap */}
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

          {/* RIGHT — Today / Quests / Recent Activity */}
          <aside className="flex flex-col gap-4 min-h-0">
            {/* Today overview */}
            <section className="tablet relative rounded p-3 shrink-0">
              <span className="corner-bl" />
              <span className="corner-br" />
              <div className="grid grid-cols-3 gap-2.5">
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
                  color="#3a5a8a"
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
                    nutritionOverview.today && nutritionOverview.goals.calories > 0
                      ? nutritionOverview.today.calories /
                        nutritionOverview.goals.calories
                      : 0
                  }
                  color="#3d6b3a"
                />
                <TodayMini
                  href="/lifting"
                  label="Workouts"
                  value={String(liftingOverview.workoutsThisWeek)}
                  goal="this week"
                  pct={Math.min(1, liftingOverview.workoutsThisWeek / 5)}
                  color="#5b3993"
                />
              </div>
            </section>

            {/* Daily quests — fills the remaining column space now that
                Recent Activity has moved out. */}
            <DailyQuestsCard quests={dailyQuests} />
          </aside>
        </section>

        {/* === RANK PROGRESSION === */}
        <RankProgression score={scores.overall} rank={scores.rank} />

        {/* The Hall of Achievements lives at /achievements (its own
            page reachable via the nav). Atlas keeps the rank, body,
            today overview, quests, recent activity, and rank progression. */}

        {/* === DEBUG (always rendered, collapsed) ============== */}
        {debug && (
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
                <div className="text-muted mt-2 mb-1">Sample sets</div>
                <pre className="bg-bg border border-border rounded-md p-2 overflow-auto whitespace-pre-wrap break-words">
{JSON.stringify(debug.sampleSets, null, 2)}
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
                <div className="text-muted mt-2 mb-1">
                  Chest zone breakdown
                </div>
                <pre className="bg-bg border border-border rounded-md p-2 overflow-auto whitespace-pre-wrap break-words">
{JSON.stringify(
  {
    chestZoneLevel: debug.chestZoneLevel,
    chestMuscleBest: debug.chestMuscleBest,
  },
  null,
  2
)}
                </pre>
                <p className="text-muted mt-2 leading-relaxed">
                  Each set must have [OK]EX (exercise name matches{" "}
                  <code>EXERCISE_OPTIONS</code>) AND [OK]STD (a row in{" "}
                  <code>strength_standards</code> for the user's age
                  group) to count toward the heatmap.
                </p>
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
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-elevated border border-border rounded-md px-3 py-3">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted mb-1">
        {label}
      </div>
      <div
        className={`font-semibold text-ink truncate ${
          small ? "text-xs" : "text-base"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatBar({
  zone,
  level,
  warning,
  decayed,
  daysSince,
}: {
  zone: Zone;
  level: StrengthLevel;
  warning?: boolean;
  decayed?: boolean;
  daysSince?: number | null;
}) {
  const rank = LEVEL_RANK[level];
  const color = LEVEL_COLOR[level];
  const fill = LEVEL_GRADIENT[level];
  const pct = (rank / 5) * 100;
  const showWarn = warning || decayed;
  const warnTitle =
    decayed && daysSince != null
      ? `Decaying — ${daysSince} days since last trained`
      : warning && daysSince != null
      ? `Train within ${Math.max(1, 14 - daysSince)} days to avoid decay`
      : undefined;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between text-[9px] uppercase tracking-[0.16em] gap-2">
        <span className="flex items-center gap-1 min-w-0">
          <span
            className="font-semibold truncate"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: rank > 0 ? "#d8d2c2" : "#5a5246",
            }}
          >
            {ZONE_LABEL[zone]}
          </span>
          {showWarn && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: decayed ? "#a0432a" : "#b8860b",
                boxShadow: decayed
                  ? "0 0 4px rgba(160, 67, 42, 0.8)"
                  : "0 0 4px rgba(184, 134, 11, 0.6)",
              }}
              title={warnTitle}
            />
          )}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <LevelSeal level={level} size={10} />
          <span
            className="font-bold"
            style={{
              color,
              textShadow: "0 1px 0 rgba(0,0,0,0.6)",
            }}
          >
            {LEVEL_LABEL[level]}
          </span>
        </span>
      </div>
      <div className="xp-track" style={{ height: 5 }}>
        {pct > 0 && (
          <div
            className="xp-fill"
            style={{
              width: `${pct}%`,
              backgroundImage: fill,
            }}
          />
        )}
      </div>
    </li>
  );
}

// ─── Rank + score badges — premium medallion-style display ────────
//
// Three circular score badges (Atlas / Journey / Sustenance), each
// with an arc that fills clockwise based on the score and a color
// tied to the score's tier (gray < blue < green < gold < purple).
// Above them sits the user's overall rank label in big tier-color
// text, optionally pulsing when the user is at Legend.
function ScoresStrip({
  scores,
  username,
}: {
  scores: Props["scores"];
  username: string;
}) {
  const tier = rankTheme(scores.rank);
  return (
    <section
      className={`tablet relative rounded p-6 lg:p-8 flex flex-col items-center gap-5 shrink-0 ${
        tier.pulse ? "pulse-legendary" : ""
      }`}
      style={{
        borderColor: tier.color,
        backgroundImage: `radial-gradient(ellipse 90% 80% at 50% 0%, ${tier.bgDeep}, transparent 70%), radial-gradient(ellipse 70% 60% at 50% 0%, ${tier.color}22, transparent 70%), var(--noise-bg)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 ${tier.glowSize}px ${tier.color}3a, 0 6px 18px rgba(0,0,0,0.55)`,
      }}
    >
      <span className="corner-bl" style={{ background: tier.color }} />
      <span className="corner-br" style={{ background: tier.color }} />

      {/* Identity + overall rank */}
      <div className="text-center">
        <div
          className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          {username}
        </div>
        <div
          className="text-4xl lg:text-5xl font-bold uppercase tracking-[0.06em] mt-1"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            color: tier.color,
            textShadow: `0 0 22px ${tier.color}77, 0 1px 0 rgba(0,0,0,0.75)`,
          }}
        >
          {scores.rankLabel}
        </div>
        <div
          className="mt-1 text-[11px] italic text-muted/90"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          {tier.flavor}
        </div>
      </div>

      {/* Three circular medallions */}
      <div className="grid grid-cols-3 gap-4 lg:gap-8">
        <ScoreBadge score={scores.atlas} label="Atlas" />
        <ScoreBadge score={scores.journey} label="Journey" />
        <ScoreBadge score={scores.sustenance} label="Sustenance" />
      </div>
    </section>
  );
}

// ─── Single circular badge ────────────────────────────────────────
function ScoreBadge({ score, label }: { score: number; label: string }) {
  // Color buckets per spec: 0-20 gray, 21-40 blue, 41-60 green,
  // 61-80 gold, 81-100 purple (glowing).
  const color =
    score <= 20
      ? "#4a4a52"
      : score <= 40
      ? "#3a5a8a"
      : score <= 60
      ? "#3d6b3a"
      : score <= 80
      ? "#b8860b"
      : "#a855f7";
  const glowing = score >= 81;
  const r = 44;
  const C = 2 * Math.PI * r;
  const dashoffset = C * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <svg viewBox="0 0 110 110" className="absolute inset-0 w-full h-full">
          {/* Outer ornate ring (decorative) */}
          <circle
            cx="55"
            cy="55"
            r={r + 6}
            fill="none"
            stroke="rgba(107, 79, 58, 0.45)"
            strokeWidth="1"
          />
          {/* Track */}
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke="rgba(107, 79, 58, 0.28)"
            strokeWidth="6"
          />
          {/* Score arc — clockwise from 12 o'clock */}
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 55 55)"
            style={{
              filter: glowing
                ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 4px ${color})`
                : `drop-shadow(0 0 4px ${color}88)`,
              transition: "stroke-dashoffset 700ms ease",
            }}
          />
          {/* Inner well — gives the medallion a recessed look */}
          <circle
            cx="55"
            cy="55"
            r={r - 6}
            fill="rgba(8, 8, 16, 0.7)"
            stroke={`${color}55`}
            strokeWidth="0.5"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color,
              textShadow: glowing
                ? `0 0 10px ${color}, 0 1px 0 rgba(0,0,0,0.8)`
                : `0 0 6px ${color}77, 0 1px 0 rgba(0,0,0,0.75)`,
            }}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>
      <span
        className="text-[10px] uppercase tracking-[0.22em] font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif", color }}
      >
        {label}
      </span>
    </div>
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

function RankMedallion({ score, color }: { score: number; color: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
      <svg viewBox="0 0 72 72" className="absolute inset-0">
        <circle cx="36" cy="36" r="34" fill="rgb(var(--color-panel))" stroke={color} strokeWidth="1.5" />
        <circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.5" />
        {/* Crown points */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x1 = 36 + Math.cos(a) * 30;
          const y1 = 36 + Math.sin(a) * 30;
          const x2 = 36 + Math.cos(a) * 35;
          const y2 = 36 + Math.sin(a) * 35;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeOpacity="0.55"
              strokeWidth="1"
            />
          );
        })}
        {/* Score arc */}
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, score / 100)))}
          transform="rotate(-90 36 36)"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          color,
          textShadow: `0 0 10px ${color}88, 0 1px 0 rgba(0,0,0,0.7)`,
        }}
      >
        <span className="text-xl font-bold tabular-nums">{score}</span>
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] mb-1">
        <span
          className="font-bold"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            color,
          }}
        >
          {label}
        </span>
        <span className="text-muted tabular-nums">
          <span className="text-ink font-semibold">{score}</span>
          <span className="text-muted/60">/100</span>
        </span>
      </div>
      <div className="xp-track" style={{ height: 6 }}>
        {score > 0 && (
          <div
            className="xp-fill"
            style={{
              width: `${score}%`,
              background: color,
            }}
          />
        )}
      </div>
    </div>
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

// ─── Recent activity (last 3 sets) ────────────────────────────────
function RecentActivityCard({
  items,
}: {
  items: Props["recentActivity"];
}) {
  return (
    <section className="tablet relative rounded p-4">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center gap-3 mb-2">
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          Recent Activity
        </div>
        <div className="rune-divider flex-1" />
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted italic">
          No sessions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, 3).map((r, i) => (
            <li key={i} className="py-2 flex items-center gap-3">
              <span
                className="seal shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  background: zoneDot(r.muscleGroup),
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-ink truncate">
                  {r.exercise}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
                  {ZONE_LABEL[r.muscleGroup as Zone] ?? r.muscleGroup}
                </div>
              </div>
              <div className="text-[11px] text-gold tabular-nums whitespace-nowrap font-semibold">
                {r.weight} x {r.reps} x {r.sets}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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

// ─── Daily quests card ────────────────────────────────────────────
function DailyQuestsCard({
  quests,
}: {
  quests: Props["dailyQuests"];
}) {
  // Per-quest progress fraction for the bar fill.
  const journeyPct =
    quests.journey.progress.target > 0
      ? Math.min(
          1,
          quests.journey.progress.current / quests.journey.progress.target
        )
      : 0;
  const sustPct =
    quests.sustenance.progress.target > 0
      ? Math.min(
          1,
          quests.sustenance.progress.current /
            quests.sustenance.progress.target
        )
      : 0;
  // Atlas pct: rest day → full bar; train day → binary (any set today
  // = 100%, otherwise 0%).
  const atlasPct = quests.atlas.progress.isRestDay
    ? 1
    : quests.atlas.progress.current >= 1
    ? 1
    : 0;

  const items: Array<{
    kind: string;
    q: { id: string; text: string; done: boolean };
    pct: number;
    label: string;
    color: string;
  }> = [
    {
      kind: "Sustenance",
      q: {
        id: quests.sustenance.id,
        text: quests.sustenance.text,
        done: quests.sustenance.done,
      },
      pct: sustPct,
      label: quests.sustenance.progress.label,
      color: "#3d6b3a",
    },
    {
      kind: "Journey",
      q: {
        id: quests.journey.id,
        text: quests.journey.text,
        done: quests.journey.done,
      },
      pct: journeyPct,
      label: quests.journey.progress.label,
      color: "#3a5a8a",
    },
    {
      kind: "Atlas",
      q: {
        id: quests.atlas.id,
        text: quests.atlas.text,
        done: quests.atlas.done,
      },
      pct: atlasPct,
      label: quests.atlas.progress.label,
      color: "#a83232",
    },
  ];

  return (
    <section className="tablet relative rounded p-5 shrink-0 flex-1 flex flex-col">
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
            All Complete · +5
          </span>
        )}
      </div>
      <ul className="space-y-3 flex-1">
        {items.map(({ kind, q, pct, label, color }) => (
          <li
            key={q.id}
            className="rounded p-2.5"
            style={{
              background: q.done ? `${color}1A` : "rgba(20, 14, 30, 0.45)",
              border: q.done
                ? `1px solid ${color}55`
                : "1px solid rgba(107, 79, 58, 0.35)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <QuestCheck done={q.done} color={color} />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[9px] uppercase tracking-[0.22em] font-bold leading-none"
                  style={{
                    fontFamily: "var(--font-cinzel), Georgia, serif",
                    color: q.done ? color : "#b8860b",
                  }}
                >
                  {kind}
                </div>
                <div
                  className={`text-[12px] leading-snug mt-1 ${
                    q.done ? "text-muted/80 line-through" : "text-ink"
                  }`}
                >
                  {q.text}
                </div>
                <div className="mt-2 xp-track" style={{ height: 4 }}>
                  {pct > 0 && (
                    <div
                      className="xp-fill transition-all duration-700 ease-out"
                      style={{ width: `${pct * 100}%`, background: color }}
                    />
                  )}
                </div>
                <div className="text-[10px] tabular-nums text-muted/85 mt-1">
                  {label}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuestCheck({
  done,
  color = "#3d6b3a",
}: {
  done: boolean;
  color?: string;
}) {
  if (done) {
    return (
      <span
        className="mt-0.5 shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 18,
          height: 18,
          background: color,
          boxShadow: `0 0 8px ${color}99`,
        }}
        aria-label="Quest complete"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0c0c18"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3 h-3"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 shrink-0 rounded-full border-2 border-bronze-deep"
      style={{ width: 18, height: 18 }}
      aria-label="Quest pending"
    />
  );
}

// ─── Hall of Achievements ─────────────────────────────────────────
function AchievementsHall({
  earned,
  newlyEarned,
}: {
  earned: string[];
  newlyEarned: string[];
}) {
  const earnedSet = new Set(earned);
  const newSet = new Set(newlyEarned);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2
          className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          Hall of Achievements
          <span className="text-muted/60 ml-2">
            {earned.length} / {DASHBOARD_BADGES.length}
          </span>
        </h2>
        <div className="rune-divider flex-1" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-3">
        {DASHBOARD_BADGES.map((b) => {
          const isEarned = earnedSet.has(b.id);
          const isNew = newSet.has(b.id);
          return (
            <BadgeTile
              key={b.id}
              badge={b}
              earned={isEarned}
              fresh={isNew}
            />
          );
        })}
      </div>
    </section>
  );
}

function BadgeTile({
  badge,
  earned,
  fresh,
}: {
  badge: { id: string; name: string; description: string; category: string };
  earned: boolean;
  fresh: boolean;
}) {
  const tone = badgeCategoryColor(badge.category);
  return (
    <div
      className={`tablet relative rounded p-3 text-center transition ${
        earned ? "" : "opacity-40 grayscale"
      } ${fresh ? "pulse-legendary" : ""}`}
      style={{
        background: earned
          ? `linear-gradient(180deg, ${tone}22, transparent), #0c0c18`
          : undefined,
      }}
      title={badge.description}
    >
      <span className="corner-bl" />
      <span className="corner-br" />
      <div
        className="seal mx-auto"
        style={{
          width: 28,
          height: 28,
          background: earned ? tone : "#4a4a52",
        }}
      />
      <div
        className="text-[10px] uppercase tracking-[0.16em] mt-2 font-bold leading-tight"
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          color: earned ? tone : "#5a5246",
        }}
      >
        {badge.name}
      </div>
      <div className="text-[9px] text-muted/70 mt-1 leading-snug">
        {badge.description}
      </div>
      {fresh && (
        <div
          className="text-[8px] uppercase tracking-[0.20em] text-gold mt-1 font-bold"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            textShadow: "0 0 6px rgba(184,134,11,0.6)",
          }}
        >
          New!
        </div>
      )}
    </div>
  );
}

function badgeCategoryColor(c: string) {
  if (c === "lifting") return "#5b3993";
  if (c === "journey") return "#3a5a8a";
  if (c === "sustenance") return "#3d6b3a";
  return "#b8860b";
}

// Mirror of lib/badges.BADGES, kept here so we don't import it from the
// client component (it's also imported server-side; keeping a local copy
// avoids the "use client" / server-only boundary friction). Server is
// the source of truth for `earned`; this list just controls how many
// silhouettes show.
const DASHBOARD_BADGES: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
}> = [
  { id: "lifting.first_blood",  name: "First Blood",   description: "Log your first workout", category: "lifting" },
  { id: "lifting.iron_will",    name: "Iron Will",     description: "Log 10 workouts", category: "lifting" },
  { id: "lifting.awakened",     name: "Awakened",      description: "Reach Awakened in any zone", category: "lifting" },
  { id: "lifting.legendary",    name: "Legendary",     description: "Reach Legendary in any zone", category: "lifting" },
  { id: "lifting.full_atlas",   name: "Full Atlas",    description: "Take every zone above Dormant", category: "lifting" },
  { id: "lifting.big_three",    name: "Big Three",     description: "PRs for Bench, Squat, Deadlift", category: "lifting" },
  { id: "journey.first_steps",  name: "First Steps",   description: "Log steps for the first time", category: "journey" },
  { id: "journey.10k_club",     name: "10K Club",      description: "10,000 steps in a day", category: "journey" },
  { id: "journey.week_warrior", name: "Week Warrior",  description: "7-day step streak", category: "journey" },
  { id: "journey.month_march",  name: "Month March",   description: "30-day step streak", category: "journey" },
  { id: "sustenance.first_meal",    name: "First Meal",    description: "Log nutrition first time", category: "sustenance" },
  { id: "sustenance.week_of_plenty",name: "Week of Plenty",description: "Log 7 days in a row", category: "sustenance" },
  { id: "sustenance.macro_master",  name: "Macro Master",  description: "Hit all macro goals in a day", category: "sustenance" },
  { id: "overall.warrior",   name: "Warrior",   description: "Reach Warrior rank",   category: "overall" },
  { id: "overall.champion",  name: "Champion",  description: "Reach Champion rank",  category: "overall" },
  { id: "overall.legend",    name: "Legend",    description: "Reach Legend rank",    category: "overall" },
  { id: "overall.balanced",  name: "Balanced",  description: "All three pillars > 60", category: "overall" },
];

/**
 * Wax-seal style level badge — small carved disc.
 */
function LevelSeal({ level, size = 12 }: { level: StrengthLevel; size?: number }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      className="seal"
      style={{
        width: size,
        height: size,
        background: color,
      }}
      aria-label={LEVEL_LABEL[level]}
      title={LEVEL_LABEL[level]}
    />
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
      className="lift block bg-elevated border border-bronze-deep rounded p-2.5 group transition"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="text-[9px] uppercase tracking-[0.22em] text-gold/80 font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="text-xl font-bold tabular-nums leading-none gold-text"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          {value}
        </span>
        <span className="text-[10px] text-muted truncate">{goal}</span>
      </div>
      <div className="mt-2 xp-track" style={{ height: 4 }}>
        {clamped > 0 && (
          <div
            className="xp-fill"
            style={{
              width: `${clamped * 100}%`,
              background: color,
            }}
          />
        )}
      </div>
    </Link>
  );
}

