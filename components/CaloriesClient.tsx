"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import FeastPlate from "@/components/FeastPlate";
import { tooltipStyle, useChartPalette } from "@/lib/chartTheme";
import { formatPTDate, lastNPTDays, todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";

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

export type StepsDay = { date: string; steps: number };
export type AllTimeNutrition = { date: string; calories: number };

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  goals: Goals;
  mode: NutritionMode;
  directions: MacroDirections;
  rows: NutritionRow[];
  // Steps data for the Energy Ledger (60-day window).
  stepsRows: StepsDay[];
  // All-time aggregates for the cumulative balance card.
  allTimeNutrition: AllTimeNutrition[];
  allTimeSteps: StepsDay[];
};

// Medieval feast palette — referenced from inline styles only so no
// Tailwind utilities can override them.
const COLOR = {
  wood: "#1a0f07",
  woodDark: "#0e0804",
  parchment: "#f4e4bc",
  parchmentEdge: "#c2ad7d",
  ink: "#2c1810",
  inkSoft: "#4a3520",
  gold: "#8B6914",
  goldBright: "#b8860b",
  protein: "#7f1d1d",
  carbs: "#14532d",
  fat: "#78350f",
  wax: "#7f1d1d",
  waxBright: "#a52a2a",
};

const cinzel = { fontFamily: "var(--font-cinzel), Georgia, serif" };

const today = () => todayPT();

