import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

async function authorized(presetId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workout_presets")
    .select("user_id")
    .eq("id", presetId)
    .maybeSingle();
  return data?.user_id === userId;
}

/**
 * Granular endpoint: append a single exercise to a preset, sort_order
 * placed at the end. The main editor uses the bulk-replace PUT in
 * /api/presets/[id], but this route exists for callers that just want
 * to nudge a single row.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!(await authorized(params.id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    exercise_name?: unknown;
    muscle_group?: unknown;
  } | null;
  const exercise_name =
    typeof body?.exercise_name === "string" ? body.exercise_name : "";
  const muscle_group =
    typeof body?.muscle_group === "string" ? body.muscle_group : "";
  if (!exercise_name || !muscle_group) {
    return NextResponse.json(
      { error: "exercise_name and muscle_group are required" },
      { status: 400 }
    );
  }
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("preset_exercises")
    .select("id", { count: "exact", head: true })
    .eq("preset_id", params.id);
  const { data, error } = await admin
    .from("preset_exercises")
    .insert({
      preset_id: params.id,
      exercise_name,
      muscle_group,
      sort_order: count ?? 0,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  return NextResponse.json({ ok: true, row: data });
}

/**
 * Granular delete by preset_exercises.id. The id is passed as a query
 * string `?row_id=...` to avoid a third dynamic segment in the route.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!(await authorized(params.id, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const rowId = url.searchParams.get("row_id");
  if (!rowId) {
    return NextResponse.json(
      { error: "row_id query parameter is required" },
      { status: 400 }
    );
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("preset_exercises")
    .delete()
    .eq("id", rowId)
    .eq("preset_id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  return NextResponse.json({ ok: true });
}
