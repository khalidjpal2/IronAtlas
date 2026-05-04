import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import SettingsForm from "@/components/SettingsForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
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

  return (
    <SettingsForm
      userId={user.id}
      username={profile.username}
      isAdmin={profile.role === "admin"}
      initialAgeGroup={profile.ageGroup}
      initialSex={profile.sex}
      initialBodyweight={profile.bodyweight}
      initialHeight={profile.height}
      initialExperience={profile.experience}
      initialWorkoutGoal={profile.workoutGoal}
    />
  );
}
