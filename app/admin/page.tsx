import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

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

  return <AdminPanel users={users} currentUserId={user.id} />;
}
