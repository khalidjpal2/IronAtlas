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

/**
 * Detect the "column doesn't exist" / "constraint doesn't exist" Postgres
 * errors so we can fall back to the legacy schema (no week_offset column).
 */
function isMigrationMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as any).code;
  const message = String((err as any).message ?? "");
  return (
    code === "42703" ||
    code === "42P10" ||
    code === "PGRST204" ||
    /week_offset/i.test(message) ||
    /preset_id/i.test(message) ||
    /workout_schedule_user_dow_week_key/i.test(message)
  );
}

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const weekOffset = Number(url.searchParams.get("week_offset") ?? "0");
  const safeOffset = Number.isInteger(weekOffset) ? weekOffset : 0;

  const admin = createSupabaseAdminClient();

  // Try the modern shape first — filter by week_offset, include preset_id.
  const modern = await admin
    .from("workout_schedule")
    .select("day_of_week, is_rest, workout_type, week_offset, preset_id")
    .eq("user_id", user.id)
    .eq("week_offset", safeOffset);

  if (!modern.error) {
    return NextResponse.json({
      days: modern.data ?? [],
      weekOffset: safeOffset,
    });
  }

  // Fall back: preset_id column missing but week_offset exists.
  if (isMigrationMissingError(modern.error)) {
    const noPreset = await admin
      .from("workout_schedule")
      .select("day_of_week, is_rest, workout_type, week_offset")
      .eq("user_id", user.id)
      .eq("week_offset", safeOffset);
    if (!noPreset.error) {
      return NextResponse.json({
        days: noPreset.data ?? [],
        weekOffset: safeOffset,
        legacy: "preset_id-missing",
      });
    }
  }

  // Fall back further to the legacy shape (no week_offset column).
  // Only meaningful when the caller asked for week 0; other offsets
  // simply won't have data until the migration is run.
  if (isMigrationMissingError(modern.error) && safeOffset === 0) {
    const legacy = await admin
      .from("workout_schedule")
      .select("day_of_week, is_rest, workout_type")
      .eq("user_id", user.id);
    if (!legacy.error) {
      return NextResponse.json({
        days: legacy.data ?? [],
        weekOffset: 0,
        legacy: true,
      });
    }
    return NextResponse.json(
      { error: legacy.error.message },
      { status: 400 }
    );
  }

  if (isMigrationMissingError(modern.error)) {
    // Asking for a non-zero week before migration: return empty so
    // the client can fall back to the template if it wants.
    return NextResponse.json({ days: [], weekOffset: safeOffset, legacy: true });
  }

  return NextResponse.json({ error: modern.error.message }, { status: 400 });
}

