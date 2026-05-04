import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import AdminPanel from "@/components/AdminPanel";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  noStore();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const profile = await loadProfile(
    user.id,
    user.email?.split("@")[0] ?? "Admin"
  );
  if (profile.role !== "admin") redirect("/dashboard");

  const admin = createSupabaseAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, role")
    .order("created_at", { ascending: true });

  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailById = new Map<string, string>();
  authUsers?.users.forEach((u) => {
    if (u.email) emailById.set(u.id, u.email);
  });

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    role: p.role,
    email: emailById.get(p.id) ?? null,
  }));

  return (
    <AdminPanel
      users={users}
      currentUserId={user.id}
      username={profile.username}
      profile={{
        bodyweight: profile.bodyweight,
        height: profile.height,
        sex: profile.sex,
        ageGroup: profile.ageGroup,
        experience: profile.experience,
      }}
    />
  );
}
