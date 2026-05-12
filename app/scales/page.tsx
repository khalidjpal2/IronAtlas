import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import ScalesClient from "@/components/ScalesClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScalesPage() {
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
  const sinceISO = new Date(Date.now() - 90 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  // Pull body weight (with fallback if migration hasn't run), plus
  // last-90d nutrition/steps for the balance calculations and the
  // all-time aggregates.
  const [bwRes, ngRes, stepsRes, allNutRes, allStepsRes, goalRes] =
    await Promise.all([
      admin
        .from("body_weight")
        .select("date, weight_lbs, notes")
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
      admin
        .from("nutrition_goals")
        .select("calorie_goal")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("daily_steps")
        .select("date, steps")
        .eq("user_id", user.id)
        .gte("date", sinceISO)
        .order("date", { ascending: true }),
      admin
        .from("daily_nutrition")
        .select("date, calories")
        .eq("user_id", user.id),
      admin
        .from("daily_steps")
        .select("date, steps")
        .eq("user_id", user.id),
      admin
        .from("profiles")
        .select("weight_goal_lbs, weight_goal_date")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  // Goal columns may not exist yet (migration not run). Degrade gracefully.
  const goalColumnsMissing =
    !!goalRes.error && /weight_goal_(lbs|date)/i.test(goalRes.error.message ?? "");
  const weightGoal =
    !goalColumnsMissing && goalRes.data?.weight_goal_lbs != null && goalRes.data?.weight_goal_date != null
      ? {
          lbs: Number(goalRes.data.weight_goal_lbs),
          date: String(goalRes.data.weight_goal_date),
        }
      : null;

  // Body weight: degrade gracefully if the table doesn't exist yet.
  const bwTableMissing =
    !!bwRes.error &&
    ((bwRes.error as any).code === "42P01" ||
      /body_weight/i.test(bwRes.error.message ?? ""));
  const weights = (bwRes.data ?? []).map((r: any) => ({
    date: String(r.date),
    weight: Number(r.weight_lbs ?? 0),
    notes: r.notes ?? null,
  }));

  // Pull nutrition for the 90-day window in a second call so we can
  // attach calories *and* date even if it returns nothing.
  const { data: nutritionRows } = await admin
    .from("daily_nutrition")
    .select("date, calories")
    .eq("user_id", user.id)
    .gte("date", sinceISO)
    .order("date", { ascending: true });

  const calorieGoal = Number(ngRes.data?.calorie_goal ?? 2000);

  return (
    <ScalesClient
      userId={user.id}
      username={profile.username}
      isAdmin={profile.role === "admin"}
      profile={{
        bodyweight: profile.bodyweight,
        height: profile.height,
        sex: profile.sex,
        ageGroup: profile.ageGroup,
        experience: profile.experience,
      }}
      calorieBenchmark={calorieGoal}
      weights={weights}
      bwTableMissing={bwTableMissing}
      nutritionRows={(nutritionRows ?? []).map((r: any) => ({
        date: String(r.date),
        calories: Number(r.calories ?? 0),
      }))}
      stepsRows={(stepsRes.data ?? []).map((r: any) => ({
        date: String(r.date),
        steps: Number(r.steps ?? 0),
      }))}
      allTimeNutrition={(allNutRes.data ?? []).map((r: any) => ({
        date: String(r.date),
        calories: Number(r.calories ?? 0),
      }))}
      allTimeSteps={(allStepsRes.data ?? []).map((r: any) => ({
        date: String(r.date),
        steps: Number(r.steps ?? 0),
      }))}
      weightGoal={weightGoal}
      goalColumnsMissing={goalColumnsMissing}
    />
  );
}
