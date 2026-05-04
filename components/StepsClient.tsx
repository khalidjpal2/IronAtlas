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
import { todayPT } from "@/lib/time";

export type StepsRow = { date: string; steps: number; goal: number };

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  goal: number;
  rows: StepsRow[];
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };
// "Today" everywhere = the user's calendar day in California (PT).
const today = () => todayPT();

export default function StepsClient({
  username,
  isAdmin,
  profile,
  goal: initialGoal,
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
  const remainingToday = Math.max(0, initialGoal - todayCount);

  // Popover + quick-add state
  const [goalOpen, setGoalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<"goal" | "add" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar cells — one per day this month, status = met/low/none.
  const journeyCells = useMemo(() => {
    const m = new Map<string, CalendarCell>();
    byDate.forEach((steps, iso) => {
      if (steps <= 0) return;
      m.set(iso, {
        date: iso,
        status: steps >= initialGoal ? "met" : "low",
        hint: steps >= 1000 ? `${Math.round(steps / 1000)}k` : String(steps),
      });
    });
    return m;
  }, [byDate, initialGoal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived stats ─────────────────────────────────────────────
  const last7 = useMemo(
    () => buildLastNDays(7, byDate, initialGoal),
    [byDate, initialGoal]
  );
  const last30 = useMemo(
    () => buildLastNDays(30, byDate, initialGoal),
    [byDate, initialGoal]
  );
  const avg7 = avg(last7.map((d) => d.steps));
  const avg30 = avg(last30.map((d) => d.steps));
  const goalsHit7 = last7.filter((d) => d.steps >= initialGoal).length;
  const { current: streak, best: bestStreak } = computeStreaks(
    last30,
    initialGoal
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
          goal: initialGoal,
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
          goal: initialGoal,
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
    if (!newGoal || newGoal < 100) {
      setErr("Goal must be at least 100");
      return;
    }
    setBusy("goal");
    setErr(null);
    try {
      const res = await fetch("/api/step-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daily_goal: newGoal }),
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

  return (
    <div className="min-h-screen flex flex-col bg-bg pb-24 md:pb-0">
      <AppHeader username={username} isAdmin={isAdmin} profile={profile} />

      <main className="flex-1 w-full px-6 lg:px-10 py-6 space-y-6">
        {/* === HEADER ROW === */}
        <header className="flex items-center justify-between gap-4">
          <h1
            className="text-3xl font-bold tracking-tight text-ink"
            style={{
              ...fontDisplay,
              textShadow: "0 0 18px rgba(58, 90, 138, 0.30)",
            }}
          >
            Journey
          </h1>
          <SetGoalPopover
            initialGoal={initialGoal}
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

        {/* === COMPASS HERO === */}
        <section className="tablet relative rounded p-6 sm:p-8">
          <span className="corner-bl" />
          <span className="corner-br" />

          {/* Layout: cards laid out around the wheel — N (top), W
              (left), E (right), S (bottom). On narrow viewports the
              cards collapse to a 2x2 grid below the wheel. */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center gap-6">
            <div className="flex flex-col items-end justify-center gap-3">
              <CardinalCard
                label="W · Month Avg"
                value={fmt(avg30)}
                accent="#3a5a8a"
                side="right"
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <CardinalCard
                label="N · Current Streak"
                value={`${streak}d`}
                accent="#b8860b"
              />
              <CompassWheel
                days30={compass30}
                days7={compass7}
                todaySteps={todayCount}
                goal={initialGoal}
              />
              <CardinalCard
                label="S · Best Streak"
                value={`${bestStreak}d`}
                accent="#a855f7"
              />
            </div>
            <div className="flex flex-col items-start justify-center gap-3">
              <CardinalCard
                label="E · Week Avg"
                value={fmt(avg7)}
                accent="#3a5a8a"
                side="left"
              />
            </div>
          </div>

          <div className="lg:hidden flex flex-col items-center gap-4">
            <CardinalCard
              label="N · Current Streak"
              value={`${streak}d`}
              accent="#b8860b"
            />
            <CompassWheel
              days30={compass30}
              days7={compass7}
              todaySteps={todayCount}
              goal={initialGoal}
            />
            <CardinalCard
              label="S · Best Streak"
              value={`${bestStreak}d`}
              accent="#a855f7"
            />
            <div className="grid grid-cols-2 gap-3 w-full">
              <CardinalCard
                label="W · Month Avg"
                value={fmt(avg30)}
                accent="#3a5a8a"
              />
              <CardinalCard
                label="E · Week Avg"
                value={fmt(avg7)}
                accent="#3a5a8a"
              />
            </div>
          </div>

          {/* CTA */}
          {!addOpen && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="btn-stone px-10 text-[11px]"
                style={{
                  ...fontDisplay,
                  letterSpacing: "0.22em",
                }}
              >
                Mark Today's Journey
              </button>
              <div className="text-[11px] text-muted">
                {remainingToday > 0 ? (
                  <>
                    <span className="text-gold font-semibold">
                      {remainingToday.toLocaleString()}
                    </span>{" "}
                    more to reach today's goal
                  </>
                ) : (
                  <span className="text-gold/80 uppercase tracking-[0.18em] text-[10px]">
                    Goal achieved · {goalsHit7}/7 this week
                  </span>
                )}
              </div>
            </div>
          )}

          {addOpen && (
            <div className="mt-8 max-w-md mx-auto">
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-2 font-bold text-center"
                style={fontDisplay}
              >
                Mark Today's Journey
              </div>
              <QuickAddSteps
                byDate={byDate}
                onAdd={applyDelta}
                onCancel={() => setAddOpen(false)}
                busy={busy === "add"}
              />
            </div>
          )}
        </section>

        {/* === CALENDAR + WEEKLY CHART side-by-side === */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <ChartCard title="Monthly Calendar">
            <MonthCalendar
              cells={journeyCells}
              onDayClick={(d) => setSelectedDate(d)}
              legend={[
                { status: "met",  label: "Goal hit" },
                { status: "low",  label: "Under goal" },
                { status: "none", label: "No data" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Last 7 Days">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart
                  data={last7}
                  margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={chart.axis}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={chart.axis}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <Tooltip
                    cursor={{ fill: chart.cursor }}
                    contentStyle={tooltipStyle(chart)}
                    formatter={(v: any) => [fmt(Number(v)), "Steps"]}
                  />
                  <ReferenceLine
                    y={initialGoal}
                    stroke={chart.goalLine}
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                  />
                  <Bar dataKey="steps" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {last7.map((d) => (
                      <Cell
                        key={d.date}
                        fill={d.steps >= initialGoal ? chart.barMet : chart.barUnder}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Streak"
          aside={
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em]">
              <span className="text-muted">Current</span>
              <span className="text-gold font-bold tabular-nums">
                {streak}d
              </span>
              <span className="text-muted/60">·</span>
              <span className="text-muted">Best</span>
              <span className="text-gold font-bold tabular-nums">
                {bestStreak}d
              </span>
            </div>
          }
        >
          <CalendarHeatmap days={last30} goal={initialGoal} />
        </ChartCard>

        {/* === PAST ENTRIES === */}
        <ChartCard title="Past Entries">
          <PastEntries
            days={last30}
            goal={initialGoal}
            onSave={replaceSteps}
            busy={busy === "add"}
          />
        </ChartCard>
      </main>

      {/* Journey day modal */}
      {selectedDate && (
        <JourneyDayModal
          date={selectedDate}
          stepsValue={byDate.get(selectedDate) ?? 0}
          goal={initialGoal}
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

// ─── Set-Goal popover ──────────────────────────────────────────────
function SetGoalPopover({
  initialGoal,
  open,
  setOpen,
  onSave,
  busy,
  err,
}: {
  initialGoal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSave: (goal: number) => void | Promise<void>;
  busy: boolean;
  err: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState(String(initialGoal));

  useEffect(() => setDraft(String(initialGoal)), [initialGoal]);

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
          className="absolute right-0 top-full mt-2 w-64 z-30 tablet rounded p-3"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <span className="corner-bl" />
          <span className="corner-br" />
          <div
            className="text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-2"
            style={fontDisplay}
          >
            Daily Goal
          </div>
          <input
            type="number"
            min="100"
            step="100"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full"
            autoFocus
          />
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

function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function longDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ─── Calendar streak heatmap ───────────────────────────────────────
function CalendarHeatmap({
  days,
  goal,
}: {
  days: Array<{ date: string; steps: number }>;
  goal: number;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
    >
      {days.map((d) => {
        const hit = d.steps >= goal;
        const empty = d.steps === 0;
        const partial = !empty && !hit;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.steps.toLocaleString()} steps`}
            className="aspect-square rounded-full"
            style={{
              background: empty
                ? "#1e1e3a"
                : hit
                ? "#5b3993"
                : "#3a5a8a",
              boxShadow: hit
                ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 4px rgba(91,57,147,0.35)"
                : partial
                ? "inset 0 1px 0 rgba(255,255,255,0.08)"
                : undefined,
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

function computeStreaks(
  days: Array<{ date: string; steps: number }>,
  goal: number
): { current: number; best: number } {
  let cur = 0,
    best = 0,
    curRun = 0;
  for (const d of days) {
    if (d.steps >= goal) {
      curRun += 1;
      if (curRun > best) best = curRun;
    } else {
      curRun = 0;
    }
  }
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].steps >= goal) cur += 1;
    else break;
  }
  return { current: cur, best };
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
