/**
 * Strength standards — code is the source of truth.
 *
 * Every exercise that appears in EXERCISE_OPTIONS should have an
 * entry below. Adding a new exercise means: add it to EXERCISE_OPTIONS
 * AND add a baseline row here. The Atlas heatmap will grade the
 * exercise immediately on next page load — no SQL migration required.
 *
 * Encoding mirrors the cross-join formula previously embedded in
 * supabase/seed_standards.sql:
 *   final_value = round(base_value × age_mult × sex_mult)
 * where multipliers depend on the user's age_group and sex, and the
 * exercise's zone_tag (upper / lower / bodyweight / endurance).
 *
 * Selecting standards via `selectStandards()` always pulls the 18-25
 * cohort and applies the runtime AGE_ADJUSTMENT to scores — same
 * design as before. Sex multipliers are applied at synthesis time
 * here so a female lifter sees correctly-scaled thresholds.
 *
 * The `strength_standards` DB table is now an *override* layer: any
 * row present in the DB takes precedence over the matching code row.
 * This lets an admin tune a single exercise live without a deploy.
 */

import type { StandardRow } from "./strength";

// ──────────────────────────────────────────────────────────────────
// Multiplier tables (mirror of seed_standards.sql)
// ──────────────────────────────────────────────────────────────────

export type StandardZoneTag = "upper" | "lower" | "bodyweight" | "endurance";

const AGE_MULT: Record<string, number> = {
  "18-25": 1.0,
  "26-35": 1.0,
  "36-45": 0.92,
  "46+": 0.8,
};

const SEX_MULT: Record<StandardZoneTag, Record<"male" | "female", number>> = {
  upper: { male: 1.0, female: 0.65 },
  lower: { male: 1.0, female: 0.75 },
  bodyweight: { male: 1.0, female: 0.55 },
  endurance: { male: 1.0, female: 0.85 },
};

// ──────────────────────────────────────────────────────────────────
// Baseline values (18-25 male)
// ──────────────────────────────────────────────────────────────────

type BaseStandard = {
  muscle_group: string;
  exercise_name: string;
  zone_tag: StandardZoneTag;
  b: number; // below_average
  a: number; // average
  ab: number; // above_average
  ex: number; // exceptional
  el: number; // elite
};

