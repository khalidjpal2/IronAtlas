import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { todayPT } from "@/lib/time";

function num(v: unknown, max: number): number {
  if (typeof v !== "number" || !isFinite(v) || v < 0 || v > max) return 0;
  return v;
}

/**
 * POST — additive log against today's daily_nutrition row. The client
 * doesn't track per-meal entries; each "Add Provisions" submission
 * increments the running totals for that date.
 */
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : todayPT();
  const calories = num(body.calories, 20000);
  const protein_g = num(body.protein_g, 2000);
  const carbs_g = num(body.carbs_g, 2000);
  const fat_g = num(body.fat_g, 2000);

  if (calories <= 0 && protein_g <= 0 && carbs_g <= 0 && fat_g <= 0) {
    return NextResponse.json(
      { error: "Provide at least one of calories or macros." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Read current totals for the day so we can bump them.
  const { data: existing } = await admin
    .from("daily_nutrition")
    .select("calories, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const next = {
    user_id: user.id,
    date,
    calories: Number(existing?.calories ?? 0) + calories,
    protein_g: Number(existing?.protein_g ?? 0) + protein_g,
    carbs_g: Number(existing?.carbs_g ?? 0) + carbs_g,
    fat_g: Number(existing?.fat_g ?? 0) + fat_g,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("daily_nutrition")
    .upsert(next, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }

  revalidatePath("/calories");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  return NextResponse.json({ ok: true, row: data });
}

/**
 * DELETE — clears today's row so the user can start over. Accepts an
 * optional `?date=YYYY-MM-DD`; defaults to today.
 */
export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayPT();

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("daily_nutrition")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) {
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }
  revalidatePath("/calories");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  return NextResponse.json({ ok: true });
}
