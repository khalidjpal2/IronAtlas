import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import StepsClient from "@/components/StepsClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import { JOURNEY_BASE_GOAL } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StepsPage() {
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

  const [
    { data: stepsRows },
    goalRowRes,
    { data: allTimeStepsRows },
  ] = await Promise.all([
    admin
      .from("daily_steps")
      .select("date, steps, goal")
      .eq("user_id", user.id)
      .gte("date", sinceISO)
      .order("date", { ascending: true }),
    admin
      .from("step_goals")
      .select("daily_goal, personal_goal")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("daily_steps")
      .select("date, steps, goal")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
  ]);

  // Fallback if personal_goal column hasn't been migrated yet.
  let goalRow: any = goalRowRes.data;
  if (goalRowRes.error) {
    const legacy = await admin
      .from("step_goals")
      .select("daily_goal")
      .eq("user_id", user.id)
      .maybeSingle();
    goalRow = legacy.data;
  }
  const personalGoal = Number(
    goalRow?.personal_goal ?? goalRow?.daily_goal ?? 20000
  );

  return (
    <StepsClient
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
      baseGoal={JOURNEY_BASE_GOAL}
      personalGoal={personalGoal}
      rows={(stepsRows ?? []).map((r: any) => ({
        date: r.date,
        steps: Number(r.steps ?? 0),
        goal: Number(r.goal ?? JOURNEY_BASE_GOAL),
      }))}
      allTimeRows={(allTimeStepsRows ?? []).map((r: any) => ({
        date: r.date,
        steps: Number(r.steps ?? 0),
        goal: Number(r.goal ?? JOURNEY_BASE_GOAL),
      }))}
    />
  );
}