export default function CaloriesClient({
  username,
  isAdmin,
  profile,
  goals: initialGoals,
  mode: initialMode,
  directions: initialDirections,
  rows,
  stepsRows,
  allTimeNutrition,
  allTimeSteps,
}: Props) {
  const router = useRouter();
  const chart = useChartPalette();

  const byDate = useMemo(() => {
    const m = new Map<string, NutritionRow>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  // Steps lookup for the Energy Ledger.
  const stepsByDate = useMemo(() => {
    const m = new Map<string, number>();
    stepsRows.forEach((r) => m.set(r.date, r.steps));
    return m;
  }, [stepsRows]);

  const todayRow = byDate.get(today()) ?? null;
  const tCals = todayRow?.calories ?? 0;
  const tP = todayRow?.protein ?? 0;
  const tC = todayRow?.carbs ?? 0;
  const tF = todayRow?.fat ?? 0;
  const tSteps = stepsByDate.get(today()) ?? 0;

  const [goalsOpen, setGoalsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTodayOpen, setEditTodayOpen] = useState(false);
  // Date selected by clicking a chart point — opens the day modal
  // pre-filled with that date's totals.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState<"goals" | "add" | string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Week chart data (7 days, stacked macro grams).
  const last7 = useMemo(
    () => buildLastNDays(7, byDate),
    [byDate]
  );
  const totalGramsGoal = useMemo(
    () =>
      (initialGoals.protein ?? 0) +
      (initialGoals.carbs ?? 0) +
      (initialGoals.fat ?? 0),
    [initialGoals.protein, initialGoals.carbs, initialGoals.fat]
  );
  const last7Combined = useMemo(
    () =>
      last7.map((d) => ({
        ...d,
        totalGrams: d.protein + d.carbs + d.fat,
      })),
    [last7]
  );

  async function addMeal(payload: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    date: string;
  }) {
    setBusy("add");
    setErr(null);
    try {
      // Clamp to today — server also validates but defending against
      // a future date keeps the heatmap honest.
      const t = today();
      const safeDate = payload.date && payload.date <= t ? payload.date : t;
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: safeDate,
          calories: payload.calories,
          protein_g: payload.protein,
          carbs_g: payload.carbs,
          fat_g: payload.fat,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast(safeDate === t ? "Logged" : `Logged · ${safeDate}`);
      setAddOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function saveGoals(
    g: Goals & { mode: NutritionMode; directions: MacroDirections }
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
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToast("Goals saved");
      setGoalsOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  const modeCaption = MODE_CAPTION[initialMode];

  return (
    <div
      className="min-h-screen flex flex-col pb-24 md:pb-0"
      style={{ background: COLOR.wood }}
    >
      <AppHeader username={username} isAdmin={isAdmin} profile={profile} />

      {/* Wood-table backdrop — grain via stacked semi-transparent stripes
          and a vignette so the table feels lit by candles. */}
      <main
        className="flex-1 w-full px-6 lg:px-10 py-8 relative isolate"
        style={{
          backgroundImage: [
            // Vignette
            "radial-gradient(ellipse 75% 60% at 50% 35%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)",
            // Long-grain wood streaks
            "repeating-linear-gradient(180deg, rgba(255,200,140,0.025) 0px, rgba(255,200,140,0.025) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)",
            // Cross-grain knots
            "repeating-linear-gradient(86deg, rgba(70,40,20,0.10) 0px, rgba(70,40,20,0.10) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 80px)",
            // Warm candle wash
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245,158,11,0.06) 0%, rgba(0,0,0,0) 70%)",
            "var(--noise-bg)",
          ].join(", "),
        }}
      >
        {/* Tiny ⚙ Goals link, top-right */}
        <button
          type="button"
          onClick={() => setGoalsOpen(true)}
          className="absolute top-4 right-6 lg:right-10 inline-flex items-center gap-1.5 transition hover:brightness-125"
          style={{
            ...cinzel,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: COLOR.gold,
            fontWeight: 700,
            textShadow: "0 1px 0 rgba(0,0,0,0.6)",
          }}
          aria-label="Open goals"
        >
          <GearIcon size={12} color={COLOR.gold} /> Goals
        </button>

        {err && (
          <div
            className="mx-auto max-w-md mb-4 mt-6 px-3 py-2 text-xs rounded"
            style={{
              background: "rgba(139,24,24,0.18)",
              border: "1px solid rgba(139,24,24,0.55)",
              color: "#fecaca",
            }}
          >
            {err}
          </div>
        )}

        {/* ─── HERO ROW: Mode pill, then [plate left | ledger right] ── */}

        {/* Interactive mode toggle pill above the plate */}
        <ModePill
          mode={initialMode}
          onChange={(m) => {
            // Persist with current goals + macro directions unchanged.
            saveGoals({
              ...initialGoals,
              mode: m,
              directions: initialDirections,
            });
          }}
        />

        {/* SECTION 1 — The Feast (plate + log food button) */}
        <section className="flex flex-col items-center mt-6">
          <div
            className="relative"
            style={{ width: "100%", maxWidth: 500 }}
          >
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

          {/* Add to Feast — wax-sealed scroll button. Opens the modal
              with a date picker so today or any past day can be logged. */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="relative mt-4 px-12 py-3 transition hover:brightness-110 active:translate-y-px"
            style={{
              ...cinzel,
              fontSize: 13,
              letterSpacing: "0.30em",
              fontWeight: 800,
              color: "#f5e6c4",
              textShadow: "0 1px 0 rgba(0,0,0,0.7)",
              background: `linear-gradient(180deg, ${COLOR.waxBright} 0%, ${COLOR.wax} 60%, #4a0a0a 100%)`,
              border: `2px solid ${COLOR.gold}`,
              borderRadius: 4,
              boxShadow: [
                `inset 0 0 0 1px ${COLOR.goldBright}66`,
                "inset 0 1px 0 rgba(255,200,160,0.30)",
                "inset 0 -2px 0 rgba(0,0,0,0.45)",
                `0 0 18px ${COLOR.wax}55`,
                "0 6px 16px rgba(0,0,0,0.6)",
              ].join(", "),
            }}
            aria-label="Log food"
          >
            <CornerDiamonds color={COLOR.gold} />
            <span className="relative z-10">Log Food +</span>
            {/* Wax seal stamp on the right edge */}
            <span
              aria-hidden
              className="absolute"
              style={{
                right: -10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, #c44, ${COLOR.wax} 60%, #3a0808 100%)`,
                border: `1px solid ${COLOR.gold}`,
                boxShadow:
                  "inset 0 1px 0 rgba(255,200,160,0.35), 0 2px 4px rgba(0,0,0,0.6)",
              }}
            />
          </button>

          {/* Hint that you can backlog past days */}
          <div
            className="mt-2.5 text-center italic"
            style={{
              ...cinzel,
              fontSize: 11,
              color: "rgba(232,213,163,0.55)",
              letterSpacing: "0.04em",
            }}
          >
            Tap the date inside the form to log a missed day.
          </div>
        </section>

        {/* SECTION 2 — The Chronicles (three interactive charts) */}
        <section className="mt-10 space-y-6">
          <h2
            className="text-center font-bold"
            style={{
              ...cinzel,
              fontSize: 20,
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              color: "#d4a853",
              textShadow: "0 0 14px rgba(212,168,83,0.40), 0 1px 0 rgba(0,0,0,0.6)",
            }}
          >
            The Chronicles
          </h2>

          {/* Chart 1 — Week's Bounty (existing stacked bar, refactored) */}
          <WeekBountyChart
            data={last7Combined}
            chart={chart}
            totalGramsGoal={totalGramsGoal}
            calorieGoal={initialGoals.calories}
          />

          {/* Chart 2 — Month's Chronicle (line w/ metric toggle) */}
          <MonthChronicleChart
            byDate={byDate}
            todayISO={today()}
            goals={initialGoals}
            chart={chart}
            onDayClick={(iso) => setSelectedDate(iso)}
          />

          {/* Chart 3 — Macro Balance Wheel */}
          <MacroBalanceWheel byDate={byDate} todayISO={today()} />
        </section>

        {/* ─── SECTION 2.5 — The Energy Ledger ─────────────────────
            Joins daily_nutrition + daily_steps. Step burn formula:
              stepsBurned = (steps / 10000) × 500
            Daily balance = caloriesIn - benchmark - stepsBurned. */}
        <EnergyLedger
          calorieBenchmark={initialGoals.calories}
          todayCalories={tCals}
          todaySteps={tSteps}
          byDate={byDate}
          stepsByDate={stepsByDate}
          allTimeNutrition={allTimeNutrition}
          allTimeSteps={allTimeSteps}
          todayISO={today()}
          chart={chart}
        />

        {/* SECTION 3 — Today's Ledger (parchment) — full width */}
        <section
          className="mt-12 mx-auto relative"
          style={{
            maxWidth: 720,
            background: [
              "radial-gradient(ellipse at 50% 0%, rgba(120,80,30,0.20), rgba(120,80,30,0) 55%)",
              "radial-gradient(ellipse at 50% 100%, rgba(120,80,30,0.20), rgba(120,80,30,0) 55%)",
              `linear-gradient(180deg, ${COLOR.parchment} 0%, #ecd7a4 60%, ${COLOR.parchmentEdge} 100%)`,
              "var(--noise-bg)",
            ].join(", "),
            color: COLOR.ink,
            border: `2px solid ${COLOR.gold}`,
            borderRadius: 4,
            padding: "20px 28px 22px",
            boxShadow: [
              `inset 0 0 0 1px ${COLOR.goldBright}55`,
              "inset 0 0 24px rgba(120,80,30,0.30)",
              "0 12px 28px rgba(0,0,0,0.6)",
            ].join(", "),
          }}
        >
          <h2
            className="text-center font-bold leading-none mb-1"
            style={{
              ...cinzel,
              fontSize: 18,
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              color: COLOR.ink,
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            Today's Provisions
          </h2>
          <div
            className="text-center"
            style={{
              ...cinzel,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: COLOR.inkSoft,
              opacity: 0.7,
            }}
          >
            {formatDate(today())}
          </div>
          <div
            className="mt-3 mb-3 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #8a6a3a 25%, #b8860b 50%, #8a6a3a 75%, transparent)",
            }}
          />
          {todayRow && tCals > 0 ? (
            <ul className="space-y-2">
              <LedgerEntry
                title="Today's Table"
                calories={tCals}
                protein={tP}
                carbs={tC}
                fat={tF}
                onEdit={() => setEditTodayOpen(true)}
              />
            </ul>
          ) : (
            <p
              className="text-center italic py-5"
              style={{
                ...cinzel,
                fontSize: 14,
                color: COLOR.inkSoft,
                opacity: 0.75,
              }}
            >
              The table sits empty…
            </p>
          )}
          <div
            className="mt-3 mb-3 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #8a6a3a 25%, #b8860b 50%, #8a6a3a 75%, transparent)",
            }}
          />
          <div
            className="flex items-center justify-between"
            style={{
              ...cinzel,
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color:
                tCals > initialGoals.calories ? "#8b1818" : COLOR.ink,
              fontWeight: 700,
            }}
          >
            <span>Sum of the Day</span>
            <span className="tabular-nums">
              {tCals.toLocaleString()}
              <span style={{ color: COLOR.inkSoft, opacity: 0.6 }}>
                {" / "}
                {initialGoals.calories.toLocaleString()}
              </span>
              <span style={{ marginLeft: 6, opacity: 0.65 }}>cal</span>
            </span>
          </div>
        </section>

      </main>

      {/* ── Add to Feast modal ─────────────────────────────────── */}
      {addOpen && (
        <AddFeastModal
          onClose={() => {
            setAddOpen(false);
            setErr(null);
          }}
          onAdd={addMeal}
          busy={busy === "add"}
          err={err}
        />
      )}

      {/* ── Day-detail modal (today edit, chart click) ────────── */}
      {(editTodayOpen || selectedDate) && (() => {
        const date = selectedDate ?? today();
        return (
          <ProvisionsDayModal
            date={date}
            row={byDate.get(date) ?? null}
            goals={initialGoals}
            onClose={() => {
              setEditTodayOpen(false);
              setSelectedDate(null);
            }}
            onSaved={() => {
              setToast("Saved");
              router.refresh();
            }}
          />
        );
      })()}

      {/* ── Royal Decree goals modal ───────────────────────────── */}
      <SetGoalsModal
        open={goalsOpen}
        onClose={() => {
          setGoalsOpen(false);
          setErr(null);
        }}
        initialGoals={initialGoals}
        initialMode={initialMode}
        initialDirections={initialDirections}
        onSave={saveGoals}
        busy={busy === "goals"}
        err={err}
      />

      {/* ── Toast ─────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          ...cinzel,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          background: COLOR.gold,
          color: "#1a0f00",
          border: `1px solid ${COLOR.ink}`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.55)",
        }}
      >
        {toast}
      </div>
    </div>
  );
}

// ─── Mode caption (under Add to Feast button) ───────────────────────
const MODE_CAPTION: Record<
  NutritionMode,
  { title: string; subtitle: string; color: string }
> = {
  bulk: {
    title: "Bulk",
    subtitle: "Feast freely",
    color: "#c8a4ff",
  },
  cut: {
    title: "Cut",
    subtitle: "Eat with discipline",
    color: "#e09060",
  },
  maintain: {
    title: "Maintain",
    subtitle: "Hold the line",
    color: "#9be095",
  },
};

// ─── Mode Scroll ─────────────────────────────────────────────────
// Aged parchment scroll that hangs above the feast plate carrying the
// banner phrase for the user's current nutrition mode.
function ModeScroll({ mode }: { mode: NutritionMode }) {
  const lines: Record<NutritionMode, { title: string; phrase: string }> = {
    bulk: { title: "Bulk", phrase: "Feast freely, warrior" },
    cut: { title: "Cut", phrase: "Eat with discipline, soldier" },
    maintain: { title: "Maintain", phrase: "Balance thy portions" },
  };
  const { title, phrase } = lines[mode];
  return (
    <section
      className="relative mx-auto"
      style={{
        maxWidth: 520,
        padding: "12px 56px",
      }}
      aria-label="Current nutrition mode"
    >
      {/* Parchment body */}
      <div
        className="relative px-6 py-2.5 text-center"
        style={{
          background:
            `linear-gradient(180deg, #e6cf85 0%, ${COLOR.parchment} 50%, #b59964 100%)`,
          color: COLOR.ink,
          boxShadow:
            "inset 0 0 14px rgba(120, 80, 30, 0.45), 0 6px 14px rgba(0,0,0,0.55)",
          borderTop: "1px solid #8a6a3a",
          borderBottom: "1px solid #8a6a3a",
          clipPath:
            "polygon(2% 0, 98% 0, 100% 50%, 98% 100%, 2% 100%, 0 50%)",
        }}
      >
        <div
          className="font-bold"
          style={{
            ...cinzel,
            fontSize: 9,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#8a5e1a",
          }}
        >
          {title}
        </div>
        <div
          className="italic mt-0.5"
          style={{
            ...cinzel,
            fontSize: 13,
            color: COLOR.ink,
            letterSpacing: "0.06em",
          }}
        >
          {phrase}
        </div>
      </div>
      {/* Scroll end-rolls (left + right) */}
      <ScrollRoll side="left" />
      <ScrollRoll side="right" />
    </section>
  );
}

function ScrollRoll({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2 rounded-full"
      style={{
        [side]: 0,
        width: 28,
        height: 56,
        background:
          "linear-gradient(90deg, #5a3a1f 0%, #8a6a3a 50%, #5a3a1f 100%)",
        boxShadow:
          "inset 0 0 6px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)",
      }}
    />
  );
}

// ─── Corner diamond ornaments for buttons ───────────────────────
// Renders four small diamond markers in each inner corner of a
// button — a tiny bit of medieval menu-card flair.
function CornerDiamonds({ color }: { color: string }) {
  const diamond = (
    pos: "tl" | "tr" | "bl" | "br"
  ): React.CSSProperties => ({
    position: "absolute",
    width: 4,
    height: 4,
    background: color,
    transform: "rotate(45deg)",
    boxShadow: `0 0 4px ${color}aa`,
    top: pos.startsWith("t") ? 5 : undefined,
    bottom: pos.startsWith("b") ? 5 : undefined,
    left: pos.endsWith("l") ? 8 : undefined,
    right: pos.endsWith("r") ? 8 : undefined,
  });
  return (
    <>
      <span aria-hidden style={diamond("tl")} />
      <span aria-hidden style={diamond("tr")} />
      <span aria-hidden style={diamond("bl")} />
      <span aria-hidden style={diamond("br")} />
    </>
  );
}

// ─── Ledger entry (parchment row) ───────────────────────────────────
function LedgerEntry({
  title,
  calories,
  protein,
  carbs,
  fat,
  onEdit,
}: {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  onEdit: () => void;
}) {
  return (
    <li
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3"
      style={{ padding: "8px 4px" }}
    >
      <div
        className="font-bold leading-tight"
        style={{
          ...cinzel,
          color: COLOR.ink,
          fontSize: 13,
        }}
      >
        {title}
        <div
          className="mt-0.5"
          style={{
            fontSize: 10,
            letterSpacing: "0.10em",
            color: COLOR.inkSoft,
            opacity: 0.75,
            fontStyle: "italic",
          }}
        >
          P {Math.round(protein)}g · C {Math.round(carbs)}g · F{" "}
          {Math.round(fat)}g
        </div>
      </div>
      <span
        className="tabular-nums whitespace-nowrap font-bold"
        style={{
          ...cinzel,
          fontSize: 14,
          color: COLOR.ink,
        }}
      >
        {calories.toLocaleString()}
        <span
          style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }}
        >
          cal
        </span>
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="transition hover:brightness-90"
        title="Edit today's totals"
        aria-label="Edit today's totals"
        style={{
          color: COLOR.gold,
          padding: 4,
          background: "transparent",
          border: "none",
        }}
      >
        <QuillIcon size={16} color={COLOR.gold} />
      </button>
    </li>
  );
}

