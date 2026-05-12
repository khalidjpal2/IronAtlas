import {
  mergeWithDbOverrides,
  synthesizeStandardsFor,
  synthesizeStandardsForBW,
} from "./strength-standards";

export type StrengthLevel =
  | "untrained"
  | "below"
  | "average"
  | "above"
  | "exceptional"
  | "elite";

// Monochrome purple gradient — like an MRI/thermography scan. Each
// tier uses the SAME hue progressively brighter and richer as the
// muscle gets stronger. Untrained is a near-black slightly purple
// tint (barely visible against the body); Elite is the brightest
// most saturated purple. Glance the heatmap and the strongest muscles
// stand out as the deepest, richest violet.
//
// Internal enum  →  Display tier   ·  Color
//   untrained    →  Untrained      ·  #1a1520 (near-invisible)
//   below        →  Beginner       ·  #2d1f3d (very faint)
//   average      →  Novice         ·  #4a2d6e (soft muted)
//   above        →  Intermediate   ·  #6b3fa0 (medium)
//   exceptional  →  Advanced       ·  #8b52cc (rich)
//   elite        →  Elite          ·  #a855f7 (deepest, brightest)
export const LEVEL_COLOR: Record<StrengthLevel, string> = {
  untrained: "#1a1520",
  below: "#2d1f3d",
  average: "#4a2d6e",
  above: "#6b3fa0",
  exceptional: "#8b52cc",
  elite: "#a855f7",
};

export const LEVEL_LABEL: Record<StrengthLevel, string> = {
  untrained: "Untrained",
  below: "Beginner",
  average: "Novice",
  above: "Intermediate",
  exceptional: "Advanced",
  elite: "Elite",
};

// Subtle inner-aura — only the upper tiers glow, scaling with brightness.
export const LEVEL_GLOW: Record<StrengthLevel, string> = {
  untrained: "rgba(26, 21, 32, 0)",
  below: "rgba(45, 31, 61, 0.18)",
  average: "rgba(74, 45, 110, 0.24)",
  above: "rgba(107, 63, 160, 0.30)",
  exceptional: "rgba(139, 82, 204, 0.38)",
  elite: "rgba(168, 85, 247, 0.50)",
};

