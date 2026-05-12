import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { todayPT } from "@/lib/time";

const COLUMN_MISSING = (msg: string) =>
  /weight_goal_(lbs|date)/i.test(msg) && /does not exist/i.test(msg);

/**
 * POST — set or replace the user's weight goal.
 * Body: { weight_goal_lbs: number, weight_goal_date: YYYY-MM-DD }
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

  const lbs = Number(body.weight_goal_lbs);
  if (!Number.isFinite(lbs) || lbs <= 0 || lbs > 1500) {
    return NextResponse.json(
      { error: "weight_goal_lbs must be a positive number under 1500" },
      { status: 400 }
    );
  }
  const date = body.weight_goal_date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "weight_goal_date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (date <= todayPT()) {
    return NextResponse.json(
      { error: "Target date must be in the future" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ weight_goal_lbs: lbs, weight_goal_date: date })
    .eq("id", user.id);

  if (error) {
    if (COLUMN_MISSING(error.message ?? "")) {
      return NextResponse.json(
        {
          error:
            "weight_goal columns missing — run supabase/migrations/add_weight_goal.sql in your Supabase SQL editor.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/scales");
  return NextResponse.json({ ok: true });
}

/** DELETE — clear the user's weight goal. */
export async function DELETE() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ weight_goal_lbs: null, weight_goal_date: null })
    .eq("id", user.id);

  if (error) {
    if (COLUMN_MISSING(error.message ?? "")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/scales");
  return NextResponse.json({ ok: true });
}