export const BASE_STANDARDS: BaseStandard[] = [
  // Chest
  { muscle_group: "chest", exercise_name: "Bench Press", zone_tag: "upper", b: 135, a: 185, ab: 235, ex: 290, el: 350 },
  { muscle_group: "chest", exercise_name: "Incline Bench Press", zone_tag: "upper", b: 115, a: 160, ab: 210, ex: 260, el: 315 },
  { muscle_group: "chest", exercise_name: "Incline Press", zone_tag: "upper", b: 115, a: 160, ab: 210, ex: 260, el: 315 },
  { muscle_group: "chest", exercise_name: "Decline Bench Press", zone_tag: "upper", b: 145, a: 195, ab: 245, ex: 300, el: 360 },
  { muscle_group: "chest", exercise_name: "Decline Press", zone_tag: "upper", b: 145, a: 195, ab: 245, ex: 300, el: 360 },
  { muscle_group: "chest", exercise_name: "Machine Chest Press", zone_tag: "upper", b: 130, a: 180, ab: 230, ex: 285, el: 345 },
  { muscle_group: "chest", exercise_name: "Pec Deck", zone_tag: "upper", b: 60, a: 95, ab: 130, ex: 170, el: 210 },
  { muscle_group: "chest", exercise_name: "Cable Fly", zone_tag: "upper", b: 50, a: 80, ab: 115, ex: 150, el: 185 },
  { muscle_group: "chest", exercise_name: "Push Up", zone_tag: "bodyweight", b: 20, a: 40, ab: 60, ex: 80, el: 110 },

  // Back
  { muscle_group: "back", exercise_name: "Pull Up", zone_tag: "bodyweight", b: 0, a: 25, ab: 60, ex: 100, el: 145 },
  { muscle_group: "back", exercise_name: "Lat Pulldown", zone_tag: "upper", b: 110, a: 145, ab: 185, ex: 230, el: 280 },
  { muscle_group: "back", exercise_name: "Lat Pulldown (Machine)", zone_tag: "upper", b: 110, a: 145, ab: 185, ex: 230, el: 280 },
  { muscle_group: "back", exercise_name: "Cable Row", zone_tag: "upper", b: 110, a: 145, ab: 185, ex: 230, el: 280 },
  { muscle_group: "back", exercise_name: "Seated Machine Row", zone_tag: "upper", b: 110, a: 145, ab: 185, ex: 230, el: 280 },
  { muscle_group: "back", exercise_name: "T-Bar Row", zone_tag: "upper", b: 100, a: 140, ab: 180, ex: 225, el: 275 },
  { muscle_group: "back", exercise_name: "Barbell Row", zone_tag: "upper", b: 95, a: 145, ab: 195, ex: 245, el: 305 },
  { muscle_group: "back", exercise_name: "Face Pull", zone_tag: "upper", b: 40, a: 60, ab: 90, ex: 120, el: 150 },
  { muscle_group: "back", exercise_name: "Chest Supported T-Bar Row", zone_tag: "upper", b: 95, a: 135, ab: 180, ex: 230, el: 280 },
  { muscle_group: "back", exercise_name: "Seated Chest Supported Row", zone_tag: "upper", b: 100, a: 140, ab: 180, ex: 225, el: 275 },
  { muscle_group: "back", exercise_name: "Seated Neutral Row", zone_tag: "upper", b: 100, a: 140, ab: 180, ex: 225, el: 275 },
  { muscle_group: "back", exercise_name: "Reverse Fly", zone_tag: "upper", b: 15, a: 25, ab: 40, ex: 55, el: 75 },
  { muscle_group: "back", exercise_name: "Shrugs", zone_tag: "upper", b: 135, a: 185, ab: 245, ex: 315, el: 405 },
  { muscle_group: "back", exercise_name: "Prone Y-Raise", zone_tag: "upper", b: 5, a: 10, ab: 15, ex: 25, el: 35 },
  { muscle_group: "back", exercise_name: "Back Extension", zone_tag: "lower", b: 25, a: 45, ab: 70, ex: 100, el: 135 },
  { muscle_group: "back", exercise_name: "Deadlift", zone_tag: "lower", b: 175, a: 275, ab: 365, ex: 450, el: 545 },

  // Shoulders
  { muscle_group: "shoulders", exercise_name: "Lateral Raise", zone_tag: "upper", b: 15, a: 25, ab: 40, ex: 55, el: 75 },
  { muscle_group: "shoulders", exercise_name: "Front Raise", zone_tag: "upper", b: 15, a: 25, ab: 40, ex: 55, el: 75 },
  { muscle_group: "shoulders", exercise_name: "Machine Shoulder Press", zone_tag: "upper", b: 95, a: 135, ab: 175, ex: 220, el: 265 },
  { muscle_group: "shoulders", exercise_name: "Overhead Press", zone_tag: "upper", b: 75, a: 115, ab: 155, ex: 195, el: 240 },
  { muscle_group: "shoulders", exercise_name: "Arnold Press", zone_tag: "upper", b: 50, a: 80, ab: 115, ex: 150, el: 185 },
  { muscle_group: "shoulders", exercise_name: "Rear Delt Fly", zone_tag: "upper", b: 15, a: 25, ab: 40, ex: 55, el: 75 },

  // Biceps
  { muscle_group: "biceps", exercise_name: "Barbell Curl", zone_tag: "upper", b: 55, a: 80, ab: 110, ex: 145, el: 185 },
  { muscle_group: "biceps", exercise_name: "Dumbbell Curl", zone_tag: "upper", b: 30, a: 45, ab: 60, ex: 80, el: 100 },
  { muscle_group: "biceps", exercise_name: "Incline Dumbbell Curl", zone_tag: "upper", b: 25, a: 40, ab: 55, ex: 75, el: 95 },
  { muscle_group: "biceps", exercise_name: "Hammer Curl", zone_tag: "upper", b: 40, a: 55, ab: 75, ex: 95, el: 120 },
  { muscle_group: "biceps", exercise_name: "Preacher Curl", zone_tag: "upper", b: 50, a: 75, ab: 100, ex: 130, el: 165 },
  { muscle_group: "biceps", exercise_name: "Cable Curl", zone_tag: "upper", b: 50, a: 75, ab: 100, ex: 130, el: 165 },

  // Triceps
  { muscle_group: "triceps", exercise_name: "Tricep Pushdown", zone_tag: "upper", b: 50, a: 75, ab: 105, ex: 140, el: 175 },
  { muscle_group: "triceps", exercise_name: "Overhead Tricep Cable", zone_tag: "upper", b: 40, a: 60, ab: 85, ex: 115, el: 145 },
  { muscle_group: "triceps", exercise_name: "Skull Crusher", zone_tag: "upper", b: 50, a: 75, ab: 100, ex: 130, el: 160 },
  { muscle_group: "triceps", exercise_name: "Dumbbell Overhead Extension", zone_tag: "upper", b: 40, a: 60, ab: 85, ex: 115, el: 145 },
  { muscle_group: "triceps", exercise_name: "Cable Pushdown", zone_tag: "upper", b: 50, a: 75, ab: 105, ex: 140, el: 175 },
  { muscle_group: "triceps", exercise_name: "Overhead Cable Rope Extension", zone_tag: "upper", b: 35, a: 55, ab: 80, ex: 110, el: 140 },
  { muscle_group: "triceps", exercise_name: "Close Grip Bench Press", zone_tag: "upper", b: 115, a: 165, ab: 215, ex: 270, el: 325 },
  { muscle_group: "triceps", exercise_name: "Dips", zone_tag: "bodyweight", b: 0, a: 10, ab: 25, ex: 45, el: 70 },

  // Quads
  { muscle_group: "quads", exercise_name: "Squat", zone_tag: "lower", b: 135, a: 230, ab: 305, ex: 385, el: 470 },
  { muscle_group: "quads", exercise_name: "Leg Extension", zone_tag: "lower", b: 95, a: 145, ab: 195, ex: 250, el: 310 },
  { muscle_group: "quads", exercise_name: "Leg Press", zone_tag: "lower", b: 270, a: 410, ab: 545, ex: 685, el: 825 },
  { muscle_group: "quads", exercise_name: "Hack Squat", zone_tag: "lower", b: 180, a: 270, ab: 360, ex: 460, el: 565 },
  { muscle_group: "quads", exercise_name: "Bulgarian Split Squat", zone_tag: "lower", b: 80, a: 130, ab: 180, ex: 230, el: 280 },

  // Hamstrings
  { muscle_group: "hamstrings", exercise_name: "Hamstring Curl", zone_tag: "lower", b: 75, a: 115, ab: 155, ex: 200, el: 245 },
  { muscle_group: "hamstrings", exercise_name: "Seated Leg Curl", zone_tag: "lower", b: 75, a: 115, ab: 155, ex: 200, el: 245 },
  { muscle_group: "hamstrings", exercise_name: "Romanian Deadlift", zone_tag: "lower", b: 135, a: 205, ab: 275, ex: 350, el: 425 },
  { muscle_group: "hamstrings", exercise_name: "Good Morning", zone_tag: "lower", b: 95, a: 145, ab: 195, ex: 245, el: 305 },
  { muscle_group: "hamstrings", exercise_name: "Nordic Curl", zone_tag: "bodyweight", b: 3, a: 5, ab: 10, ex: 15, el: 20 },

  // Glutes
  { muscle_group: "glutes", exercise_name: "Hip Thrust", zone_tag: "lower", b: 185, a: 275, ab: 360, ex: 450, el: 545 },
  { muscle_group: "glutes", exercise_name: "Glute Bridge", zone_tag: "lower", b: 135, a: 200, ab: 265, ex: 335, el: 405 },
  { muscle_group: "glutes", exercise_name: "Cable Kickback", zone_tag: "lower", b: 30, a: 50, ab: 70, ex: 95, el: 120 },
  { muscle_group: "glutes", exercise_name: "Clam Shell", zone_tag: "bodyweight", b: 0, a: 5, ab: 10, ex: 20, el: 35 },
  { muscle_group: "glutes", exercise_name: "Side-Lying Hip Raise", zone_tag: "bodyweight", b: 0, a: 5, ab: 10, ex: 20, el: 35 },
  { muscle_group: "glutes", exercise_name: "Abductor Machine", zone_tag: "lower", b: 90, a: 135, ab: 180, ex: 230, el: 280 },
  { muscle_group: "glutes", exercise_name: "Adductor Machine", zone_tag: "lower", b: 90, a: 135, ab: 180, ex: 230, el: 280 },

  // Calves
  { muscle_group: "calves", exercise_name: "Standing Calf Raise", zone_tag: "lower", b: 95, a: 165, ab: 225, ex: 295, el: 365 },
  { muscle_group: "calves", exercise_name: "Seated Calf Raise", zone_tag: "lower", b: 70, a: 110, ab: 150, ex: 200, el: 250 },
  { muscle_group: "calves", exercise_name: "Leg Press Calf Raise", zone_tag: "lower", b: 180, a: 270, ab: 360, ex: 460, el: 565 },
  { muscle_group: "calves", exercise_name: "Tibialis Raise", zone_tag: "lower", b: 25, a: 45, ab: 65, ex: 90, el: 120 },

  // Forearms
  { muscle_group: "forearms", exercise_name: "Wrist Curl", zone_tag: "upper", b: 30, a: 50, ab: 75, ex: 100, el: 130 },
  { muscle_group: "forearms", exercise_name: "Reverse Curl", zone_tag: "upper", b: 25, a: 45, ab: 65, ex: 90, el: 115 },

  // Abs
  { muscle_group: "abs", exercise_name: "Ab Crunch Machine", zone_tag: "upper", b: 80, a: 130, ab: 180, ex: 230, el: 290 },
  { muscle_group: "abs", exercise_name: "Plank", zone_tag: "endurance", b: 30, a: 60, ab: 120, ex: 240, el: 360 },
  { muscle_group: "abs", exercise_name: "Cable Crunch", zone_tag: "upper", b: 90, a: 135, ab: 180, ex: 230, el: 280 },
  { muscle_group: "abs", exercise_name: "Hanging Leg Raise", zone_tag: "endurance", b: 5, a: 10, ab: 20, ex: 30, el: 50 },
  { muscle_group: "abs", exercise_name: "Russian Twist", zone_tag: "endurance", b: 20, a: 40, ab: 60, ex: 80, el: 100 },
  { muscle_group: "abs", exercise_name: "Ab Wheel", zone_tag: "endurance", b: 5, a: 10, ab: 20, ex: 30, el: 50 },
];