// Per-tier XP bar gradient — purple monochrome top-to-bottom for each tier.
export const LEVEL_GRADIENT: Record<StrengthLevel, string> = {
  untrained: "linear-gradient(180deg, #1a1520 0%, #0a060e 100%)",
  below: "linear-gradient(180deg, #3d2a52 0%, #1d132a 100%)",
  average: "linear-gradient(180deg, #5e3b8a 0%, #2e1c4a 100%)",
  above: "linear-gradient(180deg, #7c4ab8 0%, #4a2880 100%)",
  exceptional: "linear-gradient(180deg, #a86fe0 0%, #6133a8 100%)",
  elite: "linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)",
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
  glutes: ["Gluteus Maximus", "Gluteus Medius", "Gluteus Minimus", "Adductors"],
  calves: ["Gastrocnemius", "Soleus", "Tibialis Anterior"],
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
// Multi-muscle targeting — primary / secondary / tertiary
// =============================================================
//
// Each Exercise can declare a `targets` map: tag → multiplier.
// Tags are user-friendly labels (e.g. "chest", "front-deltoid",
// "traps") that expand to a concrete list of muscle names via
// TARGET_MUSCLES. When computeLevels processes a logged set, it
// applies each target's multiplier to the effective-strength score
// and propagates it to every muscle the tag covers. This lets a
// compound lift (Bench Press, Deadlift, Dips) update multiple
// muscles at once with proportional credit.
//
// Convention used in EXERCISE_OPTIONS:
//   1.0  → primary (main target)
//   0.6  → secondary (significant assistance)
//   0.3  → tertiary (minor assistance)

export const TARGET_MUSCLES: Record<string, string[]> = {
  chest: [
    "Pectoralis Major (upper)",
    "Pectoralis Major (middle)",
    "Pectoralis Major (lower)",
    "Pectoralis Minor",
  ],
  serratus: ["Serratus Anterior"],
  back: ["Latissimus Dorsi", "Rhomboids", "Erector Spinae", "Teres Major"],
  traps: ["Trapezius (upper)", "Trapezius (middle)", "Trapezius (lower)"],
  shoulders: ["Front Deltoid", "Side Deltoid", "Rear Deltoid"],
  "front-deltoid": ["Front Deltoid"],
  "side-deltoid": ["Side Deltoid"],
  "rear-deltoid": ["Rear Deltoid"],
  biceps: [
    "Biceps Brachii (long head)",
    "Biceps Brachii (short head)",
    "Brachialis",
  ],
  triceps: [
    "Triceps (long head)",
    "Triceps (lateral head)",
    "Triceps (medial head)",
  ],
  forearms: ["Wrist Flexors", "Wrist Extensors", "Brachioradialis"],
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
  glutes: ["Gluteus Maximus", "Gluteus Medius", "Gluteus Minimus", "Adductors"],
  calves: ["Gastrocnemius", "Soleus", "Tibialis Anterior"],
  // Tags that don't currently map to any modeled muscle (e.g. hip
  // flexors) are silently dropped at compute time. Add a zone +
  // muscle for them here if you ever model that anatomy.
  "hip-flexors": [],
};

// Each tag also belongs to a primary heatmap zone — used by
// `exerciseZone()` to pick the dropdown grouping for an exercise.
export const TAG_TO_ZONE: Record<string, Zone> = {
  chest: "chest",
  serratus: "chest",
  back: "back",
  traps: "back",
  shoulders: "shoulders",
  "front-deltoid": "shoulders",
  "side-deltoid": "shoulders",
  "rear-deltoid": "shoulders",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  abs: "abs",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
};

// =============================================================
// Exercises → individual muscles primarily targeted
// =============================================================
export type Exercise = {
  name: string;
  /**
   * Ordered list of specific muscle names — used for display in the
   * History row, the Log session UI's exercise tile, etc. Index 0
   * is treated as the legacy "primary" muscle when `targets` is
   * omitted (back-compat path).
   */
  muscles: string[];
  /**
   * Optional multi-muscle scoring map. Keys are tags from
   * TARGET_MUSCLES; values are multipliers (1.0 primary, 0.6 secondary,
   * 0.3 tertiary). When present, computeLevels applies the multiplier
   * to the effective-strength score and propagates it to every muscle
   * the tag expands to. When omitted, only `muscles[0]` gets a score
   * at 1.0 (legacy behavior).
   */
  targets?: Record<string, number>;
};

export const EXERCISE_OPTIONS: Exercise[] = [
  // ── Chest ─────────────────────────────────────────────────────
  { name: "Pec Deck", muscles: ["Pectoralis Major (middle)", "Pectoralis Major (upper)", "Pectoralis Major (lower)", "Serratus Anterior"], targets: { chest: 1.0, serratus: 0.3 } },
  { name: "Machine Chest Press", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"], targets: { chest: 1.0, "front-deltoid": 0.6, triceps: 0.6 } },
  { name: "Bench Press", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"], targets: { chest: 1.0, "front-deltoid": 0.6, triceps: 0.6 } },
  { name: "Incline Bench Press", muscles: ["Pectoralis Major (upper)", "Front Deltoid", "Triceps (lateral head)"], targets: { chest: 1.0, "front-deltoid": 0.6, triceps: 0.6 } },
  { name: "Incline Press", muscles: ["Pectoralis Major (upper)", "Front Deltoid", "Triceps (lateral head)"], targets: { chest: 1.0, "front-deltoid": 0.6, triceps: 0.6 } },
  { name: "Decline Bench Press", muscles: ["Pectoralis Major (lower)", "Triceps (lateral head)"], targets: { chest: 1.0, triceps: 0.6 } },
  { name: "Decline Press", muscles: ["Pectoralis Major (lower)", "Triceps (lateral head)"], targets: { chest: 1.0, triceps: 0.6 } },
  { name: "Push Up", muscles: ["Pectoralis Major (middle)", "Front Deltoid", "Triceps (lateral head)"], targets: { chest: 1.0, "front-deltoid": 0.6, triceps: 0.6 } },
  { name: "Cable Fly", muscles: ["Pectoralis Major (lower)", "Serratus Anterior"], targets: { chest: 1.0, serratus: 0.3 } },

  // ── Back ──────────────────────────────────────────────────────
  { name: "Pull Up", muscles: ["Latissimus Dorsi", "Biceps Brachii (long head)", "Rear Deltoid"], targets: { back: 1.0, biceps: 0.6, "rear-deltoid": 0.3 } },
  { name: "Lat Pulldown", muscles: ["Latissimus Dorsi", "Biceps Brachii (long head)", "Rhomboids"], targets: { back: 1.0, biceps: 0.6 } },
  { name: "Lat Pulldown (Machine)", muscles: ["Latissimus Dorsi", "Biceps Brachii (long head)", "Rhomboids"], targets: { back: 1.0, biceps: 0.6 } },
  { name: "Cable Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)", "Biceps Brachii (short head)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Seated Machine Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Biceps Brachii (short head)", "Trapezius (middle)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "T-Bar Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Chest Supported T-Bar Row", muscles: ["Latissimus Dorsi", "Rhomboids", "Trapezius (middle)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Seated Chest Supported Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Seated Neutral Row", muscles: ["Rhomboids", "Latissimus Dorsi", "Trapezius (middle)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Barbell Row", muscles: ["Latissimus Dorsi", "Rhomboids", "Trapezius (middle)", "Biceps Brachii (short head)"], targets: { back: 1.0, biceps: 0.6, traps: 0.6 } },
  { name: "Face Pull", muscles: ["Rear Deltoid", "Trapezius (middle)", "Rhomboids"], targets: { shoulders: 1.0, traps: 0.6, back: 0.3 } },
  { name: "Reverse Fly", muscles: ["Rear Deltoid", "Rhomboids"], targets: { shoulders: 1.0, back: 0.3 } },
  { name: "Shrugs", muscles: ["Trapezius (upper)"], targets: { traps: 1.0 } },
  { name: "Prone Y-Raise", muscles: ["Trapezius (lower)", "Rear Deltoid"], targets: { back: 1.0, shoulders: 0.6 } },
  { name: "Back Extension", muscles: ["Erector Spinae", "Gluteus Maximus", "Biceps Femoris"], targets: { back: 1.0, glutes: 0.3, hamstrings: 0.3 } },
  { name: "Deadlift", muscles: ["Latissimus Dorsi", "Erector Spinae", "Gluteus Maximus", "Biceps Femoris"], targets: { back: 1.0, glutes: 0.6, hamstrings: 0.6, quads: 0.3 } },

  // ── Shoulders ─────────────────────────────────────────────────
  { name: "Lateral Raise", muscles: ["Side Deltoid"], targets: { "side-deltoid": 1.0 } },
  { name: "Front Raise", muscles: ["Front Deltoid"], targets: { "front-deltoid": 1.0 } },
  { name: "Machine Shoulder Press", muscles: ["Front Deltoid", "Side Deltoid", "Triceps (long head)"], targets: { shoulders: 1.0, triceps: 0.3 } },
  { name: "Overhead Press", muscles: ["Front Deltoid", "Side Deltoid", "Triceps (long head)"], targets: { shoulders: 1.0, triceps: 0.6 } },
  { name: "Arnold Press", muscles: ["Front Deltoid", "Side Deltoid"], targets: { shoulders: 1.0, triceps: 0.6 } },
  { name: "Rear Delt Fly", muscles: ["Rear Deltoid"], targets: { "rear-deltoid": 1.0 } },

  // ── Biceps ────────────────────────────────────────────────────
  { name: "Incline Dumbbell Curl", muscles: ["Biceps Brachii (long head)", "Brachialis"], targets: { biceps: 1.0 } },
  { name: "Hammer Curl", muscles: ["Brachialis", "Brachioradialis", "Biceps Brachii (long head)"], targets: { biceps: 1.0, forearms: 0.6 } },
  { name: "Preacher Curl", muscles: ["Biceps Brachii (short head)", "Brachialis"], targets: { biceps: 1.0 } },
  { name: "Barbell Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"], targets: { biceps: 1.0, forearms: 0.3 } },
  { name: "Dumbbell Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"], targets: { biceps: 1.0, forearms: 0.3 } },
  { name: "Cable Curl", muscles: ["Biceps Brachii (long head)", "Biceps Brachii (short head)"], targets: { biceps: 1.0 } },

  // ── Triceps ───────────────────────────────────────────────────
  { name: "Tricep Pushdown", muscles: ["Triceps (lateral head)", "Triceps (medial head)"], targets: { triceps: 1.0 } },
  { name: "Overhead Tricep Cable", muscles: ["Triceps (long head)"], targets: { triceps: 1.0 } },
  { name: "Skull Crusher", muscles: ["Triceps (long head)", "Triceps (lateral head)"], targets: { triceps: 1.0 } },
  { name: "Dumbbell Overhead Extension", muscles: ["Triceps (long head)"], targets: { triceps: 1.0 } },
  { name: "Cable Pushdown", muscles: ["Triceps (lateral head)", "Triceps (medial head)"], targets: { triceps: 1.0 } },
  { name: "Overhead Cable Rope Extension", muscles: ["Triceps (long head)"], targets: { triceps: 1.0 } },
  { name: "Close Grip Bench Press", muscles: ["Triceps (lateral head)", "Pectoralis Major (middle)"], targets: { triceps: 1.0, chest: 0.6 } },
  { name: "Dips", muscles: ["Pectoralis Major (lower)", "Triceps (lateral head)"], targets: { chest: 1.0, triceps: 0.6, shoulders: 0.3 } },

  // ── Abs ───────────────────────────────────────────────────────
  { name: "Ab Crunch Machine", muscles: ["Rectus Abdominis", "External Obliques"], targets: { abs: 1.0 } },
  { name: "Plank", muscles: ["Transverse Abdominis", "Rectus Abdominis"], targets: { abs: 1.0 } },
  { name: "Cable Crunch", muscles: ["Rectus Abdominis", "External Obliques"], targets: { abs: 1.0 } },
  { name: "Hanging Leg Raise", muscles: ["Rectus Abdominis"], targets: { abs: 1.0, "hip-flexors": 0.6 } },
  { name: "Russian Twist", muscles: ["External Obliques", "Internal Obliques"], targets: { abs: 1.0 } },
  { name: "Ab Wheel", muscles: ["Rectus Abdominis", "Transverse Abdominis"], targets: { abs: 1.0 } },

  // ── Quads ─────────────────────────────────────────────────────
  { name: "Squat", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Vastus Intermedius", "Gluteus Maximus", "Biceps Femoris"], targets: { quads: 1.0, glutes: 0.6, hamstrings: 0.3 } },
  { name: "Leg Extension", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Vastus Intermedius"], targets: { quads: 1.0 } },
  { name: "Leg Press", muscles: ["Rectus Femoris", "Vastus Lateralis", "Vastus Medialis", "Gluteus Maximus"], targets: { quads: 1.0, glutes: 0.6 } },
  { name: "Hack Squat", muscles: ["Vastus Lateralis", "Vastus Medialis", "Gluteus Maximus"], targets: { quads: 1.0, glutes: 0.6 } },
  { name: "Bulgarian Split Squat", muscles: ["Rectus Femoris", "Vastus Lateralis", "Gluteus Maximus"], targets: { quads: 1.0, glutes: 0.6 } },

  // ── Hamstrings ────────────────────────────────────────────────
  { name: "Hamstring Curl", muscles: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"], targets: { hamstrings: 1.0 } },
  { name: "Seated Leg Curl", muscles: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"], targets: { hamstrings: 1.0 } },
  { name: "Romanian Deadlift", muscles: ["Biceps Femoris", "Semitendinosus", "Gluteus Maximus", "Erector Spinae"], targets: { hamstrings: 1.0, glutes: 0.6, back: 0.3 } },
  { name: "Good Morning", muscles: ["Biceps Femoris", "Erector Spinae", "Gluteus Maximus"], targets: { hamstrings: 1.0, back: 0.6, glutes: 0.3 } },
  { name: "Nordic Curl", muscles: ["Biceps Femoris", "Semitendinosus", "Semimembranosus"], targets: { hamstrings: 1.0 } },

  // ── Glutes ────────────────────────────────────────────────────
  { name: "Hip Thrust", muscles: ["Gluteus Maximus", "Gluteus Medius"], targets: { glutes: 1.0, hamstrings: 0.3 } },
  { name: "Glute Bridge", muscles: ["Gluteus Maximus"], targets: { glutes: 1.0 } },
  { name: "Cable Kickback", muscles: ["Gluteus Maximus"], targets: { glutes: 1.0 } },
  { name: "Clam Shell", muscles: ["Gluteus Medius", "Gluteus Minimus"], targets: { glutes: 1.0 } },
  { name: "Side-Lying Hip Raise", muscles: ["Gluteus Medius"], targets: { glutes: 1.0 } },
  { name: "Abductor Machine", muscles: ["Gluteus Medius", "Gluteus Minimus"], targets: { glutes: 1.0 } },
  { name: "Adductor Machine", muscles: ["Adductors"], targets: { glutes: 1.0 } },

  // ── Calves ────────────────────────────────────────────────────
  { name: "Standing Calf Raise", muscles: ["Gastrocnemius"], targets: { calves: 1.0 } },
  { name: "Seated Calf Raise", muscles: ["Soleus"], targets: { calves: 1.0 } },
  { name: "Leg Press Calf Raise", muscles: ["Gastrocnemius", "Soleus"], targets: { calves: 1.0 } },
  { name: "Tibialis Raise", muscles: ["Tibialis Anterior"], targets: { calves: 1.0 } },

  // ── Forearms ──────────────────────────────────────────────────
  { name: "Wrist Curl", muscles: ["Wrist Flexors"], targets: { forearms: 1.0 } },
  { name: "Reverse Curl", muscles: ["Wrist Extensors", "Brachioradialis"], targets: { forearms: 1.0, biceps: 0.3 } },
];

// Pick a representative zone for the workout_sets.muscle_group column.
// Prefer the primary tag (multiplier === 1.0) when `targets` is set;
// fall back to the first muscle's zone otherwise.
export function exerciseZone(ex: Exercise): Zone {
  if (ex.targets) {
    for (const [tag, mult] of Object.entries(ex.targets)) {
      if (mult >= 1) {
        const z = TAG_TO_ZONE[tag];
        if (z) return z;
      }
    }
  }
  const first = ex.muscles[0];
  return MUSCLE_TO_ZONE[first] ?? "chest";
}

// =============================================================
// Reverse lookup — given a muscle name, which exercises target it
// and at what tier?  Powers the muscle detail panel's
// "Direct exercises" / "Compound exercises" sections.
// =============================================================

export type MuscleExerciseTier = "primary" | "secondary" | "tertiary";

export type MuscleExerciseEntry = {
  exercise: string;
  multiplier: number;
  tier: MuscleExerciseTier;
};

function tierFor(multiplier: number): MuscleExerciseTier {
  if (multiplier >= 1) return "primary";
  if (multiplier >= 0.5) return "secondary";
  return "tertiary";
}

/**
 * Return every exercise in EXERCISE_OPTIONS that targets the given
 * muscle. Tier rule (per sub-muscle, not per-tag):
 *   primary    — the muscle is the exercise's *declared* primary
 *                (`ex.muscles[0] === muscle`). Broad tags like
 *                `chest: 1.0` hit all pec heads, but only the head
 *                listed first counts as primary.
 *   secondary  — touched with multiplier >= 0.5 but not declared
 *                primary (this catches Bench Press for upper pec:
 *                tag mult = 1.0, but its primary is middle pec).
 *   tertiary   — touched with multiplier < 0.5.
 *
 * Sort: primary first, then secondary (highest multiplier first),
 * then tertiary.
 */
export function exercisesForMuscle(muscleName: string): MuscleExerciseEntry[] {
  const out: MuscleExerciseEntry[] = [];
  for (const ex of EXERCISE_OPTIONS) {
    let mult = 0;
    if (ex.targets) {
      for (const [tag, m] of Object.entries(ex.targets)) {
        const muscles = TARGET_MUSCLES[tag];
        if (!muscles) continue;
        if (muscles.includes(muscleName) && m > mult) mult = m;
      }
    } else if (ex.muscles[0] === muscleName) {
      mult = 1.0;
    }
    if (mult <= 0) continue;
    const isDeclaredPrimary = ex.muscles[0] === muscleName;
    const tier: MuscleExerciseTier = isDeclaredPrimary
      ? "primary"
      : mult >= 0.5
      ? "secondary"
      : "tertiary";
    out.push({ exercise: ex.name, multiplier: mult, tier });
  }
  const tierOrder: Record<MuscleExerciseTier, number> = {
    primary: 0,
    secondary: 1,
    tertiary: 2,
  };
  return out.sort((a, b) => {
    if (tierOrder[a.tier] !== tierOrder[b.tier]) {
      return tierOrder[a.tier] - tierOrder[b.tier];
    }
    return b.multiplier - a.multiplier;
  });
}

/**
 * Same idea, but rolled up to a heatmap zone. Returns every exercise
 * that has any target hitting any muscle in `zone`, with the highest
 * multiplier observed across that zone's muscles.
 */
export function exercisesForZoneTiered(zone: Zone): MuscleExerciseEntry[] {
  const muscles = new Set(ZONE_MUSCLES[zone]);
  const out: MuscleExerciseEntry[] = [];
  for (const ex of EXERCISE_OPTIONS) {
    let best = 0;
    if (ex.targets) {
      for (const [tag, m] of Object.entries(ex.targets)) {
        const tagMuscles = TARGET_MUSCLES[tag];
        if (!tagMuscles) continue;
        if (tagMuscles.some((tm) => muscles.has(tm)) && m > best) best = m;
      }
    } else if (muscles.has(ex.muscles[0])) {
      best = 1.0;
    }
    if (best > 0) {
      out.push({
        exercise: ex.name,
        multiplier: best,
        tier: tierFor(best),
      });
    }
  }
  return out.sort((a, b) => b.multiplier - a.multiplier);
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
 * Pick the right standards rows for a user.
 *
 * Source-of-truth model: standards live in lib/strength-standards.ts as
 * a TypeScript baseline. The runtime always synthesizes a full set for
 * the user's sex (using the 18-25 cohort, since AGE_ADJUSTMENT boosts
 * the score later — no double-counting). The DB `strength_standards`
 * table is now an *override* layer: any row matching (exercise, 18-25,
 * sex) replaces the code value, and any DB row for an exercise not in
 * code is appended.
 *
 * Adding a new exercise to EXERCISE_OPTIONS + BASE_STANDARDS makes it
 * grade immediately on the next page load — no SQL migration required.
 *
 * The `ageGroup` argument is accepted for backward compatibility but
 * intentionally ignored.
 */
export function selectStandards(
  all: StandardRow[] | null | undefined,
  _ageGroup: string,
  sex: string,
  bodyweight?: number | null
): StandardRow[] {
  // Use the bodyweight-aware 5-tier synthesis when a weight is known;
  // otherwise fall back to the legacy demographic-only baseline so
  // logged-out / new users still see something meaningful.
  const codeRows = bodyweight && bodyweight > 0
    ? synthesizeStandardsForBW("18-25", sex, bodyweight)
    : synthesizeStandardsFor("18-25", sex);
  return mergeWithDbOverrides(codeRows, all ?? [], "18-25", sex);
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
  date?: string; // ISO yyyy-mm-dd of the set that produced this best
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
 * logged sets and the current strength standards.
 *
 * Multi-muscle scoring: every exercise's `targets` map (tag → multiplier)
 * is expanded via TARGET_MUSCLES into a list of specific muscles. The
 * effective-strength score is multiplied by the tier multiplier
 * (1.0 primary / 0.6 secondary / 0.3 tertiary) and propagated to every
 * muscle in that tag's expansion. A muscle's final score is the best
 * value across all sets that touched it, and its level grades against
 * the corresponding exercise's standard row.
 *
 * Exercises without a `targets` map fall back to the legacy behavior
 * (only `muscles[0]` gets a score at 1.0) so older entries keep working.
 *
 * If `experience` is set above "never", an experience baseline multiplier
 * is applied to scores in each zone. Full for the 1st logged session in
 * that zone, halfway for the 2nd, gone entirely at 3+ sessions.
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

  // Distinct workout dates per zone, keyed by the exercise's primary zone
  // so a bench session counts as a chest session (not a shoulder session).
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

  // Resolve the (muscle, multiplier) pairs an exercise contributes to.
  // Uses targets when present; falls back to legacy single-primary.
  function resolveTargets(ex: Exercise): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    if (ex.targets && Object.keys(ex.targets).length > 0) {
      // For each (tag, multiplier), expand and emit one entry per
      // muscle. If a muscle is referenced by multiple tags on the same
      // exercise, keep the highest multiplier (defensive).
      const byMuscle = new Map<string, number>();
      for (const [tag, m] of Object.entries(ex.targets)) {
        const muscles = TARGET_MUSCLES[tag];
        if (!muscles || muscles.length === 0) continue;
        for (const mu of muscles) {
          const cur = byMuscle.get(mu) ?? 0;
          if (m > cur) byMuscle.set(mu, m);
        }
      }
      byMuscle.forEach((m, mu) => out.push([mu, m]));
    } else if (ex.muscles[0]) {
      out.push([ex.muscles[0], 1.0]);
    }
    return out;
  }

  for (const row of sets) {
    const ex = exByName.get(row.exercise_name);
    const std = stdByExercise.get(row.exercise_name);
    if (!ex || !std) continue;
    const w = Number(row.weight_lbs ?? 0);
    const r = Number(row.reps ?? 0);
    const s = Number(row.sets ?? 0);
    if (w <= 0 || r <= 0 || s <= 0) continue;

    // Bodyweight-relative ratio with age adjustment. Experience factor
    // is applied per-muscle below since it's keyed to that muscle's zone.
    const baseScore = effectiveStrength(w, r, s, bw) * ageAdj;

    for (const [muscleName, multiplier] of resolveTargets(ex)) {
      const muscleZone = MUSCLE_TO_ZONE[muscleName];
      if (!muscleZone) continue; // unknown muscle — silently skip
      const expFactor = factorByZone[muscleZone] || 1.0;
      const score = baseScore * expFactor * multiplier;

      const cur = muscleBest[muscleName];
      if (cur && score <= cur.score) continue;
      muscleBest[muscleName] = {
        exercise: ex.name,
        weight: w,
        reps: r,
        sets: s,
        date: row.date,
        score,
        level: levelFromScore(score, std),
      };
      muscleLevels[muscleName] = muscleBest[muscleName]!.level;
    }
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
