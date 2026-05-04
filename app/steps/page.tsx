import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import StepsClient from "@/components/StepsClient";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";

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
  // last 60 days for monthly chart + streaks
  const sinceISO = new Date(Date.now() - 60 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const [{ data: stepsRows }, { data: goalRow }] = await Promise.all([
    admin
      .from("daily_steps")
      .select("date, steps, goal")
      .eq("user_id", user.id)
      .gte("date", sinceISO)
      .order("date", { ascending: true }),
    admin
      .from("step_goals")
      .select("daily_goal")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

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
      goal={Number(goalRow?.daily_goal ?? 10000)}
      rows={(stepsRows ?? []).map((r: any) => ({
        date: r.date,
        steps: Number(r.steps ?? 0),
        goal: Number(r.goal ?? 10000),
      }))}
    />
  );
}