// ──────────────────────────────────────────────────────────────────
// Synthesis
// ──────────────────────────────────────────────────────────────────

function synthesize(
  base: BaseStandard,
  ageGroup: string,
  sex: "male" | "female"
): StandardRow {
  const ageMult = AGE_MULT[ageGroup] ?? 1.0;
  const sexMult = SEX_MULT[base.zone_tag][sex];
  const m = ageMult * sexMult;
  const round = (n: number) => Math.max(0, Math.round(n * m));
  return {
    muscle_group: base.muscle_group,
    exercise_name: base.exercise_name,
    age_group: ageGroup,
    sex,
    below_average_lbs: round(base.b),
    average_lbs: round(base.a),
    above_average_lbs: round(base.ab),
    exceptional_lbs: round(base.ex),
    elite_lbs: round(base.el),
  };
}

/**
 * Synthesize a full set of standards for the given demographic from
 * the in-code baseline. This is the primary source of truth.
 */
export function synthesizeStandardsFor(
  ageGroup: string,
  sex: string
): StandardRow[] {
  const sexNorm: "male" | "female" = sex === "female" ? "female" : "male";
  return BASE_STANDARDS.map((b) => synthesize(b, ageGroup, sexNorm));
}

// =============================================================
// 5-TIER STRENGTH STANDARDS (Beginner / Novice / Intermediate /
// Advanced / Elite). Replaces the legacy below/average/above/
// exceptional/elite slots inside StandardRow with bodyweight-
// interpolated thresholds for the Big Three + OHP, multiplier-based
// thresholds for isolation lifts, and an e1RM conversion for pull-ups.
//
// Internal StrengthLevel enum names are unchanged for backward
// compatibility; the new tier *labels* (Untrained / Beginner /
// Novice / Intermediate / Advanced / Elite) are surfaced via
// LEVEL_LABEL in lib/strength.ts. The mapping is:
//   below       -> Beginner    (gray   #6b7280)
//   average     -> Novice      (blue   #3b82f6)
//   above       -> Intermediate(green  #22c55e)
//   exceptional -> Advanced    (amber  #f59e0b)
//   elite       -> Elite       (purple #a855f7)
// =============================================================