// ─── Add-to-Feast modal ─────────────────────────────────────────────
// ─── Energy Ledger ──────────────────────────────────────────────
// Joins calorie intake with step-derived calorie burn. Formula:
//   stepsBurned(steps) = (steps / 10000) × 500   (cap-free)
//   dailyBalance       = calories - benchmark - stepsBurned
// Only days with BOTH calories and steps logged contribute to
// averages and balances. Days with one or the other are shown but
// flagged as partial.

const STEPS_PER_500CAL = 10000;

function stepsBurned(steps: number): number {
  if (!steps || steps <= 0) return 0;
  return (steps / STEPS_PER_500CAL) * 500;
}

function fmtSigned(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}

// 1 lb of fat ≈ 3500 kcal. Used for "estimated weight impact".
const KCAL_PER_LB = 3500;

function EnergyLedger({
  calorieBenchmark,
  todayCalories,
  todaySteps,
  byDate,
  stepsByDate,
  allTimeNutrition,
  allTimeSteps,
  todayISO,
  chart,
}: {
  calorieBenchmark: number;
  todayCalories: number;
  todaySteps: number;
  byDate: Map<string, NutritionRow>;
  stepsByDate: Map<string, number>;
  allTimeNutrition: AllTimeNutrition[];
  allTimeSteps: StepsDay[];
  todayISO: string;
  chart: ReturnType<typeof useChartPalette>;
}) {
  // ── Today
  const tBurn = stepsBurned(todaySteps);
  const tNet = todayCalories > 0 ? todayCalories - calorieBenchmark - tBurn : null;

  // ── 7-day window
  const week = useMemo(() => {
    let cal = 0;
    let burn = 0;
    let net = 0;
    let days = 0;
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      const steps = stepsByDate.get(iso) ?? 0;
      if (!row || row.calories <= 0) continue;
      const b = stepsBurned(steps);
      cal += row.calories;
      burn += b;
      net += row.calories - calorieBenchmark - b;
      days += 1;
    }
    return { cal, burn, net, days };
  }, [byDate, stepsByDate, todayISO, calorieBenchmark]);

  // ── All-time
  const all = useMemo(() => {
    const calMap = new Map<string, number>();
    allTimeNutrition.forEach((r) => calMap.set(r.date, r.calories));
    const stepMap = new Map<string, number>();
    allTimeSteps.forEach((r) => stepMap.set(r.date, r.steps));
    let cal = 0;
    let burn = 0;
    let net = 0;
    let days = 0;
    calMap.forEach((c, iso) => {
      if (c <= 0) return;
      const steps = stepMap.get(iso) ?? 0;
      if (steps <= 0) return; // require both per spec
      const b = stepsBurned(steps);
      cal += c;
      burn += b;
      net += c - calorieBenchmark - b;
      days += 1;
    });
    return { cal, burn, net, days };
  }, [allTimeNutrition, allTimeSteps, calorieBenchmark]);

  // ── 14-day balance bars (broader than the macro chart for ledger feel)
  const dailyBalance = useMemo(() => {
    const out: Array<{
      date: string;
      label: string;
      caloriesIn: number;
      steps: number;
      stepBurn: number;
      foodOnly: number; // calories - benchmark
      net: number; // foodOnly - stepBurn
      complete: boolean; // both logged
    }> = [];
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 13; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      const steps = stepsByDate.get(iso) ?? 0;
      const cals = row?.calories ?? 0;
      const burn = stepsBurned(steps);
      const foodOnly = cals > 0 ? cals - calorieBenchmark : 0;
      const net = cals > 0 ? cals - calorieBenchmark - burn : 0;
      out.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        caloriesIn: cals,
        steps,
        stepBurn: burn,
        foodOnly,
        net,
        complete: cals > 0 && steps > 0,
      });
    }
    return out;
  }, [byDate, stepsByDate, todayISO, calorieBenchmark]);

  // ── Cumulative balance (with-steps vs food-only) over the 60-day window
  const [cumulativeMode, setCumulativeMode] = useState<"with-steps" | "food-only">(
    "with-steps"
  );
  const cumulative = useMemo(() => {
    const out: Array<{
      date: string;
      label: string;
      cumFood: number;
      cumNet: number;
    }> = [];
    let runFood = 0;
    let runNet = 0;
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 59; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      const steps = stepsByDate.get(iso) ?? 0;
      if (row && row.calories > 0) {
        runFood += row.calories - calorieBenchmark;
        if (steps > 0) {
          runNet += row.calories - calorieBenchmark - stepsBurned(steps);
        } else {
          runNet += row.calories - calorieBenchmark; // no steps → same as food-only that day
        }
      }
      out.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        cumFood: runFood,
        cumNet: runNet,
      });
    }
    return out;
  }, [byDate, stepsByDate, todayISO, calorieBenchmark]);

  // ── Pace projection (avg/day across the 7-day window)
  const pace = useMemo(() => {
    if (week.days === 0) {
      return { food: 0, steps: 0, combined: 0, lbsPerWeek: 0 };
    }
    const avgFood = (week.cal - calorieBenchmark * week.days) / week.days;
    const avgSteps = week.burn / week.days;
    const combined = avgFood - avgSteps;
    const lbsPerWeek = (combined * 7) / KCAL_PER_LB;
    return { food: avgFood, steps: avgSteps, combined, lbsPerWeek };
  }, [week, calorieBenchmark]);

  return (
    <section className="mt-12 space-y-6">
      <h2
        className="text-center font-bold"
        style={{
          ...cinzel,
          fontSize: 20,
          letterSpacing: "0.30em",
          textTransform: "uppercase",
          color: "#d4a853",
          textShadow:
            "0 0 14px rgba(212,168,83,0.40), 0 1px 0 rgba(0,0,0,0.6)",
        }}
      >
        The Energy Ledger
      </h2>

      {/* Three balance cards: Today / Week / All-Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceCard
          title="Today's Balance"
          cal={todayCalories}
          burn={tBurn}
          steps={todaySteps}
          benchmark={calorieBenchmark}
          net={tNet}
          partial={todayCalories === 0 || todaySteps === 0}
        />
        <BalanceCard
          title="This Week"
          cal={week.cal}
          burn={week.burn}
          steps={null}
          benchmark={calorieBenchmark * week.days}
          net={week.days > 0 ? week.net : null}
          footnote={`${week.days} day${week.days === 1 ? "" : "s"} w/ food + steps`}
          weeklyLbs={(week.net / KCAL_PER_LB) * (week.days > 0 ? 7 / week.days : 0)}
        />
        <BalanceCard
          title="All Time"
          cal={all.cal}
          burn={all.burn}
          steps={null}
          benchmark={calorieBenchmark * all.days}
          net={all.days > 0 ? all.net : null}
          footnote={`${all.days} day${all.days === 1 ? "" : "s"} tracked`}
          totalLbs={all.net / KCAL_PER_LB}
        />
      </div>

      {/* Chart — Daily Balance bars (last 14 days) */}
      <WoodenChartFrame title="Daily Energy Balance · 14 days">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart
              data={dailyBalance}
              margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: chart.cursor }}
                contentStyle={tooltipStyle(chart)}
                content={({ active, payload }: any) => {
                  if (!active || !payload || !payload[0]) return null;
                  const r = payload[0].payload;
                  return (
                    <div
                      style={{
                        background: "rgba(20,14,10,0.95)",
                        border: "1px solid rgba(212,168,83,0.50)",
                        borderRadius: 4,
                        fontFamily: "var(--font-cinzel), Georgia, serif",
                        fontSize: 11,
                        color: "#f5e6c4",
                        padding: "8px 10px",
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ color: "#d4a853", fontWeight: 700 }}>{r.date}</div>
                      <div>
                        Food: {fmtSigned(r.foodOnly)} (ate{" "}
                        {r.caloriesIn.toLocaleString()})
                      </div>
                      <div>
                        Steps: {fmtSigned(-r.stepBurn)} (
                        {r.steps.toLocaleString()} steps)
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: r.net >= 0 ? "#e6c266" : "#8fc99a",
                          fontWeight: 700,
                        }}
                      >
                        NET: {fmtSigned(r.net)}{" "}
                        {r.net >= 0 ? "surplus" : "deficit"}
                      </div>
                      {!r.complete && (
                        <div style={{ marginTop: 4, color: "#a89a85", fontStyle: "italic" }}>
                          partial day
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="rgba(216,168,83,0.55)" strokeWidth={1.5} />
              <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {dailyBalance.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.net >= 0 ? "#c26a3a" : "#3d6b3a"}
                    fillOpacity={d.complete ? 0.95 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          className="mt-2 text-[10px] flex items-center justify-center gap-4"
          style={{ ...cinzel, color: "rgba(216,210,194,0.70)" }}
        >
          <span>
            <span style={{ color: "#3d6b3a", fontWeight: 700 }}>■</span>{" "}
            Deficit
          </span>
          <span>
            <span style={{ color: "#c26a3a", fontWeight: 700 }}>■</span>{" "}
            Surplus
          </span>
          <span style={{ opacity: 0.6 }}>· faded = partial day</span>
        </div>
      </WoodenChartFrame>

      {/* Chart — Cumulative Journey (with-steps vs food-only) */}
      <WoodenChartFrame title="Cumulative Journey · 60 days">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(["with-steps", "food-only"] as const).map((m) => {
            const active = m === cumulativeMode;
            const label = m === "with-steps" ? "With Steps" : "Food Only";
            return (
              <button
                key={m}
                type="button"
                onClick={() => setCumulativeMode(m)}
                className="px-3 py-1 rounded-full transition"
                style={{
                  ...cinzel,
                  fontSize: 10,
                  letterSpacing: "0.20em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: active ? "#1a0f00" : "rgba(232,213,163,0.65)",
                  background: active
                    ? "linear-gradient(180deg, #e6c66a 0%, #d4a853 100%)"
                    : "transparent",
                  border: `1px solid ${
                    active ? "#d4a853" : "rgba(212,168,83,0.30)"
                  }`,
                  boxShadow: active
                    ? "inset 0 1px 0 rgba(255,240,200,0.40), 0 0 6px rgba(212,168,83,0.45)"
                    : undefined,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart
              data={cumulative}
              margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cum-food" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a853" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d4a853" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cum-net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} interval={6} />
              <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle(chart)}
                formatter={(v: any) => [
                  `${fmtSigned(Number(v))} cal`,
                  cumulativeMode === "with-steps" ? "Net" : "Food only",
                ]}
              />
              <ReferenceLine y={0} stroke="rgba(216,168,83,0.50)" strokeWidth={1} />
              <Area
                type="monotone"
                dataKey={cumulativeMode === "with-steps" ? "cumNet" : "cumFood"}
                stroke={cumulativeMode === "with-steps" ? "#a855f7" : "#d4a853"}
                strokeWidth={2.5}
                fill={`url(#${cumulativeMode === "with-steps" ? "cum-net" : "cum-food"})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div
          className="text-[10px] mt-2 italic text-center"
          style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
        >
          {cumulativeMode === "with-steps"
            ? "Cumulative net balance after step burn. Lower = bigger deficit."
            : "Food-only cumulative — toggle to see how steps shift the curve."}
        </div>
      </WoodenChartFrame>

      {/* Pace callout */}
      {week.days > 0 && (
        <div
          className="rounded p-4"
          style={{
            background: "rgba(20,14,10,0.65)",
            border: "1px solid rgba(212,168,83,0.45)",
            boxShadow: "inset 0 1px 0 rgba(255,240,200,0.06)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3"
            style={{ ...cinzel, color: "#d4a853" }}
          >
            ✦ At Your Current Pace
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PaceStat label="Food avg" value={`${fmtSigned(pace.food)} / day`} color="#d4a853" />
            <PaceStat label="Steps avg" value={`${fmtSigned(-pace.steps)} / day`} color="#a855f7" />
            <PaceStat
              label="Combined"
              value={`${fmtSigned(pace.combined)} / day`}
              color={pace.combined < 0 ? "#8fc99a" : "#e6c266"}
            />
            <PaceStat
              label="Rate"
              value={`${pace.lbsPerWeek >= 0 ? "+" : ""}${pace.lbsPerWeek.toFixed(2)} lb / wk`}
              color={pace.lbsPerWeek < 0 ? "#8fc99a" : "#e6c266"}
            />
          </div>
          <div
            className="text-[10px] mt-3 italic"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            Based on the last {week.days} day{week.days === 1 ? "" : "s"} where
            both food + steps were tracked. Step burn = (steps ÷{" "}
            {STEPS_PER_500CAL.toLocaleString()}) × 500.
          </div>
        </div>
      )}
    </section>
  );
}

function BalanceCard({
  title,
  cal,
  burn,
  steps,
  benchmark,
  net,
  partial,
  footnote,
  weeklyLbs,
  totalLbs,
}: {
  title: string;
  cal: number;
  burn: number;
  steps: number | null;
  benchmark: number;
  net: number | null;
  partial?: boolean;
  footnote?: string;
  weeklyLbs?: number;
  totalLbs?: number;
}) {
  const netColor =
    net == null ? "#9a9282" : net >= 0 ? "#e6c266" : "#8fc99a";
  return (
    <div
      className="rounded p-4"
      style={{
        background: "rgba(20,14,10,0.70)",
        border: "1px solid rgba(212,168,83,0.45)",
        boxShadow:
          "inset 0 1px 0 rgba(255,240,200,0.06), 0 6px 14px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.26em] font-bold mb-3"
        style={{ ...cinzel, color: "#d4a853" }}
      >
        {title}
      </div>
      <div className="space-y-1.5 text-[12px]" style={{ color: "rgba(232,213,163,0.85)" }}>
        <div className="flex items-center justify-between gap-2">
          <span style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}>
            In
          </span>
          <span className="tabular-nums" style={{ color: "#f5e6c4" }}>
            {Math.round(cal).toLocaleString()} cal
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}>
            Steps
          </span>
          <span className="tabular-nums" style={{ color: "#a855f7" }}>
            −{Math.round(burn).toLocaleString()} cal
            {steps != null && (
              <span style={{ color: "rgba(216,210,194,0.55)", marginLeft: 6 }}>
                ({steps.toLocaleString()})
              </span>
            )}
          </span>
        </div>
        <div
          className="flex items-center justify-between gap-2 pt-1 mt-1.5"
          style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}
        >
          <span
            className="font-bold"
            style={{
              ...cinzel,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 10,
              color: "#d4a853",
            }}
          >
            Net
          </span>
          <span
            className="tabular-nums font-bold"
            style={{ ...cinzel, color: netColor, fontSize: 16 }}
          >
            {net == null ? "—" : fmtSigned(net)}{" "}
            <span style={{ fontSize: 10, opacity: 0.65, fontWeight: 400 }}>
              {net == null ? "" : net >= 0 ? "surplus" : "deficit"}
            </span>
          </span>
        </div>
        {weeklyLbs != null && Number.isFinite(weeklyLbs) && (
          <div
            className="text-[10px] italic mt-1"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            ≈ {weeklyLbs >= 0 ? "+" : ""}
            {weeklyLbs.toFixed(2)} lb / week
          </div>
        )}
        {totalLbs != null && Number.isFinite(totalLbs) && (
          <div
            className="text-[10px] italic mt-1"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            ≈ {totalLbs >= 0 ? "+" : ""}
            {totalLbs.toFixed(1)} lb total
          </div>
        )}
        {(partial || footnote) && (
          <div
            className="text-[10px] mt-1"
            style={{ ...cinzel, color: "rgba(216,210,194,0.45)" }}
          >
            {partial && !footnote
              ? "log both food + steps for a full picture"
              : footnote}
          </div>
        )}
      </div>
    </div>
  );
}

function PaceStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-bold"
        style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
      >
        {label}
      </div>
      <div
        className="text-[14px] font-bold tabular-nums mt-0.5"
        style={{ ...cinzel, color }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Mode toggle pill (3-button banner above the plate) ─────────
function ModePill({
  mode,
  onChange,
}: {
  mode: NutritionMode;
  onChange: (m: NutritionMode) => void;
}) {
  const phrases: Record<NutritionMode, string> = {
    bulk: "Feast freely, warrior",
    cut: "Eat sparingly, soldier",
    maintain: "Balance thy portions",
  };
  const labels: Record<NutritionMode, string> = {
    bulk: "Bulk",
    maintain: "Maintain",
    cut: "Cut",
  };
  const modes: NutritionMode[] = ["bulk", "maintain", "cut"];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="inline-flex p-1 rounded-full"
        style={{
          background: "rgba(20,14,30,0.65)",
          border: `1px solid ${COLOR.gold}55`,
          boxShadow:
            "inset 0 1px 2px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.45)",
        }}
      >
        {modes.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => !active && onChange(m)}
              className="px-4 py-1.5 rounded-full transition"
              style={{
                ...cinzel,
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#1a0f00" : "rgba(232,213,163,0.65)",
                background: active
                  ? `linear-gradient(180deg, #e6c66a 0%, ${COLOR.gold} 100%)`
                  : "transparent",
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,240,200,0.45), 0 0 8px rgba(212,168,83,0.40)"
                  : undefined,
              }}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>
      <div
        className="italic"
        style={{
          ...cinzel,
          fontSize: 11,
          color: "rgba(232,213,163,0.75)",
          letterSpacing: "0.06em",
        }}
      >
        {phrases[mode]}
      </div>
    </div>
  );
}

// ─── Chart 1 — Week's Bounty (stacked bar w/ click-to-detail) ───
function WeekBountyChart({
  data,
  chart,
  totalGramsGoal,
  calorieGoal,
}: {
  data: Array<{
    date: string;
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    totalGrams: number;
  }>;
  chart: ReturnType<typeof useChartPalette>;
  totalGramsGoal: number;
  calorieGoal: number;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = selectedDate
    ? data.find((d) => d.date === selectedDate) ?? null
    : null;
  return (
    <WoodenChartFrame title="The Week's Bounty">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            onClick={(e: any) => {
              const payload = e?.activePayload?.[0]?.payload;
              if (payload?.date) {
                setSelectedDate((cur) =>
                  cur === payload.date ? null : payload.date
                );
              }
            }}
          >
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: chart.cursor }}
              contentStyle={tooltipStyle(chart)}
              formatter={(v: any, name: any) => [`${Math.round(Number(v))} g`, name]}
              labelFormatter={(label, payload) => {
                const row = payload && payload[0]?.payload;
                if (!row) return label;
                return `${label} · ${row.calories.toLocaleString()} cal`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#d8d0bb", paddingTop: 4 }} iconType="square" iconSize={8} />
            {totalGramsGoal > 0 && (
              <ReferenceLine
                y={totalGramsGoal}
                stroke={chart.goalLine}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: "Goal", fill: chart.goalLine, fontSize: 10, position: "right" }}
              />
            )}
            <Bar dataKey="protein" stackId="g" fill={COLOR.protein} name="Protein" maxBarSize={56} />
            <Bar dataKey="carbs" stackId="g" fill={COLOR.carbs} name="Carbs" maxBarSize={56} />
            <Bar dataKey="fat" stackId="g" fill={COLOR.fat} name="Fat" radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <div
          className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded p-3"
          style={{
            background: "rgba(212,168,83,0.10)",
            border: "1px solid rgba(212,168,83,0.40)",
          }}
        >
          <DetailStat label={selected.label} value={`${selected.calories.toLocaleString()} cal`} color="#d4a853" />
          <DetailStat label="Protein" value={`${Math.round(selected.protein)} g`} color="#d4847a" />
          <DetailStat label="Carbs" value={`${Math.round(selected.carbs)} g`} color="#8fc99a" />
          <DetailStat label="Fat" value={`${Math.round(selected.fat)} g`} color="#e6c266" />
        </div>
      )}
    </WoodenChartFrame>
  );
}

function DetailStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-bold"
        style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] font-bold tabular-nums mt-0.5"
        style={{ ...cinzel, color }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Chart 2 — Month's Chronicle (line, metric toggle) ──────────
type MonthMetric = "calories" | "protein" | "carbs" | "fat";
const METRIC_COLOR: Record<MonthMetric, string> = {
  calories: "#d4a853",
  protein: COLOR.protein,
  carbs: COLOR.carbs,
  fat: COLOR.fat,
};
const METRIC_LABEL: Record<MonthMetric, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fats",
};

function MonthChronicleChart({
  byDate,
  todayISO,
  goals,
  chart,
  onDayClick,
}: {
  byDate: Map<string, NutritionRow>;
  todayISO: string;
  goals: Goals;
  chart: ReturnType<typeof useChartPalette>;
  onDayClick: (iso: string) => void;
}) {
  const [metric, setMetric] = useState<MonthMetric>("calories");
  const data = useMemo(() => {
    const out: Array<{ date: string; label: string; value: number }> = [];
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      out.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: row ? row[metric] : 0,
      });
    }
    return out;
  }, [byDate, todayISO, metric]);

  const goalLine =
    metric === "calories"
      ? goals.calories
      : metric === "protein"
      ? goals.protein ?? 0
      : metric === "carbs"
      ? goals.carbs ?? 0
      : goals.fat ?? 0;
  const color = METRIC_COLOR[metric];

  return (
    <WoodenChartFrame title="The Month's Chronicle">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.keys(METRIC_LABEL) as MonthMetric[]).map((m) => {
          const active = m === metric;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className="px-3 py-1 rounded-full transition"
              style={{
                ...cinzel,
                fontSize: 10,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#1a0f00" : "rgba(232,213,163,0.65)",
                background: active ? METRIC_COLOR[m] : "transparent",
                border: `1px solid ${active ? METRIC_COLOR[m] : "rgba(212,168,83,0.30)"}`,
                boxShadow: active
                  ? `inset 0 1px 0 rgba(255,255,255,0.20), 0 0 8px ${METRIC_COLOR[m]}55`
                  : undefined,
              }}
            >
              {METRIC_LABEL[m]}
            </button>
          );
        })}
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            onClick={(e: any) => {
              const payload = e?.activePayload?.[0]?.payload;
              if (payload?.date) onDayClick(payload.date);
            }}
          >
            <defs>
              <linearGradient id={`month-fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} interval={3} />
            <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: chart.cursor, strokeWidth: 1 }}
              contentStyle={tooltipStyle(chart)}
              formatter={(v: any) => [
                `${Math.round(Number(v)).toLocaleString()} ${metric === "calories" ? "cal" : "g"}`,
                METRIC_LABEL[metric],
              ]}
            />
            {goalLine > 0 && (
              <ReferenceLine
                y={goalLine}
                stroke="#a855f7"
                strokeDasharray="6 4"
                strokeOpacity={0.7}
                label={{ value: "Goal", fill: "#c084fc", fontSize: 10, position: "right" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#month-fill-${metric})`}
              dot={{ r: 2.5, fill: color, stroke: "none" }}
              activeDot={{ r: 5, fill: color, stroke: "#fff8e6", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WoodenChartFrame>
  );
}

