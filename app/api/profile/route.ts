import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import {
  AGE_GROUPS,
  TRAINING_EXPERIENCES,
  type AgeGroup,
  type Sex,
  type TrainingExperience,
} from "@/lib/strength";

const ALLOWED_SEX: Sex[] = ["male", "female"];

function fail(stage: string, status: number, error: string, extra?: unknown) {
  console.error(`[api/profile] [FAIL] ${stage}: ${error}`, extra ?? "");
  return NextResponse.json({ stage, error, extra: extra ?? null }, { status });
}

export async function POST(req: Request) {
  console.log("[api/profile] → request received");

  // Identify the caller via session cookie. The auth client is only used
  // for identity; the write below uses the service-role client.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr) return fail("auth", 401, authErr.message ?? "auth error", authErr);
  if (!user) return fail("auth", 401, "unauthenticated");
  console.log(`[api/profile] auth ok user=${user.id}`);

  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch (e: any) {
    return fail("parse", 400, e?.message ?? "invalid JSON body");
  }
  if (!body || typeof body !== "object") {
    return fail("parse", 400, "body must be a JSON object");
  }
  console.log("[api/profile] body:", body);

  const updates: Record<string, unknown> = {};

  if ("age_group" in body) {
    const v = body.age_group;
    if (typeof v !== "string" || !AGE_GROUPS.includes(v as AgeGroup)) {
      return fail(
        "validate",
        400,
        `age_group must be one of ${AGE_GROUPS.join(", ")} (got ${JSON.stringify(v)})`
      );
    }
    updates.age_group = v;
  }

  if ("sex" in body) {
    const v = body.sex;
    if (v !== null && (typeof v !== "string" || !ALLOWED_SEX.includes(v as Sex))) {
      return fail(
        "validate",
        400,
        `sex must be 'male', 'female', or null (got ${JSON.stringify(v)})`
      );
    }
    updates.sex = v;
  }

  if ("bodyweight_lbs" in body) {
    const v = body.bodyweight_lbs;
    if (v !== null && typeof v !== "number") {
      return fail(
        "validate",
        400,
        `bodyweight_lbs must be a number or null (got ${JSON.stringify(v)})`
      );
    }
    if (typeof v === "number" && (!isFinite(v) || v < 0 || v > 2000)) {
      return fail("validate", 400, `bodyweight_lbs out of range (got ${v})`);
    }
    updates.bodyweight_lbs = v;
  }

  if ("height_inches" in body) {
    const v = body.height_inches;
    if (v !== null && typeof v !== "number") {
      return fail(
        "validate",
        400,
        `height_inches must be a number or null (got ${JSON.stringify(v)})`
      );
    }
    if (typeof v === "number" && (!isFinite(v) || v < 0 || v > 120)) {
      return fail("validate", 400, `height_inches out of range (got ${v})`);
    }
    updates.height_inches = v;
  }

  if ("training_experience" in body) {
    const v = body.training_experience;
    if (
      typeof v !== "string" ||
      !TRAINING_EXPERIENCES.includes(v as TrainingExperience)
    ) {
      return fail(
        "validate",
        400,
        `training_experience invalid (got ${JSON.stringify(v)})`
      );
    }
    updates.training_experience = v;
  }

  if ("daily_workout_goal" in body) {
    const v = body.daily_workout_goal;
    const ALLOWED_GOALS = ["any", "sets_3", "sets_5", "sets_10"];
    if (typeof v !== "string" || !ALLOWED_GOALS.includes(v)) {
      return fail(
        "validate",
        400,
        `daily_workout_goal invalid (got ${JSON.stringify(v)})`
      );
    }
    updates.daily_workout_goal = v;
  }

  if (Object.keys(updates).length === 0) {
    console.log("[api/profile] no fields to update — returning ok");
    return NextResponse.json({ ok: true, updated: 0, columns: [] });
  }
  console.log("[api/profile] applying upsert:", updates);

  // Service-role client bypasses RLS. We always upsert so a missing
  // profile row (which would have made .update() a silent no-op) is
  // created on first save.
  const admin = createSupabaseAdminClient();
  let { data, error } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, ...updates },
      { onConflict: "id" }
    )
    .select()
    .single();

  // Retry without daily_workout_goal if the migration hasn't been run.
  if (
    error &&
    "daily_workout_goal" in updates &&
    /daily_workout_goal/i.test(error.message)
  ) {
    const fallback = { ...updates };
    delete fallback.daily_workout_goal;
    const retry = await admin
      .from("profiles")
      .upsert({ id: user.id, ...fallback }, { onConflict: "id" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      console.warn(
        "[api/profile] daily_workout_goal column missing — saved other fields only"
      );
    }
  }

  if (error) {
    console.error("[api/profile] [FAIL] upsert error:", error);
    return NextResponse.json(
      {
        stage: "supabase",
        error: error.message,
        code: (error as any).code ?? null,
        details: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: 400 }
    );
  }

  console.log("[api/profile] [OK] upsert returned:", data);

  // Verification round-trip — read the row back and confirm the values
  // landed. If the user reports "didn't save", this proves it did.
  const { data: verify, error: verifyErr } = await admin
    .from("profiles")
    .select("id, age_group, sex, bodyweight_lbs, height_inches, training_experience")
    .eq("id", user.id)
    .single();
  if (verifyErr) {
    console.error("[api/profile] [FAIL] verify read error:", verifyErr);
  } else {
    console.log("[api/profile] [OK] verify read:", verify);
  }

  // Bust Next.js's data cache for every page that reads from profiles so
  // the user's next navigation immediately sees the new values.
  for (const p of [
    "/dashboard",
    "/settings",
    "/lifting",
    "/history",
    "/steps",
    "/calories",
  ]) {
    try {
      revalidatePath(p);
    } catch (e) {
      console.warn(`[api/profile] revalidatePath(${p}) failed:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    updated: 1,
    row: data,
    verified: verify ?? null,
  });
}