type FiveTier = { beg: number; nov: number; int: number; adv: number; el: number };
type BWRow = { bw: number } & FiveTier;

// Male absolute-weight tables (lbs) — 5 tiers across bodyweights.
// Each row carries thresholds for an entire-body weight; consumers
// linearly interpolate between adjacent rows to match the user's
// actual bodyweight. Numbers below match common population-percentile
// strength standards.

const BENCH_M: BWRow[] = [
  { bw: 110, beg:  60, nov:  95, int: 138, adv: 187, el: 240 },
  { bw: 130, beg:  78, nov: 115, int: 161, adv: 215, el: 273 },
  { bw: 150, beg:  93, nov: 133, int: 182, adv: 240, el: 302 },
  { bw: 170, beg: 112, nov: 155, int: 209, adv: 270, el: 336 },
  { bw: 190, beg: 128, nov: 173, int: 230, adv: 295, el: 365 },
  { bw: 210, beg: 142, nov: 190, int: 250, adv: 318, el: 390 },
  { bw: 230, beg: 155, nov: 207, int: 268, adv: 339, el: 414 },
  { bw: 250, beg: 167, nov: 222, int: 285, adv: 358, el: 435 },
  { bw: 270, beg: 178, nov: 235, int: 300, adv: 374, el: 454 },
  { bw: 290, beg: 188, nov: 247, int: 314, adv: 389, el: 471 },
  { bw: 310, beg: 198, nov: 257, int: 326, adv: 402, el: 486 },
];

