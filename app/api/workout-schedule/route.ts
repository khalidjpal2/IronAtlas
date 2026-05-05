import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

const ALLOWED_TYPES = new Set([
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "custom",
]);

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workout_schedule")
    .select("day_of_week, is_rest, workout_type")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ days: data ?? [] });
}

/**
 * Bulk-replace the schedule. Body: { days: Array<{ day_of_week,
 * is_rest, workout_type | null }> }. Each entry overwrites the
 * matching (user, day) row.
 */
export async function PUT(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    days?: unknown;
  } | null;
  if (!body || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "days[] is required" }, { status: 400 });
  }

  const rows: Array<{
    user_id: string;
    day_of_week: number;
    is_rest: boolean;
    workout_type: string | null;
    updated_at: string;
  }> = [];
  for (const raw of body.days) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const dow = Number(r.day_of_week);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
    const isRest = !!r.is_rest;
    let type: string | null = null;
    if (!isRest && typeof r.workout_type === "string" && r.workout_type) {
      type = ALLOWED_TYPES.has(r.workout_type) ? r.workout_type : null;
    }
    rows.push({
      user_id: user.id,
      day_of_week: dow,
      is_rest: isRest,
      workout_type: type,
      updated_at: new Date().toISOString(),
    });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workout_schedule")
    .upsert(rows, { onConflict: "user_id,day_of_week" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/lifting");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}
