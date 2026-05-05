import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

type ExerciseInput = {
  exercise_name: string;
  muscle_group: string;
};

async function authorized(presetId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workout_presets")
    .select("user_id")
    .eq("id", presetId)
    .maybeSingle();
  if (error || !data) return false;
  return data.user_id === userId;
}

export async function GET(
  _req: Request,
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
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workout_presets")
    .select(
      "id, name, created_at, preset_exercises(id, exercise_name, muscle_group, sort_order)"
    )
    .eq("id", params.id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ preset: data });
}

export async function PUT(
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
    name?: unknown;
    exercises?: unknown;
  } | null;
  const admin = createSupabaseAdminClient();

  if (typeof body?.name === "string" && body.name.trim()) {
    const { error } = await admin
      .from("workout_presets")
      .update({ name: body.name.trim() })
      .eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (Array.isArray(body?.exercises)) {
    // Replace strategy: drop existing rows, insert the new ordered set.
    const exercises = (body!.exercises as ExerciseInput[]).filter(
      (e) =>
        e &&
        typeof e.exercise_name === "string" &&
        typeof e.muscle_group === "string"
    );
    const { error: dErr } = await admin
      .from("preset_exercises")
      .delete()
      .eq("preset_id", params.id);
    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 400 });
    }
    if (exercises.length > 0) {
      const rows = exercises.map((ex, i) => ({
        preset_id: params.id,
        exercise_name: ex.exercise_name,
        muscle_group: ex.muscle_group,
        sort_order: i,
      }));
      const { error: iErr } = await admin
        .from("preset_exercises")
        .insert(rows);
      if (iErr) {
        return NextResponse.json({ error: iErr.message }, { status: 400 });
      }
    }
  }

  revalidatePath("/lifting");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
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
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workout_presets")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  return NextResponse.json({ ok: true });
}
