import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

function num(v: unknown, max: number): number | null {
  if (typeof v !== "number" || !isFinite(v) || v < 0 || v > max) return null;
  return v;
}

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
  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const calories = num(body.calories, 20000);
  const protein = num(body.protein_g, 2000);
  const carbs = num(body.carbs_g, 2000);
  const fat = num(body.fat_g, 2000);
  if (calories === null) {
    return NextResponse.json(
      { error: "calories must be 0..20000" },
      { status: 400 }
    );
  }
  if (protein === null || carbs === null || fat === null) {
    return NextResponse.json(
      { error: "protein/carbs/fat must each be 0..2000 g" },
      { status: 400 }
    );
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim() ? body.notes : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("daily_nutrition")
    .upsert(
      {
        user_id: user.id,
        date,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }

  revalidatePath("/calories");
  return NextResponse.json({ ok: true, row: data });
}
