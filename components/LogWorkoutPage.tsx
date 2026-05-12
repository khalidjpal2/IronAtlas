"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MonthCalendar, { type CalendarCell } from "@/components/MonthCalendar";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getTierThresholdsLbs } from "@/lib/strength-standards";
import {
  HeatmapColorProvider,
  useHeatmapPalette,
} from "@/components/HeatmapColorContext";
import { useTheme } from "@/lib/useTheme";
import { addDaysISO, todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";
import WorkoutPresets, {
  StartSessionModal,
  presetColor,
  type WorkoutPreset,
  type LastSetByExercise,
} from "@/components/WorkoutPresets";
import {
  RECORDS_BY_ID,
  formatRecordValue,
  levelForRecord,
  parseTimeToSeconds,
} from "@/lib/records";
import {
  EXERCISE_OPTIONS,
  LEVEL_COLOR,
  LEVEL_GRADIENT,
  LEVEL_LABEL,
  LEVEL_RANK,
  ZONES,
  ZONE_LABEL,
  exerciseZone,
  exercisesForZone,
  exercisesForZoneTiered,
  type Sex,
  type StrengthLevel,
  type TrainingExperience,
  type Zone,
} from "@/lib/strength";

export type { WorkoutPreset, LastSetByExercise };

export type RecentByExercise = Record<
  string,
  Array<{ weight: number; reps: number; sets: number; date: string }>
>;

export type RecentSet = {
  setId: string;
  workoutId: string;
  exercise: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
  notes: string | null;
};

export type WorkoutDaySet = {
  workoutId: string;
  setId: string;
  exercise: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
};

export type RecordEntry = {
  lift:
    | "bench_press"
    | "squat"
    | "deadlift"
    | "mile_run"
    | "5k_run"
    | "10k_run"
    | "vertical_jump";
  weight: number;
  timeSeconds: number | null;
  date: string | null;
};

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  bodyweight?: number;
  height?: number;
  sex?: Sex | null;
  ageGroup?: string;
  experience?: TrainingExperience;
  zoneLevels: Record<Zone, StrengthLevel>;
  initialZone: Zone | null;
  initialExercise: string | null;
  initialDate?: string | null;
  recentSets: RecentSet[];
  records: RecordEntry[];
  workoutDays: WorkoutDaySet[];
  stats: {
    workoutsThisWeek: number;
    totalSets: number;
    totalVolume: number;
    streak: number;
  };
  presets: WorkoutPreset[];
  lastByExercise: LastSetByExercise;
  recentByExercise: RecentByExercise;
  scheduleDays: Array<{
    day_of_week: number;
    is_rest: boolean;
    workout_type: string | null;
    preset_id: string | null;
  }>;
  /** Per-date overrides for the currently-rendered week. */
  initialDailySchedule: Array<{
    date: string;
    is_rest: boolean;
    workout_type: string | null;
    preset_id: string | null;
    notes: string | null;
  }>;
  /** Monday (YYYY-MM-DD) of the week pre-loaded on the server. */
  initialWeekStartISO: string;
  /** True when daily_schedule migration hasn't been applied yet. */
  dailyScheduleTableMissing: boolean;
};

const todayISO = () => todayPT();
const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

