import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import AchievementsClient from "@/components/AchievementsClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import {
  ZONES,
  computeLevels,
  selectStandards,
  type SetRow,
  type StandardRow,
  type Zone,
} from "@/lib/strength";
import {
  applyZoneDecay,
  combineScores,
  computeAtlasScore,
  computeJourneyScore,
  computeSustenanceScore,
  currentStepStreak,
  daysSinceLastTrainedByZone,
  JOURNEY_BASE_GOAL,
  type NutritionDay,
  type NutritionMode,
} from "@/lib/scoring";
import { evaluateBadges } from "@/lib/badges";
import { ptDateNDaysAgo, todayPT } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AchievementsPage() {
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
  const todayISO = todayPT();
  const sixtyDaysAgoISO = ptDateNDaysAgo(60);

  // Pull everything needed to recompute scores + qualified badges.
  const [
    { data: allStandards },
    { data: setsRows },
    { data: prRows },
    nutritionGoalsRes,
    stepGoalRowRes,
    { data: stepsLast60 },
    { data: nutritionLast60 },
    earnedRes,
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
      .from("nutrition_goals")
      .select(
        "calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, mode, protein_direction, carbs_direction, fat_direction"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("step_goals")
      .select("daily_goal, personal_goal")
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
  ]);

  // Fallback if `mode` column not yet migrated.
  let nutritionGoalsRow: any = nutritionGoalsRes.data;
  if (nutritionGoalsRes.error) {
    const legacy = await admin
      .from("nutrition_goals")
      .select("calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g")
      .eq("user_id", user.id)
      .maybeSingle();
    nutritionGoalsRow = legacy.data;
  }

  // Same pattern for step_goals.personal_goal.
  let stepGoalRow: any = stepGoalRowRes.data;
  if (stepGoalRowRes.error) {
    const legacy = await admin
      .from("step_goals")
      .select("daily_goal")
      .eq("user_id", user.id)
      .maybeSingle();
    stepGoalRow = legacy.data;
  }
  const personalGoal = Number(
    stepGoalRow?.personal_goal ?? stepGoalRow?.daily_goal ?? 20000
  );
  const baseGoal = JOURNEY_BASE_GOAL;

  const standards: StandardRow[] = selectStandards(
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

  const { zoneLevels } = computeLevels(
    sets,
    standards,
    profile.experience,
    profile.bodyweight ?? undefined,
    profile.sex ?? "male",
    profile.ageGroup
  );

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
  const journeyScore = computeJourneyScore(
    stepsByDate,
    personalGoal,
    todayISO,
    baseGoal
  );

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
  const mode: NutritionMode =
    nutritionGoalsRow?.mode === "bulk" ||
    nutritionGoalsRow?.mode === "cut" ||
    nutritionGoalsRow?.mode === "maintain"
      ? nutritionGoalsRow.mode
      : "maintain";
  const sustenanceScore = computeSustenanceScore(
    nutritionByDate,
    nutritionGoals,
    mode,
    todayISO
  );
  const scores = combineScores({
    atlas: atlasScore,
    journey: journeyScore,
    sustenance: sustenanceScore,
  });

  // Build the badge snapshot exactly like the Atlas page does, so the
  // qualified set is consistent between the two views.
  const totalWorkoutDates = new Set(
    (setsRows ?? [])
      .map((r: any) => r.workouts?.date)
      .filter((d: any): d is string => !!d)
  ).size;
  const bestStepDay = Array.from(stepsByDate.values()).reduce(
    (m, v) => (v > m ? v : m),
    0
  );
  const baseStepStreak = currentStepStreak(stepsByDate, baseGoal, todayISO);

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
  const t = nutritionByDate.get(todayISO);
  const macroOk = (got: number, goal: number | null, tol: number) =>
    goal == null ? true : Math.abs(got - goal) <= goal * tol;
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
    stepStreak: baseStepStreak,
    totalNutritionDays: nutritionByDate.size,
    nutritionStreak: currentNutritionStreak(),
    hitAllMacrosToday,
    scores: {
      atlas: scores.atlas,
      journey: scores.journey,
      sustenance: scores.sustenance,
    },
    rank: scores.rank,
  });
  const earnedFromTable = new Set(
    (earnedRes.data ?? []).map((r: any) => String(r.badge_id))
  );
  // Insert any newly qualified badges (best-effort).
  const newlyEarned: string[] = [];
  qualified.forEach((id) => {
    if (!earnedFromTable.has(id)) newlyEarned.push(id);
  });
  if (newlyEarned.length > 0) {
    try {
      await admin.from("achievements").upsert(
        newlyEarned.map((badge_id) => ({
          user_id: user.id,
          badge_id,
          earned_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,badge_id" }
      );
      newlyEarned.forEach((id) => earnedFromTable.add(id));
    } catch {
      /* table missing — ignore */
    }
  }

  // Map badge_id → earned_at for the timestamp display.
  const earnedAtById: Record<string, string> = {};
  (earnedRes.data ?? []).forEach((r: any) => {
    if (r.badge_id) earnedAtById[String(r.badge_id)] = String(r.earned_at);
  });
  newlyEarned.forEach((id) => {
    earnedAtById[id] = new Date().toISOString();
  });

  return (
    <AchievementsClient
      username={profile.username}
      isAdmin={profile.role === "admin"}
      profile={{
        bodyweight: profile.bodyweight,
        height: profile.height,
        sex: profile.sex,
        ageGroup: profile.ageGroup,
        experience: profile.experience,
      }}
      scores={scores}
      earnedAtById={earnedAtById}
      newlyEarned={newlyEarned}
    />
  );
}
