import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

/**
 * Date-keyed workout schedule.
 *
 *   GET    ?from=YYYY-MM-DD&to=YYYY-MM-DD          → list rows in range
 *   PUT    body: { date, is_rest, workout_type?, preset_id?, notes? }
 *                                                  → upsert one date
 *   DELETE ?date=YYYY-MM-DD                        → clear one date
 *   POST   body: { action: "copy_week",
 *                  source_start: YYYY-MM-DD,
 *                  target_start: YYYY-MM-DD,
 *                  overwrite?: boolean }
 *                                                  → copy 7 days
 *
 * A row in this table OVERRIDES the day-of-week template stored in
 * workout_schedule. Absence of a row means "fall back to template".
 */

const ALLOWED_TYPES = new Set([
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "custom",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-fA-F-]{32,36}$/;

function isTableMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as any).code;
  const msg = String((err as any).message ?? "");
  return code === "42P01" || /daily_schedule/i.test(msg);
}

function migrationMissingResponse() {
  return NextResponse.json(
    {
      error:
        "daily_schedule table missing — run supabase/migrations/add_daily_schedule.sql in your Supabase SQL editor.",
    },
    { status: 400 }
  );
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("daily_schedule")
    .select("date, is_rest, workout_type, preset_id, notes")
    .eq("user_id", user.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    if (isTableMissing(error)) {
      // Degrade gracefully — return an empty range so the UI can render
      // its template-only fallback without crashing.
      return NextResponse.json({ days: [], tableMissing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ days: data ?? [] });
}

export async function PUT(req: Request) {
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
  const date = body.date;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
  }
  const isRest = !!body.is_rest;
  let workoutType: string | null = null;
  if (!isRest && typeof body.workout_type === "string" && body.workout_type) {
    workoutType = ALLOWED_TYPES.has(body.workout_type) ? body.workout_type : null;
  }
  let presetId: string | null = null;
  if (!isRest && typeof body.preset_id === "string" && UUID_RE.test(body.preset_id)) {
    presetId = body.preset_id;
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 500)
      : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("daily_schedule")
    .upsert(
      {
        user_id: user.id,
        date,
        is_rest: isRest,
        workout_type: workoutType,
        preset_id: presetId,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) {
    if (isTableMissing(error)) return migrationMissingResponse();
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("daily_schedule")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) {
    if (isTableMissing(error)) return migrationMissingResponse();
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.action !== "copy_week") {
    return NextResponse.json({ error: "action=copy_week required" }, { status: 400 });
  }
  const sourceStart = body.source_start;
  const targetStart = body.target_start;
  if (
    typeof sourceStart !== "string" ||
    !DATE_RE.test(sourceStart) ||
    typeof targetStart !== "string" ||
    !DATE_RE.test(targetStart)
  ) {
    return NextResponse.json(
      { error: "source_start and target_start (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }
  const overwrite = body.overwrite !== false; // default true

  const admin = createSupabaseAdminClient();
  const sourceEnd = addDaysISO(sourceStart, 6);
  const { data: sourceRows, error: readErr } = await admin
    .from("daily_schedule")
    .select("date, is_rest, workout_type, preset_id, notes")
    .eq("user_id", user.id)
    .gte("date", sourceStart)
    .lte("date", sourceEnd);

  if (readErr) {
    if (isTableMissing(readErr)) return migrationMissingResponse();
    return NextResponse.json({ error: readErr.message }, { status: 400 });
  }

  if (!sourceRows || sourceRows.length === 0) {
    return NextResponse.json({ ok: true, copied: 0 });
  }

  const newRows = sourceRows.map((r: any) => {
    const offset = Math.round(
      (Date.UTC(
        Number(r.date.slice(0, 4)),
        Number(r.date.slice(5, 7)) - 1,
        Number(r.date.slice(8, 10))
      ) -
        Date.UTC(
          Number(sourceStart.slice(0, 4)),
          Number(sourceStart.slice(5, 7)) - 1,
          Number(sourceStart.slice(8, 10))
        )) /
        86_400_000
    );
    return {
      user_id: user.id,
      date: addDaysISO(targetStart, offset),
      is_rest: !!r.is_rest,
      workout_type: r.workout_type ?? null,
      preset_id: r.preset_id ?? null,
      notes: r.notes ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  if (!overwrite) {
    // Drop rows that already have a target — only fill empties.
    const targetEnd = addDaysISO(targetStart, 6);
    const { data: existing } = await admin
      .from("daily_schedule")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", targetStart)
      .lte("date", targetEnd);
    const occupied = new Set((existing ?? []).map((r: any) => r.date));
    const filtered = newRows.filter((r) => !occupied.has(r.date));
    if (filtered.length === 0) {
      return NextResponse.json({ ok: true, copied: 0, skipped: newRows.length });
    }
    const { error: insErr } = await admin
      .from("daily_schedule")
      .upsert(filtered, { onConflict: "user_id,date" });
    if (insErr) {
      if (isTableMissing(insErr)) return migrationMissingResponse();
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }
    revalidatePath("/lifting");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, copied: filtered.length });
  }

  const { error: upsertErr } = await admin
    .from("daily_schedule")
    .upsert(newRows, { onConflict: "user_id,date" });
  if (upsertErr) {
    if (isTableMissing(upsertErr)) return migrationMissingResponse();
    return NextResponse.json({ error: upsertErr.message }, { status: 400 });
  }
  revalidatePath("/lifting");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, copied: newRows.length });
}
