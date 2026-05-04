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
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date : null;
  const steps = typeof body.steps === "number" ? body.steps : null;
  const goal =
    typeof body.goal === "number" && body.goal > 0 ? body.goal : null;
  if (!date || steps === null || steps < 0 || steps > 1_000_000) {
    return NextResponse.json(
      { error: "date (YYYY-MM-DD) and steps (number ≥ 0) are required" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("daily_steps")
    .upsert(
      {
        user_id: user.id,
        date,
        steps,
        ...(goal != null ? { goal } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        code: (error as any).code,
        details: (error as any).details,
      },
      { status: 400 }
    );
  }

  // Steps land in three places — the Journey page, the dashboard
  // (rank card / today overview), and Hall of Achievements (Journey
  // score). Bust all three so the user sees fresh data instantly.
  revalidatePath("/steps");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  return NextResponse.json({ ok: true, row: data });
}