export default function LogWorkoutPage({
  userId,
  username,
  isAdmin,
  bodyweight,
  height,
  sex,
  ageGroup,
  experience,
  zoneLevels,
  initialZone,
  initialExercise,
  initialDate,
  recentSets,
  records,
  workoutDays,
  stats,
  presets,
  lastByExercise,
  recentByExercise,
  scheduleDays,
  initialDailySchedule,
  initialWeekStartISO,
  dailyScheduleTableMissing,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [zone, setZone] = useState<Zone | "">(initialZone ?? "");
  const [exercise, setExercise] = useState<string>(initialExercise ?? "");
  const [date, setDate] = useState<string>(() => {
    const t = todayISO();
    return initialDate && initialDate <= t ? initialDate : t;
  });
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  // Optional prefill for the log modal — used when "Log This Set" is
  // clicked from the Strength Calculator.
  const [logPrefill, setLogPrefill] = useState<{
    zone: Zone;
    exerciseName: string;
    weight: string;
    reps: string;
    sets: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    setId: string;
    workoutId: string;
    exerciseName: string;
    muscleGroup: string;
    weight: number;
    reps: number;
    sets: number;
    date: string;
    notes: string;
  } | null>(null);
  const [bannerDetail, setBannerDetail] = useState<
    | { kind: "discipline"; zone: Zone }
    | { kind: "record"; record: RecordKindLocal }
    | null
  >(null);

  // Calendar cells — any date with at least one set logged is "met".
  const workoutCells = useMemo(() => {
    const m = new Map<string, CalendarCell>();
    workoutDays.forEach((s) => {
      if (!s.date) return;
      const existing = m.get(s.date);
      const setsCount = (existing?.hint ? Number(existing.hint) : 0) + 1;
      m.set(s.date, {
        date: s.date,
        status: "met",
        hint: String(setsCount),
      });
    });
    return m;
  }, [workoutDays]);
  const sameDay = useMemo(
    () =>
      calendarDate
        ? workoutDays.filter((s) => s.date === calendarDate)
        : [],
    [calendarDate, workoutDays]
  );

  const exerciseList = useMemo(
    () => (zone ? exercisesForZone(zone) : []),
    [zone]
  );

  useEffect(() => {
    if (!zone) return;
    if (!exerciseList.some((e) => e.name === exercise)) setExercise("");
  }, [zone, exerciseList, exercise]);

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 1600);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const canSubmit =
    !!zone &&
    !!exercise &&
    Number(weight) > 0 &&
    Number(reps) > 0 &&
    Number(sets) > 0;

  /**
   * Banner click. Opens the discipline-detail modal — the user can
   * read the level info and then tap "Log Training Session" to open
   * the log modal pre-filled with this discipline.
   */
  function pickSkill(z: Zone) {
    setBannerDetail({ kind: "discipline", zone: z });
  }

  /** Called from the discipline detail modal CTA. */
  function startLog(z: Zone | null) {
    if (z) {
      setZone(z);
      setExercise("");
    }
    setBannerDetail(null);
    setLogOpen(true);
  }

  function resetForm(keepZone = true) {
    setWeight("");
    setReps("");
    setSets("");
    setNotes("");
    setNotesOpen(false);
    setExercise("");
    if (!keepZone) setZone("");
    setDate(todayISO());
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !zone || !exercise) return;
    setSubmitting(true);
    setErr(null);
    try {
      const ex = exerciseList.find((x) => x.name === exercise);
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({ user_id: userId, date, notes: notes || null })
        .select()
        .single();
      if (wErr) throw wErr;

      const baseSet = {
        workout_id: workout.id,
        exercise_name: exercise,
        muscle_group: zone,
        weight_lbs: Number(weight),
        reps: Number(reps),
        sets: Number(sets),
      };
      const { error: sErr } = await supabase
        .from("workout_sets")
        .insert({ ...baseSet, primary_muscle: ex?.muscles?.[0] ?? null });
      if (sErr) {
        const missingColumn =
          sErr.code === "42703" ||
          sErr.code === "PGRST204" ||
          /primary_muscle/i.test(sErr.message ?? "");
        if (!missingColumn) throw sErr;
        const { error: sErr2 } = await supabase
          .from("workout_sets")
          .insert(baseSet);
        if (sErr2) throw sErr2;
      }

      setShowSuccess(true);
      resetForm(true);
      router.refresh();
      // Auto-close the log modal a moment later so the user sees the
      // brief success label before it dismisses.
      setTimeout(() => setLogOpen(false), 900);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to log workout.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSet(workoutId: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    setBusyId(workoutId);
    try {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Set-level delete (used by the Edit modal). Deletes the workout_sets
   * row, then drops the parent workout if it has no remaining sets.
   */
  async function deleteSetById(setId: string, workoutId: string) {
    setBusyId(setId);
    try {
      const { error: sErr } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", setId);
      if (sErr) throw sErr;
      const { count, error: cErr } = await supabase
        .from("workout_sets")
        .select("id", { count: "exact", head: true })
        .eq("workout_id", workoutId);
      if (cErr) throw cErr;
      if ((count ?? 0) === 0) {
        const { error: wErr } = await supabase
          .from("workouts")
          .delete()
          .eq("id", workoutId);
        if (wErr) throw wErr;
      }
      setEditTarget(null);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  async function saveSetEdit() {
    if (!editTarget) return;
    setBusyId(editTarget.setId);
    try {
      const ex = EXERCISE_OPTIONS.find(
        (e) => e.name === editTarget.exerciseName
      );
      const newZone = ex ? exerciseZone(ex) : editTarget.muscleGroup;
      const { error: wErr } = await supabase
        .from("workouts")
        .update({
          date: editTarget.date,
          notes: editTarget.notes ? editTarget.notes : null,
        })
        .eq("id", editTarget.workoutId);
      if (wErr) throw wErr;
      const { error: sErr } = await supabase
        .from("workout_sets")
        .update({
          exercise_name: editTarget.exerciseName,
          muscle_group: newZone,
          weight_lbs: Number(editTarget.weight),
          reps: Number(editTarget.reps),
          sets: Number(editTarget.sets),
        })
        .eq("id", editTarget.setId);
      if (sErr) throw sErr;
      setEditTarget(null);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
    } finally {
      setBusyId(null);
    }
  }

  const inputCls =
    "w-full bg-elevated border border-border-bright rounded-md px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:outline-none focus:border-accent transition";
  const selectCls =
    "w-full bg-elevated border border-border-bright rounded-md px-4 py-3 text-base text-ink focus:outline-none focus:border-accent transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10";

  return (
    <HeatmapColorProvider>
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader
        username={username}
        isAdmin={isAdmin}
        profile={{ bodyweight, height, sex, ageGroup, experience }}
      />

      <main className="flex-1 w-full px-6 lg:px-10 py-8 space-y-10">
        {/* === HEADER + LOG SESSION button === */}
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.32em] text-gold/80 mb-2"
              style={fontDisplay}
            >
              Realm of Iron
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold tracking-tight text-ink"
              style={{
                ...fontDisplay,
                textShadow: "0 0 24px rgba(245, 158, 11, 0.30)",
              }}
            >
              Training Ground
            </h1>
            <p className="text-xs uppercase tracking-[0.20em] text-muted mt-3">
              Choose a discipline. Log your session. Level up.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCalcOpen(true)}
              className="btn-stone btn-stone-ghost rounded-full text-[11px]"
              style={{ padding: "0.6rem 1.2rem" }}
            >
              Calculator
            </button>
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="btn-stone px-5 rounded-full text-[11px]"
              style={{ padding: "0.6rem 1.4rem" }}
            >
              Log Session +
            </button>
          </div>
        </header>

        {/* === MY WEEK === */}
        <WeeklySchedule
          userId={userId}
          template={scheduleDays}
          initialDaily={initialDailySchedule}
          initialWeekStartISO={initialWeekStartISO}
          tableMissing={dailyScheduleTableMissing}
          presets={presets}
          lastByExercise={lastByExercise}
          zoneLevels={zoneLevels}
          workoutDays={workoutDays}
          onOpenLogForDate={(iso) => {
            const t = todayISO();
            setDate(iso > t ? t : iso);
            setLogOpen(true);
          }}
        />

        {/* === MY PRESETS === */}
        <WorkoutPresets
          userId={userId}
          presets={presets}
          lastByExercise={lastByExercise}
        />

        {/* === SKILL GRID === */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2
              className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
              style={fontDisplay}
            >
              Disciplines
            </h2>
            <div className="rune-divider flex-1" />
          </div>
          {/*
            Single horizontal row — all 11 banners hang side by side
            in a great hall. overflow-x-auto kicks in on every viewport
            so narrow screens scroll laterally rather than wrapping.
          */}
          <div
            className="banner-row overflow-x-auto pt-3 pb-2"
            style={{
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div className="flex gap-5 px-1" style={{ minWidth: "min-content" }}>
              {ZONES.map((z) => (
                <div
                  key={z}
                  className="shrink-0"
                  style={{ width: 156, scrollSnapAlign: "start" }}
                >
                  <SkillBox
                    zone={z}
                    level={zoneLevels[z]}
                    active={zone === z}
                    onClick={() => pickSkill(z)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* === RECORDS — strength / endurance / athleticism === */}
        <RecordsSection
          userId={userId}
          records={records}
          bodyweight={bodyweight}
        />

        {/* === CALENDAR + RECENT SESSIONS side-by-side === */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <section className="tablet relative rounded p-4">
            <span className="corner-bl" />
            <span className="corner-br" />
            <div className="flex items-center gap-3 mb-2">
              <h2
                className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
                style={fontDisplay}
              >
                Monthly Calendar
              </h2>
              <div className="rune-divider flex-1" />
            </div>
            <MonthCalendar
              cells={workoutCells}
              onDayClick={(d) => setCalendarDate(d)}
              legend={[
                { status: "met",  label: "Workout logged" },
                { status: "none", label: "No workout" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2
                className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
                style={fontDisplay}
              >
                Recent Sessions
              </h2>
              <div className="rune-divider flex-1" />
            </div>
            {recentSets.length === 0 ? (
              <p className="text-sm text-muted italic">
                No sessions recorded yet. Tap Log Session to begin.
              </p>
            ) : (
              <ul className="divide-y divide-border bg-panel border border-border rounded-xl px-4">
                {recentSets.map((r) => (
                  <li
                    key={r.setId}
                    className="py-3 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">
                        {r.exercise}
                      </div>
                    </div>
                    <div className="text-sm text-gold tabular-nums whitespace-nowrap font-semibold">
                      {r.weight} x {r.reps} x {r.sets}
                    </div>
                    <div className="text-[11px] text-muted/70 w-24 text-right tabular-nums whitespace-nowrap uppercase tracking-wider">
                      {formatDate(r.date)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditTarget({
                          setId: r.setId,
                          workoutId: r.workoutId,
                          exerciseName: r.exercise,
                          muscleGroup: r.muscleGroup,
                          weight: r.weight,
                          reps: r.reps,
                          sets: r.sets,
                          date: r.date,
                          notes: r.notes ?? "",
                        })
                      }
                      disabled={busyId === r.setId}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-40 transition"
                      title="Edit"
                      aria-label={`Edit ${r.exercise}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      {/* Lifting day modal */}
      {calendarDate && (
        <LiftingDayModal
          date={calendarDate}
          sets={sameDay}
          busy={busyId}
          onClose={() => setCalendarDate(null)}
          onDelete={async (workoutId, label) => {
            await deleteSet(workoutId, label);
            if (sameDay.length <= 1) setCalendarDate(null);
          }}
          onEdit={(s) =>
            setEditTarget({
              setId: s.setId,
              workoutId: s.workoutId,
              exerciseName: s.exercise,
              muscleGroup: s.muscleGroup,
              weight: s.weight,
              reps: s.reps,
              sets: s.sets,
              date: s.date,
              notes: "",
            })
          }
        />
      )}

      {/* Edit set modal */}
      {editTarget && (
        <EditSetModal
          target={editTarget}
          setTarget={setEditTarget}
          onSave={saveSetEdit}
          onDelete={async () => {
            const ok = window.confirm(
              `Delete ${editTarget.exerciseName}? This can't be undone.`
            );
            if (!ok) return;
            await deleteSetById(editTarget.setId, editTarget.workoutId);
          }}
          busy={busyId === editTarget.setId}
        />
      )}

      {/* Banner detail modal — fires the log modal on CTA */}
      {bannerDetail?.kind === "discipline" && (
        <DisciplineDetailModal
          zone={bannerDetail.zone}
          level={zoneLevels[bannerDetail.zone]}
          onClose={() => setBannerDetail(null)}
          onLog={() => startLog(bannerDetail.zone)}
        />
      )}
      {bannerDetail?.kind === "record" && (
        <RecordModal
          userId={userId}
          kind={bannerDetail.record}
          current={records.find((r) => r.lift === bannerDetail.record) ?? null}
          onClose={() => setBannerDetail(null)}
        />
      )}

      {/* Log session modal */}
      {logOpen && (
        <MultiExerciseLogModal
          userId={userId}
          initialDate={date}
          presets={presets}
          lastByExercise={lastByExercise}
          initialExercise={logPrefill}
          onClose={() => {
            setLogOpen(false);
            setLogPrefill(null);
          }}
          onSaved={() => router.refresh()}
        />
      )}

      {calcOpen && (
        <StrengthCalculatorModal
          bodyweight={bodyweight}
          sex={sex ?? "male"}
          ageGroup={ageGroup ?? "18-25"}
          onClose={() => setCalcOpen(false)}
          onLogSet={(prefill) => {
            setLogPrefill(prefill);
            setCalcOpen(false);
            setLogOpen(true);
          }}
        />
      )}
    </div>
    </HeatmapColorProvider>
  );
}

// ─── Dark-fantasy hanging banner ─────────────────────────────────
//
// Each muscle group hangs from a wooden rod with two metal hooks. The
// fabric is dark and worn with a ragged torn bottom edge (clip-path),
// its color and emblem dim or vivid based on tier. Higher tiers add
// effects (inner glow on the sigil, animated shimmer, pulsing runes).
//
// CSS animation: the whole banner sways side-to-side with a per-card
// delay so the grid feels like a row of hung tournament colors. Sway
// pauses on hover or when the card is active (chosen for logging).

// Khalid's exact ragged-bottom polygon (kept in one place).
const TORN_CLIP =
  "polygon(0% 0%, 100% 0%, 100% 75%, 90% 85%, 80% 72%, 70% 88%, 60% 75%, 50% 90%, 40% 77%, 30% 88%, 20% 73%, 10% 85%, 0% 75%)";

// Tier palettes — selected at render time via the active theme so glow
// filters can use real hex (CSS var concatenation like `${var}aa`
// wouldn't be a valid color).
// Discipline-banner per-tier palette — monochrome purple. Fabric is
// the banner background; sigil is the rune/digit color; rune is the
// glow halo. Each tier gets progressively richer purple, matching
// the body heatmap.
const TIER_THEME_DARK: Record<
  StrengthLevel,
  { fabric: string; sigil: string; rune: string; bright: boolean }
> = {
  untrained:   { fabric: "#100c16", sigil: "#3a3340", rune: "rgba(58,51,64,0.30)",     bright: false },
  below:       { fabric: "#1a0f24", sigil: "#5a3f7c", rune: "rgba(90,63,124,0.40)",    bright: false },
  average:     { fabric: "#1f1530", sigil: "#7a52a8", rune: "rgba(122,82,168,0.45)",   bright: false },
  above:       { fabric: "#241a3d", sigil: "#9c6ed4", rune: "rgba(156,110,212,0.55)",  bright: true  },
  exceptional: { fabric: "#291f4a", sigil: "#b87df0", rune: "rgba(184,125,240,0.60)",  bright: true  },
  elite:       { fabric: "#2e2255", sigil: "#d4a5ff", rune: "rgba(212,165,255,0.70)",  bright: true  },
};
const TIER_THEME_LIGHT: Record<
  StrengthLevel,
  { fabric: string; sigil: string; rune: string; bright: boolean }
> = {
  untrained:   { fabric: "#ece6f0", sigil: "#7a7080", rune: "rgba(122,112,128,0.40)",  bright: true },
  below:       { fabric: "#d8c8e8", sigil: "#5a3f7c", rune: "rgba(90,63,124,0.50)",    bright: true },
  average:     { fabric: "#c5b3dc", sigil: "#4a2d6e", rune: "rgba(74,45,110,0.55)",    bright: true },
  above:       { fabric: "#b298d0", sigil: "#3d2156", rune: "rgba(61,33,86,0.60)",     bright: true },
  exceptional: { fabric: "#a385c8", sigil: "#2f1745", rune: "rgba(47,23,69,0.65)",     bright: true },
  elite:       { fabric: "#9572c2", sigil: "#260d36", rune: "rgba(38,13,54,0.70)",     bright: true },
};

const ROMAN: Record<number, string> = {
  0: "—",
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
};

function SkillBox({
  zone,
  level,
  active,
  onClick,
}: {
  zone: Zone;
  level: StrengthLevel;
  active: boolean;
  onClick: () => void;
}) {
  const rank = LEVEL_RANK[level];
  const fill = LEVEL_GRADIENT[level];
  const pct = (rank / 5) * 100;
  const themeMode = useTheme();
  const theme =
    themeMode === "light" ? TIER_THEME_LIGHT[level] : TIER_THEME_DARK[level];
  const isLegendary = level === "elite";
  const isShimmer = rank >= 4;
  const innerGlow = rank >= 3;
  const idx = ZONES.indexOf(zone); // 0..10 → drives sway delay

  // Sigil glow (level 3+): drop-shadow halos on the SVG.
  const sigilFilter = innerGlow
    ? `drop-shadow(0 0 6px ${theme.sigil}aa) drop-shadow(0 0 14px ${theme.sigil}55)`
    : "drop-shadow(0 1px 0 rgba(0,0,0,0.6))";

  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "1" : "0"}
      className="banner-button group relative text-left outline-none"
      style={{ paddingTop: 16 } as React.CSSProperties}
      aria-label={`${ZONE_LABEL[zone]} — Level ${rank} ${LEVEL_LABEL[level]}`}
    >
      {/* Wooden rod + end caps + hooks */}
      <div
        aria-hidden
        className="absolute left-0 right-0 z-20"
        style={{ top: 8 }}
      >
        {/* Rod */}
        <div
          className="mx-auto"
          style={{
            position: "relative",
            height: 6,
            width: "calc(100% + 18px)",
            marginLeft: -9,
            background:
              "linear-gradient(180deg, #6b4a2c 0%, #3a2410 50%, #5a3a1f 100%)",
            borderRadius: 3,
            boxShadow:
              "inset 0 1px 0 rgba(255,200,140,0.18), inset 0 -1px 0 rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)",
          }}
        >
          {/* End caps */}
          <span
            className="absolute"
            style={{
              left: -2,
              top: -3,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #4a3018, #1a0e04)",
              boxShadow:
                "inset 0 1px 0 rgba(255,210,150,0.20), 0 1px 2px rgba(0,0,0,0.6)",
            }}
          />
          <span
            className="absolute"
            style={{
              right: -2,
              top: -3,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #4a3018, #1a0e04)",
              boxShadow:
                "inset 0 1px 0 rgba(255,210,150,0.20), 0 1px 2px rgba(0,0,0,0.6)",
            }}
          />
        </div>
        {/* Two hooks dangling from the rod */}
        <div className="absolute left-0 right-0" style={{ top: 6 }}>
          <span
            className="absolute"
            style={{
              left: "22%",
              top: 0,
              width: 2,
              height: 6,
              background: "#3b3340",
            }}
          />
          <span
            className="absolute"
            style={{
              right: "22%",
              top: 0,
              width: 2,
              height: 6,
              background: "#3b3340",
            }}
          />
        </div>
      </div>

      {/* The banner body — sways continuously, staggered by index so
          adjacent banners aren't in lock-step. */}
      <div
        className="banner-body relative w-full"
        style={
          {
            "--sway-delay": `${idx * 0.3}s`,
          } as React.CSSProperties
        }
      >
        {/* Fabric layer (clipped to torn edge) */}
        <div
          className="banner-fabric relative w-full"
          style={{
            backgroundColor: theme.fabric,
            backgroundImage: [
              // Subtle inner vignette (darker at edges)
              "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
              // Warm fade so the top reads slightly lighter
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 100%)",
              "var(--noise-bg)",
            ].join(", "),
            backgroundBlendMode: "normal, normal, overlay",
            clipPath: TORN_CLIP,
            padding: "20px 14px 36px 14px",
            minHeight: 240,
            color: theme.bright ? "#ece5d4" : "#a8a092",
            boxShadow: active
              ? `inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 8px rgba(0,0,0,0.55), inset 0 0 0 2px ${theme.sigil}`
              : isLegendary
              ? `inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 8px rgba(0,0,0,0.55), inset 0 0 0 1px ${theme.sigil}55`
              : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 8px rgba(0,0,0,0.55)",
          }}
        >
          {/* Shimmer overlay (rank 4+) — diagonal sweep */}
          {isShimmer && <div className="banner-shimmer" aria-hidden />}

          {/* Legendary corner runes (rank 5) */}
          {isLegendary && (
            <>
              <RuneMark
                style={{ top: 6, left: 6 }}
                color={theme.rune}
              />
              <RuneMark
                style={{ top: 6, right: 6 }}
                color={theme.rune}
              />
              <RuneMark
                style={{ bottom: 28, left: 8 }}
                color={theme.rune}
              />
              <RuneMark
                style={{ bottom: 28, right: 8 }}
                color={theme.rune}
              />
            </>
          )}

          {/* Heraldic sigil */}
          <div className="flex justify-center relative z-10">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ filter: sigilFilter }}
            >
              <HeraldIcon zone={zone} color={theme.sigil} />
            </div>
          </div>

          {/* Muscle name */}
          <div
            className="mt-3 text-center text-[12px] uppercase font-bold leading-tight relative z-10"
            style={{
              ...fontDisplay,
              letterSpacing: "0.24em",
              color: theme.bright ? "#ece5d4" : "#a8a092",
              textShadow: "0 1px 0 rgba(0,0,0,0.85)",
            }}
          >
            {ZONE_LABEL[zone]}
          </div>

          {/* Hairline divider */}
          <div
            aria-hidden
            className="mx-auto mt-2"
            style={{
              height: 1,
              width: "60%",
              background: `linear-gradient(90deg, transparent, ${theme.sigil}88, transparent)`,
            }}
          />

          {/* Roman numeral level */}
          <div
            className="mt-3 text-center font-bold leading-none relative z-10"
            style={{
              ...fontDisplay,
              fontSize: 32,
              color: theme.sigil,
              textShadow: theme.bright
                ? `0 0 10px ${theme.sigil}77, 0 1px 0 rgba(0,0,0,0.8)`
                : "0 1px 0 rgba(0,0,0,0.8)",
            }}
          >
            {ROMAN[rank]}
          </div>

          {/* Tier name */}
          <div
            className="text-center text-[9px] uppercase tracking-[0.24em] font-bold mt-1 relative z-10"
            style={{
              ...fontDisplay,
              color: theme.sigil,
            }}
          >
            {LEVEL_LABEL[level]}
          </div>

          {/* XP bar at very bottom (above the torn edge) */}
          <div
            className="mt-3 mx-auto relative z-10"
            style={{
              width: "70%",
              height: 3,
              background: "rgba(0,0,0,0.55)",
              borderRadius: 2,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
              overflow: "hidden",
            }}
          >
            {pct > 0 && (
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  backgroundImage: fill,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Component-scoped CSS — shimmer + rune pulse only.
          The sway animation lives in app/globals.css so it applies
          to RecordCard banners too. */}
      <style jsx>{`
        /* Sway runs continuously even on hover / focus / active —
           hover only brightens the fabric, never pauses the motion. */
        .banner-button:hover .banner-fabric,
        .banner-button:focus-visible .banner-fabric {
          filter: brightness(1.10) saturate(1.10);
          transition: filter 180ms ease;
        }

        .banner-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            115deg,
            transparent 30%,
            rgba(255, 255, 255, 0.06) 45%,
            rgba(255, 255, 255, 0.10) 50%,
            rgba(255, 255, 255, 0.06) 55%,
            transparent 70%
          );
          background-size: 220% 100%;
          background-position: 200% 0;
          animation: shimmerSweep 7s linear infinite;
        }
        @keyframes shimmerSweep {
          0%   { background-position: 220% 0; }
          100% { background-position: -120% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .banner-shimmer { animation: none; }
        }
      `}</style>
    </button>
  );
}

function RuneMark({
  style,
  color,
}: {
  style: React.CSSProperties;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="absolute z-10 rune-mark pointer-events-none"
      style={{ width: 10, height: 10, ...style }}
      aria-hidden
    >
      <path
        d="M6 1 L1 6 L6 11 L11 6 Z M6 4 L6 8"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <style jsx>{`
        .rune-mark {
          animation: runePulse 2.4s ease-in-out infinite;
          filter: drop-shadow(0 0 3px currentColor);
        }
        @keyframes runePulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rune-mark { animation: none; opacity: 0.7; }
        }
      `}</style>
    </svg>
  );
}

function HeraldIcon({
  zone,
  color,
}: {
  zone: Zone;
  color: string;
}) {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (zone) {
    case "chest": // crossed blades
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <line {...common} x1="6" y1="6" x2="22" y2="22" />
          <line {...common} x1="26" y1="6" x2="10" y2="22" />
          <path {...common} d="M22 22l4 4 M10 22l-4 4" />
          <path {...common} d="M16 12 L18 14 L16 16 L14 14 Z" />
        </svg>
      );
    case "back": // shield with vertical spine
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path {...common} d="M16 4 L26 8 V18 C26 24 21 28 16 28 C11 28 6 24 6 18 V8 Z" />
          <line {...common} x1="16" y1="9" x2="16" y2="24" />
          <line {...common} x1="13" y1="13" x2="19" y2="13" />
          <line {...common} x1="13" y1="20" x2="19" y2="20" />
        </svg>
      );
    case "shoulders": // pauldron / armored shoulder
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path {...common} d="M5 17 C5 9 11 4 16 4 C21 4 27 9 27 17 L23 23 C20 25 12 25 9 23 Z" />
          <path {...common} d="M9 12 C12 11 20 11 23 12" />
          <path {...common} d="M11 17 H21" />
        </svg>
      );
    case "biceps": // serpent coiling upward
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            {...common}
            d="M11 28 C8 24 14 22 16 19 C18 16 12 14 14 11 C16 8 22 9 22 6"
          />
          <circle {...common} cx="22" cy="6" r="1.5" />
          <path {...common} d="M22 5.5 L23.5 6 M22 6.5 L23.5 6" />
          <path {...common} d="M14 14 L15 13 M18 21 L19 20" />
        </svg>
      );
    case "triceps": // torch with flame
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            {...common}
            d="M16 3 C19 7 22 9 21 13 C20 15 18 16 16 16 C14 16 12 15 11 13 C10 9 13 7 16 3 Z"
          />
          <path {...common} d="M14 8 C15 10 17 10 18 8" />
          <rect {...common} x="13" y="16" width="6" height="3" rx="1" />
          <line {...common} x1="16" y1="19" x2="16" y2="29" />
          <path {...common} d="M14 23 L18 23" />
        </svg>
      );
    case "forearms": // gauntlet / armored fist
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path {...common} d="M9 6 H21 L25 11 V19 L21 25 H11 L7 21 V11 Z" />
          <path {...common} d="M12 11 L12 23 M16 11 L16 23 M20 11 L20 23" />
          <path {...common} d="M9 14 H23 M9 18 H23" />
        </svg>
      );
    case "abs": // tower / fortress
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            {...common}
            d="M7 11 V8 H9 V10 H12 V8 H14 V10 H18 V8 H20 V10 H23 V8 H25 V11 V28 H7 Z"
          />
          <rect {...common} x="14" y="20" width="4" height="8" />
          <line {...common} x1="7" y1="14" x2="25" y2="14" />
          <line {...common} x1="11" y1="14" x2="11" y2="20" />
          <line {...common} x1="21" y1="14" x2="21" y2="20" />
        </svg>
      );
    case "quads": // horse rearing up
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            {...common}
            d="M7 28 C8 22 10 18 14 17 L13 11 C13 8 16 6 18 7 C19 5 21 4 22 5 C22 7 21 8 21 9 L23 12 C24 14 23 16 22 17 L24 28"
          />
          <path {...common} d="M14 17 L11 13" />
          <circle {...common} cx="20" cy="9" r="0.6" fill={color} />
          <path {...common} d="M22 9 L24 8 M22 11 L24 11" />
        </svg>
      );
    case "hamstrings": // drawn bow with arrow nocked
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path {...common} d="M8 4 C16 8 16 24 8 28" />
          <line {...common} x1="8" y1="4" x2="8" y2="28" />
          <line {...common} x1="4" y1="16" x2="28" y2="16" />
          <path {...common} d="M28 16 L24 13 M28 16 L24 19" />
          <path {...common} d="M4 16 L6 14 M4 16 L6 18" />
        </svg>
      );
    case "glutes": // mountain with two peaks
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path {...common} d="M2 27 L11 10 L16 18 L21 8 L30 27 Z" />
          <path {...common} d="M9 14 L11 10 L13 14" />
          <path {...common} d="M19 12 L21 8 L23 12" />
          <line {...common} x1="11" y1="10" x2="11" y2="13" />
          <line {...common} x1="21" y1="8" x2="21" y2="11" />
        </svg>
      );
    case "calves": // greave / boot
      return (
        <svg viewBox="0 0 32 32" className="w-full h-full">
          <path
            {...common}
            d="M11 4 H17 V18 H24 C26 18 26 22 24 22 H13 C11 22 11 24 11 26 V28 H6 V26 V8 C6 6 8 4 11 4 Z"
          />
          <line {...common} x1="11" y1="10" x2="17" y2="10" />
          <line {...common} x1="11" y1="14" x2="17" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}


function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-2 font-bold"
        style={fontDisplay}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/70 pointer-events-none"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// formatShortDate removed in favour of the shared formatDate from lib/utils.

// ─── Records section ───────────────────────────────────────────────
function RecordsSection({
  userId,
  records,
  bodyweight,
}: {
  userId: string;
  records: RecordEntry[];
  bodyweight?: number;
}) {
  const [editing, setEditing] = useState<RecordKindLocal | null>(null);

  // Group records by category for the headers.
  const byKind = new Map<string, RecordEntry>();
  records.forEach((r) => byKind.set(r.lift, r));

  const categories: Array<{
    key: "strength" | "endurance" | "athleticism";
    label: string;
    items: RecordKindLocal[];
  }> = [
    {
      key: "strength",
      label: "Strength",
      items: ["bench_press", "squat", "deadlift"],
    },
    {
      key: "endurance",
      label: "Endurance",
      items: ["mile_run", "5k_run", "10k_run"],
    },
    {
      key: "athleticism",
      label: "Athleticism",
      items: ["vertical_jump"],
    },
  ];

  // Flatten all records into the order Khalid wants displayed in the
  // single banner row.
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2
          className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
          style={fontDisplay}
        >
          Records
        </h2>
        <div className="rune-divider flex-1" />
      </div>

      {/* Three named subsections — each one a horizontal banner row. */}
      <RecordsRow
        title="Feats of Strength"
        kinds={["bench_press", "squat", "deadlift"]}
        byKind={byKind}
        bodyweight={bodyweight}
        onEdit={(k) => setEditing(k)}
      />
      <RecordsRow
        title="Feats of Endurance"
        kinds={["mile_run", "5k_run", "10k_run"]}
        byKind={byKind}
        bodyweight={bodyweight}
        onEdit={(k) => setEditing(k)}
      />
      <RecordsRow
        title="Feats of Athleticism"
        kinds={["vertical_jump"]}
        byKind={byKind}
        bodyweight={bodyweight}
        onEdit={(k) => setEditing(k)}
      />

      {editing && (
        <RecordModal
          userId={userId}
          kind={editing}
          current={byKind.get(editing) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function RecordsRow({
  title,
  kinds,
  byKind,
  bodyweight,
  onEdit,
}: {
  title: string;
  kinds: RecordKindLocal[];
  byKind: Map<string, RecordEntry>;
  bodyweight?: number;
  onEdit: (kind: RecordKindLocal) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className="text-[10px] uppercase tracking-[0.24em] text-muted/80 font-bold"
        style={fontDisplay}
      >
        {title}
      </div>
      <div
        className="banner-row overflow-x-auto pt-3 pb-2"
        style={{
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex gap-5 px-1" style={{ minWidth: "min-content" }}>
          {kinds.map((kind) => (
            <div
              key={kind}
              className="shrink-0"
              style={{ width: 156, scrollSnapAlign: "start" }}
            >
              <RecordCard
                kind={kind}
                entry={byKind.get(kind) ?? null}
                bodyweight={bodyweight}
                onEdit={() => onEdit(kind)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type RecordKindLocal =
  | "bench_press"
  | "squat"
  | "deadlift"
  | "mile_run"
  | "5k_run"
  | "10k_run"
  | "vertical_jump";

const ALL_RECORDS: RecordKindLocal[] = [
  "bench_press",
  "squat",
  "deadlift",
  "mile_run",
  "5k_run",
  "10k_run",
  "vertical_jump",
];

/**
 * Heraldic sigil keyed by record category — barbell for strength,
 * stride for endurance, jumper for athleticism.
 */
function RecordSigil({
  category,
  color,
}: {
  category: "strength" | "endurance" | "athleticism";
  color: string;
}) {
  const c = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (category === "strength") {
    // Barbell with plates
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <line {...c} x1="4" y1="16" x2="28" y2="16" />
        <rect {...c} x="3" y="11" width="3" height="10" rx="0.6" />
        <rect {...c} x="26" y="11" width="3" height="10" rx="0.6" />
        <rect {...c} x="7" y="13" width="2" height="6" rx="0.4" />
        <rect {...c} x="23" y="13" width="2" height="6" rx="0.4" />
      </svg>
    );
  }
  if (category === "endurance") {
    // Runner figure
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <circle {...c} cx="20" cy="6" r="2" />
        <path {...c} d="M19 9 L15 14 L17 18 L13 22 L9 22" />
        <path {...c} d="M15 14 L21 14 L24 19" />
        <path {...c} d="M17 18 L20 24" />
        <path {...c} d="M13 8 L17 11" />
      </svg>
    );
  }
  // athleticism — leaping figure
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <circle {...c} cx="16" cy="6" r="2" />
      <path {...c} d="M16 8 L16 16" />
      <path {...c} d="M16 12 L11 9 M16 12 L21 9" />
      <path {...c} d="M16 16 L12 22 M16 16 L20 22" />
      <path {...c} d="M6 26 L26 26" />
      <path {...c} d="M11 26 L11 24 M21 26 L21 24" />
    </svg>
  );
}

function RecordCard({
  kind,
  entry,
  bodyweight,
  onEdit,
}: {
  kind: RecordKindLocal;
  entry: RecordEntry | null;
  bodyweight?: number;
  onEdit: () => void;
}) {
  const def = RECORDS_BY_ID[kind];
  const has =
    !!entry &&
    (def.category === "endurance"
      ? (entry.timeSeconds ?? 0) > 0
      : entry.weight > 0);
  const value = has
    ? formatRecordValue(kind, entry!.weight, entry!.timeSeconds)
    : "Uncharted";
  const level: StrengthLevel = has
    ? levelForRecord(
        kind,
        def.category === "endurance" ? entry!.timeSeconds ?? 0 : entry!.weight,
        bodyweight
      )
    : "untrained";
  // Same dark-fantasy palette as the discipline banners. The fabric
  // and sigil colors come from the level so a Legendary PR banner
  // glows in the deep purple.
  const themeMode = useTheme();
  const theme =
    themeMode === "light" ? TIER_THEME_LIGHT[level] : TIER_THEME_DARK[level];
  const isLegendary = level === "elite";
  const isShimmer = LEVEL_RANK[level] >= 4;
  const innerGlow = LEVEL_RANK[level] >= 3;
  const idx = ALL_RECORDS.indexOf(kind);
  const sigilFilter = innerGlow
    ? `drop-shadow(0 0 6px ${theme.sigil}aa) drop-shadow(0 0 14px ${theme.sigil}55)`
    : "drop-shadow(0 1px 0 rgba(0,0,0,0.6))";
  const fill = LEVEL_GRADIENT[level];
  const pct = (LEVEL_RANK[level] / 5) * 100;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="banner-button group relative text-left outline-none w-full"
      style={{ paddingTop: 16 } as React.CSSProperties}
      aria-label={`${def.label} — ${value}`}
    >
      {/* Wooden rod + caps + hooks (mirrors SkillBox) */}
      <div
        aria-hidden
        className="absolute left-0 right-0 z-20"
        style={{ top: 8 }}
      >
        <div
          className="mx-auto"
          style={{
            position: "relative",
            height: 6,
            width: "calc(100% + 18px)",
            marginLeft: -9,
            background:
              "linear-gradient(180deg, #6b4a2c 0%, #3a2410 50%, #5a3a1f 100%)",
            borderRadius: 3,
            boxShadow:
              "inset 0 1px 0 rgba(255,200,140,0.18), inset 0 -1px 0 rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)",
          }}
        >
          <span
            className="absolute"
            style={{
              left: -2,
              top: -3,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, #4a3018, #1a0e04)",
              boxShadow:
                "inset 0 1px 0 rgba(255,210,150,0.20), 0 1px 2px rgba(0,0,0,0.6)",
            }}
          />
          <span
            className="absolute"
            style={{
              right: -2,
              top: -3,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, #4a3018, #1a0e04)",
              boxShadow:
                "inset 0 1px 0 rgba(255,210,150,0.20), 0 1px 2px rgba(0,0,0,0.6)",
            }}
          />
        </div>
        <div className="absolute left-0 right-0" style={{ top: 6 }}>
          <span
            className="absolute"
            style={{ left: "22%", top: 0, width: 2, height: 6, background: "#3b3340" }}
          />
          <span
            className="absolute"
            style={{ right: "22%", top: 0, width: 2, height: 6, background: "#3b3340" }}
          />
        </div>
      </div>

      {/* Fabric — same torn-bottom clip-path + sway as SkillBox */}
      <div
        className="banner-body relative w-full"
        style={
          { "--sway-delay": `${idx * 0.3}s` } as React.CSSProperties
        }
      >
        <div
          className={`banner-fabric relative w-full ${
            isLegendary ? "pulse-legendary" : ""
          }`}
          style={{
            backgroundColor: theme.fabric,
            backgroundImage: [
              "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 100%)",
              "var(--noise-bg)",
            ].join(", "),
            backgroundBlendMode: "normal, normal, overlay",
            clipPath: TORN_CLIP,
            padding: "20px 14px 36px 14px",
            minHeight: 240,
            color: theme.bright ? "#ece5d4" : "#a8a092",
            boxShadow: isLegendary
              ? `inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 8px rgba(0,0,0,0.55), inset 0 0 0 1px ${theme.sigil}55`
              : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 8px rgba(0,0,0,0.55)",
          }}
        >
          {isShimmer && <div className="banner-shimmer" aria-hidden />}

          {/* Record category sigil (reuses HeraldIcon mapping by category) */}
          <div className="flex justify-center relative z-10">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ filter: sigilFilter }}
            >
              <RecordSigil category={def.category} color={theme.sigil} />
            </div>
          </div>

          {/* Record name */}
          <div
            className="mt-3 text-center text-[11px] uppercase font-bold leading-tight relative z-10"
            style={{
              ...fontDisplay,
              letterSpacing: "0.20em",
              color: theme.bright ? "#ece5d4" : "#a8a092",
              textShadow: "0 1px 0 rgba(0,0,0,0.85)",
            }}
          >
            {def.label}
          </div>

          <div
            aria-hidden
            className="mx-auto mt-2"
            style={{
              height: 1,
              width: "60%",
              background: `linear-gradient(90deg, transparent, ${theme.sigil}88, transparent)`,
            }}
          />

          {/* PR value */}
          <div
            className="mt-3 text-center font-bold leading-none relative z-10"
            style={{
              ...fontDisplay,
              fontSize: has ? 22 : 24,
              color: theme.sigil,
              textShadow: theme.bright
                ? `0 0 10px ${theme.sigil}77, 0 1px 0 rgba(0,0,0,0.8)`
                : "0 1px 0 rgba(0,0,0,0.8)",
            }}
          >
            {has ? value : "—"}
          </div>

          {/* Tier name */}
          <div
            className="text-center text-[9px] uppercase tracking-[0.22em] font-bold mt-1 relative z-10"
            style={{
              ...fontDisplay,
              color: theme.sigil,
            }}
          >
            {has ? LEVEL_LABEL[level] : "Uncharted"}
          </div>

          {/* XP bar at foot */}
          <div
            className="mt-3 mx-auto relative z-10"
            style={{
              width: "70%",
              height: 3,
              background: "rgba(0,0,0,0.55)",
              borderRadius: 2,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
              overflow: "hidden",
            }}
          >
            {pct > 0 && (
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  backgroundImage: fill,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function RecordModal({
  userId,
  kind,
  current,
  onClose,
}: {
  userId: string;
  kind: RecordKindLocal;
  current: RecordEntry | null;
  onClose: () => void;
}) {
  const def = RECORDS_BY_ID[kind];
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [weight, setWeight] = useState<string>(
    current && current.weight > 0 ? String(current.weight) : ""
  );
  const initialSeconds = current?.timeSeconds ?? 0;
  const [tHr, setTHr] = useState<string>(
    initialSeconds > 0 ? String(Math.floor(initialSeconds / 3600)) : ""
  );
  const [tMin, setTMin] = useState<string>(
    initialSeconds > 0
      ? String(Math.floor((initialSeconds % 3600) / 60))
      : ""
  );
  const [tSec, setTSec] = useState<string>(
    initialSeconds > 0 ? String(initialSeconds % 60) : ""
  );
  const [date, setDate] = useState<string>(
    current?.date ?? todayPT()
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        user_id: userId,
        lift_name: kind,
        record_type: def.category,
        date_achieved: date,
        updated_at: new Date().toISOString(),
      };
      if (def.category === "endurance") {
        const totalSeconds = parseTimeToSeconds(tMin, tSec, tHr);
        if (totalSeconds <= 0) throw new Error("Enter a valid time");
        payload.time_seconds = totalSeconds;
        payload.weight_lbs = 0;
      } else {
        const w = Number(weight);
        if (!w || w <= 0) throw new Error("Enter a valid value");
        payload.weight_lbs = w;
        payload.time_seconds = null;
      }
      // Try the modern shape; fall back to the legacy column set if
      // the migration hasn't been applied yet.
      let res = await supabase
        .from("personal_bests")
        .upsert(payload, { onConflict: "user_id,lift_name" });
      if (
        res.error &&
        /record_type|time_seconds|lift_name_check/i.test(res.error.message)
      ) {
        const fallback: Record<string, unknown> = { ...payload };
        delete fallback.record_type;
        delete fallback.time_seconds;
        res = await supabase
          .from("personal_bests")
          .upsert(fallback, { onConflict: "user_id,lift_name" });
      }
      if (res.error) throw res.error;
      router.refresh();
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 180ms ease-out" }}
      onClick={onClose}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(2px)",
        }}
      />
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-sm space-y-4"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
          borderColor: "rgba(184, 134, 11, 0.45)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold/80"
            style={fontDisplay}
          >
            {def.category === "strength"
              ? "Strength Record"
              : def.category === "endurance"
              ? "Endurance Record"
              : "Athleticism Record"}
          </div>
          <h2
            className="text-xl font-bold mt-1 text-ink"
            style={fontDisplay}
          >
            {def.label}
          </h2>
        </div>

        {def.category === "endurance" ? (
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-2 font-bold"
              style={fontDisplay}
            >
              Time
            </label>
            {kind === "10k_run" ? (
              <div className="grid grid-cols-3 gap-2">
                <TimeField label="Hours" value={tHr} onChange={setTHr} />
                <TimeField label="Min" value={tMin} onChange={setTMin} />
                <TimeField label="Sec" value={tSec} onChange={setTSec} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <TimeField label="Min" value={tMin} onChange={setTMin} />
                <TimeField label="Sec" value={tSec} onChange={setTSec} />
              </div>
            )}
          </div>
        ) : (
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-2 font-bold"
              style={fontDisplay}
            >
              {def.category === "strength" ? "Weight (lbs)" : "Inches"}
            </label>
            <input
              type="number"
              min="0"
              step={def.category === "athleticism" ? "0.5" : "1"}
              required
              autoFocus
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        )}

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-2 font-bold"
            style={fontDisplay}
          >
            Date achieved
          </label>
          <input
            type="date"
            value={date}
            max={todayPT()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="btn-stone btn-stone-gold flex-1"
          >
            {busy ? "Saving…" : "Inscribe"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-stone btn-stone-ghost px-5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        className="block text-[9px] uppercase tracking-[0.18em] text-muted mb-1"
        style={fontDisplay}
      >
        {label}
      </label>
      <input
        type="number"
        min="0"
        max={label === "Sec" ? "59" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

// Per-zone accent color used by muscle-dot chips so each group reads
// distinctly against the dark fantasy palette.
const ZONE_ACCENT: Record<Zone, string> = {
  chest: "#a83232",
  back: "#3d6b3a",
  shoulders: "#d97706",
  biceps: "#3a5a8a",
  triceps: "#7747b0",
  forearms: "#8a6308",
  abs: "#d4a017",
  quads: "#c25a3a",
  hamstrings: "#b8860b",
  glutes: "#a855f7",
  calves: "#4d7e4a",
};

// ─── Lifting day modal — grouped by exercise w/ accordion expand ─
function LiftingDayModal({
  date,
  sets,
  busy,
  onClose,
  onDelete,
  onEdit,
}: {
  date: string;
  sets: WorkoutDaySet[];
  busy: string | null;
  onClose: () => void;
  onDelete: (workoutId: string, label: string) => void | Promise<void>;
  onEdit: (s: WorkoutDaySet) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(name: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Group sets by exercise name, preserving the order they appeared in.
  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutDaySet[]>();
    for (const s of sets) {
      const list = map.get(s.exercise) ?? [];
      list.push(s);
      map.set(s.exercise, list);
    }
    return Array.from(map.entries());
  }, [sets]);

  const totalVolume = sets.reduce(
    (a, s) => a + s.weight * s.reps * s.sets,
    0
  );
  const zonesWorked = Array.from(new Set(sets.map((s) => s.muscleGroup)));
  const longLabel = formatDate(date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Training
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={fontDisplay}
            >
              {longLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {sets.length === 0 ? (
          <p className="text-sm text-muted italic">
            No workout logged on this day.
          </p>
        ) : (
          <>
            {/* Summary header */}
            <div
              className="rounded p-3 grid grid-cols-3 gap-2 text-center"
              style={{
                background: "rgba(20, 14, 30, 0.55)",
                border: "1px solid rgba(107, 79, 58, 0.4)",
              }}
            >
              <SummaryStat label="Exercises" value={String(grouped.length)} />
              <SummaryStat label="Sets" value={String(sets.length)} />
              <SummaryStat
                label="Volume"
                value={`${totalVolume.toLocaleString()} lbs`}
              />
            </div>

            {/* Muscle-group dots */}
            {zonesWorked.length > 0 && (
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1.5"
                  style={fontDisplay}
                >
                  Muscles trained
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {zonesWorked.map((z) => {
                    const accent =
                      ZONE_ACCENT[z as Zone] ?? LEVEL_COLOR.untrained;
                    return (
                      <span
                        key={z}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em]"
                        style={{
                          background: `${accent}22`,
                          border: `1px solid ${accent}66`,
                          color: "#d8d2c2",
                          fontFamily: "var(--font-cinzel), Georgia, serif",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: accent,
                            boxShadow: `0 0 6px ${accent}`,
                          }}
                        />
                        {ZONE_LABEL[z as keyof typeof ZONE_LABEL] ?? z}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grouped exercises with accordion expand */}
            <ul className="space-y-2">
              {grouped.map(([exerciseName, group]) => {
                const isOpen = expanded.has(exerciseName);
                const totalSetsForEx = group.reduce(
                  (a, g) => a + g.sets,
                  0
                );
                const bestWeight = group.reduce(
                  (a, g) => (g.weight > a ? g.weight : a),
                  0
                );
                const accent =
                  ZONE_ACCENT[group[0].muscleGroup as Zone] ??
                  LEVEL_COLOR.untrained;
                return (
                  <li
                    key={exerciseName}
                    className="rounded overflow-hidden"
                    style={{
                      background: "rgba(20, 14, 30, 0.45)",
                      border: "1px solid rgba(107, 79, 58, 0.4)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(exerciseName)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-elevated/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">
                          {exerciseName}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted/80 mt-0.5">
                          {ZONE_LABEL[
                            group[0].muscleGroup as keyof typeof ZONE_LABEL
                          ] ?? group[0].muscleGroup}
                          {" · "}
                          {totalSetsForEx} set
                          {totalSetsForEx === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-sm text-gold tabular-nums whitespace-nowrap font-semibold">
                        {bestWeight} lbs
                      </div>
                      <span
                        aria-hidden
                        className="text-muted text-base shrink-0"
                        style={{
                          display: "inline-block",
                          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 180ms ease",
                        }}
                      >
                        ▶
                      </span>
                    </button>
                    {isOpen && (
                      <ul
                        className="border-t border-bronze-deep/40 divide-y divide-bronze-deep/30"
                        style={{
                          borderLeft: `2px solid ${accent}`,
                          marginLeft: 0,
                        }}
                      >
                        {group.map((s, i) => (
                          <li
                            key={s.setId}
                            className="py-2 pl-4 pr-3 flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-[10px] uppercase tracking-[0.18em] text-muted"
                                style={fontDisplay}
                              >
                                Set {i + 1}
                              </div>
                              <div className="text-sm tabular-nums text-ink/90">
                                {s.weight} lbs × {s.reps} reps
                                {s.sets > 1 ? ` × ${s.sets} sets` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onEdit(s)}
                              disabled={
                                busy === s.setId || busy === s.workoutId
                              }
                              className="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-40 transition"
                              title="Edit set"
                              aria-label="Edit set"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(s.workoutId, s.exercise)}
                              disabled={busy === s.workoutId}
                              className="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 transition"
                              title="Delete this workout"
                              aria-label="Delete workout"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[9px] uppercase tracking-[0.22em] text-gold/80 font-bold"
        style={fontDisplay}
      >
        {label}
      </div>
      <div className="text-base font-bold text-ink mt-0.5 tabular-nums">
        {value}
      </div>
    </div>
  );
}

// ─── Strength Calculator modal ──────────────────────────────────
// Live e1RM + tier ranking calculator. Pulls thresholds from
// getTierThresholdsLbs at the user's bodyweight + sex, mirrors the
// grading the dashboard heatmap actually uses.
// Tier names + a fallback color (overridden at render time by the
// active heatmap palette inside the calculator components).
const TIER_NAMES: Array<{
  key: "beg" | "nov" | "int" | "adv" | "el";
  label: string;
}> = [
  { key: "beg", label: "Beginner" },
  { key: "nov", label: "Novice" },
  { key: "int", label: "Intermediate" },
  { key: "adv", label: "Advanced" },
  { key: "el", label: "Elite" },
];

// Lookup tier color from the live palette by index (0 = Beginner …
// 4 = Elite). The internal enum names map: below/average/above/
// exceptional/elite respectively.
function tierColorFromPalette(
  scale: Record<StrengthLevel, string>,
  i: number
): string {
  const keys: StrengthLevel[] = [
    "below",
    "average",
    "above",
    "exceptional",
    "elite",
  ];
  return scale[keys[i]] ?? scale.elite;
}

function epleyE1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function setVolumeMult(sets: number): number {
  if (sets <= 1) return 1.0;
  if (sets === 2) return 1.02;
  if (sets === 3) return 1.04;
  if (sets <= 5) return 1.06;
  return 1.08;
}

type CalcResult = {
  e1rm: number;
  effective: number;
  volMult: number;
  thresholds: { beg: number; nov: number; int: number; adv: number; el: number };
  tierIdx: number; // 0..4, -1 if below beginner
  position: number; // 0..1 across the 5-segment bar
  nextThreshold: number | null;
  nextLabel: string | null;
};

function computeCalc(
  exerciseName: string,
  weight: number,
  reps: number,
  sets: number,
  bodyweight: number | null | undefined,
  sex: "male" | "female"
): CalcResult | null {
  if (!exerciseName || weight <= 0 || reps <= 0) return null;
  const bw = bodyweight && bodyweight > 0 ? bodyweight : sex === "female" ? 140 : 175;
  const thresholds = getTierThresholdsLbs(exerciseName, bw, sex);
  if (!thresholds) return null;
  const e1rm = epleyE1RM(weight, reps);
  const volMult = setVolumeMult(Math.max(1, sets));
  const effective = e1rm * volMult;
  // Determine tier
  let tierIdx = -1;
  if (effective >= thresholds.el) tierIdx = 4;
  else if (effective >= thresholds.adv) tierIdx = 3;
  else if (effective >= thresholds.int) tierIdx = 2;
  else if (effective >= thresholds.nov) tierIdx = 1;
  else if (effective >= thresholds.beg) tierIdx = 0;

  // Bar position across 5 equal segments.
  const tiers = [thresholds.beg, thresholds.nov, thresholds.int, thresholds.adv, thresholds.el];
  let position = 0;
  if (tierIdx === -1) {
    position = Math.max(0, (effective / thresholds.beg) * 0.1);
  } else if (tierIdx === 4) {
    // Beyond elite — clamp inside the elite segment with diminishing returns.
    const overflow = (effective - thresholds.el) / Math.max(1, thresholds.el);
    position = 0.8 + Math.min(0.18, overflow * 0.20);
  } else {
    const segStart = tierIdx / 5;
    const segEnd = (tierIdx + 1) / 5;
    const lo = tiers[tierIdx];
    const hi = tiers[tierIdx + 1];
    const within = hi > lo ? (effective - lo) / (hi - lo) : 0;
    position = segStart + within * (segEnd - segStart);
  }
  position = Math.max(0, Math.min(1, position));

  const nextIdx = tierIdx === -1 ? 0 : tierIdx + 1;
  const nextThreshold =
    nextIdx >= 5 ? null : tiers[nextIdx];
  const nextLabel =
    nextIdx >= 5 ? null : TIER_NAMES[nextIdx].label;

  return {
    e1rm,
    effective,
    volMult,
    thresholds,
    tierIdx,
    position,
    nextThreshold,
    nextLabel,
  };
}

// Suggest 3 weight × reps combos that produce a target e1RM.
function suggestCombos(targetE1RM: number, currentWeight: number) {
  const combos = [3, 5, 8].map((reps) => {
    const weight = targetE1RM / (1 + reps / 30);
    // Round to nearest 2.5 lb plate
    const rounded = Math.round(weight / 2.5) * 2.5;
    return { reps, weight: rounded };
  });
  return combos;
}

function StrengthCalculatorModal({
  bodyweight,
  sex,
  ageGroup,
  onClose,
  onLogSet,
}: {
  bodyweight?: number | null;
  sex: "male" | "female" | null;
  ageGroup: string;
  onClose: () => void;
  onLogSet: (prefill: {
    zone: Zone;
    exerciseName: string;
    weight: string;
    reps: string;
    sets: string;
  }) => void;
}) {
  const sexNorm: "male" | "female" = sex === "female" ? "female" : "male";
  const [zone, setZone] = useState<Zone | "">("");
  const [exercise, setExercise] = useState<string>("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("1");
  const [compareOpen, setCompareOpen] = useState(false);
  const [weight2, setWeight2] = useState("");
  const [reps2, setReps2] = useState("");
  const [sets2, setSets2] = useState("1");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const exerciseList = useMemo(
    () => (zone ? exercisesForZone(zone) : []),
    [zone]
  );

  const result = useMemo(
    () =>
      computeCalc(
        exercise,
        Number(weight),
        Number(reps),
        Number(sets),
        bodyweight,
        sexNorm
      ),
    [exercise, weight, reps, sets, bodyweight, sexNorm]
  );

  const result2 = useMemo(
    () =>
      compareOpen
        ? computeCalc(
            exercise,
            Number(weight2),
            Number(reps2),
            Number(sets2),
            bodyweight,
            sexNorm
          )
        : null,
    [compareOpen, exercise, weight2, reps2, sets2, bodyweight, sexNorm]
  );

  const bw = bodyweight && bodyweight > 0 ? bodyweight : sexNorm === "female" ? 140 : 175;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(2,2,8,0.80)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full"
        style={{
          maxWidth: 600,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Tools
            </div>
            <h2
              className="text-2xl font-bold tracking-tight text-ink mt-1"
              style={{
                ...fontDisplay,
                textShadow: "0 0 14px rgba(168,85,247,0.25)",
              }}
            >
              Strength Calculator
            </h2>
            <p
              className="text-[11px] mt-1"
              style={{ ...fontDisplay, color: "rgba(216,210,194,0.65)" }}
            >
              Find out where your lift ranks.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-bold"
              style={fontDisplay}
            >
              Muscle Group
            </label>
            <select
              value={zone}
              onChange={(e) => {
                setZone((e.target.value || "") as Zone | "");
                setExercise("");
              }}
              className="w-full text-[12px]"
              style={{ minHeight: 36 }}
            >
              <option value="">Pick a group</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-bold"
              style={fontDisplay}
            >
              Exercise
            </label>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              disabled={!zone}
              className="w-full text-[12px]"
              style={{ minHeight: 36 }}
            >
              <option value="">Pick an exercise</option>
              {exerciseList.map((ex) => (
                <option key={ex.name} value={ex.name}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weight / Reps / Sets */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-bold"
              style={fontDisplay}
            >
              Weight (lbs)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full text-center tabular-nums text-[14px]"
              style={{ minHeight: 40, fontWeight: 600 }}
            />
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-bold"
              style={fontDisplay}
            >
              Reps
            </label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full text-center tabular-nums text-[14px]"
              style={{ minHeight: 40, fontWeight: 600 }}
            />
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1 font-bold"
              style={fontDisplay}
            >
              Sets
            </label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="w-full text-center tabular-nums text-[14px]"
              style={{ minHeight: 40, fontWeight: 600 }}
            />
          </div>
        </div>

        {/* Live result */}
        {result ? (
          <CalcResultCard
            exerciseName={exercise}
            bodyweight={bw}
            sex={sexNorm}
            ageGroup={ageGroup}
            weight={Number(weight)}
            reps={Number(reps)}
            sets={Number(sets) || 1}
            result={result}
          />
        ) : (
          <div
            className="rounded p-5 text-center text-[12px] italic"
            style={{
              background: "rgba(20,14,30,0.55)",
              border: "1px solid rgba(107,79,58,0.30)",
              color: "rgba(216,210,194,0.55)",
              ...fontDisplay,
            }}
          >
            {!exercise
              ? "Pick an exercise to see your rank."
              : "Enter weight × reps to see your rank."}
          </div>
        )}

        {/* Compare mode */}
        <div className="mt-4">
          <label
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.20em] text-muted hover:text-gold transition cursor-pointer"
            style={fontDisplay}
          >
            <input
              type="checkbox"
              checked={compareOpen}
              onChange={(e) => setCompareOpen(e.target.checked)}
              className="accent-purple-500"
            />
            Compare with another set
          </label>
          {compareOpen && (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={weight2}
                  onChange={(e) => setWeight2(e.target.value)}
                  placeholder="Weight"
                  className="w-full text-center tabular-nums text-[14px]"
                  style={{ minHeight: 40, fontWeight: 600 }}
                />
                <input
                  type="number"
                  min="1"
                  value={reps2}
                  onChange={(e) => setReps2(e.target.value)}
                  placeholder="Reps"
                  className="w-full text-center tabular-nums text-[14px]"
                  style={{ minHeight: 40, fontWeight: 600 }}
                />
                <input
                  type="number"
                  min="1"
                  value={sets2}
                  onChange={(e) => setSets2(e.target.value)}
                  placeholder="Sets"
                  className="w-full text-center tabular-nums text-[14px]"
                  style={{ minHeight: 40, fontWeight: 600 }}
                />
              </div>
              {result2 && result && (
                <CompareCard a={result} b={result2} />
              )}
            </div>
          )}
        </div>

        {/* Log this set */}
        {result && zone && exercise && (
          <button
            type="button"
            onClick={() =>
              onLogSet({
                zone: zone as Zone,
                exerciseName: exercise,
                weight,
                reps,
                sets,
              })
            }
            className="w-full mt-5 transition hover:brightness-110 active:translate-y-px"
            style={{
              ...fontDisplay,
              fontSize: 13,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "#f5efe2",
              padding: "12px 16px",
              borderRadius: 4,
              background: "linear-gradient(180deg, #7747b0 0%, #3a2466 100%)",
              border: "1px solid #7747b0",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 12px rgba(119,71,176,0.55)",
            }}
          >
            Log This Set →
          </button>
        )}
      </div>
    </div>
  );
}

function CalcResultCard({
  exerciseName,
  bodyweight,
  sex,
  ageGroup,
  weight,
  reps,
  sets,
  result,
}: {
  exerciseName: string;
  bodyweight: number;
  sex: "male" | "female";
  ageGroup: string;
  weight: number;
  reps: number;
  sets: number;
  result: CalcResult;
}) {
  const { scale } = useHeatmapPalette();
  const tiers = TIER_NAMES.map((t, i) => ({
    ...t,
    color: tierColorFromPalette(scale, i),
  }));
  const tier = result.tierIdx === -1 ? null : tiers[result.tierIdx];
  const combos =
    result.nextThreshold != null
      ? suggestCombos(result.nextThreshold, weight)
      : [];

  return (
    <div
      className="rounded-md"
      style={{
        background: "rgba(20,14,30,0.65)",
        border: `1px solid ${tier ? `${tier.color}55` : "rgba(107,79,58,0.40)"}`,
        boxShadow: tier ? `0 0 14px ${tier.color}22` : undefined,
      }}
    >
      {/* Title strip */}
      <div
        className="px-4 py-2 border-b border-bronze-deep/40"
        style={{
          background:
            "linear-gradient(180deg, rgba(40,30,15,0.30), rgba(20,12,30,0.20))",
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.24em] font-bold"
          style={{ ...fontDisplay, color: "#d4a020" }}
        >
          {exerciseName} Analysis
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* e1RM line */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div
              className="text-[9px] uppercase tracking-[0.22em] text-muted/85 font-bold"
              style={fontDisplay}
            >
              Estimated 1RM
            </div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{
                ...fontDisplay,
                color: "#f5efe2",
                textShadow: "0 0 8px rgba(168,85,247,0.30)",
              }}
            >
              {Math.round(result.e1rm)} lbs
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[9px] uppercase tracking-[0.22em] text-muted/85 font-bold"
              style={fontDisplay}
            >
              Effective
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{
                ...fontDisplay,
                color: tier ? tier.color : "#9a9282",
              }}
            >
              {Math.round(result.effective)} lbs
            </div>
          </div>
        </div>

        {/* Rank bar */}
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.22em] text-muted/85 font-bold mb-2"
            style={fontDisplay}
          >
            Your Rank
          </div>
          <RankBar tierIdx={result.tierIdx} position={result.position} />
          {tier ? (
            <div
              className="text-center mt-2 text-[12px] uppercase tracking-[0.28em] font-bold"
              style={{
                ...fontDisplay,
                color: tier.color,
                textShadow: `0 0 8px ${tier.color}66`,
              }}
            >
              {tier.label}
            </div>
          ) : (
            <div
              className="text-center mt-2 text-[11px] uppercase tracking-[0.22em] italic"
              style={{ ...fontDisplay, color: "rgba(216,210,194,0.55)" }}
            >
              Below Beginner — keep building
            </div>
          )}
        </div>

        {/* Threshold table */}
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.22em] text-muted/85 font-bold mb-2"
            style={fontDisplay}
          >
            For a {Math.round(bodyweight)} lb {sex === "female" ? "female" : "male"}, {ageGroup}
          </div>
          <ul className="space-y-0.5">
            {tiers.map((t, i) => {
              const isCurrent = i === result.tierIdx;
              const min =
                i === 0
                  ? 0
                  : i === 1
                  ? Math.round(result.thresholds.beg)
                  : i === 2
                  ? Math.round(result.thresholds.nov)
                  : i === 3
                  ? Math.round(result.thresholds.int)
                  : Math.round(result.thresholds.adv);
              const max =
                i === 0
                  ? Math.round(result.thresholds.beg)
                  : i === 1
                  ? Math.round(result.thresholds.nov)
                  : i === 2
                  ? Math.round(result.thresholds.int)
                  : i === 3
                  ? Math.round(result.thresholds.adv)
                  : null;
              const range =
                i === 0
                  ? `< ${max} lbs`
                  : max != null
                  ? `${min} – ${max} lbs`
                  : `${min}+ lbs`;
              return (
                <li
                  key={t.key}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px]"
                  style={{
                    background: isCurrent ? `${t.color}1f` : undefined,
                    border: isCurrent
                      ? `1px solid ${t.color}66`
                      : "1px solid transparent",
                  }}
                >
                  <span
                    className="uppercase tracking-[0.18em] font-bold"
                    style={{ ...fontDisplay, color: t.color }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      color: isCurrent ? "#f5efe2" : "rgba(216,210,194,0.65)",
                    }}
                  >
                    {range}
                    {isCurrent && (
                      <span
                        className="ml-2 uppercase tracking-[0.18em]"
                        style={{
                          ...fontDisplay,
                          fontSize: 9,
                          color: t.color,
                          fontWeight: 700,
                        }}
                      >
                        ← YOU
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Progress to next rank */}
        {result.nextThreshold != null && result.nextLabel ? (
          <div
            className="rounded p-3"
            style={{
              background: "rgba(184,134,11,0.10)",
              border: "1px solid rgba(184,134,11,0.40)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ ...fontDisplay, color: "#d4a020" }}
            >
              ✦ Reach {result.nextLabel}
            </div>
            <div
              className="text-[11px] mb-2"
              style={{
                ...fontDisplay,
                color: "rgba(216,210,194,0.85)",
              }}
            >
              You need{" "}
              <span
                className="font-bold tabular-nums"
                style={{ color: "#f5efe2" }}
              >
                {Math.round(result.nextThreshold)} lbs
              </span>{" "}
              e1RM. Try one of:
            </div>
            <ul className="space-y-0.5">
              {combos.map((c, i) => (
                <li
                  key={i}
                  className="text-[11px] tabular-nums flex items-center gap-2"
                  style={{ color: "#f0c45a" }}
                >
                  <span aria-hidden style={{ color: "rgba(184,134,11,0.65)" }}>
                    →
                  </span>
                  <span style={{ fontWeight: 700 }}>{c.weight} lbs</span>
                  <span style={{ color: "rgba(216,210,194,0.65)" }}>
                    × {c.reps} reps
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            className="rounded p-3 text-center"
            style={{
              background: "rgba(168,85,247,0.10)",
              border: "1px solid rgba(168,85,247,0.40)",
            }}
          >
            <div
              className="text-[11px] uppercase tracking-[0.22em] font-bold"
              style={{ ...fontDisplay, color: "#c084fc" }}
            >
              ✦ You've reached Elite — push the limit
            </div>
          </div>
        )}

        {/* Math breakdown */}
        <details
          className="rounded text-[11px]"
          style={{
            background: "rgba(0,0,0,0.30)",
            border: "1px solid rgba(107,79,58,0.30)",
          }}
        >
          <summary
            className="cursor-pointer px-3 py-2 uppercase tracking-[0.22em] font-bold"
            style={{ ...fontDisplay, fontSize: 10, color: "#9a9282" }}
          >
            How we calculated this
          </summary>
          <div
            className="px-3 py-2 space-y-1 leading-relaxed"
            style={{ color: "rgba(216,210,194,0.78)" }}
          >
            <div>
              Weight × reps:{" "}
              <span className="tabular-nums" style={{ color: "#f5efe2" }}>
                {weight} × {reps}
              </span>
            </div>
            <div>
              e1RM (Epley): {weight} × (1 + {reps}/30) ={" "}
              <span className="tabular-nums" style={{ color: "#f5efe2" }}>
                {Math.round(result.e1rm)} lbs
              </span>
            </div>
            <div>
              Volume bonus ({sets} set{sets === 1 ? "" : "s"}): × {result.volMult.toFixed(2)} ={" "}
              <span className="tabular-nums" style={{ color: "#f5efe2" }}>
                {Math.round(result.effective)} lbs effective
              </span>
            </div>
            <div>
              Compared to {Math.round(bodyweight)} lb {sex} thresholds for{" "}
              <em>{exerciseName}</em>:
            </div>
            <div className="pl-3">
              {tier ? (
                <>
                  ≥ {Math.round(
                    result.tierIdx === 0
                      ? result.thresholds.beg
                      : result.tierIdx === 1
                      ? result.thresholds.nov
                      : result.tierIdx === 2
                      ? result.thresholds.int
                      : result.tierIdx === 3
                      ? result.thresholds.adv
                      : result.thresholds.el
                  )}{" "}
                  lbs →{" "}
                  <span style={{ color: tier.color, fontWeight: 700 }}>
                    {tier.label.toUpperCase()}
                  </span>
                </>
              ) : (
                "Below Beginner threshold"
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function RankBar({
  tierIdx,
  position,
}: {
  tierIdx: number;
  position: number;
}) {
  const { scale } = useHeatmapPalette();
  const tiers = TIER_NAMES.map((t, i) => ({
    ...t,
    color: tierColorFromPalette(scale, i),
  }));
  return (
    <div className="relative" style={{ height: 28 }}>
      <div
        className="absolute inset-0 grid grid-cols-5 rounded overflow-hidden"
        style={{
          border: "1px solid rgba(107,79,58,0.30)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
        }}
      >
        {tiers.map((t, i) => (
          <div
            key={t.key}
            style={{
              background: t.color,
              opacity: i === tierIdx ? 0.85 : 0.30,
              transition: "opacity 200ms",
            }}
            aria-label={t.label}
          />
        ))}
      </div>
      {/* Marker */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: `${position * 100}%`,
          top: -4,
          bottom: -4,
          width: 4,
          marginLeft: -2,
          background: "#f5efe2",
          borderRadius: 2,
          boxShadow:
            tierIdx >= 0
              ? `0 0 10px ${tiers[tierIdx].color}, 0 0 20px ${tiers[tierIdx].color}aa`
              : "0 0 6px rgba(216,210,194,0.5)",
        }}
      />
      <div
        className="absolute inset-x-0 -bottom-5 grid grid-cols-5 text-[8px] uppercase tracking-[0.18em] font-bold"
        style={{ ...fontDisplay, color: "rgba(216,210,194,0.55)" }}
      >
        {tiers.map((t) => (
          <div key={t.key} className="text-center">
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareCard({ a, b }: { a: CalcResult; b: CalcResult }) {
  const winner = a.effective === b.effective ? null : a.effective > b.effective ? "a" : "b";
  return (
    <div
      className="grid grid-cols-2 gap-2 rounded p-3"
      style={{
        background: "rgba(20,14,30,0.55)",
        border: "1px solid rgba(107,79,58,0.30)",
      }}
    >
      <CompareCol label="Set 1" result={a} winner={winner === "a"} />
      <CompareCol label="Set 2" result={b} winner={winner === "b"} />
    </div>
  );
}

function CompareCol({
  label,
  result,
  winner,
}: {
  label: string;
  result: CalcResult;
  winner: boolean;
}) {
  const { scale } = useHeatmapPalette();
  const tier =
    result.tierIdx === -1
      ? null
      : {
          ...TIER_NAMES[result.tierIdx],
          color: tierColorFromPalette(scale, result.tierIdx),
        };
  return (
    <div
      className="rounded p-2"
      style={{
        background: winner ? "rgba(34,197,94,0.10)" : "transparent",
        border: winner
          ? "1px solid rgba(34,197,94,0.55)"
          : "1px solid transparent",
      }}
    >
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-bold flex items-center gap-1"
        style={{ ...fontDisplay, color: winner ? "#22c55e" : "#9a9282" }}
      >
        {label}
        {winner && <span aria-hidden>★</span>}
      </div>
      <div
        className="text-[16px] font-bold tabular-nums mt-1"
        style={{ ...fontDisplay, color: tier ? tier.color : "#9a9282" }}
      >
        {Math.round(result.effective)} lbs
      </div>
      <div
        className="text-[10px] uppercase tracking-[0.18em] mt-0.5"
        style={{
          ...fontDisplay,
          color: tier ? tier.color : "rgba(216,210,194,0.55)",
        }}
      >
        {tier ? tier.label : "Sub-beginner"}
      </div>
    </div>
  );
}

// ─── Multi-exercise log session modal ───────────────────────────
// Self-contained: manages its own date, preset, exercise/set rows.
// Replaces the old single-exercise LogSessionModal flow. Shared by
// the "Log Session +" header button and the "Log Retroactively"
// flow from past-day popups.
type MELSetRow = {
  rowKey: string;
  weight: string;
  reps: string;
  sets: string;
};
type MELExerciseBlock = {
  rowKey: string;
  zone: Zone | "";
  exerciseName: string;
  setRows: MELSetRow[];
};

function MultiExerciseLogModal({
  userId,
  initialDate,
  presets,
  lastByExercise,
  initialExercise,
  onClose,
  onSaved,
}: {
  userId: string;
  initialDate: string;
  presets: WorkoutPreset[];
  lastByExercise: LastSetByExercise;
  initialExercise?: {
    zone: Zone;
    exerciseName: string;
    weight: string;
    reps: string;
    sets: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const todayPTStr = todayPT();
  const isPast = initialDate < todayPTStr;

  const [date, setDate] = useState<string>(initialDate);
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<MELExerciseBlock[]>(() => {
    if (!initialExercise) return [];
    const ts = Date.now();
    return [
      {
        rowKey: `prefill-${ts}`,
        zone: initialExercise.zone,
        exerciseName: initialExercise.exerciseName,
        setRows: [
          {
            rowKey: `set-${ts}`,
            weight: initialExercise.weight,
            reps: initialExercise.reps,
            sets: initialExercise.sets,
          },
        ],
      },
    ];
  });
  const [presetId, setPresetId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  function applyPreset(p: WorkoutPreset) {
    const ts = Date.now();
    setExercises(
      p.exercises.map((ex, i) => ({
        rowKey: `preset-${i}-${ts}`,
        zone: ex.muscleGroup as Zone,
        exerciseName: ex.exerciseName,
        setRows: [
          {
            rowKey: `set-${i}-${ts}`,
            weight: "",
            reps: "",
            sets: "",
          },
        ],
      }))
    );
    setPresetId(p.id);
  }

  function addExerciseManually() {
    setPresetId("");
    setExercises((xs) => [
      ...xs,
      {
        rowKey: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        zone: "",
        exerciseName: "",
        setRows: [
          {
            rowKey: `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            weight: "",
            reps: "",
            sets: "",
          },
        ],
      },
    ]);
  }

  function removeExercise(rowKey: string) {
    setExercises((xs) => xs.filter((x) => x.rowKey !== rowKey));
  }

  function patchExercise(rowKey: string, patch: Partial<MELExerciseBlock>) {
    setExercises((xs) =>
      xs.map((x) => (x.rowKey === rowKey ? { ...x, ...patch } : x))
    );
  }

  function patchSet(
    exRowKey: string,
    setRowKey: string,
    patch: Partial<MELSetRow>
  ) {
    setExercises((xs) =>
      xs.map((x) =>
        x.rowKey !== exRowKey
          ? x
          : {
              ...x,
              setRows: x.setRows.map((s) =>
                s.rowKey === setRowKey ? { ...s, ...patch } : s
              ),
            }
      )
    );
  }

  function addSet(exRowKey: string) {
    setExercises((xs) =>
      xs.map((x) => {
        if (x.rowKey !== exRowKey) return x;
        const last = x.setRows[x.setRows.length - 1];
        return {
          ...x,
          setRows: [
            ...x.setRows,
            {
              rowKey: `set-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 6)}`,
              // Pre-fill with previous row for easy progressive entry.
              weight: last?.weight ?? "",
              reps: last?.reps ?? "",
              sets: "",
            },
          ],
        };
      })
    );
  }

  function removeSet(exRowKey: string, setRowKey: string) {
    setExercises((xs) =>
      xs
        .map((x) => {
          if (x.rowKey !== exRowKey) return x;
          const next = x.setRows.filter((s) => s.rowKey !== setRowKey);
          return next.length > 0 ? { ...x, setRows: next } : null;
        })
        .filter((x): x is MELExerciseBlock => x !== null)
    );
  }

  async function save() {
    setErr(null);
    // Validate
    const validBlocks = exercises
      .map((b) => ({
        ...b,
        setRows: b.setRows.filter(
          (s) =>
            Number(s.weight) > 0 &&
            Number(s.reps) > 0 &&
            Number(s.sets) > 0
        ),
      }))
      .filter(
        (b) => b.zone && b.exerciseName && b.setRows.length > 0
      );

    if (validBlocks.length === 0) {
      setErr(
        "Add at least one exercise with a complete set (weight, reps, sets)."
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1) Create the parent workout row.
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          date,
          notes: notes.trim() || null,
        })
        .select()
        .single();
      if (wErr) throw wErr;

      // 2) Build set rows.
      const lookup = new Map(EXERCISE_OPTIONS.map((e) => [e.name, e]));
      const baseRows = validBlocks.flatMap((b) =>
        b.setRows.map((s) => ({
          workout_id: workout.id,
          exercise_name: b.exerciseName,
          muscle_group: b.zone as string,
          weight_lbs: Number(s.weight),
          reps: Number(s.reps),
          sets: Number(s.sets),
        }))
      );
      const withPrimary = baseRows.map((row, i) => {
        const flat = validBlocks.flatMap((b) =>
          b.setRows.map(() => b.exerciseName)
        );
        const exName = flat[i];
        return {
          ...row,
          primary_muscle: lookup.get(exName)?.muscles?.[0] ?? null,
        };
      });

      const ins = await supabase.from("workout_sets").insert(withPrimary);
      if (ins.error) {
        const code = (ins.error as any).code;
        const missing =
          code === "42703" ||
          code === "PGRST204" ||
          /primary_muscle/i.test(ins.error.message ?? "");
        if (!missing) throw ins.error;
        const retry = await supabase
          .from("workout_sets")
          .insert(baseRows);
        if (retry.error) throw retry.error;
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save session.");
      console.error("[MultiExerciseLogModal save]", e);
    } finally {
      setSubmitting(false);
    }
  }

  const longDateLabel = useMemo(() => {
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [date]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      onClick={() => !submitting && onClose()}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
      role="dialog"
      aria-modal
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(2,2,8,0.85)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl flex flex-col"
        style={{
          background: "var(--noise-bg), #0a0a14",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-bronze-deep/60 shrink-0">
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              {isPast ? "Log Retroactively" : "Log Session"}
            </div>
            <h2
              className="text-lg font-bold text-ink truncate"
              style={fontDisplay}
            >
              {longDateLabel}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={date}
              max={todayPTStr}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs"
              style={{ minHeight: 36, padding: "4px 8px" }}
              aria-label="Session date"
            />
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="btn-stone text-[10px]"
              style={{
                ...fontDisplay,
                letterSpacing: "0.22em",
                padding: "0.55rem 0.85rem",
                background: "linear-gradient(180deg, #7747b0, #3a2466)",
                borderColor: "#7747b0",
                color: "#f0e6ff",
              }}
            >
              {submitting ? "Saving…" : "Save Session"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Preset picker — when no exercises chosen yet */}
          {exercises.length === 0 && (
            <div
              className="rounded p-4"
              style={{
                background: "rgba(20,14,30,0.55)",
                border: "1px solid rgba(107,79,58,0.40)",
              }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.22em] text-gold/85 font-bold mb-3"
                style={fontDisplay}
              >
                Use a Preset
              </div>
              {presets.length === 0 ? (
                <p className="text-[12px] text-muted italic">
                  No presets saved yet. Add an exercise manually below.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {presets.map((p, i) => {
                    const accent = presetColor(i);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="text-left transition hover:brightness-110"
                        style={{
                          padding: "8px 10px 8px 12px",
                          background: `linear-gradient(90deg, ${accent}33 0%, ${accent}10 100%)`,
                          borderTop: `1px solid ${accent}55`,
                          borderRight: `1px solid ${accent}55`,
                          borderBottom: `1px solid ${accent}55`,
                          borderLeft: `4px solid ${accent}`,
                          borderRadius: 4,
                        }}
                      >
                        <div
                          className="font-bold tracking-tight truncate"
                          style={{
                            ...fontDisplay,
                            fontSize: 12,
                            color: "#f5efe2",
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
                          style={{
                            ...fontDisplay,
                            color: "rgba(245,239,226,0.55)",
                          }}
                        >
                          {p.exercises.length} ex
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-px bg-bronze-deep/40" />
                <span
                  className="text-[9px] uppercase tracking-[0.32em] text-muted/70"
                  style={fontDisplay}
                >
                  or
                </span>
                <div className="flex-1 h-px bg-bronze-deep/40" />
              </div>
              <button
                type="button"
                onClick={addExerciseManually}
                className="btn-stone btn-stone-ghost w-full mt-3 text-[11px]"
                style={{
                  ...fontDisplay,
                  letterSpacing: "0.22em",
                  padding: "0.6rem 0.9rem",
                }}
              >
                Add Manually +
              </button>
            </div>
          )}

          {exercises.length > 0 && presetId && (
            <div
              className="rounded px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] flex items-center justify-between"
              style={{
                background: "rgba(91,57,147,0.10)",
                border: "1px solid rgba(168,85,247,0.30)",
                ...fontDisplay,
                color: "rgba(216,210,194,0.75)",
              }}
            >
              <span>
                Loaded from preset:{" "}
                <span style={{ color: "#d4b6f5" }}>
                  {presets.find((p) => p.id === presetId)?.name ?? "?"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setExercises([]);
                  setPresetId("");
                }}
                className="text-muted/70 hover:text-ink"
                style={fontDisplay}
              >
                clear
              </button>
            </div>
          )}

          {/* Exercise blocks */}
          {exercises.map((block) => (
            <ExerciseLogBlock
              key={block.rowKey}
              block={block}
              last={lastByExercise[block.exerciseName]}
              onPatch={(patch) => patchExercise(block.rowKey, patch)}
              onPatchSet={(setKey, patch) =>
                patchSet(block.rowKey, setKey, patch)
              }
              onAddSet={() => addSet(block.rowKey)}
              onRemoveSet={(setKey) => removeSet(block.rowKey, setKey)}
              onRemove={() => removeExercise(block.rowKey)}
            />
          ))}

          {exercises.length > 0 && (
            <button
              type="button"
              onClick={addExerciseManually}
              className="w-full transition hover:brightness-110"
              style={{
                ...fontDisplay,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 800,
                padding: "10px 14px",
                borderRadius: 4,
                background: "rgba(184,134,11,0.10)",
                border: "1px dashed rgba(184,134,11,0.55)",
                color: "#d4a020",
              }}
            >
              + Add Exercise
            </button>
          )}

          {/* Notes — always visible */}
          {exercises.length > 0 && (
            <div className="mt-3">
              <label
                className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
                style={fontDisplay}
              >
                Session Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. felt strong today"
                className="w-full text-[12px]"
              />
            </div>
          )}

          {err && (
            <p
              className="text-[12px] mt-2"
              style={{ color: "#dc6868" }}
            >
              {err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseLogBlock({
  block,
  last,
  onPatch,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  block: MELExerciseBlock;
  last: LastSetByExercise[string] | undefined;
  onPatch: (patch: Partial<MELExerciseBlock>) => void;
  onPatchSet: (setKey: string, patch: Partial<MELSetRow>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
  onRemove: () => void;
}) {
  const exerciseList = useMemo(
    () => (block.zone ? exercisesForZone(block.zone) : []),
    [block.zone]
  );
  return (
    <div
      className="rounded p-3 space-y-2"
      style={{
        background: "rgba(20,14,30,0.55)",
        border: "1px solid rgba(107,79,58,0.40)",
      }}
    >
      <div className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
        <select
          value={block.zone}
          onChange={(e) =>
            onPatch({
              zone: (e.target.value || "") as Zone | "",
              exerciseName: "",
            })
          }
          className="w-full text-[12px]"
          style={{ minHeight: 34 }}
        >
          <option value="">Muscle group</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {ZONE_LABEL[z]}
            </option>
          ))}
        </select>
        <select
          value={block.exerciseName}
          onChange={(e) => onPatch({ exerciseName: e.target.value })}
          disabled={!block.zone}
          className="w-full text-[12px]"
          style={{ minHeight: 34 }}
        >
          <option value="">Exercise</option>
          {exerciseList.map((ex) => (
            <option key={ex.name} value={ex.name}>
              {ex.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 flex items-center justify-center rounded transition hover:brightness-125"
          style={{ color: "rgba(220,80,80,0.75)" }}
          title="Remove exercise"
          aria-label="Remove exercise"
        >
          <TrashGlyph />
        </button>
      </div>

      {/* Last-time reference */}
      <div className="text-[11px]" style={{ color: "#b8860b" }}>
        {block.exerciseName ? (
          last ? (
            <>
              Last time:{" "}
              <span
                className="tabular-nums font-semibold"
                style={{ color: "#f5efe2" }}
              >
                {last.weight} × {last.reps} × {last.sets}
              </span>
              <span style={{ color: "rgba(216,210,194,0.55)" }}>
                {" "}
                · {formatDate(last.date)}
              </span>
            </>
          ) : (
            <span className="text-muted italic">No previous data</span>
          )
        ) : null}
      </div>

      {/* Set rows */}
      {block.setRows.map((s, idx) => (
        <div
          key={s.rowKey}
          className="grid grid-cols-[24px_1fr_8px_1fr_8px_1fr_28px] gap-1.5 items-center"
        >
          <span
            className="text-[10px] uppercase tracking-[0.18em] text-muted/85 font-bold tabular-nums"
            style={fontDisplay}
          >
            {idx + 1}
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={s.weight}
            onChange={(e) =>
              onPatchSet(s.rowKey, { weight: e.target.value })
            }
            className="w-full text-[12px] text-center tabular-nums"
            style={{ minHeight: 32, padding: "4px 6px" }}
            placeholder="lb"
            aria-label={`Set ${idx + 1} weight`}
          />
          <span className="text-center text-muted/60" aria-hidden>
            ×
          </span>
          <input
            type="number"
            min="0"
            value={s.reps}
            onChange={(e) =>
              onPatchSet(s.rowKey, { reps: e.target.value })
            }
            className="w-full text-[12px] text-center tabular-nums"
            style={{ minHeight: 32, padding: "4px 6px" }}
            placeholder="reps"
            aria-label={`Set ${idx + 1} reps`}
          />
          <span className="text-center text-muted/60" aria-hidden>
            ×
          </span>
          <input
            type="number"
            min="0"
            value={s.sets}
            onChange={(e) =>
              onPatchSet(s.rowKey, { sets: e.target.value })
            }
            className="w-full text-[12px] text-center tabular-nums"
            style={{ minHeight: 32, padding: "4px 6px" }}
            placeholder="sets"
            aria-label={`Set ${idx + 1} sets count`}
          />
          <button
            type="button"
            onClick={() => onRemoveSet(s.rowKey)}
            className="w-7 h-7 flex items-center justify-center rounded transition hover:brightness-125"
            style={{ color: "rgba(220,80,80,0.75)" }}
            title="Remove this set"
            aria-label="Remove set"
          >
            <TrashGlyph />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="text-[10px] uppercase tracking-[0.18em] py-1.5 px-3 rounded border border-bronze-deep/50 text-muted hover:text-gold hover:border-bronze transition"
          style={fontDisplay}
        >
          + Add Set
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] uppercase tracking-[0.18em] py-1.5 px-3 rounded text-muted/70 hover:text-danger transition ml-auto"
          style={fontDisplay}
        >
          Remove Exercise
        </button>
      </div>
    </div>
  );
}

// ─── Log Session modal — redesigned 2-column flow ────────────────
function LogSessionModal({
  inputCls,
  zone,
  setZone,
  exercise,
  setExercise,
  weight,
  setWeight,
  reps,
  setReps,
  sets,
  setSets,
  date,
  setDate,
  notes,
  setNotes,
  notesOpen,
  setNotesOpen,
  submitting,
  showSuccess,
  err,
  canSubmit,
  lastByExercise,
  recentByExercise,
  zoneLevels,
  onSubmit,
  onClose,
}: {
  inputCls: string;
  zone: Zone | "";
  setZone: (v: Zone | "") => void;
  exercise: string;
  setExercise: (v: string) => void;
  weight: string;
  setWeight: (v: string) => void;
  reps: string;
  setReps: (v: string) => void;
  sets: string;
  setSets: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  notesOpen: boolean;
  setNotesOpen: (v: boolean) => void;
  submitting: boolean;
  showSuccess: boolean;
  err: string | null;
  canSubmit: boolean;
  lastByExercise: LastSetByExercise;
  recentByExercise: RecentByExercise;
  zoneLevels: Record<Zone, StrengthLevel>;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const exerciseList = useMemo(
    () => (zone ? exercisesForZone(zone) : []),
    [zone]
  );
  const last = exercise ? lastByExercise[exercise] : undefined;
  const recent = exercise ? recentByExercise[exercise] ?? [] : [];

  function adjustWeight(delta: number) {
    const cur = Number(weight) || 0;
    const next = Math.max(0, cur + delta);
    setWeight(Number.isInteger(next) ? String(next) : next.toFixed(1));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      style={{ animation: "modalFadeIn 180ms ease-out" }}
      onClick={() => !submitting && onClose()}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(2, 2, 8, 0.85)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl flex flex-col"
        style={{
          background: "var(--noise-bg), #0a0a14",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-bronze-deep/60 shrink-0">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Training Ground
            </div>
            <h2
              className="text-lg font-bold text-ink"
              style={fontDisplay}
            >
              Log Training Session
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] overflow-hidden"
        >
          {/* LEFT — Muscle group grid */}
          <aside className="border-r border-bronze-deep/60 p-4 overflow-y-auto">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-3"
              style={fontDisplay}
            >
              Muscle Group
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ZONES.map((z) => {
                const isSelected = zone === z;
                const lvlColor = LEVEL_COLOR[zoneLevels[z] ?? "untrained"];
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => {
                      setZone(z);
                      setExercise("");
                    }}
                    className="relative rounded px-3 py-3 text-center transition"
                    style={{
                      background: isSelected
                        ? "rgba(184, 134, 11, 0.18)"
                        : "rgba(20, 14, 30, 0.55)",
                      border: isSelected
                        ? "1px solid rgba(184, 134, 11, 0.85)"
                        : "1px solid rgba(107, 79, 58, 0.4)",
                      boxShadow: isSelected
                        ? "0 0 14px rgba(184, 134, 11, 0.32), inset 0 1px 0 rgba(255,255,255,0.06)"
                        : "inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute top-1.5 left-1.5 rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        background: lvlColor,
                        boxShadow: `0 0 4px ${lvlColor}`,
                      }}
                    />
                    <div
                      className="text-[11px] uppercase tracking-[0.18em] font-bold"
                      style={{
                        ...fontDisplay,
                        color: isSelected ? "#d4a020" : "#d8d2c2",
                      }}
                    >
                      {ZONE_LABEL[z]}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* RIGHT — Exercise list, then inputs + recent logs */}
          <main className="flex flex-col overflow-hidden">
            {!zone ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted italic px-6 text-center">
                Select a muscle group on the left to choose an exercise.
              </div>
            ) : !exercise ? (
              <div className="flex-1 overflow-y-auto p-5">
                <div
                  className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-3"
                  style={fontDisplay}
                >
                  Exercises · {ZONE_LABEL[zone as Zone]}
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {exerciseList.map((ex) => {
                    const exLast = lastByExercise[ex.name];
                    return (
                      <li key={ex.name}>
                        <button
                          type="button"
                          onClick={() => setExercise(ex.name)}
                          className="w-full text-left rounded px-3 py-2.5 transition hover:border-gold/60"
                          style={{
                            background: "rgba(20, 14, 30, 0.55)",
                            border: "1px solid rgba(107, 79, 58, 0.4)",
                          }}
                        >
                          <div className="text-sm text-ink truncate">
                            {ex.name}
                          </div>
                          {exLast ? (
                            <div
                              className="text-[10px] tabular-nums mt-0.5"
                              style={{ color: "#b8860b" }}
                            >
                              Last: {exLast.weight} × {exLast.reps} ×{" "}
                              {exLast.sets}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted/60 italic mt-0.5">
                              No previous data
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <>
                <div
                  className={`flex-1 overflow-y-auto p-5 space-y-4 ${
                    showSuccess ? "log-session-pulse" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="text-[10px] uppercase tracking-[0.22em] text-muted"
                        style={fontDisplay}
                      >
                        {ZONE_LABEL[zone as Zone]}
                      </div>
                      <h3
                        className="text-2xl font-bold text-ink truncate"
                        style={fontDisplay}
                      >
                        {exercise}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExercise("")}
                      className="text-[10px] uppercase tracking-[0.22em] text-muted hover:text-ink transition shrink-0"
                      style={fontDisplay}
                      title="Pick a different exercise"
                    >
                      ← Change
                    </button>
                  </div>

                  {/* Last time chip */}
                  {last ? (
                    <div
                      className="rounded px-3 py-2 text-sm tabular-nums"
                      style={{
                        background: "rgba(184, 134, 11, 0.10)",
                        border: "1px solid rgba(184, 134, 11, 0.32)",
                        color: "#d4a020",
                      }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-[0.22em] font-bold mr-2"
                        style={fontDisplay}
                      >
                        Last time:
                      </span>
                      {last.weight} lbs × {last.reps} × {last.sets}
                      <span className="text-muted/80">
                        {" "}
                        — {formatDate(last.date)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted italic">
                      No previous data for this exercise.
                    </div>
                  )}

                  {/* Big inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <BigInputField
                      label="Weight (lbs)"
                      value={weight}
                      onChange={setWeight}
                      step={0.5}
                      inputMode="decimal"
                    />
                    <BigInputField
                      label="Reps"
                      value={reps}
                      onChange={setReps}
                      inputMode="numeric"
                    />
                    <BigInputField
                      label="Sets"
                      value={sets}
                      onChange={setSets}
                      inputMode="numeric"
                    />
                  </div>

                  {/* Quick weight adjust */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] uppercase tracking-[0.22em] text-muted"
                      style={fontDisplay}
                    >
                      Quick adjust
                    </span>
                    {[-5, 5, 10].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => adjustWeight(d)}
                        className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] rounded border border-bronze-deep/40 text-muted hover:text-ink hover:border-gold/60 transition"
                        style={fontDisplay}
                      >
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                  </div>

                  {/* Date + notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                    <div>
                      <label
                        className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
                        style={fontDisplay}
                      >
                        Date
                      </label>
                      <input
                        type="date"
                        value={date}
                        max={todayPT()}
                        onChange={(e) => setDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      {!notesOpen ? (
                        <div className="h-full flex items-end">
                          <button
                            type="button"
                            onClick={() => setNotesOpen(true)}
                            className="text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-soft transition"
                            style={fontDisplay}
                          >
                            + Add notes
                          </button>
                        </div>
                      ) : (
                        <>
                          <label
                            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
                            style={fontDisplay}
                          >
                            Notes
                          </label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="optional"
                            className={inputCls}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recent log strip */}
                  {recent.length > 0 && (
                    <div className="pt-2 border-t border-bronze-deep/40">
                      <div
                        className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-2"
                        style={fontDisplay}
                      >
                        Recent Logs
                      </div>
                      <ul className="space-y-1">
                        {recent.map((r, i) => (
                          <li
                            key={i}
                            className="flex items-baseline justify-between text-[11px]"
                          >
                            <span className="tabular-nums text-ink/85">
                              {r.weight} × {r.reps} × {r.sets}
                            </span>
                            <span className="text-muted/80 uppercase tracking-[0.16em]">
                              {formatDate(r.date)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {err && <p className="text-sm text-danger">{err}</p>}
                </div>

                {/* Sticky submit */}
                <div className="border-t border-bronze-deep/60 p-4 shrink-0">
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className={`btn-stone w-full ${
                      showSuccess ? "btn-stone-gold" : ""
                    }`}
                    style={{
                      ...fontDisplay,
                      letterSpacing: "0.22em",
                    }}
                  >
                    {showSuccess
                      ? "Session Recorded"
                      : submitting
                      ? "Recording…"
                      : "Record Session"}
                  </button>
                </div>
              </>
            )}
          </main>
        </form>
      </div>

      <style jsx>{`
        :global(.log-session-pulse) {
          animation: logSessionPulse 1.4s ease-out;
        }
        @keyframes logSessionPulse {
          0% { background-color: transparent; }
          25% { background-color: rgba(212, 160, 23, 0.12); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}

// ─── Big input field — used in the redesigned log session form ───
// ─── Weekly workout schedule ──────────────────────────────────────
type ScheduleDayClient = {
  day_of_week: number;
  is_rest: boolean;
  workout_type: string | null;
  preset_id: string | null;
};

const WORKOUT_TYPES: Array<{ value: string; label: string }> = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
  { value: "full_body", label: "Full Body" },
  { value: "custom", label: "Custom" },
];

// Display order: Mon..Sun (My Week now reads left-to-right starting on Monday).
// `dow` keeps the JS getDay() value (0=Sun..6=Sat) so existing template
// lookups keyed on day-of-week continue to work.
const WEEK_ORDER: Array<{ dow: number; short: string; full: string }> = [
  { dow: 1, short: "Mon", full: "Monday" },
  { dow: 2, short: "Tue", full: "Tuesday" },
  { dow: 3, short: "Wed", full: "Wednesday" },
  { dow: 4, short: "Thu", full: "Thursday" },
  { dow: 5, short: "Fri", full: "Friday" },
  { dow: 6, short: "Sat", full: "Saturday" },
  { dow: 0, short: "Sun", full: "Sunday" },
];

// Per-type tint + accent for the calendar cells.
const TYPE_THEME: Record<
  string,
  { bg: string; border: string; label: string; text: string }
> = {
  push:      { bg: "rgba(160,67,42,0.18)",   border: "rgba(196,99,67,0.55)",  label: "Push",      text: "#f0b89e" },
  pull:      { bg: "rgba(58,90,138,0.20)",   border: "rgba(96,140,200,0.55)", label: "Pull",      text: "#a6c5ec" },
  legs:      { bg: "rgba(61,107,58,0.20)",   border: "rgba(96,180,90,0.55)",  label: "Legs",      text: "#a8e0a4" },
  upper:     { bg: "rgba(184,134,11,0.18)",  border: "rgba(216,160,32,0.55)", label: "Upper",     text: "#f0d68f" },
  lower:     { bg: "rgba(91,57,147,0.22)",   border: "rgba(168,85,247,0.55)", label: "Lower",     text: "#d4b6f5" },
  full_body: { bg: "rgba(212,160,32,0.20)",  border: "rgba(232,200,80,0.60)", label: "Full Body", text: "#f5d97a" },
  custom:    { bg: "rgba(91,57,147,0.18)",   border: "rgba(168,85,247,0.45)", label: "Custom",    text: "#d4b6f5" },
};
const REST_THEME = {
  bg: "rgba(20,14,30,0.55)",
  border: "rgba(107,79,58,0.45)",
  label: "Rest",
  text: "#7a6f60",
};

function buildDaysMap(
  rows: Array<{
    day_of_week: number;
    is_rest: boolean;
    workout_type: string | null;
    preset_id?: string | null;
  }>
): Record<number, ScheduleDayClient> {
  const m: Record<number, ScheduleDayClient> = {};
  for (const d of rows) {
    m[d.day_of_week] = {
      day_of_week: d.day_of_week,
      is_rest: d.is_rest,
      workout_type: d.workout_type ?? null,
      preset_id: d.preset_id ?? null,
    };
  }
  for (const w of WEEK_ORDER) {
    if (!m[w.dow]) {
      m[w.dow] = {
        day_of_week: w.dow,
        is_rest: false,
        workout_type: null,
        preset_id: null,
      };
    }
  }
  return m;
}

function weekOffsetLabel(offset: number): string {
  if (offset === 0) return "This Week";
  if (offset === -1) return "Last Week";
  if (offset === 1) return "Next Week";
  if (offset < 0) return `${Math.abs(offset)} Weeks Ago`;
  return `${offset} Weeks Ahead`;
}

// Map workout-type → relevant zones for smart suggestions.
const TYPE_ZONES: Record<string, Zone[]> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves"],
  upper: ["chest", "back", "shoulders", "biceps", "triceps"],
  lower: ["quads", "hamstrings", "glutes", "calves"],
  full_body: ["chest", "back", "quads", "shoulders", "hamstrings"],
  custom: ["chest", "back", "shoulders", "biceps", "triceps", "quads"],
};

// Sort the workout-type's zones by current level (ascending) and pick a
// primary exercise for each of the lowest 3-4. Returns suggestions
// shaped for the modal card.
function buildSmartSuggestions(
  workoutType: string,
  zoneLevels: Record<Zone, StrengthLevel>
): Array<{ exercise: string; zone: Zone; level: StrengthLevel }> {
  const zones = TYPE_ZONES[workoutType] ?? [];
  if (zones.length === 0) return [];
  const ranked = zones
    .map((z) => ({
      zone: z,
      level: zoneLevels[z] ?? "untrained",
      rank: LEVEL_RANK[zoneLevels[z] ?? "untrained"],
    }))
    .sort((a, b) => a.rank - b.rank);

  const out: Array<{
    exercise: string;
    zone: Zone;
    level: StrengthLevel;
  }> = [];
  const seen = new Set<string>();
  for (const r of ranked) {
    const list = exercisesForZoneTiered(r.zone);
    const primary = list.find(
      (e) => e.tier === "primary" && !seen.has(e.exercise)
    );
    if (!primary) continue;
    seen.add(primary.exercise);
    out.push({ exercise: primary.exercise, zone: r.zone, level: r.level });
    if (out.length >= 4) break;
  }
  return out;
}

// Compute the Monday-anchored start-of-week for a given week_offset
// (0 = current week, -1 = last week, +1 = next). Returns midnight
// local time.
function weekStartFor(offset: number): Date {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  const offsetFromMon = (now.getDay() + 6) % 7; // Mon→0, Sun→6
  monday.setDate(monday.getDate() - offsetFromMon + offset * 7);
  return monday;
}

// Given the row's WEEK_ORDER index (0=Mon..6=Sun), return the Date
// for that cell. Always reads from `weekStart + idx days` so the
// rendering order and the underlying dates stay in lockstep.
function dateForCellByIndex(weekStart: Date, idx: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + idx);
  return d;
}

function shortDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(end)}, ${end.getFullYear()}`;
}

function isoForDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// ─── Date-keyed entry coming back from /api/daily-schedule.
type DailyEntry = {
  date: string;
  is_rest: boolean;
  workout_type: string | null;
  preset_id: string | null;
  notes?: string | null;
};

function buildDailyMap(rows: DailyEntry[]): Record<string, DailyEntry> {
  const m: Record<string, DailyEntry> = {};
  for (const r of rows) m[r.date] = r;
  return m;
}

function WeeklySchedule({
  userId,
  template,
  initialDaily,
  initialWeekStartISO,
  tableMissing,
  presets,
  lastByExercise,
  zoneLevels,
  workoutDays,
  onOpenLogForDate,
}: {
  userId: string;
  template: ScheduleDayClient[];
  initialDaily: DailyEntry[];
  initialWeekStartISO: string;
  tableMissing: boolean;
  presets: WorkoutPreset[];
  lastByExercise: LastSetByExercise;
  zoneLevels: Record<Zone, StrengthLevel>;
  workoutDays: WorkoutDaySet[];
  onOpenLogForDate: (iso: string) => void;
}) {
  const router = useRouter();
  // Day-of-week template (fallback when no specific date is scheduled).
  const templateByDow = useMemo(() => buildDaysMap(template), [template]);
  const [weekOffset, setWeekOffset] = useState(0);
  // Per-date overrides for the currently-loaded week.
  const [dailyByDate, setDailyByDate] = useState<Record<string, DailyEntry>>(
    () => buildDailyMap(initialDaily)
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Day to launch a session for — when set, opens StartSessionModal
  // pre-filled from the linked preset.
  const [sessionPreset, setSessionPreset] = useState<WorkoutPreset | null>(
    null
  );
  const presetsById = useMemo(() => {
    const m = new Map<string, WorkoutPreset>();
    for (const p of presets) m.set(p.id, p);
    return m;
  }, [presets]);
  // Color cycles by the preset's index in the user's preset list — the
  // same mapping the My Presets section uses, so a given preset has the
  // same accent everywhere on the page.
  const presetColorById = useMemo(() => {
    const m = new Map<string, string>();
    presets.forEach((p, i) => m.set(p.id, presetColor(i)));
    return m;
  }, [presets]);
  // Set of ISO dates that have at least one logged set — used to mark
  // logged days inside the month preview.
  const loggedDates = useMemo(() => {
    const s = new Set<string>();
    for (const d of workoutDays) if (d.date) s.add(d.date);
    return s;
  }, [workoutDays]);
  const weekStart = useMemo(
    () => weekStartFor(weekOffset),
    [weekOffset]
  );
  // Prefer the server-rendered ISO for week 0 so the cells line up
  // exactly with the rows the server preloaded. For other offsets,
  // derive from the local Date — only the date math matters.
  const weekStartISO = useMemo(
    () => (weekOffset === 0 ? initialWeekStartISO : isoForDate(weekStart)),
    [weekOffset, weekStart, initialWeekStartISO]
  );
  const todayISOStr = useMemo(() => isoForDate(new Date()), []);
  const [monthOpen, setMonthOpen] = useState(false);
  // Date currently open in the workout-detail popup. ISO YYYY-MM-DD.
  const [detailDate, setDetailDate] = useState<string | null>(null);
  // Quick lookup of all logged sets for any given date.
  const setsByDate = useMemo(() => {
    const m = new Map<string, WorkoutDaySet[]>();
    for (const s of workoutDays) {
      if (!s.date) continue;
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [workoutDays]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Resolve the effective schedule entry for a given date — daily
   * override wins, falling back to the day-of-week template.
   *
   * Returns:
   *   { source: "daily", entry }        — explicit daily_schedule row
   *   { source: "template", entry }     — from workout_schedule template
   *   { source: "empty" }               — unplanned
   */
  function effectiveForDate(
    iso: string
  ): {
    source: "daily" | "template" | "empty";
    isRest: boolean;
    workoutType: string | null;
    presetId: string | null;
  } {
    const daily = dailyByDate[iso];
    if (daily) {
      return {
        source: "daily",
        isRest: !!daily.is_rest,
        workoutType: daily.workout_type ?? null,
        presetId: daily.preset_id ?? null,
      };
    }
    const dow = new Date(iso + "T12:00:00").getDay();
    const tpl = templateByDow[dow];
    if (tpl && (tpl.is_rest || tpl.workout_type || tpl.preset_id)) {
      return {
        source: "template",
        isRest: !!tpl.is_rest,
        workoutType: tpl.workout_type ?? null,
        presetId: tpl.preset_id ?? null,
      };
    }
    return { source: "empty", isRest: false, workoutType: null, presetId: null };
  }

  // Save (or clear) a single date. `patch === null` deletes the override
  // so the cell falls back to the template again.
  async function saveDay(
    iso: string,
    patch: { is_rest: boolean; workout_type: string | null; preset_id: string | null } | null
  ) {
    if (tableMissing) {
      setToast(
        "Run supabase/migrations/add_daily_schedule.sql to enable per-date scheduling."
      );
      return;
    }
    setBusy(true);
    try {
      let res: Response;
      if (patch === null) {
        // Optimistic local removal
        setDailyByDate((cur) => {
          const next = { ...cur };
          delete next[iso];
          return next;
        });
        res = await fetch(`/api/daily-schedule?date=${iso}`, { method: "DELETE" });
      } else {
        // Optimistic local upsert
        setDailyByDate((cur) => ({
          ...cur,
          [iso]: {
            date: iso,
            is_rest: patch.is_rest,
            workout_type: patch.workout_type,
            preset_id: patch.preset_id,
          },
        }));
        res = await fetch("/api/daily-schedule", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: iso,
            is_rest: patch.is_rest,
            workout_type: patch.workout_type,
            preset_id: patch.preset_id,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setToast("Saved");
      // Surface daily_schedule's row back into Atlas / quests etc.
      router.refresh();
    } catch (e: any) {
      setToast(`Save failed: ${e?.message ?? "unknown"}`);
      // Reload week to sync with server on failure
      void refetchWeek(weekStartISO);
    } finally {
      setBusy(false);
    }
  }

  async function refetchWeek(start: string): Promise<void> {
    const end = addDaysISO(start, 6);
    try {
      const res = await fetch(
        `/api/daily-schedule?from=${start}&to=${end}`
      );
      const data = await res.json().catch(() => ({}));
      const rows: DailyEntry[] = Array.isArray(data?.days) ? data.days : [];
      setDailyByDate(buildDailyMap(rows));
    } catch {
      // keep current state
    }
  }

  async function navigateWeek(newOffset: number) {
    if (newOffset === weekOffset) return;
    setWeekOffset(newOffset);
    const newStart = isoForDate(weekStartFor(newOffset));
    await refetchWeek(newStart);
  }

  async function copyWeek(direction: "next" | "previous") {
    if (tableMissing) {
      setToast(
        "Run supabase/migrations/add_daily_schedule.sql to enable per-date scheduling."
      );
      return;
    }
    const targetStart = addDaysISO(
      weekStartISO,
      direction === "next" ? 7 : -7
    );
    if (
      !confirm(
        `Copy this week to the ${
          direction === "next" ? "next" : "previous"
        } week? Existing entries in the target week will be overwritten.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/daily-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "copy_week",
          source_start: weekStartISO,
          target_start: targetStart,
          overwrite: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setToast(
        `Copied ${data?.copied ?? 0} day${data?.copied === 1 ? "" : "s"} → ${
          direction === "next" ? "next" : "previous"
        } week`
      );
      router.refresh();
    } catch (e: any) {
      setToast(`Copy failed: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  // Today's day-of-week (0=Sun..6=Sat) for highlighting.
  const todayDow = useMemo(() => new Date().getDay(), []);
  // The date currently open in the planner popup (null = closed).
  const [openDate, setOpenDate] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2
          className="text-[12px] uppercase tracking-[0.22em] text-gold font-bold"
          style={fontDisplay}
        >
          My Week
        </h2>
        <button
          type="button"
          onClick={() => setMonthOpen(true)}
          className="text-muted hover:text-gold transition w-7 h-7 flex items-center justify-center rounded"
          title="Open monthly calendar"
          aria-label="Open monthly calendar"
        >
          <CalendarIcon size={14} />
        </button>
        <div className="rune-divider flex-1" />
        {busy && (
          <span
            className="text-[10px] uppercase tracking-[0.22em] text-muted/80"
            style={fontDisplay}
          >
            Saving…
          </span>
        )}
        {toast && !busy && (
          <span
            className="text-[10px] uppercase tracking-[0.22em] text-gold/85"
            style={fontDisplay}
          >
            {toast}
          </span>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={() => navigateWeek(weekOffset - 1)}
          className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted hover:text-gold transition flex items-center gap-1"
          style={fontDisplay}
          aria-label="Previous week"
        >
          ‹ Last Week
        </button>
        <div className="flex flex-col items-center leading-tight">
          <div
            className="text-[12px] uppercase tracking-[0.28em] font-bold flex items-center gap-2"
            style={{
              ...fontDisplay,
              color: weekOffset === 0 ? "#d4a020" : "#d8d2c2",
              textShadow:
                weekOffset === 0
                  ? "0 0 8px rgba(212,160,32,0.4)"
                  : undefined,
            }}
          >
            {weekOffsetLabel(weekOffset)}
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => navigateWeek(0)}
                className="text-[9px] uppercase tracking-[0.20em] text-muted hover:text-gold transition"
                style={fontDisplay}
                title="Jump back to this week"
              >
                · Today
              </button>
            )}
          </div>
          <div
            className="text-[10px] tracking-[0.18em] mt-0.5"
            style={{ ...fontDisplay, color: "rgba(216,210,194,0.55)" }}
          >
            {weekRangeLabel(weekStart)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigateWeek(weekOffset + 1)}
          className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted hover:text-gold transition flex items-center gap-1"
          style={fontDisplay}
          aria-label="Next week"
        >
          Next Week ›
        </button>
      </div>

      {/* Calendar box — 7 day cells with shared borders for the grid feel */}
      <div
        className="rounded-md overflow-hidden"
        style={{
          border: "1px solid rgba(107,79,58,0.55)",
          background: "rgba(12,12,24,0.65)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.5), 0 6px 18px rgba(0,0,0,0.45)",
        }}
      >
        <div className="grid grid-cols-7">
          {WEEK_ORDER.map((w, i) => {
            const cellDate = dateForCellByIndex(weekStart, i);
            const cellISO = isoForDate(cellDate);
            const effective = effectiveForDate(cellISO);
            const isRest = effective.isRest;
            const isEmpty = effective.source === "empty";
            const isTemplate = effective.source === "template";
            const linkedPreset = effective.presetId
              ? presetsById.get(effective.presetId)
              : null;
            const presetAccent = effective.presetId
              ? presetColorById.get(effective.presetId) ?? null
              : null;
            const theme = isEmpty
              ? {
                  bg: "rgba(20,14,30,0.30)",
                  border: "rgba(107,79,58,0.25)",
                  label: "Unplanned",
                  text: "#6a6478",
                }
              : isRest
              ? REST_THEME
              : linkedPreset && presetAccent
              ? {
                  bg: `${presetAccent}1f`,
                  border: `${presetAccent}66`,
                  label: linkedPreset.name,
                  text: "#f5efe2",
                }
              : {
                  bg: "rgba(184,134,11,0.10)",
                  border: "rgba(184,134,11,0.40)",
                  label: "Custom",
                  text: "#d4b6a6",
                };
            const isToday = cellISO === todayISOStr;
            const isPast = cellISO < todayISOStr;
            return (
              <button
                key={cellISO}
                type="button"
                onClick={() => {
                  // Past + today → workout detail popup. Future (and empty
                  // current/past) → date scheduler.
                  if (isPast || isToday) {
                    setDetailDate(cellISO);
                  } else {
                    setOpenDate(cellISO);
                  }
                }}
                className="relative flex flex-col items-center justify-start gap-2 px-1 py-3 transition hover:brightness-110"
                style={{
                  minHeight: 96,
                  background: theme.bg,
                  borderLeft:
                    i > 0 ? "1px solid rgba(107,79,58,0.30)" : undefined,
                  // Today gets a glowing inset highlight
                  boxShadow: isToday
                    ? "inset 0 0 0 2px #d4a020, inset 0 0 14px rgba(212,160,32,0.20)"
                    : `inset 0 0 0 1px ${theme.border}`,
                  cursor: "pointer",
                  opacity: isEmpty ? 0.6 : isRest ? 0.85 : 1,
                }}
                aria-label={`${w.full} ${cellISO}: ${
                  isEmpty ? "unplanned" : isRest ? "rest" : theme.label
                } (click to ${isPast || isToday ? "view" : "plan"})`}
                title={
                  isTemplate
                    ? `From default ${w.full} template — click to override for ${cellISO}`
                    : undefined
                }
              >
                {/* Day name + date */}
                <div
                  className="text-[10px] uppercase tracking-[0.22em] font-bold leading-none"
                  style={{
                    ...fontDisplay,
                    color: isToday ? "#f5d97a" : "#a89a85",
                    textShadow: isToday
                      ? "0 0 6px rgba(212,160,32,0.6)"
                      : undefined,
                  }}
                >
                  {w.short.toUpperCase()}
                </div>
                <div
                  className="text-[9px] tabular-nums leading-none -mt-0.5"
                  style={{
                    ...fontDisplay,
                    color: isToday ? "#f5d97a" : "rgba(216,210,194,0.5)",
                    letterSpacing: "0.10em",
                  }}
                >
                  {shortDateLabel(cellDate)}
                </div>
                {/* Workout label — preset name, REST, UNPLANNED, or CUSTOM */}
                <div className="flex items-center gap-1.5 mt-1 px-1 max-w-full">
                  {!isRest && !isEmpty && presetAccent && (
                    <span
                      aria-hidden
                      className="seal shrink-0"
                      style={{
                        width: 6,
                        height: 6,
                        background: presetAccent,
                        boxShadow: `0 0 4px ${presetAccent}`,
                      }}
                    />
                  )}
                  <div
                    className="text-[11px] uppercase tracking-[0.16em] font-bold leading-tight truncate"
                    style={{
                      ...fontDisplay,
                      color: theme.text,
                      fontStyle: isRest || isEmpty ? "italic" : undefined,
                    }}
                    title={isRest ? "Rest day" : theme.label}
                  >
                    {isEmpty ? "+ Plan" : isRest ? "Rest" : theme.label}
                  </div>
                </div>
                {/* Source marker — small dot in the upper-left when
                    pulled from the default template rather than an
                    explicit per-date assignment. */}
                {isTemplate && (
                  <span
                    aria-hidden
                    className="absolute top-1 left-1.5 text-[7px] uppercase font-bold leading-none"
                    style={{
                      ...fontDisplay,
                      letterSpacing: "0.14em",
                      color: "rgba(168,154,133,0.55)",
                    }}
                    title="From default weekly template"
                  >
                    TPL
                  </span>
                )}
                {isToday && (
                  <span
                    className="absolute top-1 right-1.5 text-[8px] font-bold leading-none"
                    style={{
                      ...fontDisplay,
                      letterSpacing: "0.18em",
                      color: "#f5d97a",
                      textShadow: "0 0 4px rgba(212,160,32,0.7)",
                    }}
                  >
                    TODAY
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Copy-week toolbar */}
      {!tableMissing && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => copyWeek("previous")}
            disabled={busy}
            className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted hover:text-gold transition disabled:opacity-40"
            style={fontDisplay}
            title="Copy this week's schedule to the previous week"
          >
            ← Copy to Last Week
          </button>
          <span className="text-muted/40">·</span>
          <button
            type="button"
            onClick={() => copyWeek("next")}
            disabled={busy}
            className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted hover:text-gold transition disabled:opacity-40"
            style={fontDisplay}
            title="Copy this week's schedule to the next week"
          >
            Copy to Next Week →
          </button>
        </div>
      )}

      {tableMissing && (
        <div
          className="mt-3 text-[11px] rounded p-2"
          style={{
            ...fontDisplay,
            background: "rgba(139,24,24,0.18)",
            border: "1px solid rgba(139,24,24,0.55)",
            color: "#fecaca",
          }}
        >
          ⚠ Per-date scheduling needs the <code>daily_schedule</code> table —
          run <code>supabase/migrations/add_daily_schedule.sql</code> in your
          Supabase SQL editor. Until then, this view shows the default weekly
          template only.
        </div>
      )}

      {toast && (
        <div
          className="mt-2 text-[10px] uppercase tracking-[0.22em] text-gold/85"
          style={fontDisplay}
        >
          {toast}
        </div>
      )}

      {/* Day picker popover — schedules a specific date */}
      {openDate !== null &&
        (() => {
          const dow = new Date(openDate + "T12:00:00").getDay();
          const eff = effectiveForDate(openDate);
          const full =
            WEEK_ORDER.find((w) => w.dow === dow)?.full ?? "";
          const current: ScheduleDayClient = {
            day_of_week: dow,
            is_rest: eff.isRest,
            workout_type: eff.workoutType,
            preset_id: eff.presetId,
          };
          const fromTemplate = eff.source === "template";
          return (
            <DayPickerModal
              dow={dow}
              fullName={full}
              isoDate={openDate}
              dateLabel={shortDateLabel(
                new Date(openDate + "T12:00:00")
              )}
              current={current}
              fromTemplate={fromTemplate}
              presets={presets}
              zoneLevels={zoneLevels}
              onSet={(patch) => {
                // Merge with the current effective values so the user
                // never wipes a field they didn't touch.
                const next = {
                  is_rest: patch.is_rest ?? eff.isRest,
                  workout_type:
                    patch.workout_type !== undefined
                      ? patch.workout_type
                      : eff.workoutType,
                  preset_id:
                    patch.preset_id !== undefined
                      ? patch.preset_id
                      : eff.presetId,
                };
                // If REST is toggled on, clear any preset/type so the
                // server-side row makes sense.
                if (next.is_rest) {
                  next.workout_type = null;
                  next.preset_id = null;
                }
                void saveDay(openDate, next);
              }}
              onClear={() => void saveDay(openDate, null)}
              onStartSession={() => {
                const presetId = eff.presetId;
                const p = presetId ? presetsById.get(presetId) : null;
                if (p) {
                  setOpenDate(null);
                  setSessionPreset(p);
                }
              }}
              onClose={() => setOpenDate(null)}
            />
          );
        })()}

      {monthOpen && (
        <MonthPlannerModal
          templateByDow={templateByDow}
          dailyByDate={dailyByDate}
          loggedDates={loggedDates}
          presets={presets}
          presetColorById={presetColorById}
          onSelectDay={(iso) => {
            setMonthOpen(false);
            setDetailDate(iso);
          }}
          onClose={() => setMonthOpen(false)}
        />
      )}

      {detailDate &&
        (() => {
          const eff = effectiveForDate(detailDate);
          const linkedPreset = eff.presetId
            ? presetsById.get(eff.presetId) ?? null
            : null;
          const accent = eff.presetId
            ? presetColorById.get(eff.presetId) ?? null
            : null;
          const dow = new Date(detailDate + "T12:00:00").getDay();
          const planned: ScheduleDayClient | null =
            eff.source === "empty"
              ? null
              : {
                  day_of_week: dow,
                  is_rest: eff.isRest,
                  workout_type: eff.workoutType,
                  preset_id: eff.presetId,
                };
          return (
            <WorkoutDayDetailModal
              userId={userId}
              date={detailDate}
              loggedSets={setsByDate.get(detailDate) ?? []}
              planned={planned}
              preset={linkedPreset}
              presetAccent={accent}
              isToday={detailDate === todayISOStr}
              onClose={() => setDetailDate(null)}
              onSetsChanged={() => router.refresh()}
              onLogRetroactive={() => {
                const target = detailDate;
                setDetailDate(null);
                onOpenLogForDate(target);
              }}
              onStartSession={() => {
                const p = linkedPreset;
                setDetailDate(null);
                if (p) setSessionPreset(p);
              }}
            />
          );
        })()}

      {sessionPreset && (
        <StartSessionModal
          userId={userId}
          preset={sessionPreset}
          lastByExercise={lastByExercise}
          onClose={() => setSessionPreset(null)}
          onSaved={() => {
            setSessionPreset(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

// ─── Day-picker popover for the weekly schedule ──────────────────
function DayPickerModal({
  dow,
  fullName,
  isoDate,
  dateLabel,
  current,
  fromTemplate,
  presets,
  zoneLevels,
  onSet,
  onClear,
  onStartSession,
  onClose,
}: {
  dow: number;
  fullName: string;
  isoDate?: string;
  dateLabel: string;
  current: ScheduleDayClient;
  /** True when `current` was inherited from the default weekly template
   *  rather than from a saved per-date override. */
  fromTemplate?: boolean;
  presets: WorkoutPreset[];
  zoneLevels: Record<Zone, StrengthLevel>;
  onSet: (patch: Partial<ScheduleDayClient>) => void;
  /** Optional — when present, the modal can offer a "Use template"
   *  button that removes the per-date override. */
  onClear?: () => void;
  onStartSession: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-5 w-full max-w-sm"
        style={{
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <div
              className="text-[9px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Schedule · {dateLabel}
            </div>
            <h3
              className="text-lg font-bold mt-0.5 text-ink"
              style={fontDisplay}
            >
              {fullName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Source banner — shows where the current values came from
            and gives a one-click way to drop a per-date override. */}
        {fromTemplate && (
          <div
            className="mb-3 rounded p-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em]"
            style={{
              ...fontDisplay,
              background: "rgba(184,134,11,0.08)",
              border: "1px solid rgba(184,134,11,0.30)",
              color: "rgba(232,213,163,0.75)",
            }}
          >
            <span>From default {fullName} template</span>
          </div>
        )}
        {!fromTemplate && onClear && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-gold transition"
              style={fontDisplay}
              title="Remove this per-date override and fall back to the default template"
            >
              ↺ Use Default Template
            </button>
          </div>
        )}

        {/* REST DAY button — full-width selector */}
        <button
          type="button"
          onClick={() =>
            onSet({ is_rest: true, workout_type: null, preset_id: null })
          }
          className="w-full mb-3 transition"
          style={{
            ...fontDisplay,
            fontSize: 12,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            fontWeight: 800,
            padding: "10px 14px",
            borderRadius: 4,
            background: current.is_rest
              ? "linear-gradient(180deg, #6b4f3a 0%, #3a2a18 100%)"
              : "rgba(20,14,30,0.55)",
            color: current.is_rest ? "#f5e6c4" : "#9a9282",
            border: `1px solid ${
              current.is_rest
                ? "rgba(184,134,11,0.55)"
                : "rgba(107,79,58,0.45)"
            }`,
            boxShadow: current.is_rest
              ? "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.35), 0 0 10px rgba(184,134,11,0.20)"
              : "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          Rest Day
        </button>

        {/* Divider */}
        <div className="relative flex items-center my-3">
          <div className="flex-1 h-px bg-bronze-deep/40" />
          <span
            className="px-3 text-[9px] uppercase tracking-[0.32em] text-muted/70"
            style={fontDisplay}
          >
            or pick a workout
          </span>
          <div className="flex-1 h-px bg-bronze-deep/40" />
        </div>

        {/* Preset cards — clicking selects the preset for this day */}
        {presets.length === 0 ? (
          <p
            className="text-[11px] text-muted italic text-center py-2"
            style={fontDisplay}
          >
            No presets yet. Create one in My Presets, or pick Custom below.
          </p>
        ) : (
          <ul className="space-y-2">
            {presets.map((p, i) => {
              const accent = presetColor(i);
              const active =
                !current.is_rest && current.preset_id === p.id;
              const previewExercises = p.exercises
                .slice(0, 3)
                .map((e) => e.exerciseName);
              const remaining = Math.max(0, p.exercises.length - 3);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onSet({
                        is_rest: false,
                        workout_type: "custom",
                        preset_id: p.id,
                      })
                    }
                    className="w-full text-left transition hover:brightness-110"
                    style={{
                      padding: "10px 12px 10px 14px",
                      background: active
                        ? `linear-gradient(90deg, ${accent}40 0%, ${accent}15 100%)`
                        : `linear-gradient(90deg, ${accent}1a 0%, ${accent}08 100%)`,
                      borderTop: `1px solid ${accent}55`,
                      borderRight: `1px solid ${accent}55`,
                      borderBottom: `1px solid ${accent}55`,
                      borderLeft: `4px solid ${accent}`,
                      borderRadius: 4,
                      boxShadow: active
                        ? `inset 0 0 12px ${accent}40, 0 0 8px ${accent}33`
                        : undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-[13px] font-bold tracking-tight truncate"
                        style={{
                          ...fontDisplay,
                          color: "#f5efe2",
                          textShadow: "0 1px 0 rgba(0,0,0,0.5)",
                        }}
                      >
                        {p.name}
                      </span>
                      <span
                        className="text-[9px] uppercase tracking-[0.20em] shrink-0"
                        style={{
                          ...fontDisplay,
                          color: "rgba(245,239,226,0.55)",
                        }}
                      >
                        {p.exercises.length} ex
                        {active ? " · selected" : ""}
                      </span>
                    </div>
                    <div
                      className="text-[10.5px] truncate mt-0.5"
                      style={{
                        color: "rgba(245,239,226,0.70)",
                      }}
                    >
                      {previewExercises.length > 0
                        ? previewExercises.join(" · ")
                        : "No exercises yet"}
                      {remaining > 0 && (
                        <span style={{ color: "rgba(245,239,226,0.45)" }}>
                          {" "}
                          + {remaining} more
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Custom / No Preset — bottom option */}
        {(() => {
          const customActive =
            !current.is_rest && !current.preset_id;
          return (
            <button
              type="button"
              onClick={() =>
                onSet({
                  is_rest: false,
                  workout_type: "custom",
                  preset_id: null,
                })
              }
              className="w-full mt-3 transition"
              style={{
                ...fontDisplay,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 800,
                padding: "10px 14px",
                borderRadius: 4,
                background: customActive
                  ? "rgba(184,134,11,0.18)"
                  : "rgba(20,14,30,0.55)",
                color: customActive ? "#f0d68f" : "#9a9282",
                border: `1px dashed ${
                  customActive
                    ? "rgba(184,134,11,0.65)"
                    : "rgba(107,79,58,0.50)"
                }`,
              }}
            >
              Custom / No Preset
            </button>
          );
        })()}

        {/* Smart suggestions — when Custom is selected */}
        {!current.is_rest &&
          !current.preset_id &&
          (() => {
            const suggestions = buildSmartSuggestions(
              "custom",
              zoneLevels
            );
            if (suggestions.length === 0) return null;
            return (
              <div
                className="mt-3 rounded p-3"
                style={{
                  background: "rgba(20,14,30,0.55)",
                  border: "1px solid rgba(184,134,11,0.35)",
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.22em] mb-2 font-bold flex items-center gap-2"
                  style={{ ...fontDisplay, color: "#d4a020" }}
                >
                  <span aria-hidden>✦</span>
                  Suggested by Atlas
                </div>
                <ul className="space-y-1.5">
                  {suggestions.map((s) => {
                    const lvlLabel = LEVEL_LABEL[s.level];
                    const lvlColor = LEVEL_COLOR[s.level];
                    return (
                      <li key={`${s.zone}-${s.exercise}`}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            router.push(
                              `/lifting?zone=${encodeURIComponent(
                                s.zone
                              )}&exercise=${encodeURIComponent(s.exercise)}`
                            );
                          }}
                          className="lift w-full text-left rounded border border-bronze-deep/40 hover:border-bronze transition px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="seal shrink-0"
                              style={{
                                width: 6,
                                height: 6,
                                background: lvlColor,
                              }}
                            />
                            <span
                              className="text-[12px] text-ink truncate flex-1"
                              style={{ fontFamily: "inherit" }}
                            >
                              {s.exercise}
                            </span>
                            <span
                              className="text-[9px] uppercase tracking-[0.16em] whitespace-nowrap"
                              style={{
                                ...fontDisplay,
                                color: lvlColor,
                              }}
                            >
                              {ZONE_LABEL[s.zone]} · {lvlLabel}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

        {/* Start session — when this day has a linked preset */}
        {!current.is_rest && current.preset_id && (
          <button
            type="button"
            onClick={onStartSession}
            className="w-full mt-4 transition hover:brightness-110 active:translate-y-px"
            style={{
              ...fontDisplay,
              fontSize: 12,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "#f5efe2",
              padding: "10px 14px",
              borderRadius: 4,
              background:
                "linear-gradient(180deg, #7747b0 0%, #3a2466 100%)",
              border: "1px solid #7747b0",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.30), 0 0 12px rgba(119,71,176,0.55)",
            }}
          >
            Start Session
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-stone btn-stone-ghost w-full mt-3 text-[11px]"
          style={{ padding: "0.6rem 0.9rem" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Day-detail popup ─────────────────────────────────────────────
// Read-only view of what was logged on a given date, or the planned
// workout if nothing was logged. Triggered from any past/today cell
// in My Week or the Monthly Planner.
type EditingState = {
  exercise: string;
  muscleGroup: string;
  rows: Array<{
    setId: string | null; // null = new set not yet inserted
    weight: string;
    reps: string;
    sets: string;
    deleted?: boolean;
  }>;
};

function WorkoutDayDetailModal({
  userId,
  date,
  loggedSets,
  planned,
  preset,
  presetAccent,
  isToday,
  onClose,
  onSetsChanged,
  onLogRetroactive,
  onStartSession,
}: {
  userId: string;
  date: string;
  loggedSets: WorkoutDaySet[];
  planned: ScheduleDayClient | null;
  preset: WorkoutPreset | null;
  presetAccent: string | null;
  isToday: boolean;
  onClose: () => void;
  onSetsChanged: () => void;
  onLogRetroactive: () => void;
  onStartSession: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  // Local mutable copy so the popup updates immediately after edits
  // without waiting for the page-level router.refresh roundtrip.
  const [localSets, setLocalSets] = useState<WorkoutDaySet[]>(loggedSets);
  useEffect(() => setLocalSets(loggedSets), [loggedSets]);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [innerToast, setInnerToast] = useState<string | null>(null);
  useEffect(() => {
    if (!innerToast) return;
    const t = setTimeout(() => setInnerToast(null), 1500);
    return () => clearTimeout(t);
  }, [innerToast]);

  // Re-fetch this day's sets from the DB so the popup mirrors what
  // actually persisted (used after every mutation).
  async function refetchDay() {
    const { data, error } = await supabase
      .from("workout_sets")
      .select(
        "id, workout_id, exercise_name, muscle_group, weight_lbs, reps, sets, workouts!inner(user_id, date)"
      )
      .eq("workouts.user_id", userId)
      .eq("workouts.date", date);
    if (error) {
      console.warn("[refetchDay] error:", error.message);
      return;
    }
    const fresh: WorkoutDaySet[] = (data ?? []).map((r: any) => ({
      workoutId: String(r.workout_id ?? ""),
      setId: String(r.id ?? ""),
      exercise: String(r.exercise_name ?? ""),
      muscleGroup: String(r.muscle_group ?? ""),
      weight: Number(r.weight_lbs ?? 0),
      reps: Number(r.reps ?? 0),
      sets: Number(r.sets ?? 0),
      date,
    }));
    setLocalSets(fresh);
    onSetsChanged();
  }

  // Find or create a workout row for this date so we have a workout_id
  // to attach new sets to.
  async function ensureWorkoutId(): Promise<string | null> {
    const existing = await supabase
      .from("workouts")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!existing.error && existing.data && existing.data.length > 0) {
      return String(existing.data[0].id);
    }
    const created = await supabase
      .from("workouts")
      .insert({ user_id: userId, date, notes: null })
      .select("id")
      .single();
    if (created.error) {
      console.error("[ensureWorkoutId] failed:", created.error.message);
      return null;
    }
    return String(created.data.id);
  }

  function startEdit(group: { exercise: string; muscleGroup: string; rows: WorkoutDaySet[] }) {
    setAdding(false);
    setEditing({
      exercise: group.exercise,
      muscleGroup: group.muscleGroup,
      rows: group.rows.map((r) => ({
        setId: r.setId,
        weight: String(r.weight),
        reps: String(r.reps),
        sets: String(r.sets),
      })),
    });
  }

  function patchEditRow(idx: number, patch: Partial<EditingState["rows"][number]>) {
    setEditing((cur) =>
      cur
        ? {
            ...cur,
            rows: cur.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
          }
        : cur
    );
  }

  function addEditRow() {
    setEditing((cur) =>
      cur
        ? {
            ...cur,
            rows: [
              ...cur.rows,
              { setId: null, weight: "", reps: "", sets: "" },
            ],
          }
        : cur
    );
  }

  function markEditRowDeleted(idx: number) {
    setEditing((cur) => {
      if (!cur) return cur;
      const target = cur.rows[idx];
      // Brand-new (unsaved) rows can be removed outright.
      if (!target.setId) {
        return { ...cur, rows: cur.rows.filter((_, i) => i !== idx) };
      }
      return {
        ...cur,
        rows: cur.rows.map((r, i) =>
          i === idx ? { ...r, deleted: true } : r
        ),
      };
    });
  }

  async function commitEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      const exerciseLookup = new Map(
        EXERCISE_OPTIONS.map((e) => [e.name, e])
      );
      let workoutId: string | null = null;

      for (const r of editing.rows) {
        const w = Number(r.weight);
        const reps = Number(r.reps);
        const sets = Number(r.sets);
        if (r.deleted && r.setId) {
          const del = await supabase
            .from("workout_sets")
            .delete()
            .eq("id", r.setId);
          if (del.error) throw del.error;
        } else if (r.setId) {
          if (!(w > 0 && reps > 0 && sets > 0)) continue;
          const upd = await supabase
            .from("workout_sets")
            .update({
              weight_lbs: w,
              reps,
              sets,
            })
            .eq("id", r.setId);
          if (upd.error) throw upd.error;
        } else if (!r.deleted && w > 0 && reps > 0 && sets > 0) {
          if (!workoutId) {
            workoutId = await ensureWorkoutId();
            if (!workoutId) throw new Error("Could not create workout row");
          }
          const ex = exerciseLookup.get(editing.exercise);
          const ins = await supabase.from("workout_sets").insert({
            workout_id: workoutId,
            exercise_name: editing.exercise,
            muscle_group: editing.muscleGroup,
            weight_lbs: w,
            reps,
            sets,
            primary_muscle: ex?.muscles?.[0] ?? null,
          });
          if (ins.error) {
            // Older DB without primary_muscle column — retry without it.
            const code = (ins.error as any).code;
            if (
              code === "42703" ||
              code === "PGRST204" ||
              /primary_muscle/i.test(ins.error.message ?? "")
            ) {
              const retry = await supabase.from("workout_sets").insert({
                workout_id: workoutId,
                exercise_name: editing.exercise,
                muscle_group: editing.muscleGroup,
                weight_lbs: w,
                reps,
                sets,
              });
              if (retry.error) throw retry.error;
            } else {
              throw ins.error;
            }
          }
        }
      }

      setEditing(null);
      setInnerToast("Saved");
      await refetchDay();
    } catch (e: any) {
      setInnerToast(`Save failed: ${e?.message ?? "unknown"}`);
      console.error("[commitEdit]", e);
    } finally {
      setBusy(false);
    }
  }

  async function deleteExercise(exercise: string) {
    const setIds = localSets
      .filter((s) => s.exercise === exercise)
      .map((s) => s.setId);
    if (setIds.length === 0) return;
    if (
      !window.confirm(
        `Remove all ${setIds.length} set${
          setIds.length === 1 ? "" : "s"
        } for "${exercise}"?`
      )
    )
      return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .in("id", setIds);
      if (error) throw error;
      setInnerToast("Deleted");
      if (editing?.exercise === exercise) setEditing(null);
      await refetchDay();
    } catch (e: any) {
      setInnerToast(`Delete failed: ${e?.message ?? "unknown"}`);
      console.error("[deleteExercise]", e);
    } finally {
      setBusy(false);
    }
  }

  // Add-exercise form state
  const [addZone, setAddZone] = useState<Zone | "">("");
  const [addExName, setAddExName] = useState("");
  const [addWeight, setAddWeight] = useState("");
  const [addReps, setAddReps] = useState("");
  const [addSets, setAddSets] = useState("");
  const addExerciseList = useMemo(
    () => (addZone ? exercisesForZone(addZone) : []),
    [addZone]
  );
  function resetAddForm() {
    setAddZone("");
    setAddExName("");
    setAddWeight("");
    setAddReps("");
    setAddSets("");
  }
  async function commitAdd() {
    const w = Number(addWeight);
    const reps = Number(addReps);
    const sets = Number(addSets);
    if (!addZone || !addExName || w <= 0 || reps <= 0 || sets <= 0) {
      setInnerToast("Fill all fields with values > 0");
      return;
    }
    setBusy(true);
    try {
      const workoutId = await ensureWorkoutId();
      if (!workoutId) throw new Error("Could not create workout row");
      const ex = EXERCISE_OPTIONS.find((e) => e.name === addExName);
      const ins = await supabase.from("workout_sets").insert({
        workout_id: workoutId,
        exercise_name: addExName,
        muscle_group: addZone,
        weight_lbs: w,
        reps,
        sets,
        primary_muscle: ex?.muscles?.[0] ?? null,
      });
      if (ins.error) {
        const code = (ins.error as any).code;
        if (
          code === "42703" ||
          code === "PGRST204" ||
          /primary_muscle/i.test(ins.error.message ?? "")
        ) {
          const retry = await supabase.from("workout_sets").insert({
            workout_id: workoutId,
            exercise_name: addExName,
            muscle_group: addZone,
            weight_lbs: w,
            reps,
            sets,
          });
          if (retry.error) throw retry.error;
        } else {
          throw ins.error;
        }
      }
      setInnerToast("Added");
      setAdding(false);
      resetAddForm();
      await refetchDay();
    } catch (e: any) {
      setInnerToast(`Add failed: ${e?.message ?? "unknown"}`);
      console.error("[commitAdd]", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const longLabel = useMemo(() => {
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [date]);

  // Group logged sets by exercise (driven by localSets so edits show up
  // immediately after a save without waiting for parent refresh).
  const byExercise = useMemo(() => {
    const m = new Map<
      string,
      {
        exercise: string;
        muscleGroup: string;
        rows: WorkoutDaySet[];
        volume: number;
        totalSets: number;
      }
    >();
    for (const s of localSets) {
      const key = s.exercise;
      const cur =
        m.get(key) ??
        {
          exercise: s.exercise,
          muscleGroup: s.muscleGroup,
          rows: [],
          volume: 0,
          totalSets: 0,
        };
      cur.rows.push(s);
      cur.volume += s.weight * s.reps * s.sets;
      cur.totalSets += s.sets;
      m.set(key, cur);
    }
    return Array.from(m.values());
  }, [localSets]);

  const totalSets = byExercise.reduce((acc, e) => acc + e.totalSets, 0);
  const muscles = useMemo(() => {
    const s = new Set<string>();
    for (const e of byExercise) if (e.muscleGroup) s.add(e.muscleGroup);
    return Array.from(s);
  }, [byExercise]);

  const hasLogged = byExercise.length > 0;
  const status = hasLogged
    ? "logged"
    : isToday
    ? "today-empty"
    : planned?.is_rest
    ? "rest"
    : "missed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="day-detail-modal relative w-full"
        style={{
          maxWidth: 480,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: "var(--noise-bg), #0a0a14",
          color: "#d8d2c2",
          border: "1px solid rgba(107,79,58,0.55)",
          borderTop: presetAccent
            ? `4px solid ${presetAccent}`
            : "4px solid rgba(184,134,11,0.55)",
          borderRadius: 6,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
          padding: "20px 22px",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div
              className="text-[9px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              {isToday ? "Today" : "Past Day"}
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink truncate"
              style={fontDisplay}
            >
              {longLabel}
            </h2>
            {/* Planned line */}
            {planned && !planned.is_rest && (
              <div
                className="text-[11px] mt-1 inline-flex items-center gap-2"
                style={{
                  ...fontDisplay,
                  color: "rgba(216,210,194,0.65)",
                }}
              >
                {presetAccent && (
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: presetAccent,
                      boxShadow: `0 0 4px ${presetAccent}`,
                    }}
                  />
                )}
                Planned: {preset?.name ?? "Custom"}
              </div>
            )}
            {planned?.is_rest && (
              <div
                className="text-[11px] mt-1 italic"
                style={{
                  ...fontDisplay,
                  color: "rgba(155,146,130,0.85)",
                }}
              >
                Planned: Rest day
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status badge */}
            {status === "logged" && (
              <CheckIcon size={18} color="#22c55e" />
            )}
            {status === "missed" && (
              <span
                className="text-[16px]"
                style={{ color: "#d4a020" }}
                aria-label="Nothing logged"
              >
                ⚠
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="h-px mb-4"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(184,134,11,0.5) 50%, transparent)",
          }}
        />

        {/* Body */}
        {hasLogged ? (
          <>
            <div
              className="text-[10px] uppercase tracking-[0.24em] mb-3 font-bold"
              style={{ ...fontDisplay, color: "#d4a020" }}
            >
              What You Did
            </div>
            <ul className="space-y-3">
              {byExercise.map((g) => {
                const isEditing = editing?.exercise === g.exercise;
                return (
                  <li
                    key={g.exercise}
                    className="rounded p-3"
                    style={{
                      background: "rgba(20,14,30,0.55)",
                      border: isEditing
                        ? "1px solid rgba(168,85,247,0.55)"
                        : "1px solid rgba(107,79,58,0.30)",
                      boxShadow: isEditing
                        ? "0 0 12px rgba(168,85,247,0.20)"
                        : undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div
                        className="font-bold text-[13px] truncate flex-1"
                        style={{ ...fontDisplay, color: "#f5efe2" }}
                      >
                        {g.exercise}
                      </div>
                      <div
                        className="text-[9px] uppercase tracking-[0.18em] shrink-0"
                        style={{
                          ...fontDisplay,
                          color: zoneDotColor(g.muscleGroup),
                        }}
                      >
                        {ZONE_LABEL[g.muscleGroup as Zone] ?? g.muscleGroup}
                      </div>
                      {/* Edit/Delete pencil + trash */}
                      {!isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(g)}
                            disabled={busy}
                            className="w-6 h-6 flex items-center justify-center transition hover:brightness-125 disabled:opacity-40"
                            title="Edit sets"
                            aria-label={`Edit ${g.exercise}`}
                            style={{ color: "rgba(216,210,194,0.65)" }}
                          >
                            <PencilGlyph />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExercise(g.exercise)}
                            disabled={busy}
                            className="w-6 h-6 flex items-center justify-center transition hover:brightness-125 disabled:opacity-40"
                            title={`Delete all sets for ${g.exercise}`}
                            aria-label={`Delete ${g.exercise}`}
                            style={{ color: "rgba(220,80,80,0.65)" }}
                          >
                            <TrashGlyph />
                          </button>
                        </>
                      )}
                    </div>

                    {isEditing && editing ? (
                      <div className="space-y-2">
                        {editing.rows.map((r, idx) => {
                          if (r.deleted) return null;
                          return (
                            <div
                              key={`edit-${idx}`}
                              className="grid grid-cols-[1fr_8px_1fr_8px_1fr_28px] gap-1.5 items-center"
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={r.weight}
                                onChange={(e) =>
                                  patchEditRow(idx, { weight: e.target.value })
                                }
                                className="w-full text-[12px] text-center tabular-nums"
                                style={{ minHeight: 32, padding: "4px 6px" }}
                                aria-label="Weight"
                                placeholder="lb"
                              />
                              <span
                                className="text-center text-muted/70"
                                aria-hidden
                              >
                                ×
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={r.reps}
                                onChange={(e) =>
                                  patchEditRow(idx, { reps: e.target.value })
                                }
                                className="w-full text-[12px] text-center tabular-nums"
                                style={{ minHeight: 32, padding: "4px 6px" }}
                                aria-label="Reps"
                                placeholder="reps"
                              />
                              <span
                                className="text-center text-muted/70"
                                aria-hidden
                              >
                                ×
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={r.sets}
                                onChange={(e) =>
                                  patchEditRow(idx, { sets: e.target.value })
                                }
                                className="w-full text-[12px] text-center tabular-nums"
                                style={{ minHeight: 32, padding: "4px 6px" }}
                                aria-label="Sets"
                                placeholder="sets"
                              />
                              <button
                                type="button"
                                onClick={() => markEditRowDeleted(idx)}
                                className="w-7 h-7 flex items-center justify-center rounded transition hover:brightness-125"
                                title="Remove this set"
                                aria-label="Remove set"
                                style={{ color: "rgba(220,80,80,0.75)" }}
                              >
                                <TrashGlyph />
                              </button>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={addEditRow}
                            disabled={busy}
                            className="text-[10px] uppercase tracking-[0.18em] py-1.5 px-3 rounded border border-bronze-deep/50 text-muted hover:text-gold hover:border-bronze transition disabled:opacity-40"
                            style={fontDisplay}
                          >
                            + Add Set
                          </button>
                          <div className="flex-1" />
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            disabled={busy}
                            className="text-[10px] uppercase tracking-[0.18em] py-1.5 px-3 rounded text-muted hover:text-ink transition disabled:opacity-40"
                            style={fontDisplay}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={commitEdit}
                            disabled={busy}
                            className="text-[10px] uppercase tracking-[0.20em] py-1.5 px-4 rounded font-bold transition hover:brightness-110 disabled:opacity-40"
                            style={{
                              ...fontDisplay,
                              color: "#f5efe2",
                              background:
                                "linear-gradient(180deg, #7747b0, #3a2466)",
                              border: "1px solid #7747b0",
                              boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 8px rgba(119,71,176,0.45)",
                            }}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-0.5">
                          {g.rows.map((r, i) => (
                            <li
                              key={`${r.setId}-${i}`}
                              className="text-[12px] tabular-nums flex items-center gap-2"
                              style={{ color: "rgba(216,210,194,0.85)" }}
                            >
                              <span
                                aria-hidden
                                style={{
                                  color: "rgba(184,134,11,0.65)",
                                  fontFamily:
                                    "var(--font-cinzel), Georgia, serif",
                                }}
                              >
                                →
                              </span>
                              <span
                                style={{ color: "#f5efe2", fontWeight: 600 }}
                              >
                                {r.weight} × {r.reps}
                              </span>
                              <span
                                style={{ color: "rgba(216,210,194,0.55)" }}
                              >
                                ×{r.sets} set{r.sets === 1 ? "" : "s"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div
                          className="text-[10px] uppercase tracking-[0.20em] mt-2 font-semibold"
                          style={{ ...fontDisplay, color: "#b8860b" }}
                        >
                          Volume:{" "}
                          <span className="tabular-nums">
                            {Math.round(g.volume).toLocaleString()} lb
                          </span>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Totals + muscles */}
            <div
              className="mt-4 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.22em]"
              style={{ ...fontDisplay, color: "rgba(216,210,194,0.7)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: "#9a9282" }}>Exercises</span>
                <span
                  className="tabular-nums font-bold"
                  style={{ color: "#f5efe2" }}
                >
                  {byExercise.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: "#9a9282" }}>Total sets</span>
                <span
                  className="tabular-nums font-bold"
                  style={{ color: "#f5efe2" }}
                >
                  {totalSets}
                </span>
              </div>
            </div>
            {muscles.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span
                  className="text-[9px] uppercase tracking-[0.22em]"
                  style={{ ...fontDisplay, color: "#9a9282" }}
                >
                  Muscles trained:
                </span>
                {muscles.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 text-[10px]"
                    style={{
                      ...fontDisplay,
                      color: "rgba(216,210,194,0.8)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: zoneDotColor(m),
                        boxShadow: `0 0 4px ${zoneDotColor(m)}`,
                      }}
                    />
                    {ZONE_LABEL[m as Zone] ?? m}
                  </span>
                ))}
              </div>
            )}

            {/* Add Exercise — inline form or trigger button */}
            <div className="mt-4">
              {adding ? (
                <div
                  className="rounded p-3 space-y-2"
                  style={{
                    background: "rgba(20,14,30,0.55)",
                    border: "1px solid rgba(184,134,11,0.45)",
                    boxShadow: "0 0 10px rgba(184,134,11,0.10)",
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-[0.22em] font-bold"
                    style={{ ...fontDisplay, color: "#d4a020" }}
                  >
                    Add Exercise
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={addZone}
                      onChange={(e) => {
                        setAddZone((e.target.value || "") as Zone | "");
                        setAddExName("");
                      }}
                      className="w-full text-[12px]"
                      style={{ minHeight: 32 }}
                    >
                      <option value="">Muscle group</option>
                      {ZONES.map((z) => (
                        <option key={z} value={z}>
                          {ZONE_LABEL[z]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={addExName}
                      onChange={(e) => setAddExName(e.target.value)}
                      disabled={!addZone}
                      className="w-full text-[12px]"
                      style={{ minHeight: 32 }}
                    >
                      <option value="">Exercise</option>
                      {addExerciseList.map((ex) => (
                        <option key={ex.name} value={ex.name}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={addWeight}
                      onChange={(e) => setAddWeight(e.target.value)}
                      placeholder="Weight"
                      className="w-full text-[12px] text-center tabular-nums"
                      style={{ minHeight: 32 }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={addReps}
                      onChange={(e) => setAddReps(e.target.value)}
                      placeholder="Reps"
                      className="w-full text-[12px] text-center tabular-nums"
                      style={{ minHeight: 32 }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={addSets}
                      onChange={(e) => setAddSets(e.target.value)}
                      placeholder="Sets"
                      className="w-full text-[12px] text-center tabular-nums"
                      style={{ minHeight: 32 }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        resetAddForm();
                      }}
                      disabled={busy}
                      className="text-[10px] uppercase tracking-[0.18em] py-1.5 px-3 rounded text-muted hover:text-ink transition disabled:opacity-40"
                      style={fontDisplay}
                    >
                      Cancel
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={commitAdd}
                      disabled={busy}
                      className="text-[10px] uppercase tracking-[0.20em] py-1.5 px-4 rounded font-bold transition hover:brightness-110 disabled:opacity-40"
                      style={{
                        ...fontDisplay,
                        color: "#f5efe2",
                        background:
                          "linear-gradient(180deg, #7747b0, #3a2466)",
                        border: "1px solid #7747b0",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 8px rgba(119,71,176,0.45)",
                      }}
                    >
                      {busy ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(true);
                  }}
                  disabled={busy}
                  className="w-full transition hover:brightness-110"
                  style={{
                    ...fontDisplay,
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                    padding: "10px 14px",
                    borderRadius: 4,
                    background: "rgba(184,134,11,0.10)",
                    border: "1px dashed rgba(184,134,11,0.55)",
                    color: "#d4a020",
                  }}
                >
                  + Add Exercise
                </button>
              )}
            </div>

            {innerToast && (
              <div
                className="mt-3 text-center text-[11px] uppercase tracking-[0.20em]"
                style={{ ...fontDisplay, color: "#d4a020" }}
              >
                {innerToast}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-3">
            <p
              className="text-[13px] italic mb-3"
              style={{ ...fontDisplay, color: "rgba(216,210,194,0.7)" }}
            >
              {status === "rest"
                ? "Rest day — nothing planned, nothing logged."
                : status === "today-empty"
                ? "No exercises logged yet today."
                : "No workout logged this day."}
            </p>
            {/* Action button */}
            {isToday && preset ? (
              <button
                type="button"
                onClick={onStartSession}
                className="w-full transition hover:brightness-110 active:translate-y-px"
                style={{
                  ...fontDisplay,
                  fontSize: 12,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  color: "#f5efe2",
                  padding: "10px 14px",
                  borderRadius: 4,
                  background:
                    "linear-gradient(180deg, #7747b0 0%, #3a2466 100%)",
                  border: "1px solid #7747b0",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.30), 0 0 12px rgba(119,71,176,0.55)",
                }}
              >
                Start Session
              </button>
            ) : (
              !planned?.is_rest && (
                <button
                  type="button"
                  onClick={onLogRetroactive}
                  className="w-full transition hover:brightness-110 active:translate-y-px"
                  style={{
                    ...fontDisplay,
                    fontSize: 12,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                    color: "#f5efe2",
                    padding: "10px 14px",
                    borderRadius: 4,
                    background:
                      "linear-gradient(180deg, #b8860b 0%, #6a4f08 100%)",
                    border: "1px solid #b8860b",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.30), 0 0 12px rgba(184,134,11,0.45)",
                  }}
                >
                  {isToday ? "Log Session" : "Log Retroactively"}
                </button>
              )
            )}
          </div>
        )}

        {/* Slide-up animation on mobile */}
        <style jsx>{`
          .day-detail-modal {
            animation: dayDetailFadeIn 200ms ease-out;
          }
          @keyframes dayDetailFadeIn {
            from {
              opacity: 0;
              transform: translateY(12px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @media (max-width: 640px) {
            .day-detail-modal {
              animation: dayDetailSlideUp 240ms cubic-bezier(0.34, 1.4, 0.64, 1);
            }
            @keyframes dayDetailSlideUp {
              from {
                opacity: 0;
                transform: translateY(40px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          }
        `}</style>
      </div>
    </div>
  );
}

// Color per muscle group for the dot indicators (reused from Dashboard).
function zoneDotColor(zone: string): string {
  const map: Record<string, string> = {
    chest: "#a855f7",
    back: "#3a5a8a",
    shoulders: "#f59e0b",
    biceps: "#22c55e",
    triceps: "#ef4444",
    forearms: "#8b7355",
    abs: "#a0432a",
    quads: "#5b3993",
    hamstrings: "#3b82f6",
    glutes: "#a83232",
    calves: "#3d6b3a",
  };
  return map[zone] ?? "#5a5246";
}

// ─── Monthly planner modal ────────────────────────────────────────
// Bird's-eye view of the current week template projected across the
// whole month, with logged-vs-planned markers per day.
function MonthPlannerModal({
  templateByDow,
  dailyByDate,
  loggedDates,
  presets,
  presetColorById,
  onSelectDay,
  onClose,
}: {
  templateByDow: Record<number, ScheduleDayClient>;
  /** Daily overrides for the *current* week (already loaded). The
   *  month view fetches its own wider range and merges this in. */
  dailyByDate: Record<string, DailyEntry>;
  loggedDates: Set<string>;
  presets: WorkoutPreset[];
  presetColorById: Map<string, string>;
  onSelectDay: (iso: string) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayISOStr = useMemo(() => isoForDate(today), [today]);
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  // Month-wide daily overrides. Fetched lazily whenever the viewed
  // month changes. Falls back to the seed `dailyByDate` (the week
  // the user already had open) so something useful renders before
  // the fetch resolves.
  const [monthDaily, setMonthDaily] = useState<Record<string, DailyEntry>>(
    () => ({ ...dailyByDate })
  );
  const presetsById = useMemo(() => {
    const m = new Map<string, WorkoutPreset>();
    for (const p of presets) m.set(p.id, p);
    return m;
  }, [presets]);

  useEffect(() => {
    const start = `${view.year}-${String(view.month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(view.year, view.month + 1, 0).getDate();
    const end = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;
    let cancelled = false;
    fetch(`/api/daily-schedule?from=${start}&to=${end}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const rows: DailyEntry[] = Array.isArray(data?.days) ? data.days : [];
        const next: Record<string, DailyEntry> = { ...dailyByDate };
        for (const r of rows) next[r.date] = r;
        setMonthDaily(next);
      })
      .catch(() => {
        // Keep whatever we already had; the seed dailyByDate is at least
        // partially correct.
      });
    return () => {
      cancelled = true;
    };
  }, [view.year, view.month, dailyByDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );
  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-5 w-full max-w-lg"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <div
              className="text-[9px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Monthly Plan
            </div>
            <h3
              className="text-lg font-bold mt-0.5 text-ink flex items-center gap-3"
              style={fontDisplay}
            >
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="text-muted hover:text-ink w-6 h-6 flex items-center justify-center text-base"
                aria-label="Previous month"
              >
                ‹
              </button>
              {monthLabel}
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="text-muted hover:text-ink w-6 h-6 flex items-center justify-center text-base"
                aria-label="Next month"
              >
                ›
              </button>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="text-[9px] uppercase tracking-[0.18em] text-muted/60 text-center py-1"
              style={fontDisplay}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell) {
              return (
                <div
                  key={i}
                  style={{ aspectRatio: "1 / 1", minHeight: 44 }}
                />
              );
            }
            // Daily override wins, otherwise fall back to the weekly template.
            const daily = monthDaily[cell.iso];
            const tpl = templateByDow[cell.dow];
            const day = daily ?? tpl;
            const isRest = !!day?.is_rest;
            // Preset accent (per-preset color), if a preset is linked.
            const linkedPreset = day?.preset_id
              ? presetsById.get(day.preset_id) ?? null
              : null;
            const presetAccent = day?.preset_id
              ? presetColorById.get(day.preset_id) ?? null
              : null;
            // `planned` provides the bg/border tint when no preset
            // accent is available. Preset-linked cells override with
            // the preset's own color further down.
            const planned = !isRest && day?.workout_type
              ? TYPE_THEME[day.workout_type]
              : null;
            const logged = loggedDates.has(cell.iso);
            const isToday = cell.iso === todayISOStr;
            const isPast = cell.iso < todayISOStr;

            // Status icon at the bottom of each cell
            let badge: React.ReactNode = null;
            if (logged) {
              badge = (
                <CheckIcon size={11} color="#22c55e" />
              );
            } else if (isPast && !isRest && (day?.workout_type || day?.preset_id)) {
              badge = <CrossIcon size={11} color="#a0432a" />;
            } else if (isRest) {
              badge = (
                <span
                  className="text-[8px] uppercase tracking-[0.18em] font-bold"
                  style={{ ...fontDisplay, color: "#7a6f60" }}
                >
                  R
                </span>
              );
            } else if (presetAccent) {
              badge = (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: presetAccent,
                    boxShadow: `0 0 4px ${presetAccent}`,
                  }}
                />
              );
            } else if (planned) {
              badge = (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: planned.text,
                    boxShadow: `0 0 4px ${planned.text}`,
                  }}
                />
              );
            }

            // Per-preset background tint takes precedence; falls back
            // to workout_type theme, rest tint, or unplanned shadow.
            const cellBg = presetAccent
              ? `${presetAccent}1f`
              : planned
              ? planned.bg
              : isRest
              ? "rgba(20,14,30,0.45)"
              : "rgba(20,14,30,0.30)";
            const cellBorder = presetAccent
              ? `${presetAccent}66`
              : "rgba(107,79,58,0.30)";

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onSelectDay(cell.iso)}
                className="relative flex flex-col items-center justify-between rounded transition hover:brightness-125"
                style={{
                  aspectRatio: "1 / 1",
                  minHeight: 44,
                  padding: "4px 2px",
                  background: cellBg,
                  border: isToday ? "1.5px solid #d4a020" : `1px solid ${cellBorder}`,
                  boxShadow: isToday
                    ? "0 0 8px rgba(212,160,32,0.30)"
                    : undefined,
                  opacity: isRest && !isToday ? 0.7 : 1,
                  cursor: "pointer",
                }}
                title={
                  cell.iso +
                  (linkedPreset
                    ? ` · ${linkedPreset.name}`
                    : planned
                    ? ` · planned ${planned.label}`
                    : "") +
                  (isRest ? " · rest" : "") +
                  (logged ? " · logged" : "")
                }
              >
                <div
                  className="text-[10px] tabular-nums leading-none"
                  style={{
                    color: isToday ? "#f5d97a" : "#d8d2c2",
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {cell.day}
                </div>
                <div className="flex items-center justify-center h-3">
                  {badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] uppercase tracking-[0.16em] text-muted"
          style={fontDisplay}
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon size={9} color="#22c55e" />
            Logged
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CrossIcon size={9} color="#a0432a" />
            Missed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a855f7",
              }}
            />
            Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: "#7a6f60", fontWeight: 700 }}>R</span>
            Rest
          </span>
        </div>

        <p
          className="mt-3 text-[10px] italic"
          style={{ ...fontDisplay, color: "rgba(216,210,194,0.5)" }}
        >
          Plans use this week's template (week 0) projected across the month.
        </p>
      </div>
    </div>
  );
}

function buildMonthGrid(
  year: number,
  month: number
): Array<{ day: number; iso: string; dow: number } | null> {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const out: Array<{ day: number; iso: string; dow: number } | null> = [];
  for (let i = 0; i < total; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      out.push(null);
    } else {
      const date = new Date(year, month, dayNum);
      out.push({
        day: dayNum,
        iso: isoForDate(date),
        dow: date.getDay(),
      });
    }
  }
  return out;
}

function PencilGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6 M14 11v6" />
    </svg>
  );
}

function CalendarIcon({
  size = 14,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function CheckIcon({
  size = 11,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon({
  size = 11,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Direct / Compound exercise tiers for a zone ─────────────────
// Used inside DisciplineDetailModal. Splits the exercises that touch
// this zone into "Direct" (primary target, mult 1.0) vs "Compound"
// (secondary/tertiary, mult 0.3..<1.0). Caps each list so the modal
// stays compact even for crowded zones like back/chest.
function ZoneExerciseTiers({ zone }: { zone: Zone }) {
  const all = exercisesForZoneTiered(zone);
  const direct = all
    .filter((e) => e.tier === "primary")
    .map((e) => e.exercise)
    .slice(0, 6);
  const compound = all
    .filter((e) => e.tier !== "primary")
    .map((e) => e.exercise)
    .slice(0, 6);
  if (direct.length === 0 && compound.length === 0) return null;
  return (
    <div className="rounded p-3 space-y-2"
      style={{
        background: "rgba(20, 14, 30, 0.55)",
        border: "1px solid rgba(107, 79, 58, 0.4)",
      }}
    >
      {direct.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1"
            style={{ ...fontDisplay, color: "#d4a017" }}
          >
            Direct exercises
          </div>
          <div className="text-[11px] text-ink/85">
            {direct.join(" · ")}
          </div>
        </div>
      )}
      {compound.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1"
            style={{ ...fontDisplay, color: "#a855f7" }}
          >
            Compound exercises
          </div>
          <div className="text-[11px] text-muted/85">
            {compound.join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

function BigInputField({
  label,
  value,
  onChange,
  step,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div>
      <label
        className="block text-[10px] uppercase tracking-[0.22em] text-muted mb-1.5 font-bold"
        style={fontDisplay}
      >
        {label}
      </label>
      <input
        type="number"
        inputMode={inputMode}
        min="0"
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full text-2xl font-bold tabular-nums text-center"
        style={{
          fontFamily: "var(--font-cinzel), Georgia, serif",
          minHeight: 56,
          padding: "10px 12px",
        }}
      />
    </div>
  );
}

// ─── Discipline detail modal — banner click target ────────────────
function DisciplineDetailModal({
  zone,
  level,
  onClose,
  onLog,
}: {
  zone: Zone;
  level: StrengthLevel;
  onClose: () => void;
  onLog: () => void;
}) {
  const themeMode = useTheme();
  const theme =
    themeMode === "light" ? TIER_THEME_LIGHT[level] : TIER_THEME_DARK[level];
  const ladder: StrengthLevel[] = [
    "untrained",
    "below",
    "average",
    "above",
    "exceptional",
    "elite",
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 180ms ease-out" }}
      onClick={onClose}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-md space-y-4"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
          borderColor: theme.sigil,
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                filter: `drop-shadow(0 0 6px ${theme.sigil}aa)`,
              }}
            >
              <HeraldIcon zone={zone} color={theme.sigil} />
            </div>
            <div className="min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
                style={fontDisplay}
              >
                Discipline
              </div>
              <h2
                className="text-xl font-bold tracking-wide leading-tight"
                style={{
                  ...fontDisplay,
                  color: theme.sigil,
                  textShadow: `0 0 12px ${theme.sigil}55, 0 1px 0 rgba(0,0,0,0.7)`,
                }}
              >
                {ZONE_LABEL[zone]}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-2 text-[12px]">
          <span
            className="seal"
            style={{ width: 12, height: 12, background: theme.sigil }}
          />
          <span
            className="uppercase tracking-[0.22em] font-bold"
            style={{ ...fontDisplay, color: theme.sigil }}
          >
            {LEVEL_LABEL[level]}
          </span>
          <span className="text-muted ml-auto tabular-nums text-[11px]">
            Lv {LEVEL_RANK[level]} / 5
          </span>
        </div>

        {/* Compact level ladder */}
        <ul className="space-y-1">
          {ladder.map((lvl) => {
            const isCurrent = lvl === level;
            const c =
              themeMode === "light"
                ? TIER_THEME_LIGHT[lvl].sigil
                : TIER_THEME_DARK[lvl].sigil;
            return (
              <li
                key={lvl}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px]"
                style={{
                  background: isCurrent ? `${c}22` : "transparent",
                  border: isCurrent ? `1px solid ${c}66` : "1px solid transparent",
                }}
              >
                <span
                  className="seal shrink-0"
                  style={{ width: 8, height: 8, background: c }}
                />
                <span
                  className={`uppercase tracking-[0.18em] font-semibold ${
                    isCurrent ? "text-ink" : "text-muted"
                  }`}
                  style={fontDisplay}
                >
                  Lv {LEVEL_RANK[lvl]} · {LEVEL_LABEL[lvl]}
                </span>
                {isCurrent && (
                  <span
                    className="ml-auto text-[10px] uppercase tracking-[0.18em] font-bold"
                    style={{ color: c, fontFamily: "var(--font-cinzel), Georgia, serif" }}
                  >
                    You
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Direct / Compound exercise lists for this zone */}
        <ZoneExerciseTiers zone={zone} />

        <button
          type="button"
          onClick={onLog}
          className="btn-stone w-full"
        >
          Log Training Session
        </button>
      </div>
    </div>
  );
}

// ─── Edit Set modal ─────────────────────────────────────────────────
type EditSetTarget = {
  setId: string;
  workoutId: string;
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
  notes: string;
};

function EditSetModal({
  target,
  setTarget,
  onSave,
  onDelete,
  busy,
}: {
  target: EditSetTarget;
  setTarget: (t: EditSetTarget | null) => void;
  onSave: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setTarget(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setTarget, busy]);

  const exMatch = EXERCISE_OPTIONS.find((e) => e.name === target.exerciseName);
  const liveZone = exMatch ? exerciseZone(exMatch) : target.muscleGroup;
  const exerciseNames = useMemo(
    () => EXERCISE_OPTIONS.map((e) => e.name).sort(),
    []
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => !busy && setTarget(null)}
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Edit Set
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={fontDisplay}
            >
              {target.exerciseName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setTarget(null)}
            disabled={busy}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label
          className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
          style={fontDisplay}
        >
          Exercise
        </label>
        <select
          value={target.exerciseName}
          onChange={(e) =>
            setTarget({ ...target, exerciseName: e.target.value })
          }
          className="w-full"
        >
          {exerciseNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Muscle Group
          </label>
          <div
            className="rounded px-3 py-2 text-sm"
            style={{
              background: "rgba(20, 14, 30, 0.55)",
              border: "1px solid rgba(184, 134, 11, 0.3)",
              color: "#d8d2c2",
            }}
          >
            {ZONE_LABEL[liveZone as Zone] ?? liveZone}
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted">
              auto
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
              style={fontDisplay}
            >
              Weight
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={target.weight}
              onChange={(e) =>
                setTarget({ ...target, weight: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
              style={fontDisplay}
            >
              Reps
            </label>
            <input
              type="number"
              min="0"
              value={target.reps}
              onChange={(e) =>
                setTarget({ ...target, reps: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
              style={fontDisplay}
            >
              Sets
            </label>
            <input
              type="number"
              min="0"
              value={target.sets}
              onChange={(e) =>
                setTarget({ ...target, sets: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Date
          </label>
          <input
            type="date"
            value={target.date}
            max={todayPT()}
            onChange={(e) => setTarget({ ...target, date: e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1"
            style={fontDisplay}
          >
            Notes
          </label>
          <input
            type="text"
            value={target.notes}
            onChange={(e) => setTarget({ ...target, notes: e.target.value })}
            placeholder="optional"
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onSave}
            disabled={busy}
            className="btn-stone flex-1"
            style={{
              background: "linear-gradient(180deg, #7747b0, #3a2466)",
              borderColor: "#7747b0",
              color: "#f0e6ff",
            }}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={() => setTarget(null)}
            disabled={busy}
            className="btn-stone btn-stone-ghost px-4"
          >
            Cancel
          </button>
        </div>

        <button
          onClick={onDelete}
          disabled={busy}
          className="w-full text-[11px] uppercase tracking-[0.22em] font-bold py-2 rounded transition disabled:opacity-40"
          style={{
            ...fontDisplay,
            background: "rgba(168, 50, 50, 0.12)",
            border: "1px solid rgba(168, 50, 50, 0.45)",
            color: "#d96666",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
