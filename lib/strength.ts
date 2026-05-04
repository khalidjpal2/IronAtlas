export type StrengthLevel =
  | "untrained"
  | "below"
  | "average"
  | "above"
  | "exceptional"
  | "elite";

// Diablo / Dark Souls organic palette — earthy, grounded.
// Dormant   = cold stone
// Awakened  = still water
// Trained   = ancient wood
// Powerful  = firelight
// Mighty    = burnt ember
// Legendary = twilight sky
export const LEVEL_COLOR: Record<StrengthLevel, string> = {
  untrained: "#4a4a52",
  below: "#3a5a8a",
  average: "#3d6b3a",
  above: "#b8860b",
  exceptional: "#a0432a",
  elite: "#5b3993",
};

export const LEVEL_LABEL: Record<StrengthLevel, string> = {
  untrained: "Dormant",
  below: "Awakened",
  average: "Trained",
  above: "Powerful",
  exceptional: "Mighty",
  elite: "Legendary",
};

// Subtle inner-aura color used for soft halos on higher tiers.
export const LEVEL_GLOW: Record<StrengthLevel, string> = {
  untrained: "rgba(74, 74, 82, 0)",
  below: "rgba(58, 90, 138, 0.22)",
  average: "rgba(61, 107, 58, 0.22)",
  above: "rgba(184, 134, 11, 0.28)",
  exceptional: "rgba(160, 67, 42, 0.30)",
  elite: "rgba(91, 57, 147, 0.35)",
};

// Per-tier XP bar gradient — amber for lower tiers, deep purple for higher.
export const LEVEL_GRADIENT: Record<StrengthLevel, string> = {
  untrained: "linear-gradient(180deg, #4a4a52 0%, #2a2a32 100%)",
  below: "linear-gradient(180deg, #4a72a8 0%, #2a4060 100%)",
  average: "linear-gradient(180deg, #4d7e4a 0%, #2a4828 100%)",
  above: "linear-gradient(180deg, #d4a020 0%, #8a6308 100%)",
  exceptional: "linear-gradient(180deg, #c25a3a 0%, #6e2810 100%)",
  elite: "linear-gradient(180deg, #7747b0 0%, #3a2466 100%)",
};

export const LEVEL_ORDER: StrengthLevel[] = [
  "untrained",
  "below",
  "average",
  "above",
  "exceptional",
  "elite",
];

export const LEVEL_RANK: Record<StrengthLevel, number> = {
  untrained: 0,
  below: 1,
  average: 2,
  above: 3,
  exceptional: 4,
  elite: 5,
};

// =============================================================
// Body zones (clickable regions on the SVG)
// =============================================================
export const ZONES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type Zone = (typeof ZONES)[number];

// Backwards-compatible aliases
export type MuscleGroup = Zone;
export const MUSCLE_GROUPS = ZONES;

export const ZONE_LABEL: Record<Zone, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

// Reserved for any future iconography. Kept empty so callers using this
// map render no glyph by default (the user requested zero emojis).
export const ZONE_EMOJI: Record<Zone, string> = {
  chest: "",
  back: "",
  shoulders: "",
  biceps: "",
  triceps: "",
  forearms: "",
  abs: "",
  quads: "",
  hamstrings: "",
  glutes: "",
  calves: "",
};

// =============================================================
// Individual muscles per zone
// =============================================================
export const ZONE_MUSCLES: Record<Zone, string[]> = {
  chest: [
    "Pectoralis Major (upper)",
    "Pectoralis Major (middle)",
    "Pectoralis Major (lower)",
    "Pectoralis Minor",
    "Serratus Anterior",
  ],
  back: [
    "Latissimus Dorsi",
    "Trapezius (upper)",
    "Trapezius (middle)",
    "Trapezius (lower)",
    "Rhomboids",
    "Erector Spinae",
    "Teres Major",
  ],
  shoulders: [
    "Front Deltoid",
    "Side Deltoid",
    "Rear Deltoid",
    "Rotator Cuff",
  ],
  biceps: [
    "Biceps Brachii (long head)",
    "Biceps Brachii (short head)",
    "Brachialis",
    "Brachioradialis",
  ],
  triceps: [
    "Triceps (long head)",
    "Triceps (lateral head)",
    "Triceps (medial head)",
  ],
  forearms: ["Wrist Flexors", "Wrist Extensors"],
  abs: [
    "Rectus Abdominis",
    "External Obliques",
    "Internal Obliques",
    "Transverse Abdominis",
  ],
  quads: [
    "Rectus Femoris",
    "Vastus Lateralis",
    "Vastus Medialis",
    "Vastus Intermedius",
  ],
  hamstrings: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"],
  glutes: ["Gluteus Maximus", "Gluteus Medius", "Gluteus Minimus"],
  calves: ["Gastrocnemius", "Soleus"],
};

