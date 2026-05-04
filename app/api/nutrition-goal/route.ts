import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

function num(v: unknown, max: number): number | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !isFinite(v) || v < 0 || v > max)
    return undefined;
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

  console.log("[api/nutrition-goal] payload:", body);

  const calories = num(body.calorie_goal, 20000);
  if (typeof calories !== "number") {
    return NextResponse.json(
      { error: "calorie_goal (number 0..20000) is required" },
      { status: 400 }
    );
  }
  const protein = num(body.protein_goal_g, 2000);
  const carbs = num(body.carbs_goal_g, 2000);
  const fat = num(body.fat_goal_g, 2000);
  const mode =
    body.mode === "bulk" || body.mode === "cut" || body.mode === "maintain"
      ? body.mode
      : undefined;
  const dir = (v: unknown) =>
    v === "negative" || v === "neutral" || v === "positive" ? v : undefined;
  const proteinDirection = dir(body.protein_direction);
  const carbsDirection = dir(body.carbs_direction);
  const fatDirection = dir(body.fat_direction);

  const update: Record<string, unknown> = {
    user_id: user.id,
    calorie_goal: calories,
    updated_at: new Date().toISOString(),
  };
  if (protein !== undefined) update.protein_goal_g = protein;
  if (carbs !== undefined) update.carbs_goal_g = carbs;
  if (fat !== undefined) update.fat_goal_g = fat;
  if (mode !== undefined) update.mode = mode;
  if (proteinDirection !== undefined) update.protein_direction = proteinDirection;
  if (carbsDirection !== undefined) update.carbs_direction = carbsDirection;
  if (fatDirection !== undefined) update.fat_direction = fatDirection;

  const admin = createSupabaseAdminClient();

  let { data, error } = await admin
    .from("nutrition_goals")
    .upsert(update, { onConflict: "user_id" })
    .select()
    .single();

  // If the migration that adds the `mode` column hasn't been run yet,
  // PostgREST returns "column 'mode' does not exist". Retry without it
  // so existing users can still save calorie/macro goals — but flag
  // it loudly so the UI can prompt them to run the migration.
  let modeColumnMissing = false;
  let directionColumnsMissing = false;
  if (
    error &&
    /mode|protein_direction|carbs_direction|fat_direction/i.test(error.message)
  ) {
    if (/mode/i.test(error.message) && mode !== undefined) modeColumnMissing = true;
    if (/_direction/i.test(error.message)) directionColumnsMissing = true;
    console.warn(
      "[api/nutrition-goal] missing column — saved goals without it. " +
        "Run supabase/migrations/_run_all.sql in Supabase SQL editor. " +
        `(${error.message})`
    );
    const fallback: Record<string, unknown> = { ...update };
    if (modeColumnMissing) delete fallback.mode;
    if (directionColumnsMissing) {
      delete fallback.protein_direction;
      delete fallback.carbs_direction;
      delete fallback.fat_direction;
    }
    const retry = await admin
      .from("nutrition_goals")
      .upsert(fallback, { onConflict: "user_id" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[api/nutrition-goal] upsert error:", error);
    return NextResponse.json(
      { error: error.message, code: (error as any).code },
      { status: 400 }
    );
  }

  // Verification round-trip — read the row back and include it in the
  // response so the client can confirm the persisted state.
  const { data: verify } = await admin
    .from("nutrition_goals")
    .select("calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, mode")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("[api/nutrition-goal] saved row:", data);
  console.log("[api/nutrition-goal] verify read:", verify);

  revalidatePath("/calories");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");

  return NextResponse.json({
    ok: true,
    row: data,
    verify,
    modeColumnMissing,
    directionColumnsMissing,
    requestedMode: mode ?? null,
  });
}
