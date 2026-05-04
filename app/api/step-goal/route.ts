import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const goal = typeof body?.daily_goal === "number" ? body.daily_goal : null;
  if (goal === null || goal < 100 || goal > 200_000) {
    return NextResponse.json(
      { error: "daily_goal (100..200000) is required" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("step_goals")
    .upsert(
      {
        user_id: user.id,
        daily_goal: goal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }

  revalidatePath("/steps");
  return NextResponse.json({ ok: true, row: data });
}
