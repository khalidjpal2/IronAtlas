/**
 * Three-pillar scoring + Overall Rank.
 *
 * All scores recompute on every dashboard load from raw logs — nothing
 * is persisted. Decay is calculated from "days since last log" rather
 * than stored, so a user who comes back after a long break sees the
 * dip immediately without us having to run a cron.
 */

import {
  LEVEL_RANK,
  ZONES,
  type StrengthLevel,
  type Zone,
} from "./strength";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type NutritionMode = "bulk" | "cut" | "maintain";

export type RankTier =
  | "dormant"
  | "initiate"
  | "warrior"
  | "champion"
  | "legend";

export type ScoreBreakdown = {
  atlas: number;     // 0..100
  journey: number;   // 0..100
  sustenance: number;// 0..100
  overall: number;   // 0..100
  rank: RankTier;
  rankLabel: string;
};

export type ZoneDecay = {
  daysSinceLastTrained: number | null;
  effectiveLevel: StrengthLevel; // post-decay (used for Atlas score)
  warning: boolean;              // 11+ days idle — show "decaying soon"
  decayed: boolean;              // 14+ days — actively losing levels
};

// ──────────────────────────────────────────────────────────────────
// Rank table
// ──────────────────────────────────────────────────────────────────

export const RANK_TIERS: Array<{
  min: number;
  tier: RankTier;
  label: string;
  color: string;
}> = [
  { min: 0,  tier: "dormant",   label: "Dormant",   color: "#4a4a52" },
  { min: 21, tier: "initiate",  label: "Initiate",  color: "#3a5a8a" },
  { min: 41, tier: "warrior",   label: "Warrior",   color: "#3d6b3a" },
  { min: 61, tier: "champion",  label: "Champion",  color: "#b8860b" },
  { min: 81, tier: "legend",    label: "Legend",    color: "#5b3993" },
];

export function rankForScore(score: number): {
  tier: RankTier;
  label: string;
  color: string;
} {
  let pick = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (score >= t.min) pick = t;
  }
  return { tier: pick.tier, label: pick.label, color: pick.color };
}

/** Same gradient ramp for any 0..100 score bar. */
export function colorForScore(score: number): string {
  return rankForScore(score).color;
}

// ──────────────────────────────────────────────────────────────────
// ATLAS — average muscle level, with idle-decay
// ──────────────────────────────────────────────────────────────────

const LEVEL_FROM_RANK: StrengthLevel[] = [
  "untrained",
  "below",
  "average",
  "above",
  "exceptional",
  "elite",
];

function levelFromNumeric(n: number): StrengthLevel {
  const i = Math.max(0, Math.min(5, Math.round(n)));
  return LEVEL_FROM_RANK[i];
}

/**
 * Returns the post-decay (effective) level for each zone, plus warning
 * flags so the UI can show "Chest decaying — train within 3 days".
 * `daysSinceLastTrained[zone]` is null if never trained.
 */
export function applyZoneDecay(
  zoneLevels: Partial<Record<Zone, StrengthLevel>>,
  daysSinceLastTrained: Partial<Record<Zone, number | null>>
): Record<Zone, ZoneDecay> {
  const out = {} as Record<Zone, ZoneDecay>;
  for (const z of ZONES) {
    const lvl = zoneLevels[z] ?? "untrained";
    const baseRank = LEVEL_RANK[lvl];
    const days = daysSinceLastTrained[z] ?? null;

    let drop = 0;
    if (days != null) {
      if (days >= 28) drop = 2;
      else if (days >= 21) drop = 1;
      else if (days >= 14) drop = 0.5;
    }

    const effRank = Math.max(0, baseRank - drop);
    out[z] = {
      daysSinceLastTrained: days,
      effectiveLevel: levelFromNumeric(effRank),
      warning: days != null && days >= 11 && days < 14,
      decayed: drop > 0,
    };
  }
  return out;
}

export function computeAtlasScore(
  zoneDecay: Record<Zone, ZoneDecay>
): number {
  let sum = 0;
  for (const z of ZONES) {
    sum += LEVEL_RANK[zoneDecay[z].effectiveLevel];
  }
  const avg = sum / ZONES.length; // 0..5
  return clamp((avg / 5) * 100);
}

// ──────────────────────────────────────────────────────────────────
// JOURNEY — tiered step scoring
// ──────────────────────────────────────────────────────────────────
//
// Two goals: a fixed BASE GOAL (10,000) and a per-user PERSONAL GOAL
// (anything > base). Each LOGGED day contributes points; unlogged
// days are skipped entirely (vacations don't punish you). Hitting the
// personal goal multiplies the day's score by 1.5x and contributes
// to a streak bonus that ramps +1/day (cap +10/day, resets on a
// logged miss).

export type StepDay = { date: string; steps: number };

export const JOURNEY_BASE_GOAL = 10000;

