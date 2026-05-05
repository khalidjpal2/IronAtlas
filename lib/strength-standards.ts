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