/**
 * Bulk-replace one week's schedule. Body:
 *   { days: Array<{ day_of_week, is_rest, workout_type | null }>,
 *     week_offset?: number }
 * Each entry overwrites the matching (user, day, week_offset) row.
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
    week_offset?: unknown;
  } | null;
  if (!body || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "days[] is required" }, { status: 400 });
  }
  const weekOffset =
    typeof body.week_offset === "number" && Number.isInteger(body.week_offset)
      ? body.week_offset
      : 0;

  const baseRows: Array<{
    user_id: string;
    day_of_week: number;
    is_rest: boolean;
    workout_type: string | null;
    preset_id: string | null;
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
    let presetId: string | null = null;
    if (
      !isRest &&
      typeof r.preset_id === "string" &&
      // Loose UUID check — Supabase will reject malformed values anyway.
      /^[0-9a-fA-F-]{32,36}$/.test(r.preset_id)
    ) {
      presetId = r.preset_id;
    }
    baseRows.push({
      user_id: user.id,
      day_of_week: dow,
      is_rest: isRest,
      workout_type: type,
      preset_id: presetId,
      updated_at: new Date().toISOString(),
    });
  }

  const admin = createSupabaseAdminClient();

  // Modern path — include week_offset + preset_id, use the wider key.
  const modernRows = baseRows.map((r) => ({ ...r, week_offset: weekOffset }));
  console.log(
    `[workout-schedule PUT] user=${user.id} weekOffset=${weekOffset} rows:`,
    modernRows.map((r) => ({
      dow: r.day_of_week,
      rest: r.is_rest,
      type: r.workout_type,
      preset_id: r.preset_id,
    }))
  );
  const modern = await admin
    .from("workout_schedule")
    .upsert(modernRows, {
      onConflict: "user_id,day_of_week,week_offset",
    });

  async function readBack(includePreset: boolean) {
    const cols = includePreset
      ? "day_of_week, is_rest, workout_type, week_offset, preset_id"
      : "day_of_week, is_rest, workout_type, week_offset";
    const v = await admin
      .from("workout_schedule")
      .select(cols)
      .eq("user_id", user!.id)
      .eq("week_offset", weekOffset);
    return v.data ?? null;
  }

  if (!modern.error) {
    const verified = await readBack(true);
    console.log(
      `[workout-schedule PUT] modern path OK — verified rows:`,
      verified
    );
    revalidatePath("/lifting");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, weekOffset, verified });
  }
  console.warn(
    `[workout-schedule PUT] modern path failed:`,
    (modern.error as any)?.code,
    modern.error?.message
  );

  // Fall back: drop preset_id (column not migrated yet).
  if (isMigrationMissingError(modern.error)) {
    const rowsNoPreset = modernRows.map(({ preset_id, ...rest }) => rest);
    const noPreset = await admin
      .from("workout_schedule")
      .upsert(rowsNoPreset, {
        onConflict: "user_id,day_of_week,week_offset",
      });
    if (!noPreset.error) {
      const verified = await readBack(false);
      console.log(
        `[workout-schedule PUT] fallback (no preset_id) — verified:`,
        verified
      );
      revalidatePath("/lifting");
      revalidatePath("/dashboard");
      return NextResponse.json({
        ok: true,
        weekOffset,
        legacy: "preset_id-missing",
        verified,
        hint:
          "preset_id column missing — run supabase/migrations/add_workout_schedule_preset_id.sql",
      });
    }
    console.warn(
      `[workout-schedule PUT] fallback (no preset_id) also failed:`,
      (noPreset.error as any)?.code,
      noPreset.error?.message
    );
  }

  // Fall back further to legacy upsert for week 0 if the migration hasn't run.
  if (isMigrationMissingError(modern.error) && weekOffset === 0) {
    const legacyRows = baseRows.map(
      ({ preset_id, ...rest }) => rest
    );
    const legacy = await admin
      .from("workout_schedule")
      .upsert(legacyRows, { onConflict: "user_id,day_of_week" });
    if (legacy.error) {
      console.error(
        `[workout-schedule PUT] legacy upsert failed:`,
        (legacy.error as any)?.code,
        legacy.error?.message
      );
      return NextResponse.json(
        { error: legacy.error.message },
        { status: 400 }
      );
    }
    const verified = await admin
      .from("workout_schedule")
      .select("day_of_week, is_rest, workout_type")
      .eq("user_id", user.id);
    console.log(
      `[workout-schedule PUT] legacy path OK — verified:`,
      verified.data
    );
    revalidatePath("/lifting");
    revalidatePath("/dashboard");
    return NextResponse.json({
      ok: true,
      weekOffset: 0,
      legacy: true,
      verified: verified.data ?? [],
      hint:
        "Run supabase/migrations/add_workout_schedule_week_offset.sql + add_workout_schedule_preset_id.sql for full functionality.",
    });
  }

  if (isMigrationMissingError(modern.error)) {
    return NextResponse.json(
      {
        error:
          "Past/future week schedules require the workout_schedule.week_offset migration. Run supabase/migrations/add_workout_schedule_week_offset.sql.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: modern.error.message }, { status: 400 });
}
