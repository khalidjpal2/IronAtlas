"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MonthCalendar, { type CalendarCell } from "@/components/MonthCalendar";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useTheme } from "@/lib/useTheme";
import { todayPT } from "@/lib/time";
import {
  RECORDS_BY_ID,
  formatRecordValue,
  levelForRecord,
  parseTimeToSeconds,
} from "@/lib/records";
import {
  LEVEL_COLOR,
  LEVEL_GRADIENT,
  LEVEL_LABEL,
  LEVEL_RANK,
  ZONES,
  ZONE_LABEL,
  exercisesForZone,
  type Sex,
  type StrengthLevel,
  type TrainingExperience,
  type Zone,
} from "@/lib/strength";

export type RecentSet = {
  workoutId: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
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
  recentSets: RecentSet[];
  records: RecordEntry[];
  workoutDays: WorkoutDaySet[];
  stats: {
    workoutsThisWeek: number;
    totalSets: number;
    totalVolume: number;
    streak: number;
  };
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
  recentSets,
  records,
  workoutDays,
  stats,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [zone, setZone] = useState<Zone | "">(initialZone ?? "");
  const [exercise, setExercise] = useState<string>(initialExercise ?? "");
  const [date, setDate] = useState<string>(todayISO);
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

      const { error: sErr } = await supabase.from("workout_sets").insert({
        workout_id: workout.id,
        exercise_name: exercise,
        muscle_group: zone,
        weight_lbs: Number(weight),
        reps: Number(reps),
        sets: Number(sets),
        primary_muscle: ex?.muscles?.[0] ?? null,
      });
      if (sErr) throw sErr;

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

  const inputCls =
    "w-full bg-elevated border border-border-bright rounded-md px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:outline-none focus:border-accent transition";
  const selectCls =
    "w-full bg-elevated border border-border-bright rounded-md px-4 py-3 text-base text-ink focus:outline-none focus:border-accent transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10";

  return (
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
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="btn-stone shrink-0 px-5 rounded-full text-[11px]"
            style={{ padding: "0.6rem 1.4rem" }}
          >
            Log Session +
          </button>
        </header>

        {/* === LIFTING STATS — sword/shield/anvil/flame === */}
        <LiftingStatsRow stats={stats} />

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
                    key={r.workoutId}
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
                    <div className="text-[11px] text-muted/70 w-20 text-right tabular-nums whitespace-nowrap uppercase tracking-wider">
                      {formatShortDate(r.date)}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSet(r.workoutId, r.exercise)}
                      disabled={busyId === r.workoutId}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-40 transition"
                      title="Delete"
                      aria-label={`Delete ${r.exercise}`}
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
        <LogSessionModal
          inputCls={inputCls}
          selectCls={selectCls}
          zone={zone}
          setZone={setZone}
          exercise={exercise}
          setExercise={setExercise}
          exerciseList={exerciseList}
          weight={weight}
          setWeight={setWeight}
          reps={reps}
          setReps={setReps}
          sets={sets}
          setSets={setSets}
          date={date}
          setDate={setDate}
          notes={notes}
          setNotes={setNotes}
          notesOpen={notesOpen}
          setNotesOpen={setNotesOpen}
          submitting={submitting}
          showSuccess={showSuccess}
          err={err}
          canSubmit={canSubmit}
          onSubmit={async (e) => {
            await onSubmit(e);
            // onSubmit sets showSuccess; close shortly after the
            // success state appears so the user sees the confirmation.
          }}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
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
const TIER_THEME_DARK: Record<
  StrengthLevel,
  { fabric: string; sigil: string; rune: string; bright: boolean }
> = {
  untrained:   { fabric: "#1a1a1a", sigil: "#5a5246", rune: "rgba(90,82,70,0.35)",     bright: false },
  below:       { fabric: "#0d1b2a", sigil: "#3a5a8a", rune: "rgba(58,90,138,0.45)",    bright: false },
  average:     { fabric: "#0d1f0d", sigil: "#3d6b3a", rune: "rgba(61,107,58,0.45)",    bright: false },
  above:       { fabric: "#1f1500", sigil: "#b8860b", rune: "rgba(184,134,11,0.55)",   bright: true  },
  exceptional: { fabric: "#1f0800", sigil: "#a0432a", rune: "rgba(160,67,42,0.55)",    bright: true  },
  elite:       { fabric: "#150020", sigil: "#a878d0", rune: "rgba(168,120,208,0.65)",  bright: true  },
};
const TIER_THEME_LIGHT: Record<
  StrengthLevel,
  { fabric: string; sigil: string; rune: string; bright: boolean }
> = {
  untrained:   { fabric: "#e8dfd0", sigil: "#8a7f6b", rune: "rgba(138,127,107,0.4)",   bright: true },
  below:       { fabric: "#b9c9d8", sigil: "#2c4870", rune: "rgba(44,72,112,0.45)",    bright: true },
  average:     { fabric: "#b3c7a3", sigil: "#2a4628", rune: "rgba(42,70,40,0.45)",     bright: true },
  above:       { fabric: "#e0c79c", sigil: "#8a6308", rune: "rgba(138,99,8,0.55)",     bright: true },
  exceptional: { fabric: "#c87c5a", sigil: "#6e2810", rune: "rgba(110,40,16,0.55)",    bright: true },
  elite:       { fabric: "#9b7ec9", sigil: "#4a3084", rune: "rgba(74,48,132,0.6)",     bright: true },
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

      {/* The banner body — sways. Hover/active pauses the sway. */}
      <div
        className="banner-body relative w-full"
        style={
          {
            "--sway-delay": `${(idx % 5) * 0.6}s`,
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

      {/* Component-scoped CSS — sway, shimmer, rune pulse */}
      <style jsx>{`
        .banner-body {
          animation: sway 4s ease-in-out infinite;
          animation-delay: var(--sway-delay, 0s);
          transform-origin: top center;
          transition: filter 200ms ease;
        }
        .banner-button:hover .banner-body,
        .banner-button:focus-visible .banner-body,
        .banner-button[data-active="1"] .banner-body {
          animation-play-state: paused;
        }
        .banner-button:hover .banner-fabric,
        .banner-button:focus-visible .banner-fabric {
          filter: brightness(1.10) saturate(1.10);
          transition: filter 180ms ease;
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-1deg); }
          50% { transform: rotate(1deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .banner-body { animation: none; }
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

function formatShortDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Lifting stats — sword/shield/anvil/flame ─────────────────────
function LiftingStatsRow({
  stats,
}: {
  stats: {
    workoutsThisWeek: number;
    totalSets: number;
    totalVolume: number;
    streak: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <WeaponStat
        icon={<SwordIcon />}
        label="Workouts · 7d"
        value={String(stats.workoutsThisWeek)}
      />
      <WeaponStat
        icon={<ShieldIcon />}
        label="Total Sets"
        value={stats.totalSets.toLocaleString()}
      />
      <WeaponStat
        icon={<AnvilIcon />}
        label="Total Volume"
        value={`${stats.totalVolume.toLocaleString()} lb`}
      />
      <WeaponStat
        icon={<FlameIcon />}
        label="Streak"
        value={`${stats.streak}d`}
      />
    </div>
  );
}

function WeaponStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="relative bg-panel border border-bronze-deep rounded p-3 flex items-center gap-3"
      style={{
        backgroundImage: "var(--noise-bg)",
        // Slightly cut corners — angular dark-fantasy panel look.
        clipPath:
          "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="w-9 h-9 flex items-center justify-center text-gold shrink-0"
        style={{
          filter: "drop-shadow(0 0 4px rgba(184,134,11,0.4))",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className="text-[9px] uppercase tracking-[0.22em] text-muted leading-none"
          style={fontDisplay}
        >
          {label}
        </div>
        <div
          className="text-xl font-bold gold-text tabular-nums leading-tight mt-1"
          style={fontDisplay}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function SwordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M14.5 17.5 L3 20l2.5-11.5 11.5 11.5z M14.5 17.5 L20 12 13 5 7 11" />
      <path d="M5 19 L7 21" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z" />
      <line x1="12" y1="8" x2="12" y2="17" />
      <line x1="8" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function AnvilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M3 8 H21 L18 12 H6 Z" />
      <path d="M9 12 V18 H15 V12" />
      <path d="M7 18 H17" />
      <path d="M5 21 H19" />
    </svg>
  );
}
function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 3 C13 6 17 8 16 13 C15 17 12 19 12 19 C12 19 9 17 8 13 C7 8 11 6 12 3 Z" />
      <path d="M10 13 C11 14 13 14 14 13" />
    </svg>
  );
}

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
          { "--sway-delay": `${(idx % 5) * 0.6}s` } as React.CSSProperties
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

// ─── Lifting day modal ───────────────────────────────────────────
function LiftingDayModal({
  date,
  sets,
  busy,
  onClose,
  onDelete,
}: {
  date: string;
  sets: WorkoutDaySet[];
  busy: string | null;
  onClose: () => void;
  onDelete: (workoutId: string, label: string) => void | Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalVolume = sets.reduce(
    (a, s) => a + s.weight * s.reps * s.sets,
    0
  );
  const zonesWorked = Array.from(new Set(sets.map((s) => s.muscleGroup)));
  const longLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              <span className="text-muted">
                {sets.length} set{sets.length === 1 ? "" : "s"} ·{" "}
                <span className="text-gold font-semibold tabular-nums">
                  {totalVolume.toLocaleString()}
                </span>{" "}
                lbs total volume
              </span>
            </div>
            {zonesWorked.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {zonesWorked.map((z) => (
                  <span
                    key={z}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      background: `${LEVEL_COLOR.untrained}22`,
                      border: `1px solid ${LEVEL_COLOR.untrained}66`,
                      color: "#d8d2c2",
                      fontFamily: "var(--font-cinzel), Georgia, serif",
                    }}
                  >
                    <span
                      className="seal"
                      style={{
                        width: 6,
                        height: 6,
                        background: "#b8860b",
                      }}
                    />
                    {ZONE_LABEL[z as keyof typeof ZONE_LABEL] ?? z}
                  </span>
                ))}
              </div>
            )}
            <ul className="divide-y divide-border">
              {sets.map((s) => (
                <li
                  key={s.setId}
                  className="py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">
                      {s.exercise}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted/80 mt-0.5">
                      {ZONE_LABEL[s.muscleGroup as keyof typeof ZONE_LABEL] ??
                        s.muscleGroup}
                    </div>
                  </div>
                  <div className="text-sm text-gold tabular-nums whitespace-nowrap font-semibold">
                    {s.weight} x {s.reps} x {s.sets}
                  </div>
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Log Session modal ───────────────────────────────────────────
function LogSessionModal({
  inputCls,
  selectCls,
  zone,
  setZone,
  exercise,
  setExercise,
  exerciseList,
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
  onSubmit,
  onClose,
}: {
  inputCls: string;
  selectCls: string;
  zone: Zone | "";
  setZone: (v: Zone | "") => void;
  exercise: string;
  setExercise: (v: string) => void;
  exerciseList: { name: string; muscles: string[] }[];
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
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onClose: () => void;
}) {
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
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-2xl"
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
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Training Ground
            </div>
            <h2
              className="text-xl font-bold tracking-tight text-ink"
              style={fontDisplay}
            >
              Log Training Session
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

        <form
          onSubmit={onSubmit}
          className="grid md:grid-cols-2 gap-x-8 gap-y-5"
        >
          <div className="space-y-5">
            <Field label="Discipline">
              <div className="relative">
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as Zone | "")}
                  className={selectCls}
                >
                  <option value="">Select a discipline</option>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {ZONE_LABEL[z]}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            </Field>

            <Field label="Technique">
              <div className="relative">
                <select
                  disabled={!zone}
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                  className={selectCls}
                >
                  <option value="">
                    {zone
                      ? "Select a technique"
                      : "Choose a discipline first"}
                  </option>
                  {exerciseList.map((ex) => (
                    <option key={ex.name} value={ex.name}>
                      {ex.name}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            </Field>
          </div>

          <div className="space-y-5">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight (lbs)">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label="Reps">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label="Sets">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
            </div>

            <div>
              {!notesOpen ? (
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-soft transition"
                  style={fontDisplay}
                >
                  + Add notes
                </button>
              ) : (
                <Field label="Notes">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="optional"
                    className={inputCls}
                  />
                </Field>
              )}
            </div>

            {err && <p className="text-sm text-danger">{err}</p>}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className={`btn-stone w-full ${
                showSuccess ? "btn-stone-gold" : ""
              }`}
            >
              {showSuccess
                ? "Session Recorded"
                : submitting
                ? "Recording..."
                : "Record Session"}
            </button>
          </div>
        </form>
      </div>
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
