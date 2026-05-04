import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Dashboard from "@/components/Dashboard";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import {
  EXERCISE_OPTIONS,
  ZONES,
  computeLevels,
  selectStandards,
  type BigThree,
  type SetRow,
  type StandardRow,
  type Zone,
} from "@/lib/strength";
import type { PR } from "@/components/PRCards";
import {
  applyZoneDecay,
  combineScores,
  computeAtlasScore,
  computeJourneyScore,
  computeSustenanceScore,
  daysSinceLastTrainedByZone,
  type NutritionDay,
  type NutritionMode,
} from "@/lib/scoring";
import {
  evaluateQuest,
  getDailyQuests,
  type QuestEvalSnapshot,
  type WorkoutGoalChoice,
} from "@/lib/quests";
import { evaluateBadges } from "@/lib/badges";
import { ptDateNDaysAgo, todayPT } from "@/lib/time";

export type MuscleBest =
  | { exercise: string; weight: number; reps: number; sets: number; score: number }
  | null;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  noStore();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const profile = await loadProfile(
    user.id,
    user.email?.split("@")[0] ?? "Lifter"
  );

  const admin = createSupabaseAdminClient();

  // Pacific Time — the user's local "today" in California, regardless
  // of where the server is running.
  const todayISO = todayPT();
  const sevenDaysAgoISO = ptDateNDaysAgo(7);
  const sixtyDaysAgoISO = ptDateNDaysAgo(60);

  // Pull everything in parallel. Some of these tables may not exist yet
  // (migrations not run); we handle the resulting errors gracefully below.
  const [
    { data: allStandards },
    { data: setsRows },
    { data: prRows },
    { data: stepsToday },
    { data: stepGoalRow },
    { data: nutritionToday },
    nutritionGoalsRes,
    { data: stepsLast60 },
    { data: nutritionLast60 },
    earnedBadgesRes,
    todayQuestRes,
  ] = await Promise.all([
    admin.from("strength_standards").select("*"),
    admin
      .from("workout_sets")
      .select(
        "exercise_name, muscle_group, weight_lbs, reps, sets, workouts!inner(user_id, date)"
      )
      .eq("workouts.user_id", user.id),
    admin
      .from("personal_bests")
      .select("lift_name, weight_lbs, date_achieved")
      .eq("user_id", user.id),
    admin
      .from("daily_steps")
      .select("steps, goal")
      .eq("user_id", user.id)
      .eq("date", todayISO)
      .maybeSingle(),
    admin
      .from("step_goals")
      .select("daily_goal")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("daily_nutrition")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("date", todayISO)
      .maybeSingle(),
    // nutrition_goals: may or may not yet have the `mode` column; if the
    // ALTER TABLE hasn't been applied, ask for the legacy columns only.
    admin
      .from("nutrition_goals")
      .select(
        "calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, mode, protein_direction, carbs_direction, fat_direction"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("daily_steps")
      .select("date, steps")
      .eq("user_id", user.id)
      .gte("date", sixtyDaysAgoISO),
    admin
      .from("daily_nutrition")
      .select("date, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .gte("date", sixtyDaysAgoISO),
    admin
      .from("achievements")
      .select("badge_id, earned_at")
      .eq("user_id", user.id),
    admin
      .from("daily_quests")
      .select(
        "quest_atlas, quest_journey, quest_sustenance, atlas_done, journey_done, sustenance_done"
      )
      .eq("user_id", user.id)
      .eq("date", todayISO)
      .maybeSingle(),
  ]);

  // If the nutrition_goals query failed because `mode` doesn't exist
  // yet, fall back to the legacy column set.
  let nutritionGoalsRow: any = nutritionGoalsRes.data;
  if (nutritionGoalsRes.error) {
    const legacy = await admin
      .from("nutrition_goals")
      .select("calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g")
      .eq("user_id", user.id)
      .maybeSingle();
    nutritionGoalsRow = legacy.data;
  }

  const standards: StandardRow[] = selectStandards(
    (allStandards ?? []) as StandardRow[],
    profile.ageGroup,
    profile.sex ?? "male"
  );

  const sets: SetRow[] = (setsRows ?? []).map((r: any) => ({
    exercise_name: r.exercise_name,
    weight_lbs: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
    date: r.workouts?.date,
  }));

  // ── Lifting overview (this week) ───────────────────────────────
  const setsThisWeek = (setsRows ?? []).filter(
    (r: any) => (r.workouts?.date ?? "") >= sevenDaysAgoISO
  );
  const workoutsThisWeek = new Set(
    setsThisWeek
      .map((r: any) => r.workouts?.date)
      .filter((d: any): d is string => !!d)
  ).size;

  const zoneCounts: Record<string, number> = {};
  setsThisWeek.forEach((r: any) => {
    const z = r.muscle_group;
    if (!z) return;
    zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;
  });
  const mostTrainedZone =
    Object.entries(zoneCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  const lastDate =
    (setsRows ?? [])
      .map((r: any) => r.workouts?.date)
      .filter((d: any): d is string => !!d)
      .sort()
      .at(-1) ?? null;
  const lastZoneCounts: Record<string, number> = {};
  (setsRows ?? [])
    .filter((r: any) => r.workouts?.date === lastDate)
    .forEach((r: any) => {
      if (r.muscle_group) {
        lastZoneCounts[r.muscle_group] =
          (lastZoneCounts[r.muscle_group] ?? 0) + 1;
      }
    });
  const lastWorkoutZone =
    Object.entries(lastZoneCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
    null;

  const liftingOverview = {
    workoutsThisWeek,
    setsThisWeek: setsThisWeek.length,
    mostTrainedZone,
    lastWorkoutDate: lastDate,
    lastWorkoutZone,
  };

  const stepGoal = Number(
    stepsToday?.goal ?? stepGoalRow?.daily_goal ?? 10000
  );
  const stepsOverview = {
    today: Number(stepsToday?.steps ?? 0),
    goal: stepGoal,
  };

  const validDir = (v: unknown) =>
    v === "negative" || v === "neutral" || v === "positive" ? v : null;
  const nutritionGoals = {
    calories: Number(nutritionGoalsRow?.calorie_goal ?? 2000),
    protein:
      nutritionGoalsRow?.protein_goal_g != null
        ? Number(nutritionGoalsRow.protein_goal_g)
        : null,
    carbs:
      nutritionGoalsRow?.carbs_goal_g != null
        ? Number(nutritionGoalsRow.carbs_goal_g)
        : null,
    fat:
      nutritionGoalsRow?.fat_goal_g != null
        ? Number(nutritionGoalsRow.fat_goal_g)
        : null,
    proteinDirection:
      (validDir(nutritionGoalsRow?.protein_direction) as
        | "negative"
        | "neutral"
        | "positive"
        | null) ?? "positive",
    carbsDirection:
      (validDir(nutritionGoalsRow?.carbs_direction) as
        | "negative"
        | "neutral"
        | "positive"
        | null) ?? "neutral",
    fatDirection:
      (validDir(nutritionGoalsRow?.fat_direction) as
        | "negative"
        | "neutral"
        | "positive"
        | null) ?? "neutral",
  };
  const nutritionMode: NutritionMode =
    nutritionGoalsRow?.mode === "bulk" ||
    nutritionGoalsRow?.mode === "cut" ||
    nutritionGoalsRow?.mode === "maintain"
      ? nutritionGoalsRow.mode
      : "maintain";

  const nutritionOverview = {
    today: nutritionToday
      ? {
          calories: Number(nutritionToday.calories ?? 0),
          protein: Number(nutritionToday.protein_g ?? 0),
          carbs: Number(nutritionToday.carbs_g ?? 0),
          fat: Number(nutritionToday.fat_g ?? 0),
        }
      : null,
    goals: nutritionGoals,
  };

  const { muscleLevels, muscleBest, zoneLevels } = computeLevels(
    sets,
    standards,
    profile.experience,
    profile.bodyweight ?? undefined,
    profile.sex ?? "male",
    profile.ageGroup
  );

  const recentActivity = (setsRows ?? [])
    .map((r: any) => ({
      exercise: String(r.exercise_name ?? ""),
      muscleGroup: String(r.muscle_group ?? ""),
      weight: Number(r.weight_lbs ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
      date: String(r.workouts?.date ?? ""),
    }))
    .filter((r) => r.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

  // ── SCORING — three pillars + overall ─────────────────────────
  const decayMap = daysSinceLastTrainedByZone(
    (setsRows ?? []).map((r: any) => ({
      muscle_group: String(r.muscle_group ?? ""),
      date: String(r.workouts?.date ?? ""),
    })),
    todayISO
  );
  const zoneDecay = applyZoneDecay(zoneLevels, decayMap);
  const atlasScore = computeAtlasScore(zoneDecay);

  const stepsByDate = new Map<string, number>();
  (stepsLast60 ?? []).forEach((r: any) => {
    stepsByDate.set(String(r.date), Number(r.steps ?? 0));
  });
  const todaySteps = stepsByDate.get(todayISO) ?? 0;

  // Nuclear-level diagnostics for the journey score path. Print BEFORE
  // computing so we see the exact inputs even if the function throws.
  console.log(
    "[JOURNEY SCORE] steps data:",
    JSON.stringify(
      (stepsLast60 ?? []).slice(0, 3).map((r: any) => ({
        date: r.date,
        steps: r.steps,
      }))
    ),
    "rowsTotal:",
    (stepsLast60 ?? []).length,
    "goal:",
    stepGoal,
    "todayISO:",
    todayISO
  );

  const journeyScore = computeJourneyScore(stepsByDate, stepGoal, todayISO);

  console.log(
    `[journey-score] user=${user.id} today=${todayISO} ` +
      `stepsLast60Rows=${(stepsLast60 ?? []).length} ` +
      `mapSize=${stepsByDate.size} todaySteps=${todaySteps} ` +
      `goal=${stepGoal} score=${journeyScore}`
  );

  if ((stepsLast60 ?? []).length === 0) {
    console.warn(
      "[journey-score] daily_steps query returned ZERO rows. " +
        `Filter was: user_id=${user.id} AND date >= ${sixtyDaysAgoISO}. ` +
        "Confirm the /api/steps writes are using the same user.id."
    );
  } else if (stepsByDate.size === 0) {
    console.warn(
      "[journey-score] rows fetched but byDate map is empty — date column may be coming back as a non-string?"
    );
  }

  const nutritionByDate = new Map<string, NutritionDay>();
  (nutritionLast60 ?? []).forEach((r: any) => {
    nutritionByDate.set(String(r.date), {
      date: String(r.date),
      calories: Number(r.calories ?? 0),
      protein: Number(r.protein_g ?? 0),
      carbs: Number(r.carbs_g ?? 0),
      fat: Number(r.fat_g ?? 0),
    });
  });
  const sustenanceScore = computeSustenanceScore(
    nutritionByDate,
    nutritionGoals,
    nutritionMode,
    todayISO
  );

  // ── DAILY QUESTS — fixed three personal-goal quests ────────────
  const todaySetsList = (setsRows ?? []).filter(
    (r: any) => String(r.workouts?.date) === todayISO
  );

  // Current step streak ending today (used by lib/badges).
  function currentStepStreak(): number {
    let s = 0;
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 0; i < 365; i++) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if ((stepsByDate.get(iso) ?? 0) >= stepGoal) s += 1;
      else break;
    }
    return s;
  }

  const workoutGoal: WorkoutGoalChoice = profile.workoutGoal;
  const dailyQuests = getDailyQuests({
    stepGoal,
    calorieGoal: nutritionGoals.calories,
    mode: nutritionMode,
    workoutGoal,
  });
  const questSnapshot: QuestEvalSnapshot = {
    todayISO,
    workoutGoal,
    mode: nutritionMode,
    todaySetsCount: todaySetsList.length,
    todaySteps: stepsOverview.today,
    stepGoal,
    todayCalories: nutritionOverview.today?.calories ?? 0,
    goalCalories: nutritionGoals.calories,
  };
  const atlasDone = evaluateQuest(dailyQuests.atlas.id, questSnapshot);
  const journeyDone = evaluateQuest(dailyQuests.journey.id, questSnapshot);
  const sustenanceDone = evaluateQuest(
    dailyQuests.sustenance.id,
    questSnapshot
  );
  const allQuestsDone = atlasDone && journeyDone && sustenanceDone;

  // Persist quest progress (best-effort; ignore if table missing).
  try {
    await admin.from("daily_quests").upsert(
      {
        user_id: user.id,
        date: todayISO,
        quest_atlas: dailyQuests.atlas.id,
        quest_journey: dailyQuests.journey.id,
        quest_sustenance: dailyQuests.sustenance.id,
        atlas_done: atlasDone,
        journey_done: journeyDone,
        sustenance_done: sustenanceDone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
  } catch {
    /* daily_quests table not yet migrated — silently skip */
  }

  // ── OVERALL SCORE — apply the +5 quest-completion bonus ───────
  const scores = combineScores({
    atlas: atlasScore,
    journey: journeyScore,
    sustenance: sustenanceScore,
    questBonus: allQuestsDone ? 5 : 0,
  });

  // ── BADGES — evaluate and insert newly-earned IDs ─────────────
  const earnedBadgeIds = new Set<string>(
    (earnedBadgesRes.data ?? []).map((r: any) => String(r.badge_id))
  );

  const totalWorkoutDates = new Set(
    (setsRows ?? [])
      .map((r: any) => r.workouts?.date)
      .filter((d: any): d is string => !!d)
  ).size;
  const bestStepDay = Array.from(stepsByDate.values()).reduce(
    (m, v) => (v > m ? v : m),
    0
  );
  const totalNutritionDays = nutritionByDate.size;
  // current nutrition logging streak ending today
  function currentNutritionStreak(): number {
    let s = 0;
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 0; i < 365; i++) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const e = nutritionByDate.get(iso);
      if (e && (e.calories > 0 || e.protein > 0)) s += 1;
      else break;
    }
    return s;
  }
  const macroOk = (got: number, goal: number | null, tol: number) =>
    goal == null ? true : Math.abs(got - goal) <= goal * tol;
  const t = nutritionOverview.today;
  const hitAllMacrosToday =
    !!t &&
    nutritionGoals.calories > 0 &&
    Math.abs(t.calories - nutritionGoals.calories) <=
      nutritionGoals.calories * 0.10 &&
    macroOk(t.protein, nutritionGoals.protein, 0.15) &&
    macroOk(t.carbs, nutritionGoals.carbs, 0.15) &&
    macroOk(t.fat, nutritionGoals.fat, 0.15);

  const qualified = evaluateBadges({
    totalWorkoutDates,
    zoneLevels,
    prsCount: new Set(
      (prRows ?? []).map((r: any) => String(r.lift_name ?? ""))
    ).size,
    bestStepDay,
    stepStreak: currentStepStreak(),
    totalNutritionDays,
    nutritionStreak: currentNutritionStreak(),
    hitAllMacrosToday,
    scores: {
      atlas: scores.atlas,
      journey: scores.journey,
      sustenance: scores.sustenance,
    },
    rank: scores.rank,
  });

  const newlyEarned: string[] = [];
  qualified.forEach((id) => {
    if (!earnedBadgeIds.has(id)) newlyEarned.push(id);
  });
  if (newlyEarned.length > 0) {
    try {
      await admin
        .from("achievements")
        .upsert(
          newlyEarned.map((badge_id) => ({
            user_id: user.id,
            badge_id,
            earned_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,badge_id" }
        );
      newlyEarned.forEach((id) => earnedBadgeIds.add(id));
    } catch {
      /* achievements table not yet migrated — silently skip */
    }
  }

  console.log(
    `[atlas] user=${user.id} sets=${sets.length} ` +
      `scores=A${scores.atlas}/J${scores.journey}/S${scores.sustenance} ` +
      `rank=${scores.rankLabel} questsDone=${
        Number(atlasDone) + Number(journeyDone) + Number(sustenanceDone)
      }/3 newBadges=${newlyEarned.length}`
  );

  // Audit which logged sets actually contributed to a score.
  const stdNames = new Set(standards.map((s) => s.exercise_name));
  const exNames = new Set(EXERCISE_OPTIONS.map((e) => e.name));
  const setAudit = sets.map((r) => ({
    exercise: r.exercise_name,
    weight: r.weight_lbs,
    reps: r.reps,
    sets: r.sets,
    inExerciseOptions: exNames.has(r.exercise_name),
    hasStandard: stdNames.has(r.exercise_name),
  }));

  const debug = {
    setsCount: sets.length,
    standardsCount: standards.length,
    standardsLikelyOutdated: standards.length < 30,
    standardNames: Array.from(stdNames).sort(),
    ageGroup: profile.ageGroup,
    experience: profile.experience,
    chestZoneLevel: zoneLevels.chest ?? "untrained",
    sampleSets: sets.slice(0, 10),
    setAudit,
    chestMuscleBest: Object.fromEntries(
      Object.entries(muscleBest).filter(([m]) =>
        [
          "Pectoralis Major (upper)",
          "Pectoralis Major (middle)",
          "Pectoralis Major (lower)",
          "Pectoralis Minor",
          "Serratus Anterior",
        ].includes(m)
      )
    ),
  };

  const simpleBest: Record<string, MuscleBest> = {};
  Object.entries(muscleBest).forEach(([m, b]) => {
    simpleBest[m] = b
      ? {
          exercise: b.exercise,
          weight: b.weight,
          reps: b.reps,
          sets: b.sets,
          score: b.score,
        }
      : null;
  });

  const prs: PR[] = (prRows ?? []).map((r: any) => ({
    lift: r.lift_name as BigThree,
    weight: Number(r.weight_lbs ?? 0),
    date: r.date_achieved,
  }));

  // Per-zone decay flags (UI shows warning chips next to stat bars)
  const zoneDecayFlat: Record<
    string,
    { daysSinceLastTrained: number | null; warning: boolean; decayed: boolean }
  > = {};
  for (const z of ZONES) {
    zoneDecayFlat[z] = {
      daysSinceLastTrained: zoneDecay[z].daysSinceLastTrained,
      warning: zoneDecay[z].warning,
      decayed: zoneDecay[z].decayed,
    };
  }

  // Final verification: this is what the rank card receives.
  console.log(
    "[ATLAS] journeyScore:",
    journeyScore,
    "stepsRows:",
    (stepsLast60 ?? []).length,
    "stepGoal:",
    stepGoal,
    "scores:",
    {
      atlas: scores.atlas,
      journey: scores.journey,
      sustenance: scores.sustenance,
      overall: scores.overall,
      rank: scores.rank,
    }
  );

  return (
    <Dashboard
      userId={user.id}
      username={profile.username}
      isAdmin={profile.role === "admin"}
      ageGroup={profile.ageGroup}
      sex={profile.sex}
      bodyweight={profile.bodyweight}
      height={profile.height}
      experience={profile.experience}
      profileComplete={profile.isComplete}
      zoneLevels={zoneLevels}
      muscleLevels={muscleLevels}
      muscleBest={simpleBest}
      standards={standards}
      prs={prs}
      debug={debug}
      liftingOverview={liftingOverview}
      stepsOverview={stepsOverview}
      nutritionOverview={nutritionOverview}
      recentActivity={recentActivity}
      scores={scores}
      zoneDecay={zoneDecayFlat}
      dailyQuests={{
        atlas: { id: dailyQuests.atlas.id, text: dailyQuests.atlas.text, done: atlasDone },
        journey: { id: dailyQuests.journey.id, text: dailyQuests.journey.text, done: journeyDone },
        sustenance: { id: dailyQuests.sustenance.id, text: dailyQuests.sustenance.text, done: sustenanceDone },
        allDone: allQuestsDone,
      }}
      earnedBadges={Array.from(earnedBadgeIds)}
      newlyEarned={newlyEarned}
    />
  );
}
