/**
 * Achievement badges.
 *
 * - Definitions live here.
 * - `evaluateBadges(snapshot)` returns the set of badge IDs the user
 *   currently qualifies for; the dashboard server inserts any newly
 *   qualified IDs into the `achievements` table on each load (insert
 *   ... on conflict do nothing).
 * - "Earned" is monotonic — once a badge is in the table it stays even
 *   if conditions later fail (e.g. score drops below tier).
 */

import { LEVEL_RANK, ZONES, type StrengthLevel, type Zone } from "./strength";
import type { RankTier } from "./scoring";

export type BadgeCategory = "lifting" | "journey" | "sustenance" | "overall";

export type Badge = {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
};

export const BADGES: Badge[] = [
  // ─── Lifting ──────────────────────────────────────────────────
  {
    id: "lifting.first_blood",
    name: "First Blood",
    description: "Log your first workout",
    category: "lifting",
  },
  {
    id: "lifting.iron_will",
    name: "Iron Will",
    description: "Log 10 workouts",
    category: "lifting",
  },
  {
    id: "lifting.awakened",
    name: "Awakened",
    description: "Reach Awakened in any muscle group",
    category: "lifting",
  },
  {
    id: "lifting.legendary",
    name: "Legendary",
    description: "Reach Legendary in any muscle group",
    category: "lifting",
  },
  {
    id: "lifting.full_atlas",
    name: "Full Atlas",
    description: "Take every muscle group above Dormant",
    category: "lifting",
  },
  {
    id: "lifting.big_three",
    name: "Big Three",
    description: "Set PRs on Bench, Squat, and Deadlift",
    category: "lifting",
  },

  // ─── Journey ──────────────────────────────────────────────────
  {
    id: "journey.first_steps",
    name: "First Steps",
    description: "Log steps for the first time",
    category: "journey",
  },
  {
    id: "journey.10k_club",
    name: "10K Club",
    description: "Reach 10,000 steps in a single day",
    category: "journey",
  },
  {
    id: "journey.week_warrior",
    name: "Week Warrior",
    description: "Hit your step goal 7 days in a row",
    category: "journey",
  },
  {
    id: "journey.month_march",
    name: "Month March",
    description: "Hit your step goal 30 days in a row",
    category: "journey",
  },

  // ─── Sustenance ───────────────────────────────────────────────
  {
    id: "sustenance.first_meal",
    name: "First Meal",
    description: "Log nutrition for the first time",
    category: "sustenance",
  },
  {
    id: "sustenance.week_of_plenty",
    name: "Week of Plenty",
    description: "Log nutrition 7 days in a row",
    category: "sustenance",
  },
  {
    id: "sustenance.macro_master",
    name: "Macro Master",
    description: "Hit every macro goal in a single day",
    category: "sustenance",
  },

  // ─── Overall ──────────────────────────────────────────────────
  {
    id: "overall.warrior",
    name: "Warrior",
    description: "Reach the Warrior rank",
    category: "overall",
  },
  {
    id: "overall.champion",
    name: "Champion",
    description: "Reach the Champion rank",
    category: "overall",
  },
  {
    id: "overall.legend",
    name: "Legend",
    description: "Reach the Legend rank",
    category: "overall",
  },
  {
    id: "overall.balanced",
    name: "Balanced",
    description: "All three pillar scores above 60",
    category: "overall",
  },
];

const BADGE_BY_ID: Record<string, Badge> = {};
BADGES.forEach((b) => {
  BADGE_BY_ID[b.id] = b;
});

export function badgeById(id: string): Badge | null {
  return BADGE_BY_ID[id] ?? null;
}

// ──────────────────────────────────────────────────────────────────
// Evaluation
// ──────────────────────────────────────────────────────────────────

export type BadgeSnapshot = {
  totalWorkoutDates: number; // distinct dates in workouts
  zoneLevels: Partial<Record<Zone, StrengthLevel>>;
  prsCount: number; // unique big-three lifts with a PR row
  bestStepDay: number;
  stepStreak: number; // current step-goal streak (days)
  totalNutritionDays: number; // distinct dates with any nutrition logged
  nutritionStreak: number; // current run of consecutive logged days
  hitAllMacrosToday: boolean; // calories within 10% AND each macro within 15%
  scores: { atlas: number; journey: number; sustenance: number };
  rank: RankTier;
};

/** Returns the set of badge IDs the user qualifies for right now. */
export function evaluateBadges(s: BadgeSnapshot): Set<string> {
  const earned = new Set<string>();

  // Lifting
  if (s.totalWorkoutDates >= 1) earned.add("lifting.first_blood");
  if (s.totalWorkoutDates >= 10) earned.add("lifting.iron_will");
  const ranks = ZONES.map((z) => LEVEL_RANK[s.zoneLevels[z] ?? "untrained"]);
  if (ranks.some((r) => r >= 1)) earned.add("lifting.awakened");
  if (ranks.some((r) => r >= 5)) earned.add("lifting.legendary");
  if (ranks.every((r) => r >= 1)) earned.add("lifting.full_atlas");
  if (s.prsCount >= 3) earned.add("lifting.big_three");

  // Journey
  if (s.bestStepDay > 0) earned.add("journey.first_steps");
  if (s.bestStepDay >= 10000) earned.add("journey.10k_club");
  if (s.stepStreak >= 7) earned.add("journey.week_warrior");
  if (s.stepStreak >= 30) earned.add("journey.month_march");

  // Sustenance
  if (s.totalNutritionDays >= 1) earned.add("sustenance.first_meal");
  if (s.nutritionStreak >= 7) earned.add("sustenance.week_of_plenty");
  if (s.hitAllMacrosToday) earned.add("sustenance.macro_master");

  // Overall
  const r = s.rank;
  if (r === "warrior" || r === "champion" || r === "legend")
    earned.add("overall.warrior");
  if (r === "champion" || r === "legend") earned.add("overall.champion");
  if (r === "legend") earned.add("overall.legend");
  if (
    s.scores.atlas > 60 &&
    s.scores.journey > 60 &&
    s.scores.sustenance > 60
  )
    earned.add("overall.balanced");

  return earned;
}
