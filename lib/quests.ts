/**
 * Daily quests — three fixed personal-goal quests:
 *   1. Journey: hit your daily step goal
 *   2. Sustenance: hit your daily calorie goal (mode-aware)
 *   3. Atlas: clear your daily workout goal (any / 3+ / 5+ / 10+ sets)
 *
 * Quest text is built dynamically from the user's profile + goals so it
 * always reads as "your goal, today" — there is no longer a random pick
 * from a catalog. The three quest IDs are stable strings that the
 * server stores in daily_quests for completion accounting.
 */

import {
  ZONES,
  type Zone,
  type StrengthLevel,
} from "./strength";
import type { NutritionMode } from "./scoring";

export type QuestPillar = "atlas" | "journey" | "sustenance";

export type Quest = {
  id: string;
  pillar: QuestPillar;
  text: string;
};

export type WorkoutGoalChoice = "any" | "sets_3" | "sets_5" | "sets_10";

const WORKOUT_GOAL_REQUIRED_SETS: Record<WorkoutGoalChoice, number> = {
  any: 1,
  sets_3: 3,
  sets_5: 5,
  sets_10: 10,
};

// ── Stable quest IDs (one per pillar) ──────────────────────────────
export const QUEST_IDS = {
  atlas: "atlas.workout_goal",
  journey: "journey.step_goal",
  sustenance: "sustenance.calorie_goal",
} as const;

// ── Workout schedule integration ──────────────────────────────────

export type WorkoutType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "custom";

export type ScheduleDay = {
  day_of_week: number; // 0 = Sun, 6 = Sat
  is_rest: boolean;
  workout_type: WorkoutType | null;
};

const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  push: "Push Day",
  pull: "Pull Day",
  legs: "Leg Day",
  upper: "Upper Body",
  lower: "Lower Body",
  full_body: "Full Body",
  custom: "Custom",
};

/**
 * Resolve today's scheduled day from a sparse schedule array. Returns
 * null when nothing is set for today (caller falls back to the legacy
 * "any set logged today" rule).
 */
export function todayScheduleEntry(
  schedule: ScheduleDay[] | null | undefined,
  todayDow: number
): ScheduleDay | null {
  if (!schedule) return null;
  return schedule.find((d) => d.day_of_week === todayDow) ?? null;
}

/**
 * Build today's three quests from the user's personal goals. Text is
 * tailored to the user's actual numbers ("Hit 10,000 steps", "Stay
 * under 1,500 cal"). Atlas quest text adapts to today's scheduled
 * workout type when one is set.
 */
export function getDailyQuests(opts: {
  stepGoal: number;
  calorieGoal: number;
  mode: NutritionMode;
  workoutGoal: WorkoutGoalChoice;
  todaySchedule?: ScheduleDay | null;
}): { atlas: Quest; journey: Quest; sustenance: Quest } {
  const { stepGoal, calorieGoal, mode, todaySchedule } = opts;

  const journeyText = `Hit your step goal — ${stepGoal.toLocaleString()} steps`;

  const sustenanceText =
    mode === "bulk"
      ? `Eat at least ${calorieGoal.toLocaleString()} cal today`
      : mode === "cut"
      ? `Stay under ${calorieGoal.toLocaleString()} cal today`
      : `Stay within 10% of ${calorieGoal.toLocaleString()} cal today`;

  let atlasText: string;
  if (todaySchedule?.is_rest) {
    atlasText = "Today: Rest Day";
  } else if (todaySchedule?.workout_type) {
    atlasText = `Today: ${WORKOUT_TYPE_LABEL[todaySchedule.workout_type]} — log your workout`;
  } else {
    atlasText = "Complete your workout for the day";
  }

  return {
    atlas: { id: QUEST_IDS.atlas, pillar: "atlas", text: atlasText },
    journey: { id: QUEST_IDS.journey, pillar: "journey", text: journeyText },
    sustenance: {
      id: QUEST_IDS.sustenance,
      pillar: "sustenance",
      text: sustenanceText,
    },
  };
}

// ── Evaluation ─────────────────────────────────────────────────────

export type QuestEvalSnapshot = {
  todayISO: string;
  workoutGoal: WorkoutGoalChoice;
  mode: NutritionMode;

  todaySetsCount: number;
  todaySteps: number;
  stepGoal: number;
  todayCalories: number;
  goalCalories: number;
  /** Optional: today's schedule entry. Rest days auto-complete the
   *  atlas quest; train days require a logged set. */
  todaySchedule?: ScheduleDay | null;
};

export function evaluateQuest(
  questId: string,
  s: QuestEvalSnapshot
): boolean {
  switch (questId) {
    case QUEST_IDS.atlas: {
      // Rest day → auto-complete.
      if (s.todaySchedule?.is_rest) return true;
      // Train day or no schedule set → require any logged set today.
      // (The legacy `workoutGoal` count is no longer the gate; the
      // simpler "did you train today" rule matches the new spec.)
      return s.todaySetsCount >= 1;
    }
    case QUEST_IDS.journey:
      return s.stepGoal > 0 && s.todaySteps >= s.stepGoal;
    case QUEST_IDS.sustenance: {
      if (!s.goalCalories || s.todayCalories === 0) return false;
      if (s.mode === "bulk") return s.todayCalories >= s.goalCalories;
      if (s.mode === "cut") return s.todayCalories <= s.goalCalories;
      // maintain
      const dev = Math.abs(s.todayCalories - s.goalCalories) / s.goalCalories;
      return dev <= 0.10;
    }
    default:
      return false;
  }
}

/**
 * Find the user's lowest-tier zone (used by the "train weakest" quest).
 * If multiple zones tie at the lowest tier, returns the first in ZONES.
 */
export function pickWeakestZone(
  zoneLevels: Partial<Record<Zone, StrengthLevel>>
): Zone | null {
  const RANK: Record<StrengthLevel, number> = {
    untrained: 0,
    below: 1,
    average: 2,
    above: 3,
    exceptional: 4,
    elite: 5,
  };
  let best: { zone: Zone; rank: number } | null = null;
  for (const z of ZONES) {
    const r = RANK[zoneLevels[z] ?? "untrained"];
    if (best == null || r < best.rank) best = { zone: z, rank: r };
  }
  return best?.zone ?? null;
}
