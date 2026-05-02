import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  MUSCLE_GROUPS,
  levelForLift,
  type MuscleGroup,
  type StrengthLevel,
  type StandardRow,
} from "@/lib/strength";

const LEVEL_RANK: Record<StrengthLevel, number> = {
  untrained: 0,
  below: 1,
  average: 2,
  above: 3,
  exceptional: 4,
  elite: 5,
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Profile may be missing if the schema/trigger was installed after the user
  // was created. Fall back to safe defaults instead of redirecting (which
  // would loop against the middleware).
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, age_group")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? user.email?.split("@")[0] ?? "Lifter";
  const role = profile?.role ?? "user";
  const ageGroup = profile?.age_group ?? "18-25";

  const { data: standards } = await supabase
    .from("strength_standards")
    .select("*")
    .eq("age_group", ageGroup);

  const { data: setsRows } = await supabase
    .from("workout_sets")
    .select("exercise_name, muscle_group, weight_lbs, workouts!inner(user_id)")
    .eq("workouts.user_id", user.id);

  const stdByExercise = new Map<string, StandardRow>();
  (standards ?? []).forEach((s: StandardRow) => {
    stdByExercise.set(s.exercise_name, s);
  });

  const bestByExercise = new Map<string, { weight: number; muscle: MuscleGroup }>();
  (setsRows ?? []).forEach((row: any) => {
    const w = Number(row.weight_lbs ?? 0);
    const cur = bestByExercise.get(row.exercise_name);
    if (!cur || w > cur.weight) {
      bestByExercise.set(row.exercise_name, {
        weight: w,
        muscle: row.muscle_group as MuscleGroup,
      });
    }
  });

  const levels: Partial<Record<MuscleGroup, StrengthLevel>> = {};
  MUSCLE_GROUPS.forEach((m) => (levels[m] = "untrained"));

  for (const [exerciseName, info] of bestByExercise) {
    const std = stdByExercise.get(exerciseName);
    if (!std) continue;
    const lvl = levelForLift(info.weight, std);
    if (LEVEL_RANK[lvl] > LEVEL_RANK[levels[info.muscle] ?? "untrained"]) {
      levels[info.muscle] = lvl;
    }
  }

  return (
    <Dashboard
      userId={user.id}
      username={username}
      isAdmin={role === "admin"}
      ageGroup={ageGroup}
      levels={levels}
    />
  );
}