const SQUAT_M: BWRow[] = [
  { bw: 110, beg:  88, nov: 138, int: 200, adv: 270, el: 348 },
  { bw: 130, beg: 113, nov: 167, int: 234, adv: 312, el: 396 },
  { bw: 150, beg: 135, nov: 193, int: 264, adv: 348, el: 437 },
  { bw: 170, beg: 162, nov: 225, int: 303, adv: 391, el: 488 },
  { bw: 190, beg: 186, nov: 251, int: 333, adv: 428, el: 530 },
  { bw: 210, beg: 205, nov: 275, int: 363, adv: 461, el: 567 },
  { bw: 230, beg: 225, nov: 300, int: 388, adv: 491, el: 600 },
  { bw: 250, beg: 242, nov: 322, int: 414, adv: 519, el: 631 },
  { bw: 270, beg: 258, nov: 341, int: 435, adv: 542, el: 658 },
  { bw: 290, beg: 273, nov: 358, int: 455, adv: 564, el: 683 },
  { bw: 310, beg: 287, nov: 372, int: 472, adv: 583, el: 705 },
];

const DEADLIFT_M: BWRow[] = [
  { bw: 110, beg: 121, nov: 187, int: 270, adv: 365, el: 470 },
  { bw: 130, beg: 156, nov: 230, int: 320, adv: 425, el: 540 },
  { bw: 150, beg: 187, nov: 265, int: 360, adv: 470, el: 595 },
  { bw: 170, beg: 224, nov: 310, int: 415, adv: 540, el: 670 },
  { bw: 190, beg: 256, nov: 350, int: 460, adv: 590, el: 727 },
  { bw: 210, beg: 285, nov: 380, int: 495, adv: 630, el: 770 },
  { bw: 230, beg: 310, nov: 410, int: 530, adv: 670, el: 815 },
  { bw: 250, beg: 335, nov: 440, int: 565, adv: 705, el: 855 },
  { bw: 270, beg: 358, nov: 467, int: 595, adv: 738, el: 893 },
  { bw: 290, beg: 378, nov: 491, int: 622, adv: 766, el: 925 },
  { bw: 310, beg: 397, nov: 513, int: 645, adv: 790, el: 952 },
];

const OHP_M: BWRow[] = [
  { bw: 110, beg:  41, nov:  67, int:  99, adv: 137, el: 178 },
  { bw: 130, beg:  53, nov:  81, int: 116, adv: 156, el: 200 },
  { bw: 150, beg:  65, nov:  95, int: 132, adv: 175, el: 222 },
  { bw: 170, beg:  76, nov: 109, int: 148, adv: 193, el: 244 },
  { bw: 190, beg:  87, nov: 122, int: 163, adv: 211, el: 264 },
  { bw: 210, beg:  97, nov: 134, int: 178, adv: 227, el: 282 },
  { bw: 230, beg: 106, nov: 145, int: 190, adv: 241, el: 298 },
  { bw: 250, beg: 115, nov: 156, int: 202, adv: 255, el: 313 },
  { bw: 270, beg: 122, nov: 164, int: 213, adv: 267, el: 327 },
  { bw: 290, beg: 130, nov: 174, int: 224, adv: 280, el: 340 },
  { bw: 310, beg: 137, nov: 182, int: 233, adv: 290, el: 352 },
];

