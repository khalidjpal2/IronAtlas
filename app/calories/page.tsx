import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import CaloriesClient from "@/components/CaloriesClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import type { NutritionMode } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CaloriesPage() {
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
  const sinceISO = new Date(Date.now() - 60 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  // Goals — try the full new column set first; fall back if any
  // columns aren't migrated yet so existing rows still load.
  let goalsRes = await admin
    .from("nutrition_goals")
    .select(
      "calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, mode, protein_direction, carbs_direction, fat_direction"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (goalsRes.error) {
    // Retry without direction columns
    goalsRes = await admin
      .from("nutrition_goals")
      .select("calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, mode")
      .eq("user_id", user.id)
      .maybeSingle();
  }
  if (goalsRes.error) {
    // Retry also without mode
    goalsRes = await admin
      .from("nutrition_goals")
      .select("calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g")
      .eq("user_id", user.id)
      .maybeSingle();
  }
  const goalRow: any = goalsRes.data;

  // Pull nutrition + steps for the same 60-day window so the Energy
  // Ledger can join them per-day (calories in vs. step-derived burn).
  const [{ data: nutritionRows }, { data: stepsRows }] = await Promise.all([
    admin
      .from("daily_nutrition")
      .select("date, calories, protein_g, carbs_g, fat_g, notes")
      .eq("user_id", user.id)
      .gte("date", sinceISO)
      .order("date", { ascending: true }),
    admin
      .from("daily_steps")
      .select("date, steps")
      .eq("user_id", user.id)
      .gte("date", sinceISO)
      .order("date", { ascending: true }),
  ]);

  // Also count all-time steps + nutrition for the All-Time Ledger card.
  const [{ data: allNutrition }, { data: allSteps }] = await Promise.all([
    admin
      .from("daily_nutrition")
      .select("date, calories")
      .eq("user_id", user.id),
    admin
      .from("daily_steps")
      .select("date, steps")
      .eq("user_id", user.id),
  ]);

  const mode: NutritionMode =
    goalRow?.mode === "bulk" || goalRow?.mode === "cut" || goalRow?.mode === "maintain"
      ? goalRow.mode
      : "maintain";
  const dir = (v: unknown, fallback: "negative" | "neutral" | "positive") =>
    v === "negative" || v === "neutral" || v === "positive" ? v : fallback;
  const directions = {
    protein: dir(goalRow?.protein_direction, "positive") as
      | "negative"
      | "neutral"
      | "positive",
    carbs: dir(goalRow?.carbs_direction, "neutral") as
      | "negative"
      | "neutral"
      | "positive",
    fat: dir(goalRow?.fat_direction, "neutral") as
      | "negative"
      | "neutral"
      | "positive",
  };

  return (
    <CaloriesClient
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
      goals={{
        calories: Number(goalRow?.calorie_goal ?? 2000),
        protein: goalRow?.protein_goal_g != null ? Number(goalRow.protein_goal_g) : null,
        carbs: goalRow?.carbs_goal_g != null ? Number(goalRow.carbs_goal_g) : null,
        fat: goalRow?.fat_goal_g != null ? Number(goalRow.fat_goal_g) : null,
      }}
      mode={mode}
      directions={directions}
      rows={(nutritionRows ?? []).map((r: any) => ({
        date: r.date,
        calories: Number(r.calories ?? 0),
        protein: Number(r.protein_g ?? 0),
        carbs: Number(r.carbs_g ?? 0),
        fat: Number(r.fat_g ?? 0),
        notes: r.notes ?? null,
      }))}
      stepsRows={(stepsRows ?? []).map((r: any) => ({
        date: String(r.date),
        steps: Number(r.steps ?? 0),
      }))}
      allTimeNutrition={(allNutrition ?? []).map((r: any) => ({
        date: String(r.date),
        calories: Number(r.calories ?? 0),
      }))}
      allTimeSteps={(allSteps ?? []).map((r: any) => ({
        date: String(r.date),
        steps: Number(r.steps ?? 0),
      }))}
    />
  );
}