export const MUSCLE_TO_ZONE: Record<string, Zone> = (() => {
  const map: Record<string, Zone> = {};
  (Object.keys(ZONE_MUSCLES) as Zone[]).forEach((zone) => {
    ZONE_MUSCLES[zone].forEach((m) => {
      map[m] = zone;
    });
  });
  return map;
})();

// =============================================================
// Exercises → individual muscles primarily targeted
// =============================================================
export type Exercise = {
  name: string;
  muscles: string[];
};

export const EXERCISE_OPTIONS: Exercise[] = [
  // ── Chest ─────────────────────────────────────────────────────
  // Primaries
  { name: "Pec Deck", muscles: ["Pectoralis Major (middle)", "Pectoralis Major (upper)", "Pectoralis Major (lower)", "Serratus Anterior"] },
  { name: "Machine Chest Press", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"] },
  { name: "Bench Press", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"] },
  // Others
  { name: "Incline Bench Press", muscles: ["Pectoralis Major (upper)", "Front Deltoid"] },
  { name: "Decline Bench Press", muscles: ["Pectoralis Major (lower)", "Triceps (lateral head)"] },
  { name: "Push Up", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"] },
  { name: "Cable Fly", muscles: ["Pectoralis Major (lower)", "Serratus Anterior"] },

  // ── Back ──────────────────────────────────────────────────────
  // Primaries
  { name: "Pull Up", muscles: ["Latissimus Dorsi", "Biceps Brachii (long head)", "Rear Deltoid"] },
  { name: "Lat Pulldown", muscles: ["Latissimus Dorsi", "Biceps Brachii (long head)", "Rhomboids"] },
  { name: "Cable Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)", "Biceps Brachii (short head)"] },
  { name: "T-Bar Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)"] },
  // Others
  { name: "Barbell Row", muscles: ["Latissimus Dorsi", "Rhomboids", "Trapezius (middle)", "Biceps Brachii (short head)"] },
  // Trapezius first so Face Pull groups under Back (matches the listed spec).
  { name: "Face Pull", muscles: ["Trapezius (middle)", "Rear Deltoid"] },
  { name: "Deadlift", muscles: ["Latissimus Dorsi", "Erector Spinae", "Gluteus Maximus", "Biceps Femoris"] },

  // ── Shoulders ─────────────────────────────────────────────────
  // Primaries
  { name: "Lateral Raise", muscles: ["Side Deltoid", "Trapezius (upper)"] },
  { name: "Front Raise", muscles: ["Front Deltoid"] },
  { name: "Machine Shoulder Press", muscles: ["Front Deltoid", "Side Deltoid", "Triceps (long head)"] },
  // Others
  { name: "Overhead Press", muscles: ["Front Deltoid", "Side Deltoid", "Triceps (long head)"] },
  { name: "Arnold Press", muscles: ["Front Deltoid", "Side Deltoid"] },
  { name: "Rear Delt Fly", muscles: ["Rear Deltoid"] },

  // ── Biceps ────────────────────────────────────────────────────
  // Primaries
  { name: "Incline Dumbbell Curl", muscles: ["Biceps Brachii (long head)", "Brachialis"] },
  { name: "Hammer Curl", muscles: ["Brachialis", "Brachioradialis", "Biceps Brachii (long head)"] },
  { name: "Preacher Curl", muscles: ["Biceps Brachii (short head)", "Brachialis"] },
  // Others
  { name: "Barbell Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"] },
  { name: "Dumbbell Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"] },
  { name: "Cable Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"] },

  // ── Triceps ───────────────────────────────────────────────────
  // Primaries
  { name: "Tricep Pushdown", muscles: ["Triceps (lateral head)", "Triceps (medial head)"] },
  { name: "Overhead Tricep Cable", muscles: ["Triceps (long head)"] },
  { name: "Skull Crusher", muscles: ["Triceps (long head)", "Triceps (lateral head)"] },
  { name: "Dumbbell Overhead Extension", muscles: ["Triceps (long head)"] },
  // Others
  { name: "Close Grip Bench Press", muscles: ["Triceps (lateral head)", "Pectoralis Major (middle)"] },
  { name: "Dips", muscles: ["Triceps (lateral head)", "Pectoralis Major (lower)"] },

  // ── Abs ───────────────────────────────────────────────────────
  // Primaries
  { name: "Ab Crunch Machine", muscles: ["Rectus Abdominis", "External Obliques"] },
  { name: "Plank", muscles: ["Transverse Abdominis", "Rectus Abdominis"] },
  { name: "Cable Crunch", muscles: ["Rectus Abdominis", "External Obliques"] },
  // Others
  { name: "Hanging Leg Raise", muscles: ["Rectus Abdominis"] },
  { name: "Russian Twist", muscles: ["External Obliques", "Internal Obliques"] },
  { name: "Ab Wheel", muscles: ["Rectus Abdominis", "Transverse Abdominis"] },

  // ── Quads ─────────────────────────────────────────────────────
  // Primaries
  { name: "Squat", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Vastus Intermedius", "Gluteus Maximus", "Biceps Femoris"] },
  { name: "Leg Extension", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Vastus Intermedius"] },
  { name: "Leg Press", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Gluteus Maximus"] },
  { name: "Hack Squat", muscles: ["Vastus Lateralis", "Vastus Medialis", "Gluteus Maximus"] },
  // Others
  { name: "Bulgarian Split Squat", muscles: ["Rectus Femoris", "Vastus Lateralis", "Gluteus Maximus"] },

  // ── Hamstrings ────────────────────────────────────────────────
  // Primaries
  { name: "Hamstring Curl", muscles: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"] },
  { name: "Romanian Deadlift", muscles: ["Biceps Femoris", "Semitendinosus", "Gluteus Maximus", "Erector Spinae"] },
  // Others
  { name: "Good Morning", muscles: ["Biceps Femoris", "Erector Spinae"] },
  { name: "Nordic Curl", muscles: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"] },

  // ── Glutes ────────────────────────────────────────────────────
  { name: "Hip Thrust", muscles: ["Gluteus Maximus", "Gluteus Medius"] },
  { name: "Glute Bridge", muscles: ["Gluteus Maximus"] },
  { name: "Cable Kickback", muscles: ["Gluteus Maximus"] },
  { name: "Abductor Machine", muscles: ["Gluteus Medius", "Gluteus Minimus"] },

  // ── Calves ────────────────────────────────────────────────────
  { name: "Standing Calf Raise", muscles: ["Gastrocnemius"] },
  { name: "Seated Calf Raise", muscles: ["Soleus"] },
  { name: "Leg Press Calf Raise", muscles: ["Gastrocnemius", "Soleus"] },
];

// Pick a representative zone for the workout_sets.muscle_group column based on the
// first individual muscle the exercise targets.
export function exerciseZone(ex: Exercise): Zone {
  const first = ex.muscles[0];
  return MUSCLE_TO_ZONE[first] ?? "chest";
}

// All exercises whose primary zone matches.
export function exercisesForZone(zone: Zone): Exercise[] {
  return EXERCISE_OPTIONS.filter((ex) => exerciseZone(ex) === zone);
}

// First exercise option that primarily hits the given zone.
export function suggestedExerciseForZone(zone: Zone): string | null {
  const list = exercisesForZone(zone);
  return list[0]?.name ?? EXERCISE_OPTIONS.find((e) =>
    e.muscles.some((m) => ZONE_MUSCLES[zone].includes(m))
  )?.name ?? null;
}

// =============================================================
// Strength standards (per exercise) and level computation
// =============================================================
export type StandardRow = {
  muscle_group: string;
  exercise_name: string;
  age_group: string;
  sex: string; // 'male' | 'female'
  below_average_lbs: number;
  average_lbs: number;
  above_average_lbs: number;
  exceptional_lbs: number;
  elite_lbs: number;
};

/**
 * Pick the right standards rows for a user. We always pull the 18-25 rows
 * (peak demographic) and rely on AGE_ADJUSTMENT to boost an older lifter's
 * score, instead of selecting age-discounted standards. This avoids
 * double-counting age (once in the standard, once in the score).
 *
 * The `ageGroup` argument is accepted for backward compatibility but
 * intentionally ignored.
 */
export function selectStandards(
  all: StandardRow[],
  _ageGroup: string,
  sex: string
): StandardRow[] {
  const tries: Array<[string, string]> = [
    ["18-25", sex],
    ["18-25", "male"],
  ];
  for (const [a, s] of tries) {
    const rows = all.filter((r) => r.age_group === a && r.sex === s);
    if (rows.length > 0) return rows;
  }
  return all;
}

/**
 * Given an absolute effective lift (lbs) and a standard row, return the
 * level. (Kept for callers that grade a single absolute lift like a PR.)
 */
export function levelForLift(lift: number, std: StandardRow): StrengthLevel {
  if (lift <= 0) return "untrained";
  if (lift >= std.elite_lbs) return "elite";
  if (lift >= std.exceptional_lbs) return "exceptional";
  if (lift >= std.above_average_lbs) return "above";
  if (lift >= std.average_lbs) return "average";
  if (lift >= std.below_average_lbs) return "below";
  return "untrained";
}

// Reference bodyweights — declared here so it's hoisted above the
// scoring helpers that reference it.
export type Sex = "male" | "female";
export const SEX_LABEL: Record<Sex, string> = {
  male: "Male",
  female: "Female",
};
export const REFERENCE_BW: Record<Sex | "default", number> = {
  male: 175,
  female: 140,
  default: 175,
};

/**
 * Given a bodyweight-relative score and a standard row, return the level.
 * The standard's lbs values are converted to ratios using the demographic's
 * REFERENCE_BW so a heavy lifter is graded against their own bodyweight
 * rather than absolute lbs.
 */
export function levelFromScore(score: number, std: StandardRow): StrengthLevel {
  if (score <= 0) return "untrained";
  const ref = REFERENCE_BW[(std.sex as Sex) ?? "male"] ?? REFERENCE_BW.male;
  const t = (lbs: number) => lbs / ref;
  if (score >= t(std.elite_lbs)) return "elite";
  if (score >= t(std.exceptional_lbs)) return "exceptional";
  if (score >= t(std.above_average_lbs)) return "above";
  if (score >= t(std.average_lbs)) return "average";
  if (score >= t(std.below_average_lbs)) return "below";
  return "untrained";
}

/**
 * Convert a standard row's lbs thresholds to bodyweight-relative ratio
 * thresholds (same units as effectiveStrength).
 */
export function standardThresholdRatios(std: StandardRow): Record<
  Exclude<StrengthLevel, "untrained">,
  number
> {
  const ref = REFERENCE_BW[(std.sex as Sex) ?? "male"] ?? REFERENCE_BW.male;
  return {
    below: std.below_average_lbs / ref,
    average: std.average_lbs / ref,
    above: std.above_average_lbs / ref,
    exceptional: std.exceptional_lbs / ref,
    elite: std.elite_lbs / ref,
  };
}

// Average a list of levels by their numeric rank, rounded to the nearest level.
export function averageLevel(levels: StrengthLevel[]): StrengthLevel {
  if (levels.length === 0) return "untrained";
  const total = levels.reduce((a, l) => a + LEVEL_RANK[l], 0);
  const avg = total / levels.length;
  const rounded = Math.round(avg);
  return LEVEL_ORDER[Math.max(0, Math.min(LEVEL_ORDER.length - 1, rounded))];
}

// =============================================================
// Smart strength scoring — Epley 1RM + volume bonus + secondary
// muscle reduction. Used to compute the heatmap and PRs.
// =============================================================

// Estimated 1RM via the Epley formula.
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// More sets = more training stimulus. +2% per set above 1. (Kept the
// "volumeBonus" name for the existing callers; same as volumeModifier.)
export function volumeBonus(sets: number): number {
  return 1 + Math.max(0, sets - 1) * 0.02;
}
export const volumeModifier = volumeBonus;

/**
 * Effective strength as a bodyweight-relative ratio:
 *   e1RM × volumeModifier(sets) / bodyweight
 *
 * Returns a unitless number typically in [0, 2]. Compare to a standard via
 * levelFromScore (which converts the standard's lbs to a ratio using
 * REFERENCE_BW for the demographic).
 *
 * If bodyweight is 0/missing, falls back to the demographic reference
 * weight so users still get *some* grade.
 */
export function effectiveStrength(
  weight: number,
  reps: number,
  sets: number,
  bodyweight: number = REFERENCE_BW.male
): number {
  const bw = bodyweight && bodyweight > 0 ? bodyweight : REFERENCE_BW.male;
  return (epley1RM(weight, reps) * volumeBonus(sets)) / bw;
}

/**
 * Inverse of effectiveStrength — given a target ratio and a rep/set scheme,
 * what weight (lbs) would the user need to lift to hit that ratio?
 */
export function weightForTargetRatio(
  targetRatio: number,
  reps: number,
  sets: number,
  bodyweight: number
): number {
  const bw = bodyweight && bodyweight > 0 ? bodyweight : REFERENCE_BW.male;
  const e1rmNeeded = (targetRatio * bw) / volumeBonus(sets);
  return e1rmNeeded / (1 + reps / 30);
}

export const SECONDARY_MULTIPLIER = 0.5;

// =============================================================
// Demographic context (for grading + display)
// =============================================================
export const AGE_GROUPS = ["18-25", "26-35", "36-45", "46+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

// Age adjustment applied to the user's score AFTER bodyweight division.
// Older lifters are graded against the same (peak / 18-25) standards but
// their score is boosted to compensate for natural age-related decline.
export const AGE_ADJUSTMENT: Record<AgeGroup, number> = {
  "18-25": 1.0,
  "26-35": 1.0,
  "36-45": 1.08,
  "46+": 1.2,
};

// (Sex type, SEX_LABEL, and REFERENCE_BW are declared earlier in this
// file so they're available to the scoring helpers above.)

// =============================================================
// Training-experience baseline boost. The boost is applied to
// scores in a zone until the user has logged 3+ distinct workout
// dates targeting that zone. Lifts a brand-new advanced lifter
// out of "untrained" and lets the heatmap reflect their real
// strength level before they have weeks of in-app data.
// =============================================================
export const TRAINING_EXPERIENCES = [
  "never",
  "beginner",
  "intermediate",
  "advanced",
] as const;
export type TrainingExperience = (typeof TRAINING_EXPERIENCES)[number];

export const EXPERIENCE_LABEL: Record<TrainingExperience, string> = {
  never: "Never Trained",
  beginner: "Beginner (6mo–1yr)",
  intermediate: "Intermediate (1–3yr)",
  advanced: "Advanced (3+ yr)",
};

export const EXPERIENCE_MULTIPLIER: Record<TrainingExperience, number> = {
  never: 1.0,
  beginner: 1.1,
  intermediate: 1.2,
  advanced: 1.3,
};

// How much of the experience multiplier to apply for a given session count.
// 0 sessions: no data → no boost (the muscle is genuinely untrained in-app).
// 1 session: full multiplier (we trust experience over a single data point).
// 2 sessions: halfway between full and 1.0.
// 3+ sessions: fully fade to 1.0 — let the real data speak.
function experienceFactor(
  sessions: number,
  base: number
): number {
  if (sessions <= 0) return 1.0;
  if (sessions === 1) return base;
  if (sessions === 2) return 1 + (base - 1) * 0.5;
  return 1.0;
}

// =============================================================
// Big-three lift PRs
// =============================================================
export const BIG_THREE = ["bench_press", "squat", "deadlift"] as const;
export type BigThree = (typeof BIG_THREE)[number];

export const BIG_THREE_LABEL: Record<BigThree, string> = {
  bench_press: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
};

// Each big-three lift maps to an exercise name in the standards table.
export const BIG_THREE_EXERCISE: Record<BigThree, string> = {
  bench_press: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
};

// =============================================================
// Per-set → per-muscle scoring
// =============================================================
export type SetRow = {
  exercise_name: string;
  weight_lbs: number;
  reps: number;
  sets: number;
  /** ISO yyyy-mm-dd. Optional but required for the experience-multiplier fadeout. */
  date?: string;
};

export type MuscleBestEntry = {
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  score: number; // effective strength after multiplier
  level: StrengthLevel;
};

export type LevelComputation = {
  muscleLevels: Record<string, StrengthLevel>;
  muscleBest: Record<string, MuscleBestEntry | null>;
  zoneLevels: Partial<Record<Zone, StrengthLevel>>;
};

/**
 * Compute per-muscle strength levels and zone heatmap colors from a list of
 * logged sets and the current strength standards. The score for each muscle
 * is the BEST effective-strength score that any logged set has produced for
 * that muscle (full score for the exercise's primary muscle, 0.5 × score for
 * each secondary muscle).
 *
 * If `experience` is set above "never", an experience baseline multiplier is
 * applied to scores in each zone. The multiplier is full for the user's 1st
 * logged session in that zone, halfway for the 2nd, and gone entirely once
 * they have 3+ sessions.
 */
export function computeLevels(
  sets: SetRow[],
  standards: StandardRow[],
  experience: TrainingExperience = "never",
  bodyweight?: number,
  sex: Sex = "male",
  ageGroup: AgeGroup = "18-25"
): LevelComputation {
  const bw =
    bodyweight && bodyweight > 0
      ? bodyweight
      : REFERENCE_BW[sex] ?? REFERENCE_BW.male;
  const ageAdj = AGE_ADJUSTMENT[ageGroup] ?? 1.0;
  const exByName = new Map<string, Exercise>();
  EXERCISE_OPTIONS.forEach((ex) => exByName.set(ex.name, ex));

  const stdByExercise = new Map<string, StandardRow>();
  standards.forEach((s) => stdByExercise.set(s.exercise_name, s));

  // Distinct workout dates per zone, keyed by the exercise's primary zone so
  // a bench session counts as a chest session (not a shoulder session).
  const datesByZone = new Map<Zone, Set<string>>();
  for (const row of sets) {
    const ex = exByName.get(row.exercise_name);
    if (!ex || !row.date) continue;
    const primaryZone = exerciseZone(ex);
    let dates = datesByZone.get(primaryZone);
    if (!dates) {
      dates = new Set();
      datesByZone.set(primaryZone, dates);
    }
    dates.add(row.date);
  }

  const baseMultiplier = EXPERIENCE_MULTIPLIER[experience];
  const factorByZone: Partial<Record<Zone, number>> = {};
  ZONES.forEach((z) => {
    const sessions = datesByZone.get(z)?.size ?? 0;
    factorByZone[z] = experienceFactor(sessions, baseMultiplier);
  });

  const muscleLevels: Record<string, StrengthLevel> = {};
  const muscleBest: Record<string, MuscleBestEntry | null> = {};
  ZONES.forEach((z) => {
    ZONE_MUSCLES[z].forEach((m) => {
      muscleLevels[m] = "untrained";
      muscleBest[m] = null;
    });
  });

  for (const row of sets) {
    const ex = exByName.get(row.exercise_name);
    const std = stdByExercise.get(row.exercise_name);
    if (!ex || !std) continue;
    const w = Number(row.weight_lbs ?? 0);
    const r = Number(row.reps ?? 0);
    const s = Number(row.sets ?? 0);
    if (w <= 0 || r <= 0 || s <= 0) continue;

    // ONLY the exercise's primary muscle gets a score. Compound lifts no
    // longer "spill over" into secondary muscle scores — a muscle is
    // untrained until the user logs an exercise where it's the primary
    // target (matches the spec: "Muscles with no workouts logged =
    // Untrained, score = 0").
    const primaryMuscle = ex.muscles[0];
    if (!primaryMuscle) continue;

    const muscleZone = MUSCLE_TO_ZONE[primaryMuscle];
    const expFactor = (muscleZone && factorByZone[muscleZone]) || 1.0;

    // Bodyweight-relative ratio with experience baseline + age adjustment.
    const score = effectiveStrength(w, r, s, bw) * expFactor * ageAdj;

    const cur = muscleBest[primaryMuscle];
    if (cur && score <= cur.score) continue;
    muscleBest[primaryMuscle] = {
      exercise: ex.name,
      weight: w,
      reps: r,
      sets: s,
      score,
      level: levelFromScore(score, std),
    };
    muscleLevels[primaryMuscle] = muscleBest[primaryMuscle]!.level;
  }

  // Zone color = average of TRAINED muscles in the group (we ignore the
  // untrained ones so a single logged chest exercise can actually move the
  // chest color, instead of being diluted to near-zero by 4 untrained pec
  // sub-muscles). If no muscle in the group has data, the zone stays
  // untrained.
  const zoneLevels: Partial<Record<Zone, StrengthLevel>> = {};
  ZONES.forEach((z) => {
    const trained = ZONE_MUSCLES[z]
      .map((m) => muscleLevels[m] ?? "untrained")
      .filter((l) => l !== "untrained");
    zoneLevels[z] = trained.length === 0 ? "untrained" : averageLevel(trained);
  });

  return { muscleLevels, muscleBest, zoneLevels };
}
