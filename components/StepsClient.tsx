"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import MonthCalendar, { type CalendarCell } from "@/components/MonthCalendar";
import CompassWheel, { type CompassDay } from "@/components/CompassWheel";
import { tooltipStyle, useChartPalette } from "@/lib/chartTheme";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { todayPT } from "@/lib/time";
import { computeDailyJourneyPoints } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";

export type StepsRow = { date: string; steps: number; goal: number };

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  baseGoal: number;
  personalGoal: number;
  rows: StepsRow[];
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };
// "Today" everywhere = the user's calendar day in California (PT).
const today = () => todayPT();

export default function StepsClient({
  userId,
  username,
  isAdmin,
  profile,
  baseGoal,
  personalGoal: initialPersonalGoal,
  rows,
}: Props) {
  const router = useRouter();
  const chart = useChartPalette();

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.date, r.steps));
    return m;
  }, [rows]);

  const todayCount = byDate.get(today()) ?? 0;
  const remainingToBase = Math.max(0, baseGoal - todayCount);
  const remainingToPersonal = Math.max(0, initialPersonalGoal - todayCount);

  // Popover + quick-add state
  const [goalOpen, setGoalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<"goal" | "add" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar cells — status reflects personal-goal achievement (gold)
  // vs base-goal-only (purple) vs under-base (low).
  const journeyCells = useMemo(() => {
    const m = new Map<string, CalendarCell>();
    byDate.forEach((steps, iso) => {
      if (steps <= 0) return;
      m.set(iso, {
        date: iso,
        status: steps >= initialPersonalGoal ? "met" : "low",
        hint: steps >= 1000 ? `${Math.round(steps / 1000)}k` : String(steps),
      });
    });
    return m;
  }, [byDate, initialPersonalGoal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived stats ─────────────────────────────────────────────
  // The chart uses personal goal as its reference line (the user's
  // actual target). Streak rows use the same reference.
  const last7 = useMemo(
    () => buildLastNDays(7, byDate, initialPersonalGoal),
    [byDate, initialPersonalGoal]
  );
  const last30 = useMemo(
    () => buildLastNDays(30, byDate, initialPersonalGoal),
    [byDate, initialPersonalGoal]
  );
  const avg7 = avg(last7.map((d) => d.steps).filter((n) => n > 0));
  const avg30 = avg(last30.map((d) => d.steps).filter((n) => n > 0));
  const personalHit7 = last7.filter(
    (d) => d.steps >= initialPersonalGoal
  ).length;

  const baseStreak = useMemo(
    () => streakOnlyLogged(last30, baseGoal),
    [last30, baseGoal]
  );
  const personalStreak = useMemo(
    () => streakOnlyLogged(last30, initialPersonalGoal),
    [last30, initialPersonalGoal]
  );
  const bestDay = useMemo(() => {
    let best = 0;
    byDate.forEach((s) => {
      if (s > best) best = s;
    });
    return best;
  }, [byDate]);

  // Today's score contribution (computed via the same lib function the
  // server uses, so it always matches the dashboard's Journey score).
  const todayPoints = useMemo(
    () => computeDailyJourneyPoints(todayCount, initialPersonalGoal, baseGoal),
    [todayCount, initialPersonalGoal, baseGoal]
  );

  // Compass wheel feeds — index 0 = today, increasing into the past.
  const compass30 = useMemo<CompassDay[]>(
    () =>
      [...last30]
        .reverse()
        .map((d) => ({ date: d.date, steps: d.steps })),
    [last30]
  );
  const compass7 = useMemo<CompassDay[]>(
    () =>
      [...last7]
        .reverse()
        .map((d) => ({ date: d.date, steps: d.steps })),
    [last7]
  );

  async function applyDelta(delta: number, date: string = today()) {
    setBusy("add");
    setErr(null);
    try {
      const current = byDate.get(date) ?? 0;
      const res = await fetch("/api/steps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          steps: current + delta,
          goal: initialPersonalGoal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast(
        date === today()
          ? `+${delta.toLocaleString()} steps`
          : `+${delta.toLocaleString()} on ${shortDate(date)}`
      );
      setAddOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Replaces the absolute step count for a given date. Used by the
   * Past Entries inline editor where the user types the exact number
   * for a missed day rather than adding to a current value.
   */
  async function replaceSteps(steps: number, date: string) {
    setBusy("add");
    setErr(null);
    try {
      const res = await fetch("/api/steps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          steps: Math.max(0, steps),
          goal: initialPersonalGoal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast(`Saved · ${shortDate(date)}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function saveGoal(newGoal: number) {
    if (!newGoal || newGoal < baseGoal + 1) {
      setErr(`Personal goal must be greater than ${baseGoal.toLocaleString()}`);
      return;
    }
    setBusy("goal");
    setErr(null);
    try {
      const res = await fetch("/api/step-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personal_goal: newGoal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast("Goal saved");
      setGoalOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  // Best streak across the last 60 days (rough "Longest March").
  const longestMarch = useMemo(() => {
    const days60 = buildLastNDays(60, byDate, baseGoal);
    let best = 0;
    let run = 0;
    for (const d of days60) {
      if (d.steps >= baseGoal) {
        run += 1;
        if (run > best) best = run;
      } else if (d.steps > 0) {
        run = 0;
      }
      // unlogged days don't affect the streak (matches scoring rules)
    }
    return best;
  }, [byDate, baseGoal]);

  // Days traveled / trials conquered for the CURRENT month.
  const monthStats = useMemo(() => {
    const todayDate = new Date(today() + "T12:00:00Z");
    const y = todayDate.getUTCFullYear();
    const m = todayDate.getUTCMonth();
    let traveled = 0;
    let conquered = 0;
    byDate.forEach((steps, iso) => {
      const d = new Date(iso + "T12:00:00Z");
      if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m) return;
      if (steps > 0) traveled += 1;
      if (steps >= baseGoal) conquered += 1;
    });
    return { traveled, conquered };
  }, [byDate, baseGoal]);

  return (
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader username={username} isAdmin={isAdmin} profile={profile} />

      <main className="flex-1 w-full px-6 lg:px-10 py-6 space-y-6">
        {/* === HEADER ROW === */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Journey
            </div>
            <h1
              className="text-3xl lg:text-4xl font-bold tracking-tight text-ink mt-1"
              style={{
                ...fontDisplay,
                textShadow: "0 0 22px rgba(168, 85, 247, 0.25)",
              }}
            >
              The Road of Trials
            </h1>
          </div>
          <SetGoalPopover
            baseGoal={baseGoal}
            initialPersonalGoal={initialPersonalGoal}
            open={goalOpen}
            setOpen={setGoalOpen}
            onSave={saveGoal}
            busy={busy === "goal"}
            err={err}
          />
        </header>

        {err && busy !== "goal" && (
          <div className="bg-danger/10 border border-danger/40 rounded px-3 py-2 text-xs text-danger">
            {err}
          </div>
        )}

        {/* === TOP ROW: ROAD (left) + SIDE PANEL (right) === */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* ROAD OF TRIALS — calendar grid */}
          <RoadOfTrials
            userId={userId}
            todayISO={today()}
            byDate={byDate}
            baseGoal={baseGoal}
            personalGoal={initialPersonalGoal}
            onDayClick={(iso) => setSelectedDate(iso)}
          />

          {/* SIDE PANEL */}
          <aside className="flex flex-col gap-4">
            {/* Today hero */}
            <section
              className="tablet relative rounded p-5 text-center"
              style={{
                background:
                  "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(168, 85, 247, 0.10), transparent 70%), var(--noise-bg), #0a0a14",
              }}
            >
              <span className="corner-bl" />
              <span className="corner-br" />
              <div
                className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
                style={fontDisplay}
              >
                Today's Steps
              </div>
              <div
                className="text-5xl font-bold tabular-nums mt-1"
                style={{
                  ...fontDisplay,
                  color:
                    todayPoints.personalGoalMet
                      ? "#d4a017"
                      : todayPoints.baseGoalMet
                      ? "#a855f7"
                      : "#d8d2c2",
                  textShadow: todayPoints.personalGoalMet
                    ? "0 0 18px rgba(212,160,23,0.55)"
                    : todayPoints.baseGoalMet
                    ? "0 0 14px rgba(168,85,247,0.45)"
                    : undefined,
                }}
              >
                {todayCount.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted mt-1">
                / {baseGoal.toLocaleString()} base · {initialPersonalGoal.toLocaleString()} personal
              </div>

              {/* Progress bar to base goal */}
              <div className="mt-3 mx-auto xp-track" style={{ height: 6 }}>
                {todayCount > 0 && (
                  <div
                    className="xp-fill"
                    style={{
                      width: `${Math.min(100, (todayCount / baseGoal) * 100)}%`,
                      background:
                        todayCount >= initialPersonalGoal
                          ? "#d4a017"
                          : todayCount >= baseGoal
                          ? "#a855f7"
                          : "#3a5a8a",
                    }}
                  />
                )}
              </div>
              <div
                className={`mt-2 text-[10px] uppercase tracking-[0.22em] font-bold ${
                  todayPoints.total >= 0 ? "" : "text-danger"
                }`}
                style={{
                  ...fontDisplay,
                  color:
                    todayPoints.total > 0
                      ? "#d4a017"
                      : todayPoints.total < 0
                      ? "#a83232"
                      : "#8b8275",
                }}
              >
                {todayPoints.total >= 0 ? "+" : ""}
                {Math.round(todayPoints.total)} pts today
              </div>

              {/* Log Steps CTA */}
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="mt-4 btn-stone w-full text-[11px]"
                style={{
                  ...fontDisplay,
                  letterSpacing: "0.22em",
                  background: "linear-gradient(180deg, #7747b0, #3a2466)",
                  borderColor: "#7747b0",
                  color: "#f0e6ff",
                }}
              >
                {addOpen ? "Close" : "Log Steps"}
              </button>

              {addOpen && (
                <div className="mt-3 text-left">
                  <QuickAddSteps
                    byDate={byDate}
                    onAdd={applyDelta}
                    onCancel={() => setAddOpen(false)}
                    busy={busy === "add"}
                  />
                </div>
              )}
            </section>

            {/* Wheel of Treks — small corner widget */}
            <section className="tablet relative rounded p-4">
              <span className="corner-bl" />
              <span className="corner-br" />
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-gold/85 font-bold mb-2 text-center"
                style={fontDisplay}
              >
                Wheel of Treks
              </div>
              <CompassWheel
                days30={compass30}
                days7={compass7}
                todaySteps={todayCount}
                baseGoal={baseGoal}
                personalGoal={initialPersonalGoal}
                size={220}
              />
            </section>
          </aside>
        </div>

        {/* === STAT TABLETS === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTablet
            label="Days Traveled"
            value={String(monthStats.traveled)}
            accent="#3a5a8a"
          />
          <StatTablet
            label="Trials Conquered"
            value={String(monthStats.conquered)}
            accent="#a855f7"
          />
          <StatTablet
            label="Current Streak"
            value={`${baseStreak}d`}
            accent="#d4a017"
          />
          <StatTablet
            label="Longest March"
            value={`${longestMarch}d`}
            accent="#c25a3a"
          />
        </div>
      </main>

      {/* Journey day modal */}
      {selectedDate && (
        <JourneyDayModal
          date={selectedDate}
          stepsValue={byDate.get(selectedDate) ?? 0}
          goal={initialPersonalGoal}
          busy={busy === "add"}
          onClose={() => setSelectedDate(null)}
          onSave={async (value) => {
            await replaceSteps(value, selectedDate);
            setSelectedDate(null);
          }}
        />
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-bold rounded transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          ...fontDisplay,
          background: "#8a6308",
          color: "#1a0f00",
          border: "1px solid #4a3010",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.55)",
        }}
      >
        {toast}
      </div>
    </div>
  );
}

// ─── Today panel — two progress bars + score chip ─────────────────
// ─── The Road of Trials — calendar-grid version ──────────────────
//
// Standard 7-column calendar (Sun–Sat) with the dark-fantasy road
// aesthetic layered on top: each row has a subtle cobblestone band
// connecting the cells, and each day cell hosts a waypoint icon
// reflecting its status (cleared / under goal / no data / today /
// future). Days outside the viewed month show as faded peeks so
// the grid stays full and visually grounded.
type WaypointStatus =
  | "past_met"
  | "past_unmet"
  | "past_no_data"
  | "today"
  | "future"
  | "other_month";

type CalendarCellData = {
  iso: string;
  day: number;
  inMonth: boolean;
  status: WaypointStatus;
  steps: number;
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function RoadOfTrials({
  userId,
  todayISO,
  byDate,
  baseGoal,
  personalGoal,
  onDayClick,
}: {
  userId: string;
  todayISO: string;
  byDate: Map<string, number>;
  baseGoal: number;
  personalGoal: number;
  onDayClick: (iso: string) => void;
}) {
  const supabase = createSupabaseBrowserClient();
  // Today's calendar month is the default view.
  const [todayY, todayM0] = useMemo(() => {
    const t = new Date(todayISO + "T12:00:00Z");
    return [t.getUTCFullYear(), t.getUTCMonth()] as const;
  }, [todayISO]);
  const [view, setView] = useState<{ y: number; m0: number }>({
    y: todayY,
    m0: todayM0,
  });

  // Cache step data per fetched month (keyed YYYY-MM). Initial map
  // already has up to 60 days back from the server fetch; we lazily
  // top it up when the user navigates to an older month.
  const [extraByMonth, setExtraByMonth] = useState<
    Map<string, Map<string, number>>
  >(new Map());

  const viewKey = `${view.y}-${String(view.m0 + 1).padStart(2, "0")}`;
  const isCurrentOrFutureMonth =
    view.y > todayY || (view.y === todayY && view.m0 >= todayM0);

  // Resolve the byDate map for the viewed month — server data first,
  // then any month-specific cache loaded on demand.
  const monthSteps = useMemo(() => {
    const out = new Map<string, number>();
    const monthPrefix = viewKey;
    byDate.forEach((v, k) => {
      if (k.startsWith(monthPrefix)) out.set(k, v);
    });
    const cached = extraByMonth.get(viewKey);
    if (cached) cached.forEach((v, k) => out.set(k, v));
    return out;
  }, [byDate, extraByMonth, viewKey]);

  // Lazy fetch: when navigating to a month not covered by the initial
  // 60-day window (i.e. older than ~2 months ago), pull that month's
  // rows from Supabase.
  useEffect(() => {
    if (isCurrentOrFutureMonth) return;
    if (extraByMonth.has(viewKey)) return;
    let canceled = false;
    (async () => {
      const start = `${viewKey}-01`;
      const lastDay = new Date(view.y, view.m0 + 1, 0).getDate();
      const end = `${viewKey}-${String(lastDay).padStart(2, "0")}`;
      const { data } = await supabase
        .from("daily_steps")
        .select("date, steps")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end);
      if (canceled) return;
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) =>
        m.set(String(r.date), Number(r.steps ?? 0))
      );
      setExtraByMonth((prev) => new Map(prev).set(viewKey, m));
    })();
    return () => {
      canceled = true;
    };
  }, [
    viewKey,
    view.y,
    view.m0,
    isCurrentOrFutureMonth,
    extraByMonth,
    supabase,
    userId,
  ]);

  // Build the calendar cells (always 6 rows × 7 cols = 42 cells).
  const cells = useMemo<CalendarCellData[]>(() => {
    const firstOfMonth = new Date(view.y, view.m0, 1);
    const startDow = firstOfMonth.getDay(); // 0 Sun .. 6 Sat
    const daysInMonth = new Date(view.y, view.m0 + 1, 0).getDate();
    const daysInPrev = new Date(view.y, view.m0, 0).getDate();
    const out: CalendarCellData[] = [];
    for (let i = 0; i < 42; i++) {
      let cellY = view.y;
      let cellM0 = view.m0;
      let day: number;
      let inMonth = true;
      if (i < startDow) {
        // Tail of previous month
        day = daysInPrev - (startDow - 1 - i);
        cellM0 = view.m0 - 1;
        if (cellM0 < 0) {
          cellM0 = 11;
          cellY -= 1;
        }
        inMonth = false;
      } else if (i >= startDow + daysInMonth) {
        // Head of next month
        day = i - (startDow + daysInMonth) + 1;
        cellM0 = view.m0 + 1;
        if (cellM0 > 11) {
          cellM0 = 0;
          cellY += 1;
        }
        inMonth = false;
      } else {
        day = i - startDow + 1;
      }
      const iso = `${cellY}-${String(cellM0 + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const steps =
        (inMonth ? monthSteps.get(iso) : extraByMonth.get(`${cellY}-${String(cellM0 + 1).padStart(2, "0")}`)?.get(iso) ?? byDate.get(iso)) ?? 0;
      let status: WaypointStatus;
      if (!inMonth) {
        status = "other_month";
      } else if (iso > todayISO) {
        status = "future";
      } else if (iso === todayISO) {
        status = "today";
      } else if (steps === 0) {
        status = "past_no_data";
      } else if (steps >= baseGoal) {
        status = "past_met";
      } else {
        status = "past_unmet";
      }
      out.push({ iso, day, inMonth, status, steps });
    }
    return out;
  }, [view, monthSteps, todayISO, baseGoal, byDate, extraByMonth]);

  const totalRows = Math.ceil(42 / 7); // always 6
  const visibleRows = (() => {
    // Drop the trailing all-other-month row if the month fits in 5.
    const lastRow = cells.slice(35, 42);
    if (lastRow.every((c) => !c.inMonth)) return 5;
    return 6;
  })();
  const cellsToShow = cells.slice(0, visibleRows * 7);

  // ── Path geometry ────────────────────────────────────────────
  // SVG viewBox uses 100 abstract units per cell width and per cell
  // height. The grid uses gap-0 so cell centers in CSS land at the
  // same fractional position they do in the viewBox.
  const COLS_FOR_PATH = 7;
  const cellCenterX = (col: number) => col * 100 + 50;
  const cellCenterY = (row: number) => row * 100 + 50;

  // Day → grid (row, col) for in-month days only. The first day of
  // the month sits at row 0, column = first-DOW.
  const inMonthDays = useMemo(() => {
    const firstDow = new Date(view.y, view.m0, 1).getDay();
    const daysInMonth = new Date(view.y, view.m0 + 1, 0).getDate();
    const result: Array<{
      iso: string;
      row: number;
      col: number;
      isToday: boolean;
      isPast: boolean;
    }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const idx = firstDow + (d - 1);
      const row = Math.floor(idx / 7);
      const col = idx % 7;
      const iso = `${view.y}-${String(view.m0 + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      result.push({
        iso,
        row,
        col,
        isToday: iso === todayISO,
        isPast: iso < todayISO,
      });
    }
    return result;
  }, [view, todayISO]);

  // Build the SVG path that walks the in-month days in date order.
  // Within a row we draw a straight line; between rows we sweep a
  // cubic bezier from the right side of the upper row to the left
  // side of the lower row, which produces the winding "snake" feel.
  function buildPath(start: number, end: number): string {
    if (end <= start) return "";
    const parts: string[] = [];
    for (let i = start; i < end; i++) {
      const p = inMonthDays[i];
      const x = cellCenterX(p.col);
      const y = cellCenterY(p.row);
      if (i === start) {
        parts.push(`M ${x} ${y}`);
        continue;
      }
      const prev = inMonthDays[i - 1];
      const px = cellCenterX(prev.col);
      const py = cellCenterY(prev.row);
      if (prev.row === p.row) {
        parts.push(`L ${x} ${y}`);
      } else {
        // Sweep curve between rows.
        const midY = (py + y) / 2;
        const c1x = px + 60;
        const c2x = x - 60;
        parts.push(`C ${c1x} ${midY}, ${c2x} ${midY}, ${x} ${y}`);
      }
    }
    return parts.join(" ");
  }

  // Today's index in the in-month-days array (or -1 if today isn't in
  // the viewed month). The path splits here: past portion is
  // illuminated, future portion gets the fog treatment.
  const todayIdx = inMonthDays.findIndex((d) => d.isToday);
  const pastEnd =
    todayIdx >= 0
      ? todayIdx + 1
      : inMonthDays[0] && inMonthDays[0].iso < todayISO
      ? inMonthDays.length
      : 0;
  const pastPathD = buildPath(0, pastEnd);
  const futurePathD =
    todayIdx >= 0 && todayIdx < inMonthDays.length - 1
      ? buildPath(todayIdx, inMonthDays.length)
      : pastEnd === 0
      ? buildPath(0, inMonthDays.length)
      : "";

  function navMonth(delta: number) {
    setView((v) => {
      let y = v.y;
      let m0 = v.m0 + delta;
      if (m0 < 0) {
        m0 = 11;
        y -= 1;
      } else if (m0 > 11) {
        m0 = 0;
        y += 1;
      }
      // Clamp forward — never navigate past the current month.
      if (y > todayY || (y === todayY && m0 > todayM0)) {
        return { y: todayY, m0: todayM0 };
      }
      return { y, m0 };
    });
  }
  const canGoForward = !(view.y === todayY && view.m0 === todayM0);

  return (
    <section
      className="tablet relative rounded p-4 lg:p-6 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 100% 70% at 50% 0%, rgba(91, 57, 147, 0.10), transparent 60%), linear-gradient(180deg, #0a0a14 0%, #16092e 60%, #0a0a14 100%), var(--noise-bg)",
      }}
    >
      <span className="corner-bl" />
      <span className="corner-br" />

      {/* Atmospheric dead trees */}
      <DeadTree className="absolute left-1 top-16 opacity-35" height={110} />
      <DeadTree
        className="absolute right-1 top-24 opacity-30"
        height={95}
        flip
      />
      <DeadTree className="absolute left-2 bottom-4 opacity-30" height={90} />
      <DeadTree
        className="absolute right-3 bottom-10 opacity-30"
        height={100}
        flip
      />

      {/* Month nav header */}
      <header className="relative flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => navMonth(-1)}
          className="w-9 h-9 flex items-center justify-center rounded text-muted hover:text-gold transition"
          style={{
            background: "rgba(20, 14, 30, 0.55)",
            border: "1px solid rgba(107, 79, 58, 0.45)",
          }}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-center">
          <div
            className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
            style={fontDisplay}
          >
            Road of Trials
          </div>
          <div
            className="text-2xl lg:text-3xl font-bold tracking-[0.06em] uppercase"
            style={{
              ...fontDisplay,
              color: "#d4a017",
              textShadow: "0 0 14px rgba(212, 160, 23, 0.45)",
            }}
          >
            {MONTH_LABELS[view.m0]} {view.y}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navMonth(1)}
          disabled={!canGoForward}
          className="w-9 h-9 flex items-center justify-center rounded text-muted hover:text-gold transition disabled:opacity-30 disabled:cursor-default"
          style={{
            background: "rgba(20, 14, 30, 0.55)",
            border: "1px solid rgba(107, 79, 58, 0.45)",
          }}
          aria-label="Next month"
        >
          ›
        </button>
      </header>

      {/* Tight, board-game-style calendar. Capped at 504px so the
          cells stay compact (each ≈ 72px square) and the 44px node
          inside each cell looks like a Candy-Land waypoint, not a
          giant blob. */}
      <div className="relative mx-auto" style={{ maxWidth: 504 }}>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW_LABELS.map((d) => (
            <div
              key={d}
              className="text-[9px] uppercase tracking-[0.22em] text-gold/65 font-bold text-center py-1"
              style={fontDisplay}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid + cobblestone road overlay. Grid is gap-0 so the
            SVG viewBox column centers (col*100+50) align exactly
            with the rendered cell centers. */}
        <div className="relative grid grid-cols-7 gap-0">
          <svg
            viewBox={`0 0 ${COLS_FOR_PATH * 100} ${visibleRows * 100}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <defs>
              <pattern
                id="cobble"
                width="14"
                height="14"
                patternUnits="userSpaceOnUse"
              >
                <rect width="14" height="14" fill="#3a2820" />
                <circle cx="3.5" cy="3.5" r="2.4" fill="#5a4030" opacity="0.85" />
                <circle cx="10.5" cy="10.5" r="2.4" fill="#5a4030" opacity="0.85" />
                <circle cx="10.5" cy="3.5" r="1.6" fill="#4a3325" opacity="0.7" />
                <circle cx="3.5" cy="10.5" r="1.6" fill="#4a3325" opacity="0.7" />
              </pattern>
              <filter id="fog-future" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              </filter>
            </defs>
            {pastPathD && (
              <>
                <path
                  d={pastPathD}
                  stroke="#000"
                  strokeWidth="22"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.6"
                />
                <path
                  d={pastPathD}
                  stroke="url(#cobble)"
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={pastPathD}
                  stroke="rgba(255, 220, 160, 0.06)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 7"
                />
              </>
            )}
            {futurePathD && (
              <>
                <path
                  d={futurePathD}
                  stroke="#000"
                  strokeWidth="22"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.65"
                />
                <path
                  d={futurePathD}
                  stroke="url(#cobble)"
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.35"
                  filter="url(#fog-future)"
                />
              </>
            )}
          </svg>
          {cellsToShow.map((c, i) => (
            <CalendarCell
              key={`${c.iso}-${i}`}
              cell={c}
              personalGoal={personalGoal}
              onClick={
                !c.inMonth || c.status === "future"
                  ? undefined
                  : () => onDayClick(c.iso)
              }
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        :global(.knight-pulse) {
          animation: knightPulse 2.4s ease-in-out infinite;
        }
        @keyframes knightPulse {
          0%, 100% {
            box-shadow: 0 0 14px rgba(212, 160, 23, 0.55),
              inset 0 0 12px rgba(212, 160, 23, 0.35);
          }
          50% {
            box-shadow: 0 0 26px rgba(212, 160, 23, 0.95),
              inset 0 0 16px rgba(212, 160, 23, 0.6);
          }
        }
        :global(.torch-flicker) {
          animation: torchFlicker 1.6s ease-in-out infinite;
        }
        @keyframes torchFlicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          45% { opacity: 0.85; transform: scale(0.94); }
          70% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </section>
  );
}

// Cobblestone road band that sits behind a row of calendar cells.
// Rendered as a grid item that spans all 7 columns so it draws under
// every cell in the row.
function CalendarRow() {
  return (
    <div
      aria-hidden
      className="col-span-7 absolute pointer-events-none"
      style={{
        // The row's road is laid via background gradient on the
        // grid container instead. This component is reserved for
        // future per-row decoration if needed.
        display: "none",
      }}
    />
  );
}

function CalendarCell({
  cell,
  personalGoal,
  onClick,
}: {
  cell: CalendarCellData;
  personalGoal: number;
  onClick?: () => void;
}) {
  const { status, steps, day, inMonth } = cell;
  const isFuture = status === "future";
  const isToday = status === "today";
  const isCleared = status === "past_met";
  const isFailed = status === "past_unmet";
  const isNoData = status === "past_no_data";
  const personalCleared = isCleared && steps >= personalGoal;

  const ring = isToday
    ? "#d4a017"
    : personalCleared
    ? "#d4a017"
    : isCleared
    ? "#a855f7"
    : isFailed
    ? "#5a5246"
    : isNoData
    ? "#3a3340"
    : !inMonth
    ? "rgba(107, 79, 58, 0.25)"
    : "#2a2030";
  const fill = isToday
    ? "rgba(212, 160, 23, 0.10)"
    : personalCleared
    ? "rgba(212, 160, 23, 0.14)"
    : isCleared
    ? "rgba(168, 85, 247, 0.14)"
    : isFailed
    ? "rgba(58, 51, 64, 0.5)"
    : isNoData
    ? "rgba(20, 14, 30, 0.6)"
    : "rgba(8, 8, 16, 0.45)";

  const Icon = (() => {
    if (!inMonth) return null;
    if (isToday) return <KnightIcon color="#d4a017" />;
    if (isCleared)
      return (
        <span className="torch-flicker">
          <TorchIcon color={personalCleared ? "#d4a017" : "#a855f7"} />
        </span>
      );
    if (isFailed) return <ExtinguishedTorchIcon color="#5a5246" />;
    if (isNoData) return <SkullIcon color="#3a3340" />;
    if (isFuture)
      return (
        <span
          className="text-[14px] font-bold"
          style={{ ...fontDisplay, color: "rgba(180, 160, 200, 0.5)" }}
        >
          ?
        </span>
      );
    return null;
  })();

  // Each grid cell is a transparent square sized by the column
  // (≈ 72px at the 504-px-max layout). A fixed 44px circular node
  // sits centered inside, so the waypoint always looks compact and
  // board-game-like regardless of the calendar's actual width.
  const NODE = 44;

  if (!inMonth) {
    // Dark empty terrain — faint day number, no road, no node.
    return (
      <div
        className="relative aspect-square flex items-center justify-center"
        aria-hidden
      >
        <span
          className="absolute top-1 left-1 text-[9px] tabular-nums leading-none"
          style={{
            ...fontDisplay,
            color: "rgba(150, 130, 110, 0.22)",
          }}
        >
          {day}
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-square flex items-center justify-center">
      {/* Day number — corner of the cell, not the node, so it's
          legible without crowding the icon. */}
      <span
        className="absolute top-0.5 left-1 text-[9px] tabular-nums leading-none pointer-events-none"
        style={{
          ...fontDisplay,
          color: isToday ? "#d4a017" : isFuture ? "#5a5246" : "#8b8275",
          fontWeight: isToday ? 700 : 500,
          zIndex: 3,
        }}
      >
        {day}
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`relative rounded-full transition flex items-center justify-center ${
          isToday ? "knight-pulse" : ""
        } ${onClick ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
        style={{
          width: NODE,
          height: NODE,
          zIndex: 2,
          background: fill,
          border: `1.5px solid ${ring}`,
          opacity: isFuture ? 0.55 : 1,
          filter: isFuture ? "blur(0.3px)" : undefined,
          boxShadow: isToday
            ? `0 0 12px ${ring}99, inset 0 0 8px ${ring}55`
            : isCleared
            ? `0 0 8px ${ring}66, inset 0 0 6px ${ring}33`
            : "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
        aria-label={`Day ${day}${isToday ? " · Today" : ""}`}
        title={
          isFuture
            ? `Day ${day} · upcoming`
            : isToday
            ? `Today · ${steps.toLocaleString()} steps`
            : isCleared
            ? `Day ${day} · ${steps.toLocaleString()} steps · cleared`
            : isFailed
            ? `Day ${day} · ${steps.toLocaleString()} steps · under goal`
            : `Day ${day} · no data`
        }
      >
        {Icon}
      </button>
    </div>
  );
}

function WaypointNode({
  x,
  y,
  day,
  steps,
  status,
  personalGoal,
  onClick,
}: {
  x: number;
  y: number;
  day: number;
  steps: number;
  status: WaypointStatus;
  personalGoal: number;
  onClick?: () => void;
}) {
  const isFuture = status === "future";
  const isToday = status === "today";
  const isCleared = status === "past_met";
  const isFailed = status === "past_unmet";
  const isNoData = status === "past_no_data";
  const personalCleared = isCleared && steps >= personalGoal;

  const size = isToday ? 56 : 44;
  const ring =
    isToday
      ? "#d4a017"
      : personalCleared
      ? "#d4a017"
      : isCleared
      ? "#a855f7"
      : isFailed
      ? "#5a5246"
      : isNoData
      ? "#3a3340"
      : "#2a2030";
  const fill =
    isToday
      ? "#1a0e2a"
      : personalCleared
      ? "rgba(212, 160, 23, 0.18)"
      : isCleared
      ? "rgba(168, 85, 247, 0.18)"
      : isFailed
      ? "rgba(58, 51, 64, 0.6)"
      : isNoData
      ? "rgba(20, 14, 30, 0.7)"
      : "rgba(8, 8, 16, 0.55)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={`Day ${day}${
        isToday
          ? " · Today"
          : isCleared
          ? ` · ${steps.toLocaleString()} steps · cleared`
          : isFailed
          ? ` · ${steps.toLocaleString()} steps · under goal`
          : isNoData
          ? " · no data"
          : ""
      }`}
      className={`absolute rounded-full flex items-center justify-center transition ${
        isToday ? "knight-pulse" : ""
      } ${isFuture ? "" : "hover:scale-110"}`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        background: fill,
        border: `2px solid ${ring}`,
        boxShadow: isToday
          ? `0 0 14px ${ring}, inset 0 0 12px ${ring}55`
          : isCleared
          ? `0 0 10px ${ring}88, inset 0 1px 0 rgba(255,255,255,0.05)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        opacity: isFuture ? 0.45 : 1,
        filter: isFuture ? "blur(0.5px)" : undefined,
        cursor: onClick ? "pointer" : "default",
      }}
      aria-label={`Day ${day}`}
    >
      {/* Icon by status */}
      {isToday && <KnightIcon color="#d4a017" />}
      {!isToday && isCleared && (
        <span className="torch-flicker">
          <TorchIcon color={personalCleared ? "#d4a017" : "#a855f7"} />
        </span>
      )}
      {!isToday && isFailed && <ExtinguishedTorchIcon color="#5a5246" />}
      {!isToday && isNoData && <SkullIcon color="#3a3340" />}
      {isFuture && (
        <span
          className="text-[14px] font-bold"
          style={{ ...fontDisplay, color: "rgba(180, 160, 200, 0.5)" }}
        >
          ?
        </span>
      )}

      {/* Day number tucked in the corner */}
      <span
        className="absolute -bottom-5 text-[9px] tabular-nums"
        style={{
          ...fontDisplay,
          color: isToday ? "#d4a017" : isFuture ? "#5a5246" : "#8b8275",
          fontWeight: isToday ? 700 : 500,
        }}
      >
        {day}
      </span>
    </button>
  );
}

// ─── Atmospheric icons (inline SVG, sized by parent button) ──────
function KnightIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      {/* Stylised helmet silhouette */}
      <path
        d="M5 11 Q5 5 12 5 Q19 5 19 11 L19 16 Q19 19 16 19 L8 19 Q5 19 5 16 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Visor slit */}
      <rect x="7" y="11.5" width="10" height="1.6" fill="#0a0a14" />
      <rect x="9" y="14.5" width="6" height="1" fill="#0a0a14" />
      {/* Plume */}
      <path d="M11 5 L13 5 L12 2 Z" fill={color} />
    </svg>
  );
}
function TorchIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      {/* Handle */}
      <rect x="10.5" y="13" width="3" height="9" rx="0.5" fill="#5a4030" />
      {/* Cup */}
      <rect x="9" y="11.5" width="6" height="2.5" rx="0.5" fill="#3a2820" />
      {/* Flame */}
      <path
        d="M12 3 Q9 7 9 10 Q9 12.5 12 12.5 Q15 12.5 15 10 Q15 7 12 3 Z"
        fill={color}
      />
      <path
        d="M12 5 Q10.5 8 10.5 10 Q10.5 11.5 12 11.5 Q13.5 11.5 13.5 10 Q13.5 8 12 5 Z"
        fill="#fff"
        opacity="0.45"
      />
    </svg>
  );
}
function ExtinguishedTorchIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <rect x="10.5" y="13" width="3" height="9" rx="0.5" fill="#3a2820" />
      <rect x="9" y="11.5" width="6" height="2.5" rx="0.5" fill="#2a1810" />
      {/* Smoke wisp */}
      <path
        d="M12 4 Q10.5 6 11 8 Q12 10 11 12"
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
function SkullIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M6 11 Q6 5 12 5 Q18 5 18 11 L18 14 Q18 16 16 16 L15 16 L15 18 L13 18 L13 16 L11 16 L11 18 L9 18 L9 16 L8 16 Q6 16 6 14 Z"
        fill={color}
      />
      <circle cx="9.5" cy="11" r="1.4" fill="#0a0a14" />
      <circle cx="14.5" cy="11" r="1.4" fill="#0a0a14" />
      <rect x="11.4" y="13" width="1.2" height="1.6" fill="#0a0a14" />
    </svg>
  );
}
function DeadTree({
  className,
  height = 100,
  flip,
}: {
  className?: string;
  height?: number;
  flip?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 100"
      width={height * 0.4}
      height={height}
      aria-hidden
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path
        d="M20 100 L20 50 M20 80 L8 60 M20 70 L32 50 M20 60 L12 45 M20 50 L26 38 M20 50 L14 30 M20 38 L24 25 M20 30 L18 18"
        stroke="#1a1018"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 100 L20 50 M20 80 L8 60 M20 70 L32 50"
        stroke="#0a0608"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Stat tablet — stone-tablet styled stat card ─────────────────
function StatTablet({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="relative rounded p-4 text-center overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(40, 30, 50, 0.55), rgba(20, 14, 30, 0.75)), var(--noise-bg)",
        border: `1px solid ${accent}55`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 6px rgba(0,0,0,0.55), 0 0 14px ${accent}1F`,
      }}
    >
      <span
        aria-hidden
        className="absolute top-1 left-1 w-2 h-2 rounded-full"
        style={{ background: accent, opacity: 0.6 }}
      />
      <span
        aria-hidden
        className="absolute top-1 right-1 w-2 h-2 rounded-full"
        style={{ background: accent, opacity: 0.6 }}
      />
      <div
        className="text-[9px] uppercase tracking-[0.28em] font-bold mb-1"
        style={{ ...fontDisplay, color: accent }}
      >
        {label}
      </div>
      <div
        className="text-3xl font-bold tabular-nums leading-none"
        style={{
          ...fontDisplay,
          color: "#d8d2c2",
          textShadow: `0 0 10px ${accent}66, 0 1px 0 rgba(0,0,0,0.7)`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TodayPanel({
  todaySteps,
  baseGoal,
  personalGoal,
  remainingToBase,
  remainingToPersonal,
  points,
}: {
  todaySteps: number;
  baseGoal: number;
  personalGoal: number;
  remainingToBase: number;
  remainingToPersonal: number;
  points: ReturnType<typeof computeDailyJourneyPoints>;
}) {
  const basePct = Math.min(1, baseGoal > 0 ? todaySteps / baseGoal : 0);
  const personalPct = Math.min(
    1,
    personalGoal > 0 ? todaySteps / personalGoal : 0
  );
  const baseColor =
    todaySteps < baseGoal
      ? "#a83232"
      : todaySteps >= personalGoal
      ? "#d4a017"
      : "#a855f7";
  const personalColor = points.personalGoalMet ? "#d4a017" : "#5b3993";
  const scorePositive = points.total >= 0;
  return (
    <section className="tablet relative rounded p-5">
      <span className="corner-bl" />
      <span className="corner-br" />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold/80 font-bold"
            style={fontDisplay}
          >
            Today's Steps
          </div>
          <div
            className="text-4xl font-bold tabular-nums leading-none mt-1"
            style={{
              ...fontDisplay,
              color: points.personalGoalMet
                ? "#d4a017"
                : points.baseGoalMet
                ? "#a855f7"
                : "#d8d2c2",
              textShadow: points.personalGoalMet
                ? "0 0 18px rgba(212, 160, 23, 0.45)"
                : undefined,
            }}
          >
            {todaySteps.toLocaleString()}
          </div>
        </div>

        <div
          className="rounded px-3 py-2 text-right"
          style={{
            background: scorePositive
              ? "rgba(212, 160, 23, 0.12)"
              : "rgba(168, 50, 50, 0.12)",
            border: scorePositive
              ? "1px solid rgba(212, 160, 23, 0.4)"
              : "1px solid rgba(168, 50, 50, 0.4)",
          }}
        >
          <div
            className="text-[9px] uppercase tracking-[0.2em] font-bold"
            style={{
              ...fontDisplay,
              color: scorePositive ? "#d4a017" : "#a83232",
            }}
          >
            Today's Score
          </div>
          <div
            className="text-xl font-bold tabular-nums leading-tight"
            style={{
              ...fontDisplay,
              color: scorePositive ? "#d4a017" : "#a83232",
            }}
          >
            {scorePositive ? "+" : ""}
            {Math.round(points.total)} pts
          </div>
        </div>
      </div>

      {points.personalGoalMet && (
        <div
          className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.22em] font-bold"
          style={{
            ...fontDisplay,
            color: "#d4a017",
            background: "rgba(212, 160, 23, 0.12)",
            border: "1px solid rgba(212, 160, 23, 0.45)",
            boxShadow: "0 0 14px rgba(212, 160, 23, 0.25)",
          }}
        >
          ★ Personal Goal Achieved · 1.5× multiplier
        </div>
      )}

      {/* Personal goal bar (shown above) */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] mb-1">
          <span className="font-bold" style={{ ...fontDisplay, color: "#d4a017" }}>
            Personal · {personalGoal.toLocaleString()}
          </span>
          <span className="text-muted tabular-nums">
            {remainingToPersonal > 0 ? (
              <>
                <span className="text-ink font-semibold">
                  {remainingToPersonal.toLocaleString()}
                </span>{" "}
                to go
              </>
            ) : (
              <span style={{ color: "#d4a017" }}>Achieved</span>
            )}
          </span>
        </div>
        <div className="xp-track" style={{ height: 8 }}>
          {personalPct > 0 && (
            <div
              className="xp-fill"
              style={{
                width: `${personalPct * 100}%`,
                background: personalColor,
                boxShadow: points.personalGoalMet
                  ? "0 0 10px rgba(212, 160, 23, 0.55)"
                  : undefined,
              }}
            />
          )}
        </div>
      </div>

      {/* Base goal bar (always visible) */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] mb-1">
          <span
            className="font-bold"
            style={{
              ...fontDisplay,
              color: todaySteps < baseGoal ? "#a83232" : "#a855f7",
            }}
          >
            Base · {baseGoal.toLocaleString()}
          </span>
          <span className="text-muted tabular-nums">
            {remainingToBase > 0 ? (
              <>
                <span className="text-ink font-semibold">
                  {remainingToBase.toLocaleString()}
                </span>{" "}
                to go
              </>
            ) : (
              <span style={{ color: "#a855f7" }}>Met</span>
            )}
          </span>
        </div>
        <div className="xp-track" style={{ height: 6 }}>
          {basePct > 0 && (
            <div
              className="xp-fill"
              style={{ width: `${basePct * 100}%`, background: baseColor }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Set-Goal popover ──────────────────────────────────────────────
function SetGoalPopover({
  baseGoal,
  initialPersonalGoal,
  open,
  setOpen,
  onSave,
  busy,
  err,
}: {
  baseGoal: number;
  initialPersonalGoal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSave: (goal: number) => void | Promise<void>;
  busy: boolean;
  err: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState(String(initialPersonalGoal));

  useEffect(() => setDraft(String(initialPersonalGoal)), [initialPersonalGoal]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-stone btn-stone-ghost text-[10px]"
        style={{ padding: "0.5rem 0.9rem" }}
      >
        Set Goal
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 z-30 tablet rounded p-3"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <span className="corner-bl" />
          <span className="corner-br" />

          {/* Base goal — fixed, shown for context */}
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1"
            style={{ ...fontDisplay, color: "#a855f7" }}
          >
            Base Goal
          </div>
          <div
            className="rounded px-3 py-2 mb-3 text-sm tabular-nums flex items-baseline justify-between"
            style={{
              background: "rgba(20, 14, 30, 0.55)",
              border: "1px solid rgba(168, 85, 247, 0.35)",
            }}
          >
            <span className="text-ink font-semibold">
              {baseGoal.toLocaleString()}
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted">
              steps · fixed
            </span>
          </div>

          {/* Personal goal — editable */}
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1"
            style={{ ...fontDisplay, color: "#d4a017" }}
          >
            Personal Goal
          </div>
          <input
            type="number"
            min={baseGoal + 1}
            step="500"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full"
            autoFocus
          />
          <p className="mt-1 text-[10px] text-muted">
            Must exceed {baseGoal.toLocaleString()}. Hitting it earns the 1.5×
            multiplier on that day's score.
          </p>
          {err && <p className="mt-2 text-[11px] text-danger">{err}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onSave(Number(draft))}
              disabled={busy}
              className="btn-stone flex-1 text-[10px]"
              style={{ padding: "0.55rem 0.75rem" }}
            >
              {busy ? "Saving" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              className="btn-stone btn-stone-ghost text-[10px]"
              style={{ padding: "0.55rem 0.75rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick-add presets (with date picker) ──────────────────────────
function QuickAddSteps({
  byDate,
  onAdd,
  onCancel,
  busy,
}: {
  byDate: Map<string, number>;
  onAdd: (delta: number, date: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<null | "custom">(null);
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState<string>(today());
  const isPast = date !== today();
  const existing = byDate.get(date) ?? 0;
  const verb = existing > 0 ? "Update" : "Add";
  return (
    <div className="space-y-3">
      {/* Date row */}
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className="text-[10px] uppercase tracking-[0.18em] text-muted"
          style={fontDisplay}
        >
          Date
        </span>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1"
          style={{ minHeight: 36, padding: "6px 10px" }}
        />
      </div>
      {(isPast || existing > 0) && (
        <div
          className="text-[11px] text-muted text-center"
          style={fontDisplay}
        >
          <span className="uppercase tracking-[0.18em]">{verb}</span>
          {existing > 0 ? (
            <>
              {" · current "}
              <span className="text-gold tabular-nums font-semibold">
                {existing.toLocaleString()}
              </span>
            </>
          ) : (
            " · no steps yet"
          )}
        </div>
      )}

      {mode !== "custom" && (
        <div className="grid grid-cols-4 gap-2">
          {[1000, 5000, 10000].map((n) => (
            <button
              key={n}
              onClick={() => onAdd(n, date)}
              disabled={busy}
              className="btn-stone btn-stone-ghost text-[11px]"
              style={{ padding: "0.7rem 0.4rem" }}
            >
              +{n.toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setMode("custom")}
            disabled={busy}
            className="btn-stone btn-stone-ghost text-[11px]"
            style={{ padding: "0.7rem 0.4rem" }}
          >
            Custom
          </button>
        </div>
      )}
      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Steps"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            autoFocus
            className="flex-1"
          />
          <button
            onClick={() => {
              const n = Number(custom);
              if (n > 0) onAdd(n, date);
            }}
            disabled={busy || !custom}
            className="btn-stone text-[10px]"
            style={{ padding: "0.6rem 1rem" }}
          >
            {verb}
          </button>
          <button
            onClick={() => setMode(null)}
            disabled={busy}
            className="btn-stone btn-stone-ghost text-[10px]"
            style={{ padding: "0.6rem 0.75rem" }}
          >
            Back
          </button>
        </div>
      )}
      <button
        onClick={onCancel}
        disabled={busy}
        className="block mx-auto text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink transition"
        style={fontDisplay}
      >
        Close
      </button>
    </div>
  );
}

// ─── Cardinal card (compass-point stat tile) ───────────────────────
function CardinalCard({
  label,
  value,
  accent,
  side,
}: {
  label: string;
  value: string;
  accent: string;
  side?: "left" | "right";
}) {
  return (
    <div
      className="relative rounded px-4 py-3 text-center min-w-[170px]"
      style={{
        background: "rgba(12, 12, 24, 0.72)",
        border: `1px solid ${accent}55`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px ${accent}26`,
        textAlign: side ? "center" : "center",
      }}
    >
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-bold"
        style={{ ...fontDisplay, color: accent }}
      >
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-0.5 text-ink">
        {value}
      </div>
    </div>
  );
}

// ─── Chart card ────────────────────────────────────────────────────
function ChartCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="tablet relative rounded p-5">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
          style={fontDisplay}
        >
          {title}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ─── Past Entries (last 30 days, inline edit) ─────────────────────
function PastEntries({
  days,
  goal,
  onSave,
  busy,
}: {
  days: Array<{ date: string; steps: number; label: string }>;
  goal: number;
  onSave: (steps: number, date: string) => void;
  busy: boolean;
}) {
  // Newest first.
  const ordered = [...days].reverse();
  return (
    <ul className="divide-y divide-border max-h-[360px] overflow-y-auto pr-1">
      {ordered.map((d) => (
        <PastEntryRow
          key={d.date}
          date={d.date}
          steps={d.steps}
          goal={goal}
          onSave={onSave}
          busy={busy}
        />
      ))}
    </ul>
  );
}

function PastEntryRow({
  date,
  steps,
  goal,
  onSave,
  busy,
}: {
  date: string;
  steps: number;
  goal: number;
  onSave: (steps: number, date: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(steps > 0 ? String(steps) : "");
  const isToday = date === today();
  const empty = steps === 0;
  const hit = !empty && steps >= goal;

  function commit() {
    const n = Number(draft);
    if (!isFinite(n) || n < 0) return;
    onSave(n, date);
    setEditing(false);
  }

  return (
    <li className="py-2.5 flex items-center gap-3">
      <div className="w-28 shrink-0">
        <div
          className="text-[11px] uppercase tracking-[0.16em] font-bold leading-tight"
          style={{
            fontFamily: "var(--font-cinzel), Georgia, serif",
            color: isToday ? "#b8860b" : "#d8d2c2",
          }}
        >
          {longDate(date)}
          {isToday && (
            <span className="ml-1 text-[9px] text-gold/70">today</span>
          )}
        </div>
      </div>

      {!editing && (
        <>
          <div className="flex-1 text-sm tabular-nums">
            {empty ? (
              <span className="text-muted/60 italic">—</span>
            ) : (
              <span className={hit ? "text-gold font-semibold" : "text-ink"}>
                {steps.toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] w-16 text-right">
            {empty ? (
              <span className="text-muted/40">—</span>
            ) : hit ? (
              <span className="text-gold">Met</span>
            ) : (
              <span className="text-muted">Under</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(steps > 0 ? String(steps) : "");
              setEditing(true);
            }}
            disabled={busy}
            className="text-[10px] uppercase tracking-[0.18em] text-accent hover:text-accent-soft disabled:opacity-40 transition"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            {empty ? "Add" : "Edit"}
          </button>
        </>
      )}

      {editing && (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            placeholder="Steps"
            className="flex-1"
            style={{ minHeight: 36, padding: "6px 10px" }}
          />
          <button
            type="button"
            onClick={commit}
            disabled={busy || draft === ""}
            className="btn-stone text-[10px]"
            style={{ padding: "0.5rem 0.75rem" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="btn-stone btn-stone-ghost text-[10px]"
            style={{ padding: "0.5rem 0.65rem" }}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

// Both shortDate and longDate now route through the shared formatDate
// utility so the entire app uses the same Today / Yesterday / N days
// ago / Last <Weekday> / May 4 / May 4, 2026 progression.
const shortDate = formatDate;
const longDate = formatDate;

// ─── Calendar streak heatmap ───────────────────────────────────────
function CalendarHeatmap({
  days,
  baseGoal,
  personalGoal,
}: {
  days: Array<{ date: string; steps: number }>;
  baseGoal: number;
  personalGoal: number;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
    >
      {days.map((d) => {
        const empty = d.steps === 0;
        const personalHit = d.steps >= personalGoal;
        const baseHit = !personalHit && d.steps >= baseGoal;
        const underBase = !empty && !baseHit && !personalHit;
        const bg = empty
          ? "#1e1e3a"
          : personalHit
          ? "#d4a017"
          : baseHit
          ? "#5b3993"
          : "#3a5a8a";
        const shadow = personalHit
          ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 0 6px rgba(212,160,23,0.45)"
          : baseHit
          ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 4px rgba(91,57,147,0.35)"
          : underBase
          ? "inset 0 1px 0 rgba(255,255,255,0.08)"
          : undefined;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.steps.toLocaleString()} steps`}
            className="aspect-square rounded-full"
            style={{
              background: bg,
              boxShadow: shadow,
              opacity: empty ? 0.55 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
function buildLastNDays(
  n: number,
  byDate: Map<string, number>,
  goal: number
): Array<{ date: string; steps: number; goal: number; label: string }> {
  const out: Array<{ date: string; steps: number; goal: number; label: string }> = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const steps = byDate.get(iso) ?? 0;
    out.push({
      date: iso,
      steps,
      goal,
      label:
        n <= 7
          ? d.toLocaleDateString(undefined, { weekday: "short" })
          : `${d.getMonth() + 1}/${d.getDate()}`,
    });
  }
  return out;
}

function avg(xs: number[]) {
  if (xs.length === 0) return 0;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function fmt(n: number) {
  return n.toLocaleString();
}

/**
 * Streak of consecutive days hitting `goal` ending on the most-recent
 * day in `days`. `days` is oldest-first. Days with 0 steps are
 * treated as "not logged" and skipped (don't increment, don't reset),
 * matching the Journey scoring rule.
 */
function streakOnlyLogged(
  days: Array<{ date: string; steps: number }>,
  goal: number
): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i].steps;
    if (s === 0) continue; // unlogged → skip
    if (s >= goal) streak += 1;
    else break;
  }
  return streak;
}

// ─── Journey day modal ────────────────────────────────────────────
function JourneyDayModal({
  date,
  stepsValue,
  goal,
  busy,
  onClose,
  onSave,
}: {
  date: string;
  stepsValue: number;
  goal: number;
  busy: boolean;
  onClose: () => void;
  onSave: (value: number) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<string>(
    stepsValue > 0 ? String(stepsValue) : ""
  );
  const pct = goal > 0 ? Math.min(1, (Number(draft) || 0) / goal) : 0;
  const hit = Number(draft) >= goal;

  useEffect(() => {
    setDraft(stepsValue > 0 ? String(stepsValue) : "");
  }, [stepsValue]);

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
      style={{ animation: "modalFadeIn 180ms ease-out" }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full max-w-sm space-y-4"
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
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              Journey
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              {longDate(date)}
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

        <div className="text-center">
          <div
            className="text-5xl font-bold tabular-nums leading-none gold-text"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            {(Number(draft) || stepsValue).toLocaleString()}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.20em] text-muted">
            / {goal.toLocaleString()} goal
          </div>
          <div className="mt-3 mx-auto max-w-xs xp-track" style={{ height: 6 }}>
            {pct > 0 && (
              <div
                className="xp-fill"
                style={{
                  width: `${pct * 100}%`,
                  background: hit
                    ? "linear-gradient(180deg, #7747b0, #3a2466)"
                    : "linear-gradient(180deg, #4a72a8, #2a4060)",
                }}
              />
            )}
          </div>
        </div>

        <div>
          <label
            className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-1.5 font-bold"
            style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
          >
            Steps
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSave(Number(draft) || 0)}
            disabled={busy || draft === ""}
            className="btn-stone flex-1"
          >
            {busy ? "Saving…" : "Save"}
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
      </div>
    </div>
  );
}
