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

/**
 * Build today's three quests from the user's personal goals. Text is
 * tailored to the user's actual numbers ("Hit 10,000 steps", "Stay
 * under 1,500 cal").
 */
export function getDailyQuests(opts: {
  stepGoal: number;
  calorieGoal: number;
  mode: NutritionMode;
  workoutGoal: WorkoutGoalChoice;
}): { atlas: Quest; journey: Quest; sustenance: Quest } {
  const { stepGoal, calorieGoal, mode, workoutGoal } = opts;

  const journeyText = `Hit your step goal — ${stepGoal.toLocaleString()} steps`;

  const sustenanceText =
    mode === "bulk"
      ? `Eat at least ${calorieGoal.toLocaleString()} cal today`
      : mode === "cut"
      ? `Stay under ${calorieGoal.toLocaleString()} cal today`
      : `Stay within 10% of ${calorieGoal.toLocaleString()} cal today`;

  const required = WORKOUT_GOAL_REQUIRED_SETS[workoutGoal];
  const atlasText =
    workoutGoal === "any"
      ? "Log at least one exercise today"
      : `Log at least ${required} sets today`;

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
};

export function evaluateQuest(
  questId: string,
  s: QuestEvalSnapshot
): boolean {
  switch (questId) {
    case QUEST_IDS.atlas: {
      const required = WORKOUT_GOAL_REQUIRED_SETS[s.workoutGoal];
      return s.todaySetsCount >= required;
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
