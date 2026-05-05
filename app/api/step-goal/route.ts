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

  // Accept either `personal_goal` (new) or `daily_goal` (legacy).
  const rawPersonal =
    typeof body?.personal_goal === "number"
      ? body.personal_goal
      : typeof body?.daily_goal === "number"
      ? body.daily_goal
      : null;

  if (rawPersonal === null || rawPersonal < 10001 || rawPersonal > 200_000) {
    return NextResponse.json(
      { error: "personal_goal must be between 10,001 and 200,000" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Try with the new personal_goal column. If the migration hasn't
  // been applied yet, fall back to the legacy daily_goal column so
  // the app still works.
  const tryNew = await admin
    .from("step_goals")
    .upsert(
      {
        user_id: user.id,
        daily_goal: rawPersonal,
        personal_goal: rawPersonal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  let result = tryNew;
  if (tryNew.error) {
    const code = (tryNew.error as any).code;
    const missingColumn =
      code === "42703" ||
      code === "PGRST204" ||
      /personal_goal/i.test(tryNew.error.message ?? "");
    if (missingColumn) {
      result = await admin
        .from("step_goals")
        .upsert(
          {
            user_id: user.id,
            daily_goal: rawPersonal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
    }
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message, code: (result.error as any).code },
      { status: 400 }
    );
  }

  revalidatePath("/steps");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  return NextResponse.json({ ok: true, row: result.data });
}