export type DailyJourneyPoints = {
  steps: number;
  basePoints: number;        // -10..+10 from the steps-vs-base tier
  bonusFromAbove: number;    // points for steps above base
  multiplier: 1 | 1.5;       // 1.5x when personal goal met
  total: number;             // (basePoints + bonusFromAbove) * multiplier
  baseGoalMet: boolean;
  personalGoalMet: boolean;
};

/**
 * Score one day's step count under the tiered system.
 * Negative tiers (below base) do not get the multiplier — the
 * multiplier only fires when the personal goal is actually hit.
 */
export function computeDailyJourneyPoints(
  steps: number,
  personalGoal: number,
  baseGoal: number = JOURNEY_BASE_GOAL
): DailyJourneyPoints {
  let basePoints = 0;
  let bonusFromAbove = 0;
  let multiplier: 1 | 1.5 = 1;

  if (steps < baseGoal) {
    if (steps === 0) basePoints = -10;
    else if (steps < 5000) basePoints = -7;
    else if (steps < 7500) basePoints = -5;
    else basePoints = -2;
  } else {
    basePoints = 10;
    const above = steps - baseGoal;
    bonusFromAbove =
      Math.floor(above / 1000) + Math.floor(above / 5000) * 5;
    if (steps >= personalGoal) multiplier = 1.5;
  }

  const total = (basePoints + bonusFromAbove) * multiplier;
  return {
    steps,
    basePoints,
    bonusFromAbove,
    multiplier,
    total,
    baseGoalMet: steps >= baseGoal,
    personalGoalMet: steps >= personalGoal,
  };
}

/**
 * 0..100 Journey score over the last 30 LOGGED days.
 * Normalized so 30 consecutive days exactly at the personal goal = 100.
 * Uses a 60-day lookback to seed the streak counter, so a user already
 * on a long run gets the full +10/day from day one of the window.
 */
export function computeJourneyScore(
  stepsByDate: Map<string, number>,
  personalGoal: number,
  todayISO: string,
  baseGoal: number = JOURNEY_BASE_GOAL
): number {
  const window60 = lastNDates(todayISO, 60);
  const inLast30 = new Set(lastNDates(todayISO, 30));

  let streak = 0;
  let total = 0;

  for (const iso of window60) {
    if (!stepsByDate.has(iso)) continue; // unlogged → skip
    const day = computeDailyJourneyPoints(
      stepsByDate.get(iso) ?? 0,
      personalGoal,
      baseGoal
    );

    let streakBonus = 0;
    if (day.personalGoalMet) {
      streak += 1;
      streakBonus = Math.min(streak, 10);
    } else {
      streak = 0;
    }

    if (inLast30.has(iso)) {
      total += day.total + streakBonus;
    }
  }

  const dailyAtPersonal = computeDailyJourneyPoints(
    personalGoal,
    personalGoal,
    baseGoal
  ).total;
  const denom = Math.max(1, dailyAtPersonal * 30);
  return clamp((total / denom) * 100);
}

/**
 * Current streak of consecutive logged days hitting `goal`, ending
 * today. Unlogged days don't break the streak (consistent with the
 * scoring rules), but a logged day below the goal does.
 */
export function currentStepStreak(
  stepsByDate: Map<string, number>,
  goal: number,
  todayISO: string
): number {
  let streak = 0;
  const end = new Date(todayISO + "T00:00:00");
  for (let i = 0; i < 365; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (!stepsByDate.has(iso)) continue;
    if ((stepsByDate.get(iso) ?? 0) >= goal) streak += 1;
    else break;
  }
  return streak;
}

// ──────────────────────────────────────────────────────────────────
// SUSTENANCE — mode-aware
// ──────────────────────────────────────────────────────────────────

export type NutritionDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MacroDirection = "negative" | "neutral" | "positive";

export type SustenanceGoals = {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  proteinDirection: MacroDirection;
  carbsDirection: MacroDirection;
  fatDirection: MacroDirection;
};

/**
 * Score a single value against a goal under a direction policy.
 *  POSITIVE: at-or-above goal = 1.0, below = (value/goal)
 *  NEGATIVE: at-or-below goal = 1.0, above = decays linearly past 1.5x
 *  NEUTRAL : within 10% = 1.0, within 20% = 0.6, else = 0.2
 * Returns 0..1.
 */
function directionalMacroScore(
  value: number,
  goal: number,
  direction: MacroDirection
): number {
  if (goal <= 0) return 0;
  const ratio = value / goal;
  if (direction === "positive") {
    if (ratio >= 1) return 1;
    return clamp01(ratio);
  }
  if (direction === "negative") {
    if (ratio <= 1) return 1;
    // Penalise overshoot — at 1.5x goal score = 0.
    return Math.max(0, 1 - (ratio - 1) * 2);
  }
  // neutral
  const dev = Math.abs(ratio - 1);
  if (dev <= 0.10) return 1;
  if (dev <= 0.20) return 0.6;
  return 0.2;
}