// Pull-ups — reps required for each tier (male). Converted to
// effective-weight via e1RM at lookup time: weight_eq = bw * (1 + reps/30).
const PULLUPS_M: BWRow[] = [
  { bw: 110, beg: 0, nov: 4, int: 11, adv: 21, el: 32 },
  { bw: 130, beg: 0, nov: 5, int: 12, adv: 22, el: 33 },
  { bw: 150, beg: 0, nov: 6, int: 13, adv: 23, el: 34 },
  { bw: 170, beg: 0, nov: 6, int: 14, adv: 24, el: 35 },
  { bw: 190, beg: 0, nov: 7, int: 15, adv: 25, el: 36 },
  { bw: 210, beg: 0, nov: 7, int: 16, adv: 26, el: 37 },
  { bw: 230, beg: 0, nov: 8, int: 17, adv: 27, el: 38 },
  { bw: 250, beg: 0, nov: 8, int: 18, adv: 28, el: 39 },
  { bw: 270, beg: 0, nov: 9, int: 18, adv: 28, el: 39 },
  { bw: 290, beg: 0, nov: 9, int: 19, adv: 29, el: 40 },
  { bw: 310, beg: 0, nov: 10, int: 20, adv: 30, el: 41 },
];

// Female adjustments — per body region. Multiplied against male
// thresholds at synthesis time.
const FEMALE_REGION_MULT = {
  upper: 0.65,
  lower: 0.80,
  core: 0.70,
  endurance: 0.85,
} as const;

// Map exercise → which female region multiplier applies.
const EXERCISE_REGION: Record<
  string,
  "upper" | "lower" | "core" | "endurance"
> = {
  // Compound
  "Bench Press": "upper",
  "Back Squat": "lower",
  Deadlift: "lower",
  "Overhead Press": "upper",
  // Pull-ups handled separately
  // Lower-body isolation (any zone matching quads/hamstrings/glutes/calves)
};

// Isolation / accessory bodyweight-multiplier table.
// Each value is the user's-bodyweight multiplier required to reach
// that tier (e.g., 0.40 means "0.40 × bodyweight" for that tier).
const ISO_RATIOS: Record<
  string,
  { region: "upper" | "lower" | "core"; r: FiveTier }
