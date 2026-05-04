"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import MonthCalendar, { type CalendarCell } from "@/components/MonthCalendar";
import FeastPlate from "@/components/FeastPlate";
import { tooltipStyle, useChartPalette } from "@/lib/chartTheme";
import { todayPT } from "@/lib/time";

export type NutritionRow = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string | null;
};

type Goals = {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type NutritionMode = "bulk" | "cut" | "maintain";
export type MacroDirection = "negative" | "neutral" | "positive";

export type MacroDirections = {
  protein: MacroDirection;
  carbs: MacroDirection;
  fat: MacroDirection;
};

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  goals: Goals;
  mode: NutritionMode;
  directions: MacroDirections;
  rows: NutritionRow[];
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };
const today = () => todayPT();

export default function CaloriesClient({
  username,
  isAdmin,
  profile,
  goals: initialGoals,
  mode: initialMode,
  directions: initialDirections,
  rows,
}: Props) {
  const router = useRouter();
  const chart = useChartPalette();

  const byDate = useMemo(() => {
    const m = new Map<string, NutritionRow>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  // Today totals come from the daily_nutrition row (kept in sync server-side
  // by /api/meals when meals are added/removed).
  const todayRow = byDate.get(today()) ?? null;
  const tCals = todayRow?.calories ?? 0;
  const tP = todayRow?.protein ?? 0;
  const tC = todayRow?.carbs ?? 0;
  const tF = todayRow?.fat ?? 0;

  const [goalsOpen, setGoalsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<"goals" | "add" | string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar status per day — same logic as the score rubric: within
  // 10% of calorie goal = met, above = over, below = low.
  const provisionsCells = useMemo(() => {
    const m = new Map<string, CalendarCell>();
    byDate.forEach((row, iso) => {
      if (row.calories <= 0) return;
      const goal = initialGoals.calories || 1;
      const dev = (row.calories - goal) / goal;
      const status: CalendarCell["status"] =
        Math.abs(dev) <= 0.10
          ? "met"
          : dev > 0
          ? "over"
          : "low";
      m.set(iso, {
        date: iso,
        status,
        hint:
          row.calories >= 1000
            ? `${Math.round(row.calories / 100) / 10}k`
            : String(row.calories),
      });
    });
    return m;
  }, [byDate, initialGoals.calories]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Stats ───────────────────────────────────────────────────────
  const last7 = useMemo(
    () => buildLastNDays(7, byDate, initialGoals.calories),
    [byDate, initialGoals.calories]
  );
  const last30 = useMemo(
    () => buildLastNDays(30, byDate, initialGoals.calories),
    [byDate, initialGoals.calories]
  );
  // Sum-of-grams goal line (protein + carbs + fat goals; falls back to
  // 0 when any are unset so the line just won't render).
  const totalGramsGoal = useMemo(
    () =>
      (initialGoals.protein ?? 0) +
      (initialGoals.carbs ?? 0) +
      (initialGoals.fat ?? 0),
    [initialGoals.protein, initialGoals.carbs, initialGoals.fat]
  );
  // Per-day totals so the tooltip can show "X total grams" alongside
  // each segment's actual gram value.
  const last7Combined = useMemo(
    () =>
      last7.map((d) => ({
        ...d,
        totalGrams: d.protein + d.carbs + d.fat,
      })),
    [last7]
  );

  const loggedDays7 = last7.filter((d) => d.calories > 0);
  const avgCals7 = avg(loggedDays7.map((d) => d.calories));
  const avgProtein7 = avg(loggedDays7.map((d) => d.protein));
  const onTrack7 = loggedDays7.filter(
    (d) =>
      Math.abs(d.calories - initialGoals.calories) <=
      initialGoals.calories * 0.1
  ).length;
  const { current: streak, best: bestStreak } = computeStreaks(
    last30,
    initialGoals.calories
  );

  async function addMeal(payload: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) {
    setBusy("add");
    setErr(null);
    try {
      // Additive: server reads today's totals and bumps them.
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: today(),
          calories: payload.calories,
          protein_g: payload.protein,
          carbs_g: payload.carbs,
          fat_g: payload.fat,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast("Logged");
      setAddOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function clearToday() {
    if (!window.confirm("Clear today's provisions log?")) return;
    setBusy("clear");
    try {
      const res = await fetch(`/api/meals?date=${today()}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast("Today cleared");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to clear");
    } finally {
      setBusy(null);
    }
  }

  async function saveGoals(
    g: Goals & {
      mode: NutritionMode;
      directions: MacroDirections;
    }
  ) {
    setBusy("goals");
    setErr(null);
    try {
      const res = await fetch("/api/nutrition-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          calorie_goal: g.calories,
          protein_goal_g: g.protein ?? null,
          carbs_goal_g: g.carbs ?? null,
          fat_goal_g: g.fat ?? null,
          mode: g.mode,
          protein_direction: g.directions.protein,
          carbs_direction: g.directions.carbs,
          fat_direction: g.directions.fat,
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[CaloriesClient] save goals response:", data);
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data?.modeColumnMissing || data?.directionColumnsMissing) {
        const missing = [
          data.modeColumnMissing && "`mode`",
          data.directionColumnsMissing && "`protein/carbs/fat_direction`",
        ]
          .filter(Boolean)
          .join(" and ");
        setErr(
          `Goals saved, but ${missing} column(s) are missing in your database. ` +
            "Run supabase/migrations/_run_all.sql in the Supabase SQL editor."
        );
        setToast(null);
      } else {
        setToast("Goals saved");
        setGoalsOpen(false);
      }
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
        {/* === HEADER — title + small mode pill + Set Goals === */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl font-bold tracking-tight text-ink"
              style={{
                ...fontDisplay,
                textShadow: "0 0 18px rgba(61, 107, 58, 0.30)",
              }}
            >
              Provisions
            </h1>
            <ModePill
              mode={initialMode}
              onClick={() => setGoalsOpen(true)}
            />
          </div>
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="btn-stone btn-stone-ghost text-[10px]"
            style={{ padding: "0.5rem 0.9rem" }}
          >
            Set Goals
          </button>
        </header>

        {err && busy !== "goals" && (
          <div className="bg-danger/10 border border-danger/40 rounded px-3 py-2 text-xs text-danger">
            {err}
          </div>
        )}

        {/* === MODE SCROLL === */}
        <ModeScroll mode={initialMode} />

        {/* === FEAST PLATE HERO === */}
        <section className="tablet relative rounded p-6 sm:p-8">
          <span className="corner-bl" />
          <span className="corner-br" />

          <div className="flex justify-center">
            <FeastPlate
              calories={tCals}
              calorieGoal={initialGoals.calories}
              protein={tP}
              proteinGoal={initialGoals.protein}
              carbs={tC}
              carbsGoal={initialGoals.carbs}
              fat={tF}
              fatGoal={initialGoals.fat}
            />
          </div>

          {!addOpen && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="btn-stone px-10 text-[11px]"
                style={{ ...fontDisplay, letterSpacing: "0.22em" }}
              >
                Lay the Feast
              </button>
              {todayRow && (
                <button
                  onClick={clearToday}
                  disabled={busy === "clear"}
                  className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-danger transition disabled:opacity-40"
                  style={fontDisplay}
                  title="Clear today's totals"
                >
                  {busy === "clear" ? "Clearing…" : "Reset Today"}
                </button>
              )}
            </div>
          )}

          {addOpen && (
            <div className="mt-6 max-w-xl mx-auto">
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-gold/80 mb-2 font-bold text-center"
                style={fontDisplay}
              >
                New Entry
              </div>
              <QuickAddMeal
                onAdd={addMeal}
                onCancel={() => setAddOpen(false)}
                busy={busy === "add"}
              />
            </div>
          )}
        </section>

        {/* === TAVERN STAT CARDS === */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TavernCard
            label="Weekly Rations"
            value={fmt(avgCals7)}
            unit="cal/day"
            accent="#7747b0"
            crest="🍷"
          />
          <TavernCard
            label="Days of Virtue"
            value={`${onTrack7}`}
            unit="of last 7"
            accent="#3d6b3a"
            crest="✦"
          />
          <TavernCard
            label="Protein of the Realm"
            value={`${fmt(avgProtein7)}`}
            unit="g/day"
            accent="#c8443a"
            crest="⚔"
          />
          <TavernCard
            label={initialMode === "cut" ? "Longest Fast" : "Longest Feast"}
            value={`${bestStreak}d`}
            unit={streak > 0 ? `current ${streak}d` : "best run"}
            accent="#d4a020"
            crest="🔥"
          />
        </section>

        {/* === CALENDAR + WEEKLY CHART side-by-side === */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <ChartCard title="Monthly Calendar">
            <MonthCalendar
              cells={provisionsCells}
              onDayClick={(d) => setSelectedDate(d)}
              legend={[
                { status: "met",  label: "On track" },
                { status: "low",  label: "Under" },
                { status: "over", label: "Over" },
                { status: "none", label: "No data" },
              ]}
            />
          </ChartCard>

        <ChartCard title="Last 7 Days">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart
                data={last7Combined}
                margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={chart.axis}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "grams",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: chart.axis, fontSize: 10 },
                  }}
                />
                <Tooltip
                  cursor={{ fill: chart.cursor }}
                  contentStyle={tooltipStyle(chart)}
                  formatter={(v: any, name: any) => [
                    `${fmt(Math.round(Number(v)))} g`,
                    name,
                  ]}
                  labelFormatter={(label, payload) => {
                    const total =
                      payload && payload[0]?.payload
                        ? Math.round(payload[0].payload.totalGrams)
                        : 0;
                    return `${label} · ${fmt(total)} g total`;
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    color: chart.axis,
                    paddingTop: 4,
                  }}
                  iconType="square"
                  iconSize={8}
                />
                {totalGramsGoal > 0 && (
                  <ReferenceLine
                    y={totalGramsGoal}
                    stroke={chart.goalLine}
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                    label={{
                      value: "Goal",
                      fill: chart.goalLine,
                      fontSize: 10,
                      position: "right",
                    }}
                  />
                )}
                <Bar dataKey="protein" stackId="g" fill={chart.macroProtein} name="Protein" maxBarSize={56} />
                <Bar dataKey="carbs" stackId="g" fill={chart.macroCarbs} name="Carbs" maxBarSize={56} />
                <Bar dataKey="fat" stackId="g" fill={chart.macroFat} name="Fat" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        </div>
      </main>

      {/* Day-detail modal */}
      {selectedDate && (
        <ProvisionsDayModal
          date={selectedDate}
          row={byDate.get(selectedDate) ?? null}
          goals={initialGoals}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* Goals modal */}
      <SetGoalsModal
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        initialGoals={initialGoals}
        initialMode={initialMode}
        initialDirections={initialDirections}
        onSave={saveGoals}
        busy={busy === "goals"}
        err={err}
      />

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

// ─── Set-Goals popover ─────────────────────────────────────────────
/**
 * Fixed-position centered modal for editing nutrition goals + per-macro
 * directions. The previous popover was anchored to the Set Goals button
 * via absolute positioning, which shifted neighboring layout when it
 * opened on smaller viewports. This version overlays the page (fixed
 * inset 0 backdrop + centered modal) and never affects flow.
 */
function SetGoalsModal({
  open,
  onClose,
  initialGoals,
  initialMode,
  initialDirections,
  onSave,
  busy,
  err,
}: {
  open: boolean;
  onClose: () => void;
  initialGoals: Goals;
  initialMode: NutritionMode;
  initialDirections: MacroDirections;
  onSave: (
    g: Goals & { mode: NutritionMode; directions: MacroDirections }
  ) => void | Promise<void>;
  busy: boolean;
  err: string | null;
}) {
  // Calorie direction is the same data as `mode` — POSITIVE=bulk,
  // NEGATIVE=cut, NEUTRAL=maintain. Storing it as a direction in state
  // simplifies the UI; we map back to mode at save time.
  const modeToDir: Record<NutritionMode, MacroDirection> = {
    bulk: "positive",
    cut: "negative",
    maintain: "neutral",
  };
  const dirToMode: Record<MacroDirection, NutritionMode> = {
    positive: "bulk",
    negative: "cut",
    neutral: "maintain",
  };

  const [cal, setCal] = useState(String(initialGoals.calories));
  const [p, setP] = useState(
    initialGoals.protein != null ? String(initialGoals.protein) : ""
  );
  const [c, setC] = useState(
    initialGoals.carbs != null ? String(initialGoals.carbs) : ""
  );
  const [f, setF] = useState(
    initialGoals.fat != null ? String(initialGoals.fat) : ""
  );
  const [calDir, setCalDir] = useState<MacroDirection>(modeToDir[initialMode]);
  const [pDir, setPDir] = useState<MacroDirection>(initialDirections.protein);
  const [cDir, setCDir] = useState<MacroDirection>(initialDirections.carbs);
  const [fDir, setFDir] = useState<MacroDirection>(initialDirections.fat);

  // Resync with props when they change (after a save → router.refresh).
  useEffect(() => {
    setCal(String(initialGoals.calories));
    setP(initialGoals.protein != null ? String(initialGoals.protein) : "");
    setC(initialGoals.carbs != null ? String(initialGoals.carbs) : "");
    setF(initialGoals.fat != null ? String(initialGoals.fat) : "");
    setCalDir(modeToDir[initialMode]);
    setPDir(initialDirections.protein);
    setCDir(initialDirections.carbs);
    setFDir(initialDirections.fat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGoals, initialMode, initialDirections]);

  // Esc closes; trap is light (focus rings are sufficient here).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Don't render when closed — avoids stray DOM and allows fade-in via
  // a CSS transition keyed on `open`.
  if (!open) return null;

  function suggest() {
    const n = Number(cal);
    if (!n) return;
    setP(String(Math.round((n * 0.3) / 4)));
    setC(String(Math.round((n * 0.4) / 4)));
    setF(String(Math.round((n * 0.3) / 9)));
  }

  function commit() {
    onSave({
      calories: Number(cal) || 0,
      protein: p ? Number(p) : null,
      carbs: c ? Number(c) : null,
      fat: f ? Number(f) : null,
      mode: dirToMode[calDir],
      directions: { protein: pDir, carbs: cDir, fat: fDir },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ animation: "modalFadeIn 180ms ease-out" }}
      onClick={onClose}
      aria-modal
      role="dialog"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal card — stops click propagation so the backdrop's onClick
         only fires when clicking outside. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="tablet relative rounded p-6 w-full"
        style={{
          maxWidth: 480,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
          animation: "modalIn 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
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
              Provisions
            </div>
            <h2
              className="text-xl font-bold tracking-tight text-ink mt-0.5"
              style={fontDisplay}
            >
              Set Goals
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rune-divider mb-4" />

        {/* SECTION 1 — Calories */}
        <GoalSection
          label="Calorie Goal"
          unit=""
          value={cal}
          onChange={setCal}
          dirLabel="Going over calories is..."
          dir={calDir}
          onDir={setCalDir}
          autoFocus
          extra={
            <button
              type="button"
              onClick={suggest}
              className="text-[9px] uppercase tracking-[0.18em] text-accent hover:text-accent-soft"
              style={fontDisplay}
            >
              Auto-fill macros
            </button>
          }
        />

        {/* SECTION 2 — Protein */}
        <GoalSection
          label="Protein Goal"
          unit="g"
          value={p}
          onChange={setP}
          dirLabel="Going over protein is..."
          dir={pDir}
          onDir={setPDir}
        />

        {/* SECTION 3 — Carbs */}
        <GoalSection
          label="Carbs Goal"
          unit="g"
          value={c}
          onChange={setC}
          dirLabel="Going over carbs is..."
          dir={cDir}
          onDir={setCDir}
        />

        {/* SECTION 4 — Fat */}
        <GoalSection
          label="Fat Goal"
          unit="g"
          value={f}
          onChange={setF}
          dirLabel="Going over fat is..."
          dir={fDir}
          onDir={setFDir}
        />

        {err && (
          <p className="mt-3 text-[11px] text-danger leading-snug">{err}</p>
        )}

        <button
          type="button"
          onClick={commit}
          disabled={busy}
          className="btn-stone w-full mt-5"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function GoalSection({
  label,
  unit,
  value,
  onChange,
  dirLabel,
  dir,
  onDir,
  autoFocus,
  extra,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  dirLabel: string;
  dir: MacroDirection;
  onDir: (d: MacroDirection) => void;
  autoFocus?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <label
          className="text-[10px] uppercase tracking-[0.20em] text-gold/80 font-bold"
          style={fontDisplay}
        >
          {label}
        </label>
        {extra}
      </div>
      <div className="relative">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">
            {unit}
          </span>
        )}
      </div>

      <div
        className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted"
        style={fontDisplay}
      >
        {dirLabel}
      </div>
      <DirectionToggle dir={dir} onDir={onDir} />
    </section>
  );
}

function PopField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <label
        className="block text-[9px] uppercase tracking-[0.18em] text-gold/80 mb-1 font-bold"
        style={fontDisplay}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function DirectionToggle({
  dir,
  onDir,
}: {
  dir: MacroDirection;
  onDir: (d: MacroDirection) => void;
}) {
  const opts: Array<{ key: MacroDirection; label: string; color: string }> = [
    { key: "negative", label: "Negative", color: "#dc2626" },
    { key: "neutral",  label: "Neutral",  color: "#94a3b8" },
    { key: "positive", label: "Positive", color: "#16a34a" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
      {opts.map((o) => {
        const active = o.key === dir;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onDir(o.key)}
            className={`text-[10px] py-1.5 rounded-full uppercase tracking-[0.16em] font-bold transition border ${
              active
                ? "text-ink"
                : "text-muted hover:text-ink"
            }`}
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              borderColor: active ? o.color : "var(--bronze-deep)",
              background: active ? `${o.color}22` : "transparent",
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 8px ${o.color}33`
                : undefined,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Quick-add meal form ───────────────────────────────────────────
function QuickAddMeal({
  onAdd,
  onCancel,
  busy,
}: {
  onAdd: (p: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      name: name.trim(),
      calories: Number(cal) || 0,
      protein: Number(p) || 0,
      carbs: Number(c) || 0,
      fat: Number(f) || 0,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label
          className="block text-[10px] uppercase tracking-[0.20em] text-gold/80 mb-1.5 font-bold"
          style={fontDisplay}
        >
          Meal name (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Breakfast"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PopField label="Calories">
          <input
            type="number"
            min="0"
            value={cal}
            onChange={(e) => setCal(e.target.value)}
            required
          />
        </PopField>
        <PopField label="Protein g">
          <input type="number" min="0" value={p} onChange={(e) => setP(e.target.value)} />
        </PopField>
        <PopField label="Carbs g">
          <input type="number" min="0" value={c} onChange={(e) => setC(e.target.value)} />
        </PopField>
        <PopField label="Fat g">
          <input type="number" min="0" value={f} onChange={(e) => setF(e.target.value)} />
        </PopField>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !cal}
          className="btn-stone flex-1"
        >
          {busy ? "Saving" : "Log Meal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="btn-stone btn-stone-ghost"
          style={{ padding: "0.75rem 1rem" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Mode scroll banner ─────────────────────────────────────────────
function ModeScroll({ mode }: { mode: NutritionMode }) {
  const config: Record<
    NutritionMode,
    { color: string; title: string; tagline: string }
  > = {
    bulk: {
      color: "#7747b0",
      title: "Bulk",
      tagline: "Feast freely — every grain counts toward the throne.",
    },
    cut: {
      color: "#a0432a",
      title: "Cut",
      tagline: "Discipline at the table sharpens the blade.",
    },
    maintain: {
      color: "#3d6b3a",
      title: "Maintain",
      tagline: "Keep the larder steady — hold the line.",
    },
  };
  const c = config[mode];
  return (
    <section
      className="relative mx-auto max-w-2xl text-center"
      style={{ padding: "14px 56px" }}
    >
      {/* Parchment scroll body */}
      <div
        className="relative px-6 py-3"
        style={{
          background:
            "linear-gradient(180deg, #d8c9a4 0%, #c2ad7d 50%, #b59964 100%)",
          color: "#3a2a18",
          boxShadow:
            "inset 0 0 12px rgba(120, 80, 30, 0.45), 0 6px 14px rgba(0,0,0,0.45)",
          borderTop: "1px solid #8a6a3a",
          borderBottom: "1px solid #8a6a3a",
          clipPath:
            "polygon(2% 0, 98% 0, 100% 50%, 98% 100%, 2% 100%, 0 50%)",
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.32em] font-bold"
          style={{ ...fontDisplay, color: c.color }}
        >
          {c.title}
        </div>
        <div
          className="text-[12px] italic mt-0.5"
          style={{ ...fontDisplay, color: "#3a2a18" }}
        >
          {c.tagline}
        </div>
      </div>
      {/* Scroll end-rolls */}
      <div
        aria-hidden
        className="absolute top-1/2 -translate-y-1/2 left-0 rounded-full"
        style={{
          width: 28,
          height: 56,
          background: "linear-gradient(90deg, #6b4f3a 0%, #8a6a3a 50%, #6b4f3a 100%)",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)",
        }}
      />
      <div
        aria-hidden
        className="absolute top-1/2 -translate-y-1/2 right-0 rounded-full"
        style={{
          width: 28,
          height: 56,
          background: "linear-gradient(90deg, #6b4f3a 0%, #8a6a3a 50%, #6b4f3a 100%)",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)",
        }}
      />
    </section>
  );
}

// ─── Tavern stat card ──────────────────────────────────────────────
function TavernCard({
  label,
  value,
  unit,
  accent,
  crest,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  crest?: string;
}) {
  return (
    <div
      className="relative rounded p-4"
      style={{
        background: "rgba(20, 14, 10, 0.78)",
        border: `1px solid ${accent}55`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 16px ${accent}22, 0 4px 8px rgba(0,0,0,0.5)`,
      }}
    >
      <span className="corner-bl" />
      <span className="corner-br" />
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-[9px] uppercase tracking-[0.22em] font-bold"
          style={{ ...fontDisplay, color: accent }}
        >
          {label}
        </div>
        {crest && (
          <span
            className="text-[14px] leading-none"
            style={{ color: accent, opacity: 0.85 }}
            aria-hidden
          >
            {crest}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight text-ink">
        {value}
      </div>
      {unit && (
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted/80 mt-0.5">
          {unit}
        </div>
      )}
    </div>
  );
}

/**
 * Inline mode pill — shows the active mode next to the page title and
 * opens the Set Goals popover when clicked. Replaces the old big
 * ModeBanner block.
 */
function ModePill({
  mode,
  onClick,
}: {
  mode: NutritionMode;
  onClick: () => void;
}) {
  const colorMap: Record<NutritionMode, string> = {
    bulk: "#5b3993",
    cut: "#a0432a",
    maintain: "#3d6b3a",
  };
  const labelMap: Record<NutritionMode, string> = {
    bulk: "Bulk",
    cut: "Cut",
    maintain: "Maintain",
  };
  const color = colorMap[mode];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${labelMap[mode]} mode — click to change`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] font-bold transition hover:brightness-110"
      style={{
        fontFamily: "var(--font-cinzel), Georgia, serif",
        background: `${color}22`,
        border: `1px solid ${color}66`,
        color,
        textShadow: "0 1px 0 rgba(0,0,0,0.4)",
      }}
    >
      <span
        className="seal"
        style={{ width: 6, height: 6, background: color }}
      />
      {labelMap[mode]}
    </button>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tablet relative rounded p-5">
      <span className="corner-bl" />
      <span className="corner-br" />
      <div
        className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold mb-4"
        style={fontDisplay}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildLastNDays(
  n: number,
  byDate: Map<string, NutritionRow>,
  goal: number
) {
  const out: Array<{
    date: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    goal: number;
  }> = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = byDate.get(iso);
    out.push({
      date: iso,
      label:
        n <= 7
          ? d.toLocaleDateString(undefined, { weekday: "short" })
          : `${d.getMonth() + 1}/${d.getDate()}`,
      calories: r?.calories ?? 0,
      protein: r?.protein ?? 0,
      carbs: r?.carbs ?? 0,
      fat: r?.fat ?? 0,
      goal,
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
  days: Array<{ date: string; calories: number }>,
  goal: number
): { current: number; best: number } {
  const within = (x: number) => x > 0 && Math.abs(x - goal) <= goal * 0.1;
  let cur = 0,
    best = 0,
    curRun = 0;
  for (const d of days) {
    if (within(d.calories)) {
      curRun += 1;
      if (curRun > best) best = curRun;
    } else {
      curRun = 0;
    }
  }
  for (let i = days.length - 1; i >= 0; i--) {
    if (within(days[i].calories)) cur += 1;
    else break;
  }
  return { current: cur, best };
}

// ─── Provisions day modal ─────────────────────────────────────────
function ProvisionsDayModal({
  date,
  row,
  goals,
  onClose,
}: {
  date: string;
  row: NutritionRow | null;
  goals: Goals;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cals = row?.calories ?? 0;
  const goalCal = goals.calories || 1;
  const dev = (cals - goalCal) / goalCal;
  const status =
    cals === 0
      ? "No data"
      : Math.abs(dev) <= 0.10
      ? "On track"
      : dev > 0
      ? "Over"
      : "Under";
  const statusColor =
    status === "On track"
      ? "#3d6b3a"
      : status === "Over"
      ? "#a0432a"
      : status === "Under"
      ? "#3a5a8a"
      : "#5a5246";
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
        className="tablet relative rounded p-6 w-full max-w-md space-y-4"
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
              Provisions
            </div>
            <h2
              className="text-xl font-bold mt-0.5 text-ink"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
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

        <div className="flex items-center gap-3">
          <span
            className="seal"
            style={{ width: 12, height: 12, background: statusColor }}
          />
          <span
            className="text-[12px] uppercase tracking-[0.22em] font-bold"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              color: statusColor,
            }}
          >
            {status}
          </span>
          {cals > 0 && (
            <span className="text-[11px] text-muted ml-auto tabular-nums">
              {cals.toLocaleString()} / {goalCal.toLocaleString()} cal
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <MacroBar
            label="Protein"
            value={row?.protein ?? 0}
            goal={goals.protein}
            color="#dc2626"
          />
          <MacroBar
            label="Carbs"
            value={row?.carbs ?? 0}
            goal={goals.carbs}
            color="#16a34a"
          />
          <MacroBar
            label="Fat"
            value={row?.fat ?? 0}
            goal={goals.fat}
            color="#d97706"
          />
        </div>

        {row?.notes && (
          <div className="bg-elevated border border-bronze-deep rounded p-3 text-[11px] text-ink/90 leading-relaxed">
            {row.notes}
          </div>
        )}

        {!row && (
          <p className="text-sm text-muted italic">
            No provisions logged on this day.
          </p>
        )}
      </div>
    </div>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  color: string;
}) {
  const pct = goal && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] mb-1">
        <span
          className="uppercase tracking-[0.18em] font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif", color }}
        >
          {label}
        </span>
        <span className="text-muted tabular-nums">
          {Math.round(value)}
          {goal != null && (
            <span className="text-muted/60">/{Math.round(goal)}</span>
          )}
          g
        </span>
      </div>
      <div className="xp-track" style={{ height: 4 }}>
        {pct > 0 && (
          <div
            className="xp-fill"
            style={{ width: `${pct * 100}%`, background: color }}
          />
        )}
      </div>
    </div>
  );
}
