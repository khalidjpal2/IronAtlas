import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import LogWorkoutPage, {
  type LastSetByExercise,
  type RecentByExercise,
  type RecentSet,
  type WorkoutPreset,
} from "@/components/LogWorkoutPage";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { loadProfile } from "@/lib/profile";
import {
  ZONES,
  computeLevels,
  selectStandards,
  type SetRow,
  type StandardRow,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";
import { addDaysISO, mondayOfWeekISO, ptDateNDaysAgo, todayPT } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LiftingPage({
  searchParams,
}: {
  searchParams: { zone?: string; exercise?: string; date?: string };
}) {
  noStore();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const profile = await loadProfile(
    user.id,
    user.email?.split("@")[0] ?? "Lifter"
  );

  const admin = createSupabaseAdminClient();
  // PRs are read with a fallback path: try the new column shape first,
  // gracefully drop record_type/time_seconds if the migration hasn't run.
  let prRes = await admin
    .from("personal_bests")
    .select(
      "lift_name, weight_lbs, date_achieved, record_type, time_seconds"
    )
    .eq("user_id", user.id);
  if (prRes.error) {
    const legacy = await admin
      .from("personal_bests")
      .select("lift_name, weight_lbs, date_achieved")
      .eq("user_id", user.id);
    prRes = legacy as any;
  }
  const prRows = prRes.data ?? [];

  const [{ data: allStandards }, { data: allSets }, { data: recentRows }] =
    await Promise.all([
      admin.from("strength_standards").select("*"),
      admin
        .from("workout_sets")
        .select(
          "id, workout_id, exercise_name, muscle_group, weight_lbs, reps, sets, workouts!inner(user_id, date)"
        )
        .eq("workouts.user_id", user.id),
      // Recent sessions — ordered by workout_sets.created_at (own
      // table) so a freshly-inserted row always lands at the top.
      // Ordering by a foreign-table column (`workouts.created_at`)
      // is unreliable in PostgREST; using the row's own timestamp
      // makes the list update instantly after router.refresh().
      admin
        .from("workout_sets")
        .select(
          "id, workout_id, exercise_name, muscle_group, weight_lbs, reps, sets, created_at, workouts!inner(user_id, date, notes)"
        )
        .eq("workouts.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const standards: StandardRow[] = selectStandards(
    (allStandards ?? []) as StandardRow[],
    profile.ageGroup,
    profile.sex ?? "male",
    profile.bodyweight ?? null
  );

  const sets: SetRow[] = (allSets ?? []).map((r: any) => ({
    exercise_name: r.exercise_name,
    weight_lbs: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
    date: r.workouts?.date,
  }));

  const { zoneLevels } = computeLevels(
    sets,
    standards,
    profile.experience,
    profile.bodyweight ?? undefined,
    profile.sex ?? "male",
    profile.ageGroup
  );

  // Fill zoneLevels with explicit "untrained" for any missing zones so
  // the skill grid always renders all 11 boxes.
  const fullZoneLevels: Record<Zone, StrengthLevel> = Object.fromEntries(
    ZONES.map((z) => [z, zoneLevels[z] ?? "untrained"])
  ) as Record<Zone, StrengthLevel>;

  const recentSets: RecentSet[] = (recentRows ?? []).map((r: any) => ({
    setId: String(r.id ?? ""),
    workoutId: String(r.workout_id ?? ""),
    exercise: String(r.exercise_name ?? ""),
    muscleGroup: String(r.muscle_group ?? ""),
    weight: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
    date: r.workouts?.date ?? "",
    notes: r.workouts?.notes ?? null,
  }));

  // ── Recent-by-exercise lookups (drive the "Last time: ..." chip
  // and the small recent-logs strip in the Log Session modal).
  // Derived from allSets, no extra query.
  const allSetsSorted = (allSets ?? [])
    .map((r: any) => ({
      name: String(r.exercise_name ?? ""),
      weight: Number(r.weight_lbs ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
      date: String(r.workouts?.date ?? ""),
    }))
    .filter((r) => r.name && r.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const lastByExercise: LastSetByExercise = {};
  const recentByExercise: RecentByExercise = {};
  for (const r of allSetsSorted) {
    if (!lastByExercise[r.name]) {
      lastByExercise[r.name] = {
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
        date: r.date,
      };
    }
    if (!recentByExercise[r.name]) recentByExercise[r.name] = [];
    if (recentByExercise[r.name].length < 3) {
      recentByExercise[r.name].push({
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
        date: r.date,
      });
    }
  }

  // ── Workout presets — table may not exist yet if the migration
  // hasn't been applied; fall back to an empty list so the page still
  // renders.
  let presets: WorkoutPreset[] = [];
  const presetRes = await admin
    .from("workout_presets")
    .select(
      "id, name, created_at, preset_exercises(id, exercise_name, muscle_group, sort_order)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (!presetRes.error && Array.isArray(presetRes.data)) {
    presets = presetRes.data.map((p: any) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      exercises: (p.preset_exercises ?? [])
        .slice()
        .sort(
          (a: any, b: any) =>
            (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
        )
        .map((e: any) => ({
          id: String(e.id),
          exerciseName: String(e.exercise_name ?? ""),
          muscleGroup: String(e.muscle_group ?? ""),
        })),
    }));
  }

  // ── Weekly workout schedule (current week, week_offset=0). Falls
  // back gracefully when the preset_id and/or week_offset migrations
  // haven't been applied yet.
  let scheduleDays: Array<{
    day_of_week: number;
    is_rest: boolean;
    workout_type: string | null;
    preset_id: string | null;
  }> = [];
  {
    // 1) modern: week_offset + preset_id
    const modern = await admin
      .from("workout_schedule")
      .select("day_of_week, is_rest, workout_type, preset_id")
      .eq("user_id", user.id)
      .eq("week_offset", 0);
    let rows: any[] | null = null;
    if (!modern.error) {
      rows = modern.data ?? [];
    } else {
      // 2) week_offset only (preset_id missing)
      const noPreset = await admin
        .from("workout_schedule")
        .select("day_of_week, is_rest, workout_type")
        .eq("user_id", user.id)
        .eq("week_offset", 0);
      if (!noPreset.error) {
        rows = noPreset.data ?? [];
      } else {
        // 3) legacy (no week_offset column)
        const legacy = await admin
          .from("workout_schedule")
          .select("day_of_week, is_rest, workout_type")
          .eq("user_id", user.id);
        if (!legacy.error) rows = legacy.data ?? [];
      }
    }
    if (rows) {
      scheduleDays = rows.map((r: any) => ({
        day_of_week: Number(r.day_of_week),
        is_rest: !!r.is_rest,
        workout_type: r.workout_type ?? null,
        preset_id: r.preset_id ?? null,
      }));
    }
  }

  // ── Date-keyed schedule for THIS WEEK (Mon-Sun).
  // The new daily_schedule table stores per-date overrides. The
  // template above remains as the fallback when no specific date is set.
  // Degrade gracefully when the table doesn't exist yet (migration
  // hasn't been run).
  const weekStartISO = mondayOfWeekISO(todayPT());
  const weekEndISO = addDaysISO(weekStartISO, 6);
  let dailySchedule: Array<{
    date: string;
    is_rest: boolean;
    workout_type: string | null;
    preset_id: string | null;
    notes: string | null;
  }> = [];
  let dailyScheduleTableMissing = false;
  {
    const res = await admin
      .from("daily_schedule")
      .select("date, is_rest, workout_type, preset_id, notes")
      .eq("user_id", user.id)
      .gte("date", weekStartISO)
      .lte("date", weekEndISO);
    if (res.error) {
      const code = (res.error as any).code;
      const msg = String(res.error.message ?? "");
      if (code === "42P01" || /daily_schedule/i.test(msg)) {
        dailyScheduleTableMissing = true;
      } else {
        console.warn("[lifting page] daily_schedule fetch error:", res.error);
      }
    } else {
      dailySchedule = (res.data ?? []).map((r: any) => ({
        date: String(r.date),
        is_rest: !!r.is_rest,
        workout_type: r.workout_type ?? null,
        preset_id: r.preset_id ?? null,
        notes: r.notes ?? null,
      }));
    }
  }

  // Per-day workout sets for the calendar + day-detail modal. The raw
  // join already gives us everything we need; just shape it for the
  // client.
  const workoutDays: Array<{
    workoutId: string;
    setId: string;
    exercise: string;
    muscleGroup: string;
    weight: number;
    reps: number;
    sets: number;
    date: string;
  }> = (allSets ?? []).map((r: any) => ({
    workoutId: String(r.workout_id ?? ""),
    setId: String(r.id ?? ""),
    exercise: String(r.exercise_name ?? ""),
    muscleGroup: String(r.muscle_group ?? ""),
    weight: Number(r.weight_lbs ?? 0),
    reps: Number(r.reps ?? 0),
    sets: Number(r.sets ?? 0),
    date: String(r.workouts?.date ?? ""),
  }));

  const initialZone = (() => {
    const z = searchParams?.zone;
    if (!z) return null;
    return ZONES.includes(z as Zone) ? (z as Zone) : null;
  })();
  const initialExercise = searchParams?.exercise ?? null;
  // Pre-fill the form's date when the user clicks "Log Retroactively"
  // on a past day. Validated as YYYY-MM-DD.
  const initialDate =
    typeof searchParams?.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : null;

  // === Lifting stats (this week / lifetime / streak) ===
  const todayISO = todayPT();
  const weekAgoISO = ptDateNDaysAgo(7);
  const allDates = (allSets ?? [])
    .map((r: any) => String(r.workouts?.date ?? ""))
    .filter((d: string) => d.length > 0);
  const uniqueDates = Array.from(new Set(allDates));
  const workoutsThisWeek = new Set(
    allDates.filter((d: string) => d >= weekAgoISO)
  ).size;
  const totalSets = (allSets ?? []).reduce(
    (acc: number, r: any) => acc + Number(r.sets ?? 0),
    0
  );
  const totalVolume = (allSets ?? []).reduce(
    (acc: number, r: any) =>
      acc +
      Number(r.weight_lbs ?? 0) * Number(r.reps ?? 0) * Number(r.sets ?? 0),
    0
  );
  // Current consecutive-day streak ending today (PT).
  const dateSet = new Set(uniqueDates);
  let liftingStreak = 0;
  for (let i = 0; i < 365; i++) {
    const iso = ptDateNDaysAgo(i);
    if (dateSet.has(iso)) liftingStreak += 1;
    else if (i === 0) {
      // today not counted yet — keep going to count yesterday's streak
      continue;
    } else break;
  }
  const liftingStats = {
    workoutsThisWeek,
    totalSets,
    totalVolume: Math.round(totalVolume),
    streak: liftingStreak,
  };

  // Records — pass a normalized array; client renders them all (each
  // record gets a card whether or not the user has set a value yet).
  const records = (prRows ?? []).map((r: any) => ({
    lift: String(r.lift_name ?? "") as
      | "bench_press"
      | "squat"
      | "deadlift"
      | "mile_run"
      | "5k_run"
      | "10k_run"
      | "vertical_jump",
    weight: Number(r.weight_lbs ?? 0),
    timeSeconds: r.time_seconds != null ? Number(r.time_seconds) : null,
    date: r.date_achieved ?? null,
  }));

  return (
    <LogWorkoutPage
      userId={user.id}
      username={profile.username}
      isAdmin={profile.role === "admin"}
      bodyweight={profile.bodyweight ?? undefined}
      height={profile.height ?? undefined}
      sex={profile.sex}
      ageGroup={profile.ageGroup}
      experience={profile.experience}
      zoneLevels={fullZoneLevels}
      initialZone={initialZone}
      initialExercise={initialExercise}
      initialDate={initialDate}
      recentSets={recentSets}
      records={records}
      workoutDays={workoutDays}
      stats={liftingStats}
      presets={presets}
      lastByExercise={lastByExercise}
      recentByExercise={recentByExercise}
      scheduleDays={scheduleDays}
      initialDailySchedule={dailySchedule}
      initialWeekStartISO={weekStartISO}
      dailyScheduleTableMissing={dailyScheduleTableMissing}
    />
  );
}