> = {
  "Lateral Raise":          { region: "upper", r: { beg: 0.08, nov: 0.12, int: 0.18, adv: 0.24, el: 0.30 } },
  "Front Raise":            { region: "upper", r: { beg: 0.07, nov: 0.11, int: 0.16, adv: 0.22, el: 0.28 } },
  "Barbell Curl":           { region: "upper", r: { beg: 0.20, nov: 0.30, int: 0.40, adv: 0.55, el: 0.70 } },
  "Dumbbell Curl":          { region: "upper", r: { beg: 0.10, nov: 0.15, int: 0.22, adv: 0.30, el: 0.38 } },
  "Hammer Curl":            { region: "upper", r: { beg: 0.12, nov: 0.18, int: 0.25, adv: 0.33, el: 0.42 } },
  "Tricep Pushdown":        { region: "upper", r: { beg: 0.18, nov: 0.28, int: 0.38, adv: 0.50, el: 0.65 } },
  "Skull Crusher":          { region: "upper", r: { beg: 0.15, nov: 0.23, int: 0.33, adv: 0.45, el: 0.58 } },
  "Cable Pushdown":         { region: "upper", r: { beg: 0.18, nov: 0.28, int: 0.38, adv: 0.50, el: 0.65 } },
  "Leg Extension":          { region: "lower", r: { beg: 0.35, nov: 0.55, int: 0.75, adv: 1.00, el: 1.25 } },
  "Leg Curl":               { region: "lower", r: { beg: 0.25, nov: 0.40, int: 0.55, adv: 0.75, el: 0.95 } },
  "Seated Leg Curl":        { region: "lower", r: { beg: 0.25, nov: 0.40, int: 0.55, adv: 0.75, el: 0.95 } },
  "Hip Thrust":             { region: "lower", r: { beg: 0.50, nov: 0.85, int: 1.25, adv: 1.75, el: 2.25 } },
  "Calf Raise":             { region: "lower", r: { beg: 0.50, nov: 0.80, int: 1.20, adv: 1.60, el: 2.00 } },
  "Standing Calf Raise":    { region: "lower", r: { beg: 0.50, nov: 0.80, int: 1.20, adv: 1.60, el: 2.00 } },
  "Seated Calf Raise":      { region: "lower", r: { beg: 0.40, nov: 0.65, int: 0.95, adv: 1.30, el: 1.65 } },
  "Lat Pulldown":           { region: "upper", r: { beg: 0.40, nov: 0.60, int: 0.85, adv: 1.10, el: 1.35 } },
  "Seated Row":             { region: "upper", r: { beg: 0.35, nov: 0.55, int: 0.75, adv: 1.00, el: 1.25 } },
  "Cable Row":              { region: "upper", r: { beg: 0.35, nov: 0.55, int: 0.75, adv: 1.00, el: 1.25 } },
  "Chest Supported Row":    { region: "upper", r: { beg: 0.30, nov: 0.50, int: 0.70, adv: 0.95, el: 1.20 } },
  "Face Pull":              { region: "upper", r: { beg: 0.12, nov: 0.20, int: 0.30, adv: 0.42, el: 0.55 } },
  Shrugs:                   { region: "upper", r: { beg: 0.50, nov: 0.80, int: 1.20, adv: 1.60, el: 2.00 } },
  "Barbell Shrug":          { region: "upper", r: { beg: 0.50, nov: 0.80, int: 1.20, adv: 1.60, el: 2.00 } },
  "Back Extension":         { region: "core",  r: { beg: 0.20, nov: 0.35, int: 0.55, adv: 0.75, el: 1.00 } },
  "Good Morning":           { region: "lower", r: { beg: 0.25, nov: 0.40, int: 0.60, adv: 0.85, el: 1.10 } },
  "Romanian Deadlift":      { region: "lower", r: { beg: 0.60, nov: 0.90, int: 1.30, adv: 1.75, el: 2.20 } },
  RDL:                      { region: "lower", r: { beg: 0.60, nov: 0.90, int: 1.30, adv: 1.75, el: 2.20 } },
  "Leg Press":              { region: "lower", r: { beg: 1.00, nov: 1.50, int: 2.25, adv: 3.00, el: 3.75 } },
  "Hack Squat":             { region: "lower", r: { beg: 0.50, nov: 0.85, int: 1.25, adv: 1.75, el: 2.25 } },
  "Ab Crunch Machine":      { region: "core",  r: { beg: 0.15, nov: 0.25, int: 0.40, adv: 0.55, el: 0.70 } },
  "Pec Deck":               { region: "upper", r: { beg: 0.30, nov: 0.50, int: 0.70, adv: 0.95, el: 1.20 } },
  "Machine Chest Press":    { region: "upper", r: { beg: 0.40, nov: 0.65, int: 0.90, adv: 1.20, el: 1.50 } },
  "Incline Bench Press":    { region: "upper", r: { beg: 0.45, nov: 0.65, int: 0.90, adv: 1.20, el: 1.50 } },
  "Decline Bench Press":    { region: "upper", r: { beg: 0.55, nov: 0.80, int: 1.10, adv: 1.40, el: 1.75 } },
  "Front Squat":            { region: "lower", r: { beg: 0.55, nov: 0.85, int: 1.20, adv: 1.65, el: 2.10 } },
  "Bulgarian Split Squat":  { region: "lower", r: { beg: 0.20, nov: 0.35, int: 0.55, adv: 0.80, el: 1.05 } },
  Lunges:                   { region: "lower", r: { beg: 0.20, nov: 0.35, int: 0.55, adv: 0.80, el: 1.05 } },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateBW(bw: number, table: BWRow[]): FiveTier {
  if (bw <= table[0].bw) return { ...table[0] };
  if (bw >= table[table.length - 1].bw) return { ...table[table.length - 1] };
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (bw >= a.bw && bw <= b.bw) {
      const t = (bw - a.bw) / (b.bw - a.bw);
      return {
        beg: lerp(a.beg, b.beg, t),
        nov: lerp(a.nov, b.nov, t),
        int: lerp(a.int, b.int, t),
        adv: lerp(a.adv, b.adv, t),
        el: lerp(a.el, b.el, t),
      };
    }
  }
  return { ...table[table.length - 1] };
}

function applyFemale(
  thresholds: FiveTier,
  region: "upper" | "lower" | "core" | "endurance"
): FiveTier {
  const m = FEMALE_REGION_MULT[region];
  return {
    beg: thresholds.beg * m,
    nov: thresholds.nov * m,
    int: thresholds.int * m,
    adv: thresholds.adv * m,
    el: thresholds.el * m,
  };
}

/**
 * Returns absolute-lbs thresholds for an exercise at a user's
 * bodyweight + sex, using the new 5-tier system. Returns null when
 * the exercise isn't recognized in any of the new tables.
 */