// ─── Chart 3 — Macro Balance Wheel (donut + range toggle) ───────
type WheelRange = "week" | "month" | "all";
function MacroBalanceWheel({
  byDate,
  todayISO,
}: {
  byDate: Map<string, NutritionRow>;
  todayISO: string;
}) {
  const [range, setRange] = useState<WheelRange>("week");
  const stats = useMemo(() => {
    const days =
      range === "week" ? 7 : range === "month" ? 30 : 365;
    const end = new Date(todayISO + "T00:00:00");
    let p = 0;
    let c = 0;
    let f = 0;
    let cal = 0;
    let n = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      if (!row || row.calories === 0) continue;
      p += row.protein;
      c += row.carbs;
      f += row.fat;
      cal += row.calories;
      n += 1;
    }
    if (n === 0)
      return { protein: 0, carbs: 0, fat: 0, calories: 0, days: 0 };
    return {
      protein: Math.round(p / n),
      carbs: Math.round(c / n),
      fat: Math.round(f / n),
      calories: Math.round(cal / n),
      days: n,
    };
  }, [byDate, todayISO, range]);

  // Calorie contribution per macro (4/4/9 kcal/g).
  const proteinCal = stats.protein * 4;
  const carbsCal = stats.carbs * 4;
  const fatCal = stats.fat * 9;
  const totalCal = proteinCal + carbsCal + fatCal;
  const slices = totalCal > 0
    ? [
        { name: "Protein", value: proteinCal, color: COLOR.protein, grams: stats.protein, pct: Math.round((proteinCal / totalCal) * 100) },
        { name: "Carbs", value: carbsCal, color: COLOR.carbs, grams: stats.carbs, pct: Math.round((carbsCal / totalCal) * 100) },
        { name: "Fats", value: fatCal, color: COLOR.fat, grams: stats.fat, pct: Math.round((fatCal / totalCal) * 100) },
      ]
    : [];

  const rangeLabel: Record<WheelRange, string> = {
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  return (
    <WoodenChartFrame title="The Macro Balance Wheel">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["week", "month", "all"] as WheelRange[]).map((r) => {
          const active = r === range;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="px-3 py-1 rounded-full transition"
              style={{
                ...cinzel,
                fontSize: 10,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#1a0f00" : "rgba(232,213,163,0.65)",
                background: active ? COLOR.gold : "transparent",
                border: `1px solid ${active ? COLOR.gold : "rgba(212,168,83,0.30)"}`,
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,240,200,0.40), 0 0 6px rgba(212,168,83,0.45)"
                  : undefined,
              }}
            >
              {rangeLabel[r]}
            </button>
          );
        })}
      </div>

      {slices.length === 0 ? (
        <div
          className="flex items-center justify-center h-56 italic"
          style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
        >
          No data for {rangeLabel[range].toLowerCase()} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4 items-center">
          <div className="h-56 relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  stroke="#0a0805"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,14,10,0.92)",
                    border: "1px solid rgba(212,168,83,0.45)",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "#f5e6c4",
                    fontFamily: "var(--font-cinzel), Georgia, serif",
                  }}
                  formatter={(v: any, name: any, entry: any) => [
                    `${entry?.payload?.grams ?? "?"} g  ·  ${entry?.payload?.pct ?? "?"}%`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            >
              <div
                className="text-[9px] uppercase tracking-[0.30em]"
                style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
              >
                Avg Daily
              </div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{
                  ...cinzel,
                  color: "#d4a853",
                  textShadow: "0 0 10px rgba(212,168,83,0.45)",
                }}
              >
                {stats.calories.toLocaleString()}
              </div>
              <div
                className="text-[9px] uppercase tracking-[0.24em] mt-0.5"
                style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
              >
                cal · {stats.days} day{stats.days === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {slices.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-2.5 rounded p-2"
                style={{
                  background: "rgba(20,14,10,0.45)",
                  border: `1px solid ${s.color}55`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: s.color,
                    boxShadow: `0 0 4px ${s.color}aa`,
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.20em] font-bold flex-1"
                  style={{ ...cinzel, color: "rgba(232,213,163,0.85)" }}
                >
                  {s.name}
                </span>
                <span
                  className="tabular-nums font-bold"
                  style={{ ...cinzel, color: s.color, fontSize: 13 }}
                >
                  {s.grams}g
                </span>
                <span
                  className="tabular-nums text-[10px]"
                  style={{ color: "rgba(216,210,194,0.65)" }}
                >
                  {s.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WoodenChartFrame>
  );
}

// ─── Wooden-frame chart card (shared) ───────────────────────────
function WoodenChartFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative rounded-md"
      style={{
        background: [
          "radial-gradient(ellipse at 30% 20%, rgba(60,80,70,0.16), rgba(0,0,0,0) 60%)",
          "linear-gradient(180deg, #15110a 0%, #0a0805 100%)",
        ].join(", "),
        border: "4px solid #5a3a1f",
        boxShadow: [
          "inset 0 0 0 1px #2d1d0f",
          "inset 0 0 24px rgba(0,0,0,0.7)",
          "0 6px 18px rgba(0,0,0,0.55)",
        ].join(", "),
        padding: "20px 24px",
        borderRadius: 6,
      }}
    >
      <h3
        className="font-bold mb-3"
        style={{
          ...cinzel,
          fontSize: 14,
          letterSpacing: "0.30em",
          textTransform: "uppercase",
          color: "#d4a853",
          textShadow:
            "0 0 8px rgba(212,168,83,0.30), 0 1px 0 rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function AddFeastModal({
  onClose,
  onAdd,
  busy,
  err,
}: {
  onClose: () => void;
  onAdd: (p: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    date: string;
  }) => void;
  busy: boolean;
  err: string | null;
}) {
  const todayStr = todayPT();
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  // Default to today; user can scroll back to log a missed day.
  const [logDate, setLogDate] = useState<string>(todayStr);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      name: name.trim(),
      calories: Number(cal) || 0,
      protein: Number(p) || 0,
      carbs: Number(c) || 0,
      fat: Number(f) || 0,
      date: logDate,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
      aria-modal
      role="dialog"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="relative w-full"
        style={{
          maxWidth: 460,
          padding: "24px 28px",
          background: [
            "radial-gradient(ellipse at 50% 0%, rgba(120,80,30,0.20), rgba(120,80,30,0) 55%)",
            `linear-gradient(180deg, ${COLOR.parchment} 0%, ${COLOR.parchmentEdge} 100%)`,
            "var(--noise-bg)",
          ].join(", "),
          color: COLOR.ink,
          border: `2px solid ${COLOR.gold}`,
          borderRadius: 4,
          boxShadow: [
            `inset 0 0 0 1px ${COLOR.goldBright}55`,
            "inset 0 0 24px rgba(120,80,30,0.30)",
            "0 24px 64px rgba(0,0,0,0.7)",
          ].join(", "),
        }}
      >
        <ParchmentInputStyles />

        <div className="flex items-start justify-between mb-3">
          <h2
            className="font-bold tracking-tight"
            style={{
              ...cinzel,
              fontSize: 20,
              color: COLOR.ink,
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            Add to Feast
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl w-8 h-8 flex items-center justify-center"
            style={{ color: COLOR.inkSoft }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className="mb-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, #8a6a3a 25%, #b8860b 50%, #8a6a3a 75%, transparent)",
          }}
        />

        <div className="space-y-3">
          {/* Date — defaults to today; pick a past day to log retroactively */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <FieldLabel label="Dish (optional)">
              <input
                type="text"
                placeholder="e.g. Roast & ale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="parchment-input"
              />
            </FieldLabel>
            <FieldLabel label="Date">
              <input
                type="date"
                value={logDate}
                max={todayStr}
                onChange={(e) => setLogDate(e.target.value)}
                className="parchment-input"
                style={{ minWidth: 150 }}
              />
            </FieldLabel>
          </div>
          {logDate !== todayStr && (
            <div
              className="text-[11px] italic"
              style={{
                ...cinzel,
                color: "#8a5e1a",
                background: "rgba(212,168,83,0.15)",
                border: "1px solid rgba(212,168,83,0.45)",
                borderRadius: 4,
                padding: "6px 10px",
              }}
            >
              Logging retroactively for {logDate}. Today's plate is untouched.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FieldLabel label="Calories">
              <input
                type="number"
                min="0"
                value={cal}
                onChange={(e) => setCal(e.target.value)}
                required
                className="parchment-input"
              />
            </FieldLabel>
            <FieldLabel label="Protein g">
              <input
                type="number"
                min="0"
                value={p}
                onChange={(e) => setP(e.target.value)}
                className="parchment-input"
              />
            </FieldLabel>
            <FieldLabel label="Carbs g">
              <input
                type="number"
                min="0"
                value={c}
                onChange={(e) => setC(e.target.value)}
                className="parchment-input"
              />
            </FieldLabel>
            <FieldLabel label="Fat g">
              <input
                type="number"
                min="0"
                value={f}
                onChange={(e) => setF(e.target.value)}
                className="parchment-input"
              />
            </FieldLabel>
          </div>
          {err && (
            <p style={{ ...cinzel, fontSize: 11, color: "#8b1818" }}>{err}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy || !cal}
              className="flex-1 parchment-button-gold"
            >
              {busy ? "Logging…" : "Log to Ledger"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="parchment-button-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Royal Decree goals modal ───────────────────────────────────────
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      onClick={onClose}
      aria-modal
      role="dialog"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full"
        style={{
          maxWidth: 480,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          padding: "26px 28px",
          background: [
            "radial-gradient(ellipse at 50% 0%, rgba(120,80,30,0.20), rgba(120,80,30,0) 55%)",
            "radial-gradient(ellipse at 50% 100%, rgba(120,80,30,0.20), rgba(120,80,30,0) 55%)",
            `linear-gradient(180deg, ${COLOR.parchment} 0%, ${COLOR.parchmentEdge} 100%)`,
            "var(--noise-bg)",
          ].join(", "),
          color: COLOR.ink,
          border: `2px solid ${COLOR.gold}`,
          borderRadius: 4,
          boxShadow: [
            `inset 0 0 0 1px ${COLOR.goldBright}55`,
            "inset 0 0 24px rgba(120,80,30,0.30)",
            "0 24px 64px rgba(0,0,0,0.7)",
          ].join(", "),
        }}
      >
        <ParchmentInputStyles />

        <div className="flex items-start justify-between mb-3">
          <div>
            <div
              className="font-bold"
              style={{
                ...cinzel,
                fontSize: 9,
                letterSpacing: "0.36em",
                textTransform: "uppercase",
                color: "#8a5e1a",
              }}
            >
              By Royal Decree
            </div>
            <h2
              className="text-2xl font-bold tracking-tight mt-1"
              style={{
                ...cinzel,
                color: COLOR.ink,
                textShadow: "0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              Provisions Edict
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl w-8 h-8 flex items-center justify-center"
            style={{ color: COLOR.inkSoft }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className="mb-5 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, #8a6a3a 25%, #b8860b 50%, #8a6a3a 75%, transparent)",
          }}
        />

        <DecreeSection
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
              style={{
                ...cinzel,
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#8a5e1a",
                fontWeight: 700,
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              Auto-fill macros
            </button>
          }
        />
        <DecreeSection
          label="Protein Goal"
          unit="g"
          value={p}
          onChange={setP}
          dirLabel="Going over protein is..."
          dir={pDir}
          onDir={setPDir}
        />
        <DecreeSection
          label="Carbs Goal"
          unit="g"
          value={c}
          onChange={setC}
          dirLabel="Going over carbs is..."
          dir={cDir}
          onDir={setCDir}
        />
        <DecreeSection
          label="Fat Goal"
          unit="g"
          value={f}
          onChange={setF}
          dirLabel="Going over fat is..."
          dir={fDir}
          onDir={setFDir}
        />

        {err && (
          <p
            style={{
              ...cinzel,
              fontSize: 11,
              color: "#8b1818",
              marginTop: 12,
            }}
          >
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={commit}
          disabled={busy}
          className="parchment-button-gold w-full mt-5"
        >
          {busy ? "Sealing…" : "Affix the Royal Seal"}
        </button>
      </div>
    </div>
  );
}

function DecreeSection({
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
          className="font-bold"
          style={{
            ...cinzel,
            fontSize: 10,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "#5a3a18",
          }}
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
          className="parchment-input"
        />
        {unit && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ fontSize: 11, color: COLOR.inkSoft }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        className="mt-2"
        style={{
          ...cinzel,
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#6a5530",
        }}
      >
        {dirLabel}
      </div>
      <DirectionToggle dir={dir} onDir={onDir} />
    </section>
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
    { key: "negative", label: "Negative", color: "#8b1818" },
    { key: "neutral", label: "Neutral", color: "#5a4a30" },
    { key: "positive", label: "Positive", color: "#2c5a18" },
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
            className="font-bold transition"
            style={{
              ...cinzel,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${active ? o.color : "#8a6a3a"}`,
              background: active ? `${o.color}1a` : "transparent",
              color: active ? o.color : "#5a4a30",
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.20), 0 0 8px ${o.color}33`
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

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block mb-1 font-bold"
        style={{
          ...cinzel,
          fontSize: 10,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          color: "#5a3a18",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// Shared parchment-input styling, scoped to whichever modal mounts it.
function ParchmentInputStyles() {
  return (
    <style jsx global>{`
      .parchment-input {
        width: 100%;
        padding: 8px 32px 8px 12px;
        font-family: var(--font-cinzel), Georgia, serif;
        font-size: 13px;
        background: rgba(255, 248, 220, 0.65);
        color: #2a1f10;
        border: 1px solid #8a6a3a;
        border-radius: 4px;
        box-shadow: inset 0 1px 2px rgba(120, 80, 30, 0.35),
          inset 0 0 0 1px rgba(184, 134, 11, 0.18);
        caret-color: #2a1f10;
        outline: none;
      }
      .parchment-input:focus {
        border-color: #b8860b;
        box-shadow: inset 0 1px 2px rgba(120, 80, 30, 0.35),
          inset 0 0 0 1px rgba(184, 134, 11, 0.5),
          0 0 0 2px rgba(184, 134, 11, 0.25);
      }
      .parchment-input::placeholder {
        color: rgba(58, 42, 24, 0.55);
      }
      .parchment-button-gold {
        font-family: var(--font-cinzel), Georgia, serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.20em;
        text-transform: uppercase;
        color: #2a1808;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.18);
        padding: 10px 16px;
        background: linear-gradient(180deg, #c89436 0%, #8a5e1a 100%);
        border: 1px solid #5a3a18;
        border-radius: 4px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25),
          inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.45);
        cursor: pointer;
        transition: filter 100ms;
      }
      .parchment-button-gold:hover:not(:disabled) {
        filter: brightness(1.1);
      }
      .parchment-button-gold:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .parchment-button-ghost {
        font-family: var(--font-cinzel), Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #5a3a18;
        padding: 10px 16px;
        background: transparent;
        border: 1px solid #8a6a3a;
        border-radius: 4px;
        cursor: pointer;
        transition: background 100ms;
      }
      .parchment-button-ghost:hover:not(:disabled) {
        background: rgba(120, 80, 30, 0.1);
      }
    `}</style>
  );
}

// ─── Today's totals edit modal (quill) ─────────────────────────────
function ProvisionsDayModal({
  date,
  row,
  goals,
  onClose,
  onSaved,
}: {
  date: string;
  row: NutritionRow | null;
  goals: Goals;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    calories: String(row?.calories ?? ""),
    protein: String(row?.protein ?? ""),
    carbs: String(row?.carbs ?? ""),
    fat: String(row?.fat ?? ""),
    notes: row?.notes ?? "",
  }));
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saveBusy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saveBusy]);

  async function save() {
    setSaveBusy(true);
    setSaveErr(null);
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          calories: Number(draft.calories || 0),
          protein_g: Number(draft.protein || 0),
          carbs_g: Number(draft.carbs || 0),
          fat_g: Number(draft.fat || 0),
          notes: draft.notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSaved();
      onClose();
    } catch (e: any) {
      setSaveErr(e?.message ?? "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full"
        style={{
          maxWidth: 460,
          padding: "24px 28px",
          background: [
            `linear-gradient(180deg, ${COLOR.parchment} 0%, ${COLOR.parchmentEdge} 100%)`,
            "var(--noise-bg)",
          ].join(", "),
          color: COLOR.ink,
          border: `2px solid ${COLOR.gold}`,
          borderRadius: 4,
          boxShadow: [
            `inset 0 0 0 1px ${COLOR.goldBright}55`,
            "0 24px 64px rgba(0,0,0,0.7)",
          ].join(", "),
        }}
      >
        <ParchmentInputStyles />

        <div className="flex items-start justify-between mb-3">
          <h2
            className="font-bold"
            style={{
              ...cinzel,
              fontSize: 18,
              color: COLOR.ink,
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            Edit Today's Totals
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl w-8 h-8 flex items-center justify-center"
            style={{ color: COLOR.inkSoft }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className="mb-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, #8a6a3a 25%, #b8860b 50%, #8a6a3a 75%, transparent)",
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="Calories">
            <input
              type="number"
              min="0"
              value={draft.calories}
              onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
              className="parchment-input"
              autoFocus
            />
          </FieldLabel>
          <FieldLabel label="Protein g">
            <input
              type="number"
              min="0"
              value={draft.protein}
              onChange={(e) => setDraft({ ...draft, protein: e.target.value })}
              className="parchment-input"
            />
          </FieldLabel>
          <FieldLabel label="Carbs g">
            <input
              type="number"
              min="0"
              value={draft.carbs}
              onChange={(e) => setDraft({ ...draft, carbs: e.target.value })}
              className="parchment-input"
            />
          </FieldLabel>
          <FieldLabel label="Fat g">
            <input
              type="number"
              min="0"
              value={draft.fat}
              onChange={(e) => setDraft({ ...draft, fat: e.target.value })}
              className="parchment-input"
            />
          </FieldLabel>
        </div>
        <div className="mt-3">
          <FieldLabel label="Notes">
            <input
              type="text"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="optional"
              className="parchment-input"
            />
          </FieldLabel>
        </div>
        {saveErr && (
          <p style={{ ...cinzel, fontSize: 11, color: "#8b1818", marginTop: 8 }}>
            {saveErr}
          </p>
        )}
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={save}
            disabled={saveBusy}
            className="parchment-button-gold flex-1"
          >
            {saveBusy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saveBusy}
            className="parchment-button-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────
function GearIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function QuillIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 4 C 16 6, 13 8, 10 12 L 8 17 L 13 16 C 17 14, 19 11, 20 4 Z" />
      <line x1="10" y1="12" x2="3" y2="20" />
      <line x1="9" y1="14" x2="6" y2="14" />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
function buildLastNDays(n: number, byDate: Map<string, NutritionRow>) {
  // Iterate the last N PT calendar days. `new Date()` + `setDate()` +
  // `toISOString()` would walk UTC dates, so a Saturday evening in PT
  // (still Friday UTC for early hours) was bucketing into Friday — the
  // user's "Saturday Bounty" silently rolled back one day.
  return lastNPTDays(n).map((iso) => {
    const r = byDate.get(iso);
    return {
      date: iso,
      label:
        n <= 7
          ? formatPTDate(iso, { weekday: "short" })
          : formatPTDate(iso, { month: "numeric", day: "numeric" }),
      calories: r?.calories ?? 0,
      protein: r?.protein ?? 0,
      carbs: r?.carbs ?? 0,
      fat: r?.fat ?? 0,
    };
  });
}
