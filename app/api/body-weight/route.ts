import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { todayPT } from "@/lib/time";

/**
 * POST — upsert one body-weight entry for a given date.
 * Body: { date?: YYYY-MM-DD, weight_lbs: number, notes?: string }
 */
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const t = todayPT();
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : t;
  if (date > t) {
    return NextResponse.json(
      { error: "Cannot log a weight for a future date" },
      { status: 400 }
    );
  }
  const weight = Number(body.weight_lbs);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1500) {
    return NextResponse.json(
      { error: "weight_lbs must be a positive number under 1500" },
      { status: 400 }
    );
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 500)
      : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("body_weight")
    .upsert(
      {
        user_id: user.id,
        date,
        weight_lbs: weight,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) {
    // Surface "table doesn't exist" cleanly so the user knows to run
    // the migration.
    const code = (error as any).code;
    if (
      code === "42P01" ||
      /body_weight/i.test(error.message ?? "") &&
        /does not exist/i.test(error.message ?? "")
    ) {
      return NextResponse.json(
        {
          error:
            "body_weight table missing — run supabase/migrations/add_body_weight.sql in your Supabase SQL editor.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/scales");
  return NextResponse.json({ ok: true, row: data });
}

/**
 * DELETE — remove a single body-weight entry by date.
 * Query: ?date=YYYY-MM-DD
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
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("body_weight")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/scales");
  return NextResponse.json({ ok: true });
}
