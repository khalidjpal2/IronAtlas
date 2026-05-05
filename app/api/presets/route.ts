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
    .from("workout_presets")
    .select(
      "id, name, created_at, preset_exercises(id, exercise_name, muscle_group, sort_order)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }
  return NextResponse.json({ presets: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    exercises?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const exercises = Array.isArray(body?.exercises)
    ? (body!.exercises as ExerciseInput[]).filter(
        (e) =>
          e &&
          typeof e.exercise_name === "string" &&
          typeof e.muscle_group === "string"
      )
    : [];

  const admin = createSupabaseAdminClient();
  const { data: preset, error: pErr } = await admin
    .from("workout_presets")
    .insert({ user_id: user.id, name })
    .select()
    .single();
  if (pErr) {
    return NextResponse.json(
      { error: pErr.message, code: (pErr as any).code },
      { status: 400 }
    );
  }

  if (exercises.length > 0) {
    const rows = exercises.map((ex, i) => ({
      preset_id: preset.id,
      exercise_name: ex.exercise_name,
      muscle_group: ex.muscle_group,
      sort_order: i,
    }));
    const { error: eErr } = await admin.from("preset_exercises").insert(rows);
    if (eErr) {
      // Roll back the preset header so we don't leave an empty preset.
      await admin.from("workout_presets").delete().eq("id", preset.id);
      return NextResponse.json(
        { error: eErr.message, code: (eErr as any).code },
        { status: 400 }
      );
    }
  }

  revalidatePath("/lifting");
  return NextResponse.json({ ok: true, id: preset.id });
}
