import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import {
  REFERENCE_BW,
  ZONES,
  ZONE_LABEL,
  ZONE_MUSCLES,
  computeLevels,
  exercisesForZone,
  selectStandards,
  standardThresholdRatios,
  weightForTargetRatio,
  type Exercise,
  type SetRow,
  type StandardRow,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";

// Personalized example workouts to hit a given target ratio. Returns 2-3
// realistic set/rep combos at the user's bodyweight.
function exampleWorkouts(targetRatio: number, bw: number): string[] {
  const SCHEMES: Array<{ sets: number; reps: number; label: string }> = [
    { sets: 3, reps: 10, label: "3×10" },
    { sets: 4, reps: 8, label: "4×8" },
    { sets: 3, reps: 5, label: "3×5" },
  ];
  return SCHEMES.map((s) => {
    const w = weightForTargetRatio(targetRatio, s.reps, s.sets, bw);
    return `${s.label} @ ${Math.max(0, Math.round(w))} lbs`;
  });
}

function pickPrimaryExercise(
  zone: Zone,
  stdByExercise: Map<string, StandardRow>
): Exercise | null {
  // Prefer the first listed exercise for the zone that we have a standard
  // for. Falls back to first exercise even without a standard so the modal
  // can still render the zone.
  const opts = exercisesForZone(zone);
  for (const ex of opts) {
    if (stdByExercise.has(ex.name)) return ex;
  }
  return opts[0] ?? null;
}

export async function GET() {
  noStore();
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const profile = await loadProfile(
    user.id,
    user.email?.split("@")[0] ?? "Lifter"
  );

  const effectiveBw =
    profile.bodyweight && profile.bodyweight > 0
      ? profile.bodyweight
      : REFERENCE_BW[profile.sex ?? "male"] ?? REFERENCE_BW.male;

  const admin = createSupabaseAdminClient();
  const [{ data: allStandards }, { data: setsRows }] = await Promise.all([
    admin.from("strength_standards").select("*"),
    admin
      .from("workout_sets")
      .select(
        "exercise_name, weight_lbs, reps, sets, workouts!inner(user_id, date)"
      )
      .eq("workouts.user_id", user.id),
  ]);

  const standards = selectStandards(
    (allStandards ?? []) as StandardRow[],
    profile.ageGroup,
    profile.sex ?? "male",
    profile.bodyweight ?? null
  );

  const sets: SetRow[] = (setsRows ?? []).map((r: any) => ({
    exercise_name: r.exercise_name,
    weight_lbs: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
    date: r.workouts?.date,
  }));

  const { muscleBest, zoneLevels } = computeLevels(
    sets,
    standards,
    profile.experience,
    profile.bodyweight ?? undefined,
    profile.sex ?? "male",
    profile.ageGroup
  );

  const stdByExercise = new Map<string, StandardRow>();
  standards.forEach((s) => stdByExercise.set(s.exercise_name, s));

  const LEVEL_LABEL_MAP: Record<StrengthLevel, string> = {
    untrained: "Untrained",
    below: "Below Average",
    average: "Average",
    above: "Above Average",
    exceptional: "Exceptional",
    elite: "Elite",
  };
  const NEXT: Record<StrengthLevel, StrengthLevel | null> = {
    untrained: "below",
    below: "average",
    average: "above",
    above: "exceptional",
    exceptional: "elite",
    elite: null,
  };

  const zones = ZONES.map((zone) => {
    const ex = pickPrimaryExercise(zone, stdByExercise);
    const std = ex ? stdByExercise.get(ex.name) : undefined;

    // Best score across muscles in the zone.
    let bestScore = 0;
    let bestMuscle: string | null = null;
    let bestSource: { exercise: string; weight: number; reps: number; sets: number } | null = null;
    for (const m of ZONE_MUSCLES[zone]) {
      const b = muscleBest[m];
      if (b && b.score > bestScore) {
        bestScore = b.score;
        bestMuscle = m;
        bestSource = {
          exercise: b.exercise,
          weight: b.weight,
          reps: b.reps,
          sets: b.sets,
        };
      }
    }

    const currentLevel: StrengthLevel = zoneLevels[zone] ?? "untrained";

    const breakdown = std
      ? (() => {
          const t = standardThresholdRatios(std);
          const order: Array<[StrengthLevel, number, number | null]> = [
            ["below", t.below, t.average],
            ["average", t.average, t.above],
            ["above", t.above, t.exceptional],
            ["exceptional", t.exceptional, t.elite],
            ["elite", t.elite, null],
          ];
          return order.map(([lvl, lo, hi]) => ({
            level: lvl,
            label: LEVEL_LABEL_MAP[lvl],
            min: lo,
            max: hi,
            examples: exampleWorkouts(lo, effectiveBw),
          }));
        })()
      : [];

    const nextLevel = NEXT[currentLevel];
    const nextTarget =
      nextLevel && std
        ? standardThresholdRatios(std)[
            nextLevel === "untrained" ? "below" : nextLevel
          ]
        : null;

    return {
      zone,
      label: ZONE_LABEL[zone],
      currentLevel,
      currentLevelLabel: LEVEL_LABEL_MAP[currentLevel],
      currentScore: bestScore,
      bestMuscle,
      bestSource,
      primaryExercise: ex?.name ?? null,
      breakdown,
      nextLevel,
      nextLevelLabel: nextLevel ? LEVEL_LABEL_MAP[nextLevel] : null,
      nextTargetRatio: nextTarget,
      nextTargetExamples:
        nextLevel && nextTarget != null
          ? exampleWorkouts(nextTarget, effectiveBw)
          : [],
    };
  });

  return NextResponse.json({
    ageGroup: profile.ageGroup,
    sex: profile.sex,
    bodyweight: profile.bodyweight,
    effectiveBodyweight: effectiveBw,
    experience: profile.experience,
    zones,
  });
}
