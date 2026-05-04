import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import HistoryClient, { type HistoryRow } from "@/components/HistoryClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import { selectStandards, type StandardRow } from "@/lib/strength";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage() {
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
  const [{ data: allStandards }, { data: setsRows }] = await Promise.all([
    admin.from("strength_standards").select("*"),
    admin
      .from("workout_sets")
      .select(
        "id, workout_id, exercise_name, muscle_group, weight_lbs, reps, sets, created_at, workouts!inner(id, user_id, date, notes)"
      )
      .eq("workouts.user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const standards: StandardRow[] = selectStandards(
    (allStandards ?? []) as StandardRow[],
    profile.ageGroup,
    profile.sex ?? "male"
  );

  const rows: HistoryRow[] = (setsRows ?? []).map((r: any) => ({
    id: r.id,
    workoutId: r.workout_id,
    date: r.workouts?.date ?? r.created_at?.slice(0, 10) ?? "",
    notes: r.workouts?.notes ?? null,
    exerciseName: r.exercise_name,
    muscleGroup: r.muscle_group,
    weight: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
  }));

  return (
    <HistoryClient
      username={profile.username}
      isAdmin={profile.role === "admin"}
      rows={rows}
      standards={standards}
      bodyweight={profile.bodyweight ?? undefined}
      profileMeta={{
        bodyweight: profile.bodyweight,
        height: profile.height,
        sex: profile.sex,
        ageGroup: profile.ageGroup,
        experience: profile.experience,
      }}
    />
  );
}