/**
 * Day-level Sustenance score — average of the per-macro directional
 * scores, weighted toward calories. Calorie direction is implied by
 * `mode` (cut/maintain/bulk → negative/neutral/positive).
 */
function dayScore(
  d: NutritionDay,
  goals: SustenanceGoals,
  mode: NutritionMode
): number {
  if (d.calories === 0 && d.protein === 0 && d.carbs === 0 && d.fat === 0)
    return 0;

  const calorieDirection: MacroDirection =
    mode === "cut" ? "negative" : mode === "bulk" ? "positive" : "neutral";

  // Calories always count. Macros only count if a goal is set for them.
  let weighted = 0;
  let totalWeight = 0;

  // Calories — biggest weight (the macro most users actually steer by).
  weighted +=
    directionalMacroScore(d.calories, goals.calories, calorieDirection) * 2.0;
  totalWeight += 2.0;

  if (goals.protein != null && goals.protein > 0) {
    weighted +=
      directionalMacroScore(d.protein, goals.protein, goals.proteinDirection) *
      1.0;
    totalWeight += 1.0;
  }
  if (goals.carbs != null && goals.carbs > 0) {
    weighted +=
      directionalMacroScore(d.carbs, goals.carbs, goals.carbsDirection) * 0.5;
    totalWeight += 0.5;
  }
  if (goals.fat != null && goals.fat > 0) {
    weighted +=
      directionalMacroScore(d.fat, goals.fat, goals.fatDirection) * 0.5;
    totalWeight += 0.5;
  }

  return clamp01(weighted / totalWeight);
}

export function computeSustenanceScore(
  nutritionByDate: Map<string, NutritionDay>,
  goals: SustenanceGoals,
  mode: NutritionMode,
  todayISO: string
): number {
  const last30 = lastNDates(todayISO, 30);
  let total = 0;
  let countedDays = 0;
  for (const iso of last30) {
    const d = nutritionByDate.get(iso);
    if (!d) continue;
    total += dayScore(d, goals, mode) * 100;
    countedDays += 1;
  }
  // Score = average over LOGGED days, scaled by logging coverage so a
  // single perfect day doesn't max out the score.
  const coverage = countedDays / 30;
  let score =
    countedDays === 0 ? 0 : (total / countedDays) * Math.min(1, coverage * 1.5);

  // Decay
  const idle = daysSinceLastLog(nutritionByDate, todayISO);
  if (idle != null) {
    if (idle >= 14) score -= 30;
    else if (idle >= 7) score -= 15;
    else if (idle >= 3) score -= 5;
  }

  return clamp(score);
}

// ──────────────────────────────────────────────────────────────────
// Overall rank (weighted)
// ──────────────────────────────────────────────────────────────────

export function combineScores(input: {
  atlas: number;
  journey: number;
  sustenance: number;
  questBonus?: number; // +5 if all 3 quests done that day
}): ScoreBreakdown {
  const overall = clamp(
    input.atlas * 0.4 +
      input.journey * 0.3 +
      input.sustenance * 0.3 +
      (input.questBonus ?? 0)
  );
  const r = rankForScore(overall);
  return {
    atlas: round(input.atlas),
    journey: round(input.journey),
    sustenance: round(input.sustenance),
    overall: round(overall),
    rank: r.tier,
    rankLabel: r.label,
  };
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function round(n: number) {
  return Math.round(n);
}

function lastNDates(todayISO: string, n: number): string[] {
  const out: string[] = [];
  const end = new Date(todayISO + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function daysSinceLastLog(
  byDate: Map<string, NutritionDay>,
  todayISO: string
): number | null {
  const end = new Date(todayISO + "T00:00:00");
  for (let i = 0; i < 365; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const e = byDate.get(iso);
    if (e && (e.calories > 0 || e.protein > 0)) return i;
  }
  return null;
}

/**
 * Build a "days since last trained" map for each zone from the user's
 * raw workout sets. Returns null for zones never trained.
 */
export function daysSinceLastTrainedByZone(
  sets: Array<{ muscle_group: string; date: string }>,
  todayISO: string
): Partial<Record<Zone, number | null>> {
  const lastByZone = new Map<string, string>(); // zone -> latest ISO
  for (const s of sets) {
    if (!s.date) continue;
    const cur = lastByZone.get(s.muscle_group);
    if (!cur || s.date > cur) lastByZone.set(s.muscle_group, s.date);
  }
  const out: Partial<Record<Zone, number | null>> = {};
  const end = new Date(todayISO + "T00:00:00");
  for (const z of ZONES) {
    const last = lastByZone.get(z);
    if (!last) {
      out[z] = null;
      continue;
    }
    const d = new Date(last + "T00:00:00");
    out[z] = Math.max(
      0,
      Math.round((end.getTime() - d.getTime()) / 86_400_000)
    );
  }
  return out;
}