export function getTierThresholdsLbs(
  exerciseName: string,
  bodyweight: number,
  sex: "male" | "female"
): FiveTier | null {
  const bw = bodyweight > 0 ? bodyweight : sex === "female" ? 140 : 175;

  // Compound — interpolate the absolute table directly.
  const COMPOUND_TABLES: Record<string, BWRow[]> = {
    "Bench Press": BENCH_M,
    "Back Squat": SQUAT_M,
    Squat: SQUAT_M,
    Deadlift: DEADLIFT_M,
    "Conventional Deadlift": DEADLIFT_M,
    "Overhead Press": OHP_M,
    "Standing Press": OHP_M,
  };
  const compoundTable = COMPOUND_TABLES[exerciseName];
  if (compoundTable) {
    const region = exerciseName === "Bench Press" || /Press/.test(exerciseName)
      ? "upper"
      : "lower";
    let t = interpolateBW(bw, compoundTable);
    if (sex === "female") t = applyFemale(t, region);
    return t;
  }

  // Pull-ups — convert reps to e1RM-equivalent at the user's bw.
  if (exerciseName === "Pull-up" || exerciseName === "Pullups" || exerciseName === "Pull Up") {
    const reps = interpolateBW(bw, PULLUPS_M);
    const toEq = (r: number) => bw * (1 + r / 30);
    let t: FiveTier = {
      beg: toEq(reps.beg),
      nov: toEq(reps.nov),
      int: toEq(reps.int),
      adv: toEq(reps.adv),
      el: toEq(reps.el),
    };
    if (sex === "female") t = applyFemale(t, "upper");
    return t;
  }

  // Isolation — bodyweight × per-tier ratio.
  const iso = ISO_RATIOS[exerciseName];
  if (iso) {
    let t: FiveTier = {
      beg: bw * iso.r.beg,
      nov: bw * iso.r.nov,
      int: bw * iso.r.int,
      adv: bw * iso.r.adv,
      el: bw * iso.r.el,
    };
    if (sex === "female") t = applyFemale(t, iso.region);
    return t;
  }

  return null;
}

/**
 * Bodyweight-aware variant of synthesizeStandardsFor. For each
 * exercise that has a 5-tier table (compound) or ratio (isolation),
 * the thresholds are recomputed to the user's bodyweight. Falls
 * back to the legacy demographic-only synthesis for unknown lifts
 * so the heatmap still grades them.
 */
export function synthesizeStandardsForBW(
  ageGroup: string,
  sex: string,
  bodyweight: number | null | undefined
): StandardRow[] {
  const sexNorm: "male" | "female" = sex === "female" ? "female" : "male";
  const ageMult = AGE_MULT[ageGroup] ?? 1.0;
  const round = (n: number) => Math.max(0, Math.round(n));
  const bw = bodyweight && bodyweight > 0 ? bodyweight : sexNorm === "female" ? 140 : 175;

  return BASE_STANDARDS.map((b) => {
    const tier = getTierThresholdsLbs(b.exercise_name, bw, sexNorm);
    if (tier) {
      // 5-tier path — apply age mult on top.
      return {
        muscle_group: b.muscle_group,
        exercise_name: b.exercise_name,
        age_group: ageGroup,
        sex: sexNorm,
        below_average_lbs: round(tier.beg * ageMult),
        average_lbs: round(tier.nov * ageMult),
        above_average_lbs: round(tier.int * ageMult),
        exceptional_lbs: round(tier.adv * ageMult),
        elite_lbs: round(tier.el * ageMult),
      };
    }
    // Fallback — legacy demographic synthesis for exercises not
    // covered by the new tables.
    return synthesize(b, ageGroup, sexNorm);
  });
}

/**
 * Merge code standards with optional DB overrides. Any DB row whose
 * (exercise_name, age_group, sex) matches a code row replaces it; DB
 * rows not in code are appended (so an admin can add a custom
 * exercise without a code change).
 */
export function mergeWithDbOverrides(
  codeRows: StandardRow[],
  dbRows: StandardRow[] | null | undefined,
  ageGroup: string,
  sex: string
): StandardRow[] {
  const sexNorm = sex === "female" ? "female" : "male";
  const byName = new Map<string, StandardRow>();
  for (const r of codeRows) byName.set(r.exercise_name, r);
  for (const r of dbRows ?? []) {
    if (r.age_group === ageGroup && r.sex === sexNorm) {
      byName.set(r.exercise_name, r);
    }
  }
  return Array.from(byName.values());
}
