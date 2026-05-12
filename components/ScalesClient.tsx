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
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader, { type HeaderProfile } from "@/components/AppHeader";
import { tooltipStyle, useChartPalette } from "@/lib/chartTheme";
import { todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";

const cinzel = { fontFamily: "var(--font-cinzel), Georgia, serif" };
const STEPS_PER_500CAL = 10000;
const KCAL_PER_LB = 3500;

function stepsBurned(steps: number): number {
  return steps > 0 ? (steps / STEPS_PER_500CAL) * 500 : 0;
}
function fmtSigned(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}

export type WeightEntry = { date: string; weight: number; notes: string | null };
export type CaloriesDay = { date: string; calories: number };
export type StepsDay = { date: string; steps: number };

export type WeightGoal = { lbs: number; date: string };

type Props = {
  userId: string;
  username: string;
  isAdmin: boolean;
  profile?: HeaderProfile;
  calorieBenchmark: number;
  weights: WeightEntry[];
  bwTableMissing: boolean;
  nutritionRows: CaloriesDay[];
  stepsRows: StepsDay[];
  allTimeNutrition: CaloriesDay[];
  allTimeSteps: StepsDay[];
  weightGoal: WeightGoal | null;
  goalColumnsMissing: boolean;
};

export default function ScalesClient({
  username,
  isAdmin,
  profile,
  calorieBenchmark,
  weights,
  bwTableMissing,
  nutritionRows,
  stepsRows,
  allTimeNutrition,
  allTimeSteps,
  weightGoal,
  goalColumnsMissing,
}: Props) {
  const router = useRouter();
  const chart = useChartPalette();
  const todayISO = todayPT();

  const caloriesByDate = useMemo(() => {
    const m = new Map<string, number>();
    nutritionRows.forEach((r) => m.set(r.date, r.calories));
    return m;
  }, [nutritionRows]);
  const stepsByDate = useMemo(() => {
    const m = new Map<string, number>();
    stepsRows.forEach((r) => m.set(r.date, r.steps));
    return m;
  }, [stepsRows]);

  // ── Body weight derived stats
  const latest = weights[weights.length - 1] ?? null;
  const previous = weights[weights.length - 2] ?? null;
  const thirtyAgo = useMemo(() => {
    if (weights.length === 0) return null;
    const cutoff = new Date(todayISO + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const before = weights.filter((w) => w.date <= cutoffISO);
    return before[before.length - 1] ?? weights[0];
  }, [weights, todayISO]);
  const start = weights[0] ?? null;

  // ── 7-day balance
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
      const c = caloriesByDate.get(iso) ?? 0;
      const s = stepsByDate.get(iso) ?? 0;
      if (c <= 0) continue;
      const b = stepsBurned(s);
      cal += c;
      burn += b;
      net += c - calorieBenchmark - b;
      days += 1;
    }
    return { cal, burn, net, days };
  }, [caloriesByDate, stepsByDate, todayISO, calorieBenchmark]);

  // ── All-time balance
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
      const s = stepMap.get(iso) ?? 0;
      const b = stepsBurned(s);
      cal += c;
      burn += b;
      net += c - calorieBenchmark - b;
      days += 1;
    });
    return { cal, burn, net, days };
  }, [allTimeNutrition, allTimeSteps, calorieBenchmark]);

  // ── Today
  const tCal = caloriesByDate.get(todayISO) ?? 0;
  const tSteps = stepsByDate.get(todayISO) ?? 0;
  const tBurn = stepsBurned(tSteps);
  const tNet = tCal > 0 ? tCal - calorieBenchmark - tBurn : null;

  // ── Pace (14-day average)
  const pace = useMemo(() => {
    let cal = 0;
    let burn = 0;
    let days = 0;
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 13; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const c = caloriesByDate.get(iso) ?? 0;
      const s = stepsByDate.get(iso) ?? 0;
      if (c <= 0) continue;
      cal += c;
      burn += stepsBurned(s);
      days += 1;
    }
    if (days === 0)
      return { avgDaily: 0, weeklyLbs: 0, monthlyLbs: 0, days: 0 };
    const avgDaily = (cal - calorieBenchmark * days) / days - burn / days;
    return {
      avgDaily,
      weeklyLbs: (avgDaily * 7) / KCAL_PER_LB,
      monthlyLbs: (avgDaily * 30) / KCAL_PER_LB,
      days,
    };
  }, [caloriesByDate, stepsByDate, todayISO, calorieBenchmark]);

  // ── Actual rate from weigh-ins (linear regression over the last 30 days)
  const actualRate = useMemo(() => {
    if (weights.length < 2) return null;
    const cutoff = new Date(todayISO + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const points = weights
      .filter((w) => w.date >= cutoffISO)
      .map((w) => {
        const d = new Date(w.date + "T00:00:00").getTime();
        return { x: d, y: w.weight };
      });
    if (points.length < 2) return null;
    // Simple least-squares slope
    const n = points.length;
    const sumX = points.reduce((a, p) => a + p.x, 0);
    const sumY = points.reduce((a, p) => a + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0;
    let den = 0;
    points.forEach((p) => {
      num += (p.x - meanX) * (p.y - meanY);
      den += (p.x - meanX) ** 2;
    });
    if (den === 0) return null;
    const slopePerMs = num / den; // lbs per millisecond
    const lbsPerDay = slopePerMs * 86_400_000;
    return { lbsPerDay, lbsPerWeek: lbsPerDay * 7 };
  }, [weights, todayISO]);

  // ── State for log-weight modal
  const [logOpen, setLogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function saveWeight(date: string, w: number, notes: string) {
    const res = await fetch("/api/body-weight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        weight_lbs: w,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    router.refresh();
  }

  // Balance scale tilt — based on this week's net. Positive (surplus)
  // tilts LEFT (calories in heavier); negative (deficit) tilts RIGHT.
  const tiltDeg = useMemo(() => {
    if (week.days === 0) return 0;
    const avg = week.net / week.days;
    // Map [-1000, +1000] cal/day → [-15°, +15°] tilt
    const t = Math.max(-1000, Math.min(1000, avg)) / 1000;
    return -t * 15; // negate so surplus → left tilt
  }, [week]);

  return (
    <div
      className="min-h-screen flex flex-col pb-24 md:pb-0"
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(40,30,60,0.30), rgba(0,0,0,0) 70%), #0a0810",
      }}
    >
      <AppHeader username={username} isAdmin={isAdmin} profile={profile} />
      <main className="flex-1 w-full px-6 lg:px-10 py-6 space-y-8">
        {/* Hero — Balance scale + title */}
        <section className="text-center">
          <div
            className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
            style={cinzel}
          >
            Apothecary's Tools
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mt-1"
            style={{
              ...cinzel,
              color: "#d4a853",
              letterSpacing: "0.16em",
              textShadow: "0 0 22px rgba(212,168,83,0.35)",
            }}
          >
            The Scales of Fate
          </h1>
          <p
            className="text-[12px] mt-2 italic"
            style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}
          >
            Weigh thy calories, weigh thy steps, weigh thyself.
          </p>
          <BalanceScaleSVG tilt={tiltDeg} />
          {week.days > 0 && (
            <div
              className="text-[10px] uppercase tracking-[0.24em]"
              style={{
                ...cinzel,
                color: tiltDeg > 1 ? "#e6c266" : tiltDeg < -1 ? "#8fc99a" : "#d4a853",
              }}
            >
              This week:{" "}
              {tiltDeg > 1 ? "Surplus" : tiltDeg < -1 ? "Deficit" : "Balanced"}
              {" · "}
              {fmtSigned(week.net / Math.max(1, week.days))} cal / day
            </div>
          )}
        </section>

        {bwTableMissing && (
          <div
            className="mx-auto max-w-2xl text-[12px] rounded p-3"
            style={{
              ...cinzel,
              background: "rgba(139,24,24,0.18)",
              border: "1px solid rgba(139,24,24,0.55)",
              color: "#fecaca",
            }}
          >
            ⚠ The <code>body_weight</code> table is missing. Run{" "}
            <code>supabase/migrations/add_body_weight.sql</code> in your
            Supabase SQL editor. Weight logging will fail until then; the
            energy ledger continues to work.
          </div>
        )}

        {/* SECTION 1 — Body weight tracker */}
        <section
          className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-stretch rounded-md p-6"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(60,40,80,0.18), rgba(0,0,0,0) 60%), linear-gradient(180deg, #15110a 0%, #0a0805 100%)",
            border: "4px solid #5a3a1f",
            boxShadow:
              "inset 0 0 0 1px #2d1d0f, inset 0 0 24px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.55)",
          }}
        >
          {/* Current weight */}
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.26em] font-bold mb-2"
              style={{ ...cinzel, color: "#d4a853" }}
            >
              Current Weight
            </div>
            {latest ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      ...cinzel,
                      fontSize: 48,
                      color: "#f5e6c4",
                      textShadow: "0 0 18px rgba(212,168,83,0.40)",
                    }}
                  >
                    {latest.weight.toFixed(1)}
                  </span>
                  <span
                    style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}
                  >
                    lbs
                  </span>
                </div>
                <div
                  className="text-[10px] mt-1"
                  style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
                >
                  Last logged {formatDate(latest.date)}
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
                  <DeltaStat
                    label="From last"
                    delta={previous ? latest.weight - previous.weight : null}
                  />
                  <DeltaStat
                    label="From 30d"
                    delta={
                      thirtyAgo && thirtyAgo !== latest
                        ? latest.weight - thirtyAgo.weight
                        : null
                    }
                  />
                  <DeltaStat
                    label="From start"
                    delta={
                      start && start !== latest
                        ? latest.weight - start.weight
                        : null
                    }
                  />
                </ul>
              </>
            ) : (
              <p
                className="italic mt-2"
                style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
              >
                No weight logged yet. Record your first weigh-in →
              </p>
            )}
          </div>
          {/* Log weight CTA */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="relative px-10 py-3 transition hover:brightness-110 active:translate-y-px"
              style={{
                ...cinzel,
                fontSize: 12,
                letterSpacing: "0.28em",
                fontWeight: 800,
                color: "#f5e6c4",
                textShadow: "0 1px 0 rgba(0,0,0,0.7)",
                background:
                  "linear-gradient(180deg, #c89436 0%, #8a5e1a 60%, #4a3010 100%)",
                border: "2px solid #d4a853",
                borderRadius: 4,
                boxShadow:
                  "inset 0 1px 0 rgba(255,240,200,0.30), inset 0 -2px 0 rgba(0,0,0,0.40), 0 0 16px rgba(212,168,83,0.40), 0 6px 14px rgba(0,0,0,0.55)",
              }}
              aria-label="Record your weight"
            >
              Record Your Weight
            </button>
          </div>
        </section>

        {/* SECTION 2 — Energy balance hero cards */}
        <section>
          <h2
            className="text-center font-bold mb-4"
            style={{
              ...cinzel,
              fontSize: 18,
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              color: "#d4a853",
              textShadow: "0 0 12px rgba(212,168,83,0.35)",
            }}
          >
            Energy Balance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BalanceCard
              title="Today"
              cal={tCal}
              burn={tBurn}
              steps={tSteps}
              net={tNet}
              partial={tCal === 0 || tSteps === 0}
            />
            <BalanceCard
              title="This Week"
              cal={week.cal}
              burn={week.burn}
              steps={null}
              net={week.days > 0 ? week.net : null}
              footnote={`${week.days}/7 days tracked`}
              weeklyLbs={(week.net / KCAL_PER_LB) * (week.days > 0 ? 7 / week.days : 0)}
            />
            <BalanceCard
              title="All Time"
              cal={all.cal}
              burn={all.burn}
              steps={null}
              net={all.days > 0 ? all.net : null}
              footnote={`${all.days} day${all.days === 1 ? "" : "s"} tracked`}
              totalLbs={all.net / KCAL_PER_LB}
            />
          </div>
        </section>

        {/* SECTION 3 — Three charts */}
        <section className="space-y-6">
          <h2
            className="text-center font-bold"
            style={{
              ...cinzel,
              fontSize: 18,
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              color: "#d4a853",
              textShadow: "0 0 12px rgba(212,168,83,0.35)",
            }}
          >
            The Ledger Charts
          </h2>

          <WeightOverTimeChart weights={weights} chart={chart} />
          <DailyBalanceChart
            caloriesByDate={caloriesByDate}
            stepsByDate={stepsByDate}
            todayISO={todayISO}
            calorieBenchmark={calorieBenchmark}
            chart={chart}
          />
          <CumulativeJourneyChart
            caloriesByDate={caloriesByDate}
            stepsByDate={stepsByDate}
            weights={weights}
            todayISO={todayISO}
            calorieBenchmark={calorieBenchmark}
            chart={chart}
          />
        </section>

        {/* SECTION 4 — Projections + Goal setting */}
        <section>
          <h2
            className="text-center font-bold mb-4"
            style={{
              ...cinzel,
              fontSize: 18,
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              color: "#d4a853",
              textShadow: "0 0 12px rgba(212,168,83,0.35)",
            }}
          >
            Projections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PaceCard pace={pace} actualRate={actualRate} />
            <GoalCard
              currentWeight={latest?.weight ?? null}
              avgDaily={pace.avgDaily}
              calorieBenchmark={calorieBenchmark}
              weightGoal={weightGoal}
              goalColumnsMissing={goalColumnsMissing}
              todayISO={todayISO}
              onLogWeight={async (date, w, notes) => {
                await saveWeight(date, w, notes);
                setToast(`Logged ${w.toFixed(1)} lbs · ${date}`);
              }}
              onSaveGoal={async (lbs, date) => {
                const res = await fetch("/api/weight-goal", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    weight_goal_lbs: lbs,
                    weight_goal_date: date,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
                setToast(`Goal set: ${lbs} lbs by ${date}`);
                router.refresh();
              }}
              onClearGoal={async () => {
                const res = await fetch("/api/weight-goal", { method: "DELETE" });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error ?? `HTTP ${res.status}`);
                }
                setToast("Goal cleared");
                router.refresh();
              }}
            />
          </div>
        </section>

        {/* SECTION 5 — Settings hint */}
        <section
          className="rounded p-4 text-center"
          style={{
            background: "rgba(20,14,10,0.55)",
            border: "1px solid rgba(212,168,83,0.30)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.24em] font-bold"
            style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}
          >
            Calibration
          </div>
          <p
            className="mt-2 text-[12px]"
            style={{ ...cinzel, color: "rgba(232,213,163,0.85)" }}
          >
            Daily benchmark:{" "}
            <span style={{ color: "#d4a853", fontWeight: 700 }}>
              {calorieBenchmark.toLocaleString()} cal
            </span>{" "}
            · Step burn:{" "}
            <span style={{ color: "#d4a853", fontWeight: 700 }}>
              {STEPS_PER_500CAL.toLocaleString()} steps = 500 cal
            </span>
          </p>
          <a
            href="/calories"
            className="inline-block mt-3 text-[10px] uppercase tracking-[0.22em] font-bold hover:brightness-125"
            style={{ ...cinzel, color: "#a855f7" }}
          >
            Adjust benchmark in Provisions →
          </a>
        </section>
      </main>

      {logOpen && (
        <LogWeightModal
          latestWeight={latest?.weight ?? null}
          todayISO={todayISO}
          onClose={() => setLogOpen(false)}
          onSave={async (date, w, notes) => {
            try {
              await saveWeight(date, w, notes);
              setToast(`Logged ${w.toFixed(1)} lbs · ${date}`);
              setLogOpen(false);
            } catch (e: any) {
              throw e;
            }
          }}
        />
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-bold rounded transition-opacity duration-200 ${
          toast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          ...cinzel,
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

// ─── Balance Scale SVG (animated tilt) ──────────────────────────
function BalanceScaleSVG({ tilt }: { tilt: number }) {
  return (
    <div className="flex justify-center my-4">
      <svg viewBox="0 0 320 200" width="280" height="180" aria-hidden>
        {/* Stand */}
        <line
          x1="160"
          y1="170"
          x2="160"
          y2="60"
          stroke="#d4a853"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ellipse cx="160" cy="178" rx="40" ry="6" fill="#5a3a1f" />
        <ellipse cx="160" cy="60" rx="6" ry="6" fill="#d4a853" />

        {/* Beam (rotates) */}
        <g
          style={{
            transform: `rotate(${tilt}deg)`,
            transformOrigin: "160px 60px",
            transition: "transform 1200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <line
            x1="40"
            y1="60"
            x2="280"
            y2="60"
            stroke="#d4a853"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Left pan (Calories In) */}
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="100"
            stroke="#8a6a3a"
            strokeWidth="1.5"
          />
          <line
            x1="40"
            y1="100"
            x2="80"
            y2="100"
            stroke="#8a6a3a"
            strokeWidth="1.5"
          />
          <path
            d="M 30 100 Q 35 120, 60 120 Q 85 120, 90 100 Z"
            fill="url(#pan-grad-L)"
            stroke="#8a6a3a"
            strokeWidth="1"
          />
          <text
            x="60"
            y="138"
            textAnchor="middle"
            fontSize="8"
            fill="#d4a853"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              letterSpacing: "0.16em",
            }}
          >
            CAL IN
          </text>
          {/* Right pan (Calories Out) */}
          <line
            x1="260"
            y1="60"
            x2="260"
            y2="100"
            stroke="#8a6a3a"
            strokeWidth="1.5"
          />
          <line
            x1="240"
            y1="100"
            x2="280"
            y2="100"
            stroke="#8a6a3a"
            strokeWidth="1.5"
          />
          <path
            d="M 230 100 Q 235 120, 260 120 Q 285 120, 290 100 Z"
            fill="url(#pan-grad-R)"
            stroke="#8a6a3a"
            strokeWidth="1"
          />
          <text
            x="260"
            y="138"
            textAnchor="middle"
            fontSize="8"
            fill="#d4a853"
            style={{
              fontFamily: "var(--font-cinzel), Georgia, serif",
              letterSpacing: "0.16em",
            }}
          >
            CAL OUT
          </text>
        </g>

        <defs>
          <linearGradient id="pan-grad-L" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2818" />
            <stop offset="100%" stopColor="#1a0f06" />
          </linearGradient>
          <linearGradient id="pan-grad-R" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2818" />
            <stop offset="100%" stopColor="#1a0f06" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─── Stat helpers ───────────────────────────────────────────────
function DeltaStat({
  label,
  delta,
}: {
  label: string;
  delta: number | null;
}) {
  const color =
    delta == null
      ? "#9a9282"
      : delta < 0
      ? "#8fc99a"
      : delta > 0
      ? "#e6c266"
      : "#d4a853";
  return (
    <li>
      <div
        className="text-[9px] uppercase tracking-[0.20em]"
        style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
      >
        {label}
      </div>
      <div
        className="font-bold tabular-nums mt-0.5"
        style={{ ...cinzel, color, fontSize: 14 }}
      >
        {delta == null
          ? "—"
          : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb`}
      </div>
    </li>
  );
}

function BalanceCard({
  title,
  cal,
  burn,
  steps,
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
  net: number | null;
  partial?: boolean;
  footnote?: string;
  weeklyLbs?: number;
  totalLbs?: number;
}) {
  const netColor =
    net == null ? "#9a9282" : net >= 0 ? "#e6c266" : "#8fc99a";
  const status =
    net == null
      ? "—"
      : Math.abs(net) < 100
      ? "Balanced"
      : net > 0
      ? "Surplus"
      : "Deficit";
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
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}>In</span>
          <span className="tabular-nums" style={{ color: "#f5e6c4" }}>
            {Math.round(cal).toLocaleString()} cal
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}>Steps</span>
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
          className="flex items-center justify-between pt-1 mt-1.5"
          style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}
        >
          <span
            style={{
              ...cinzel,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 10,
              color: "#d4a853",
              fontWeight: 700,
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
              {status.toLowerCase()}
            </span>
          </span>
        </div>
        {weeklyLbs != null && Number.isFinite(weeklyLbs) && (
          <div
            className="text-[10px] italic"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            ≈ {weeklyLbs >= 0 ? "+" : ""}
            {weeklyLbs.toFixed(2)} lb / week
          </div>
        )}
        {totalLbs != null && Number.isFinite(totalLbs) && (
          <div
            className="text-[10px] italic"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            ≈ {totalLbs >= 0 ? "+" : ""}
            {totalLbs.toFixed(1)} lb total
          </div>
        )}
        {(partial || footnote) && (
          <div
            className="text-[10px]"
            style={{ ...cinzel, color: "rgba(216,210,194,0.45)" }}
          >
            {footnote ?? "log both food + steps for a full picture"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chart 1 — Weight Over Time ─────────────────────────────────
type WeightRange = "week" | "month" | "3m" | "all";
function WeightOverTimeChart({
  weights,
  chart,
}: {
  weights: WeightEntry[];
  chart: ReturnType<typeof useChartPalette>;
}) {
  const [range, setRange] = useState<WeightRange>("month");
  const data = useMemo(() => {
    if (weights.length === 0) return [];
    const today = new Date();
    const days =
      range === "week" ? 7 : range === "month" ? 30 : range === "3m" ? 90 : 99999;
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - days);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return weights
      .filter((w) => w.date >= cutoffISO)
      .map((w) => ({ date: w.date, label: w.date.slice(5), weight: w.weight }));
  }, [weights, range]);

  // Trend line (linear regression)
  const trendData = useMemo(() => {
    if (data.length < 2) return [];
    const xs = data.map((_, i) => i);
    const ys = data.map((d) => d.weight);
    const n = xs.length;
    const mx = xs.reduce((a, x) => a + x, 0) / n;
    const my = ys.reduce((a, y) => a + y, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den === 0) return [];
    const m = num / den;
    const b = my - m * mx;
    return data.map((d, i) => ({ ...d, trend: m * i + b }));
  }, [data]);

  return (
    <WoodenFrame title="Body Weight Over Time">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["week", "month", "3m", "all"] as WeightRange[]).map((r) => {
          const active = r === range;
          const label = r === "week" ? "Week" : r === "month" ? "Month" : r === "3m" ? "3 Months" : "All Time";
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
                background: active
                  ? "linear-gradient(180deg, #e6c66a 0%, #d4a853 100%)"
                  : "transparent",
                border: `1px solid ${active ? "#d4a853" : "rgba(212,168,83,0.30)"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {data.length < 2 ? (
        <div
          className="h-48 flex items-center justify-center italic"
          style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
        >
          Log at least two weigh-ins to see the trend.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart
              data={trendData}
              margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={tooltipStyle(chart)}
                formatter={(v: any, name: any) => [`${Number(v).toFixed(1)} lbs`, name]}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#d4a853"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#d4a853" }}
                activeDot={{ r: 5, fill: "#fff8e6", stroke: "#d4a853", strokeWidth: 2 }}
                name="Weight"
              />
              <Line
                type="linear"
                dataKey="trend"
                stroke="#a855f7"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                name="Trend"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </WoodenFrame>
  );
}

// ─── Chart 2 — Daily Balance ─────────────────────────────────────
function DailyBalanceChart({
  caloriesByDate,
  stepsByDate,
  todayISO,
  calorieBenchmark,
  chart,
}: {
  caloriesByDate: Map<string, number>;
  stepsByDate: Map<string, number>;
  todayISO: string;
  calorieBenchmark: number;
  chart: ReturnType<typeof useChartPalette>;
}) {
  const [mode, setMode] = useState<"with-steps" | "food-only">("with-steps");
  const data = useMemo(() => {
    const out: Array<{
      date: string;
      label: string;
      cal: number;
      steps: number;
      burn: number;
      net: number;
      foodOnly: number;
    }> = [];
    const end = new Date(todayISO + "T00:00:00");
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const c = caloriesByDate.get(iso) ?? 0;
      const s = stepsByDate.get(iso) ?? 0;
      const b = stepsBurned(s);
      const foodOnly = c > 0 ? c - calorieBenchmark : 0;
      const net = c > 0 ? foodOnly - b : 0;
      out.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        cal: c,
        steps: s,
        burn: b,
        net,
        foodOnly,
      });
    }
    return out;
  }, [caloriesByDate, stepsByDate, todayISO, calorieBenchmark]);

  const valueKey: "net" | "foodOnly" = mode === "with-steps" ? "net" : "foodOnly";

  return (
    <WoodenFrame title="Daily Energy Balance · 30 days">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["with-steps", "food-only"] as const).map((m) => {
          const active = m === mode;
          const label = m === "with-steps" ? "With Steps" : "Food Only";
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="px-3 py-1 rounded-full transition"
              style={{
                ...cinzel,
                fontSize: 10,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#1a0f00" : "rgba(232,213,163,0.65)",
                background: active ? "linear-gradient(180deg,#e6c66a,#d4a853)" : "transparent",
                border: `1px solid ${active ? "#d4a853" : "rgba(212,168,83,0.30)"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} interval={3} />
            <YAxis stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: chart.cursor }}
              content={({ active, payload }: any) => {
                if (!active || !payload || !payload[0]) return null;
                const r = payload[0].payload;
                const value = r[valueKey];
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
                    <div>Food: {r.cal.toLocaleString()} cal</div>
                    <div>Steps: {r.steps.toLocaleString()} ({fmtSigned(-r.burn)} cal)</div>
                    <div
                      style={{
                        marginTop: 4,
                        color: value >= 0 ? "#e6c266" : "#8fc99a",
                        fontWeight: 700,
                      }}
                    >
                      Net: {fmtSigned(value)} ({value >= 0 ? "surplus" : "deficit"})
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="#d4a853" strokeDasharray="4 4" strokeOpacity={0.7} />
            <Bar dataKey={valueKey} radius={[3, 3, 0, 0]} maxBarSize={18}>
              {data.map((d, i) => (
                <Cell key={i} fill={d[valueKey] >= 0 ? "#c26a3a" : "#3d6b3a"} fillOpacity={d.cal > 0 ? 0.95 : 0.30} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WoodenFrame>
  );
}

// ─── Chart 3 — Cumulative Journey ────────────────────────────────
function CumulativeJourneyChart({
  caloriesByDate,
  stepsByDate,
  weights,
  todayISO,
  calorieBenchmark,
  chart,
}: {
  caloriesByDate: Map<string, number>;
  stepsByDate: Map<string, number>;
  weights: WeightEntry[];
  todayISO: string;
  calorieBenchmark: number;
  chart: ReturnType<typeof useChartPalette>;
}) {
  const [range, setRange] = useState<"week" | "month" | "all">("month");
  const days = range === "week" ? 7 : range === "month" ? 30 : 90;
  const data = useMemo(() => {
    const out: Array<{
      date: string;
      label: string;
      cum: number;
      lbs: number;
      hasWeight: boolean;
    }> = [];
    let run = 0;
    const end = new Date(todayISO + "T00:00:00");
    const wDates = new Set(weights.map((w) => w.date));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const c = caloriesByDate.get(iso) ?? 0;
      const s = stepsByDate.get(iso) ?? 0;
      if (c > 0) {
        run += c - calorieBenchmark - stepsBurned(s);
      }
      out.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        cum: run,
        lbs: run / KCAL_PER_LB,
        hasWeight: wDates.has(iso),
      });
    }
    return out;
  }, [caloriesByDate, stepsByDate, todayISO, calorieBenchmark, days, weights]);

  return (
    <WoodenFrame title="Cumulative Journey">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["week", "month", "all"] as const).map((r) => {
          const active = r === range;
          const label = r === "week" ? "Week" : r === "month" ? "Month" : "All Time";
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
                background: active ? "linear-gradient(180deg,#e6c66a,#d4a853)" : "transparent",
                border: `1px solid ${active ? "#d4a853" : "rgba(212,168,83,0.30)"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="cum-pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c26a3a" stopOpacity={0.50} />
                <stop offset="100%" stopColor="#c26a3a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cum-neg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d6b3a" stopOpacity={0} />
                <stop offset="100%" stopColor="#3d6b3a" stopOpacity={0.50} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#d8d0bb" fontSize={10} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(days / 8))} />
            <YAxis
              stroke="#d8d0bb"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              yAxisId="cal"
              orientation="left"
            />
            <YAxis
              stroke="#a855f7"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              yAxisId="lbs"
              orientation="right"
              tickFormatter={(v: any) => `${(Number(v)).toFixed(1)}`}
            />
            <Tooltip
              contentStyle={tooltipStyle(chart)}
              formatter={(v: any, _name: any, entry: any) => {
                if (entry?.dataKey === "lbs") return [`${Number(v).toFixed(2)} lb`, "Est. lbs"];
                return [`${fmtSigned(Number(v))} cal`, "Cumulative"];
              }}
            />
            <ReferenceLine yAxisId="cal" y={0} stroke="#d4a853" strokeDasharray="4 4" strokeOpacity={0.7} />
            <Area
              yAxisId="cal"
              type="monotone"
              dataKey="cum"
              stroke="#d4a853"
              strokeWidth={2.5}
              fill="url(#cum-pos)"
              dot={({ cx, cy, payload }: any) =>
                payload?.hasWeight ? (
                  <circle cx={cx} cy={cy} r={4} fill="#d4a853" stroke="#fff8e6" strokeWidth={1.5} />
                ) : (
                  <></>
                )
              }
            />
            <Line yAxisId="lbs" type="monotone" dataKey="lbs" stroke="transparent" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div
        className="text-[10px] mt-2 italic text-center"
        style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
      >
        Gold dots = days a weight was logged. Right axis: estimated lbs (÷3500).
      </div>
    </WoodenFrame>
  );
}

// ─── Section 4 — Pace + Goal cards ──────────────────────────────
function PaceCard({
  pace,
  actualRate,
}: {
  pace: { avgDaily: number; weeklyLbs: number; monthlyLbs: number; days: number };
  actualRate: { lbsPerDay: number; lbsPerWeek: number } | null;
}) {
  return (
    <div
      className="rounded p-4"
      style={{
        background: "rgba(20,14,10,0.70)",
        border: "1px solid rgba(212,168,83,0.45)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3"
        style={{ ...cinzel, color: "#d4a853" }}
      >
        ✦ At Your Current Pace
      </div>
      {pace.days === 0 ? (
        <p className="italic text-[12px]" style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}>
          Log food + steps for a few days to see your pace.
        </p>
      ) : (
        <div className="space-y-1.5 text-[12px]">
          <Row label="Avg daily balance" value={`${fmtSigned(pace.avgDaily)} cal/day`} color="#d4a853" />
          <Row label="Weekly rate" value={`${pace.weeklyLbs >= 0 ? "+" : ""}${pace.weeklyLbs.toFixed(2)} lb/week`} color={pace.weeklyLbs < 0 ? "#8fc99a" : "#e6c266"} />
          <Row label="Monthly projection" value={`${pace.monthlyLbs >= 0 ? "+" : ""}${pace.monthlyLbs.toFixed(1)} lb/month`} color={pace.monthlyLbs < 0 ? "#8fc99a" : "#e6c266"} />
          {actualRate && (
            <>
              <div className="h-px my-2" style={{ background: "rgba(212,168,83,0.25)" }} />
              <Row label="Calculated" value={`${pace.weeklyLbs >= 0 ? "+" : ""}${pace.weeklyLbs.toFixed(2)} lb/wk`} color="#d4a853" />
              <Row label="Actual (weigh-ins)" value={`${actualRate.lbsPerWeek >= 0 ? "+" : ""}${actualRate.lbsPerWeek.toFixed(2)} lb/wk`} color="#a855f7" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}>{label}</span>
      <span className="tabular-nums font-bold" style={{ ...cinzel, color }}>{value}</span>
    </div>
  );
}

function GoalCard({
  currentWeight,
  avgDaily,
  calorieBenchmark,
  weightGoal,
  goalColumnsMissing,
  todayISO,
  onLogWeight,
  onSaveGoal,
  onClearGoal,
}: {
  currentWeight: number | null;
  avgDaily: number;
  calorieBenchmark: number;
  weightGoal: WeightGoal | null;
  goalColumnsMissing: boolean;
  todayISO: string;
  onLogWeight: (date: string, weight: number, notes: string) => Promise<void>;
  onSaveGoal: (lbs: number, date: string) => Promise<void>;
  onClearGoal: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Inline weight log (when no weight exists yet)
  const [logWeight, setLogWeight] = useState("");
  const [logDate, setLogDate] = useState(todayISO);

  async function submitLogWeight(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(logWeight);
    if (!Number.isFinite(w) || w <= 0) {
      setErr("Enter a valid weight.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onLogWeight(logDate, w, "");
      setLogWeight("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to log weight");
    } finally {
      setBusy(false);
    }
  }

  // ── Goal form
  const [target, setTarget] = useState(weightGoal ? String(weightGoal.lbs) : "");
  const [targetDate, setTargetDate] = useState(weightGoal?.date ?? "");
  const minDate = useMemo(() => {
    const d = new Date(todayISO + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [todayISO]);

  async function submitGoal(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0 || t > 1500) {
      setErr("Target weight must be 1-1500 lbs.");
      return;
    }
    if (!targetDate || targetDate <= todayISO) {
      setErr("Target date must be in the future.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSaveGoal(t, targetDate);
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save goal");
    } finally {
      setBusy(false);
    }
  }

  async function clearGoal() {
    setBusy(true);
    setErr(null);
    try {
      await onClearGoal();
      setEditing(false);
      setTarget("");
      setTargetDate("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to clear goal");
    } finally {
      setBusy(false);
    }
  }

  // ── Projection (based on saved goal)
  const projection = useMemo(() => {
    if (!currentWeight || !weightGoal) return null;
    const today = new Date(todayISO + "T00:00:00");
    const goal = new Date(weightGoal.date + "T00:00:00");
    const daysRemaining = Math.max(
      1,
      Math.round((goal.getTime() - today.getTime()) / 86_400_000)
    );
    const lbsToLose = currentWeight - weightGoal.lbs; // positive = need to lose
    const lbsPerDay = lbsToLose / daysRemaining;
    const calPerDay = lbsPerDay * KCAL_PER_LB; // positive = required deficit
    return { daysRemaining, lbsToLose, lbsPerDay, calPerDay };
  }, [currentWeight, weightGoal, todayISO]);

  // ── At-current-pace ETA — returns { status, etaISO?, daysLate? }
  // status: "wrong-way" | "on-track" | "behind" | "very-behind"
  const paceETA = useMemo(() => {
    if (!currentWeight || !weightGoal || !Number.isFinite(avgDaily)) return null;
    const lbsPerDayActual = -avgDaily / KCAL_PER_LB; // positive = losing
    const lbsToLose = currentWeight - weightGoal.lbs;
    const wantLose = lbsToLose > 0;
    const isLosing = lbsPerDayActual > 0;
    if (lbsPerDayActual === 0 || wantLose !== isLosing) {
      return { status: "wrong-way" as const };
    }
    const daysAtPace = Math.abs(lbsToLose) / Math.abs(lbsPerDayActual);
    const eta = new Date(todayISO + "T00:00:00");
    eta.setDate(eta.getDate() + Math.round(daysAtPace));
    const goal = new Date(weightGoal.date + "T00:00:00");
    const daysLate = Math.round((eta.getTime() - goal.getTime()) / 86_400_000);
    const etaISO = eta.toISOString().slice(0, 10);
    if (daysLate <= 0) return { status: "on-track" as const, etaISO, daysLate };
    if (daysLate <= 14) return { status: "behind" as const, etaISO, daysLate };
    return { status: "very-behind" as const, etaISO, daysLate };
  }, [currentWeight, weightGoal, avgDaily, todayISO]);

  // ── If goal columns aren't migrated yet, show a friendly nudge
  if (goalColumnsMissing) {
    return (
      <div
        className="rounded p-4"
        style={{
          background: "rgba(139,24,24,0.18)",
          border: "1px solid rgba(139,24,24,0.55)",
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-bold mb-2"
          style={{ ...cinzel, color: "#fecaca" }}
        >
          Goal Storage Missing
        </div>
        <p className="text-[11px]" style={{ ...cinzel, color: "#fecaca" }}>
          Run <code>supabase/migrations/add_weight_goal.sql</code> in your
          Supabase SQL editor to enable goal saving.
        </p>
      </div>
    );
  }

  // ── No weight logged yet → inline log form
  if (!currentWeight) {
    return (
      <div
        className="rounded p-4"
        style={{
          background: "rgba(20,14,10,0.70)",
          border: "1px solid rgba(212,168,83,0.45)",
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3"
          style={{ ...cinzel, color: "#d4a853" }}
        >
          Set a Weight Goal
        </div>
        <p
          className="text-[12px] mb-3"
          style={{ ...cinzel, color: "rgba(232,213,163,0.75)" }}
        >
          Log your current weight to set a goal:
        </p>
        <form onSubmit={submitLogWeight} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div>
            <label className="block text-[9px] uppercase tracking-[0.22em] mb-1" style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}>
              Weight (lbs)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={logWeight}
              onChange={(e) => setLogWeight(e.target.value)}
              placeholder="lbs"
              className="w-full text-[13px] tabular-nums"
              style={{ minHeight: 36, padding: "4px 8px" }}
              required
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-[0.22em] mb-1" style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}>
              Date
            </label>
            <input
              type="date"
              value={logDate}
              max={todayISO}
              onChange={(e) => setLogDate(e.target.value)}
              className="text-[13px]"
              style={{ minHeight: 36, padding: "4px 8px" }}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-3"
            style={{
              ...cinzel,
              minHeight: 36,
              fontSize: 10,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "#f5e6c4",
              background: "linear-gradient(180deg, #c89436, #8a5e1a)",
              border: "1px solid #d4a853",
              borderRadius: 4,
            }}
          >
            {busy ? "…" : "Log"}
          </button>
        </form>
        {err && (
          <p className="text-[11px] mt-2" style={{ color: "#dc6868" }}>
            {err}
          </p>
        )}
      </div>
    );
  }

  // ── No goal saved (or editing) → show form
  if (!weightGoal || editing) {
    return (
      <div
        className="rounded p-4"
        style={{
          background: "rgba(20,14,10,0.70)",
          border: "1px solid rgba(212,168,83,0.45)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div
            className="text-[10px] uppercase tracking-[0.28em] font-bold"
            style={{ ...cinzel, color: "#d4a853" }}
          >
            {weightGoal ? "Edit Weight Goal" : "Set a Weight Goal"}
          </div>
          {weightGoal && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTarget(String(weightGoal.lbs));
                setTargetDate(weightGoal.date);
                setErr(null);
              }}
              className="text-[10px] uppercase tracking-[0.20em]"
              style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}
            >
              Cancel
            </button>
          )}
        </div>
        <form onSubmit={submitGoal} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] uppercase tracking-[0.22em] mb-1" style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}>
                Target (lbs)
              </label>
              <input
                type="number"
                min="50"
                max="600"
                step="0.5"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={String(Math.round(currentWeight))}
                className="w-full text-[13px] tabular-nums"
                style={{ minHeight: 36, padding: "4px 8px" }}
                required
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-[0.22em] mb-1" style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}>
                Target date
              </label>
              <input
                type="date"
                value={targetDate}
                min={minDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full text-[13px]"
                style={{ minHeight: 36, padding: "4px 8px" }}
                required
              />
            </div>
          </div>
          {err && (
            <p className="text-[11px]" style={{ color: "#dc6868" }}>
              {err}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1"
              style={{
                ...cinzel,
                minHeight: 38,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 800,
                color: "#f5e6c4",
                background: "linear-gradient(180deg, #c89436, #8a5e1a)",
                border: "1px solid #d4a853",
                borderRadius: 4,
              }}
            >
              {busy ? "Saving…" : "Save Goal"}
            </button>
            {weightGoal && (
              <button
                type="button"
                onClick={clearGoal}
                disabled={busy}
                className="px-4"
                style={{
                  ...cinzel,
                  minHeight: 38,
                  fontSize: 10,
                  letterSpacing: "0.20em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "rgba(254,202,202,0.85)",
                  background: "transparent",
                  border: "1px solid rgba(220,104,104,0.45)",
                  borderRadius: 4,
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ── Goal + weight present → show full projection
  const goalDateLabel = formatDate(weightGoal.date);
  const lbDeltaSign = weightGoal.lbs >= currentWeight ? "Gain" : "Lose";
  const dailyDeficit = projection?.calPerDay ?? 0; // positive = deficit needed
  const isLossGoal = weightGoal.lbs < currentWeight;

  return (
    <div
      className="rounded p-4"
      style={{
        background: "rgba(20,14,10,0.70)",
        border: "1px solid rgba(212,168,83,0.45)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[10px] uppercase tracking-[0.28em] font-bold"
          style={{ ...cinzel, color: "#d4a853" }}
        >
          Weight Goal
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setErr(null);
            }}
            className="text-[10px] uppercase tracking-[0.20em] hover:brightness-125"
            style={{ ...cinzel, color: "#a855f7" }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={clearGoal}
            disabled={busy}
            className="text-[10px] uppercase tracking-[0.20em] hover:brightness-125"
            style={{ ...cinzel, color: "rgba(220,104,104,0.85)" }}
          >
            Clear
          </button>
        </div>
      </div>
      {projection && (
        <>
          <div className="space-y-1 text-[12px]" style={{ ...cinzel }}>
            <Row label="Current" value={`${currentWeight.toFixed(1)} lbs`} color="#f5e6c4" />
            <Row
              label="Target"
              value={`${weightGoal.lbs.toFixed(1)} lbs by ${goalDateLabel}`}
              color="#d4a853"
            />
            <Row
              label="Remaining"
              value={`${lbDeltaSign} ${Math.abs(projection.lbsToLose).toFixed(1)} lb in ${projection.daysRemaining} day${projection.daysRemaining === 1 ? "" : "s"}`}
              color={isLossGoal ? "#8fc99a" : "#e6c266"}
            />
          </div>

          <div
            className="mt-3 pt-3"
            style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-1"
              style={{ ...cinzel, color: "#d4a853" }}
            >
              Required Daily {isLossGoal ? "Deficit" : "Surplus"}
            </div>
            <div
              className="font-bold tabular-nums"
              style={{
                ...cinzel,
                fontSize: 22,
                color: isLossGoal ? "#8fc99a" : "#e6c266",
              }}
            >
              {Math.round(Math.abs(dailyDeficit)).toLocaleString()} cal/day
            </div>

            <div
              className="text-[9px] uppercase tracking-[0.22em] font-bold mt-3 mb-2"
              style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}
            >
              How to Get There
            </div>
            <Options
              dailyDeficit={dailyDeficit}
              calorieBenchmark={calorieBenchmark}
              isLossGoal={isLossGoal}
            />
          </div>

          {/* Timeline section */}
          <div
            className="mt-3 pt-3 space-y-1.5"
            style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.22em] font-bold"
              style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}
            >
              Timeline
            </div>
            <p
              className="text-[11px]"
              style={{ ...cinzel, color: "rgba(232,213,163,0.85)" }}
            >
              At this pace you'll reach{" "}
              <span style={{ color: "#d4a853", fontWeight: 700 }}>
                {weightGoal.lbs.toFixed(1)} lbs
              </span>{" "}
              by{" "}
              <span style={{ color: "#d4a853", fontWeight: 700 }}>
                {formatDate(weightGoal.date)}
              </span>
              .
            </p>
            {paceETA &&
              (paceETA.status === "wrong-way" ? (
                <p
                  className="text-[11px]"
                  style={{ ...cinzel, color: "#dc6868" }}
                >
                  ✗ At your current 14-day pace ({fmtSigned(avgDaily)}{" "}
                  cal/day) you're trending the wrong way — you need to{" "}
                  {isLossGoal ? "create a deficit" : "create a surplus"}{" "}
                  to reach your target.
                </p>
              ) : paceETA.status === "on-track" ? (
                <p
                  className="text-[11px]"
                  style={{ ...cinzel, color: "#8fc99a" }}
                >
                  ✓ At your current 14-day pace you'll reach{" "}
                  {weightGoal.lbs.toFixed(1)} lbs by{" "}
                  {formatDate(paceETA.etaISO!)}
                  {paceETA.daysLate! < 0
                    ? ` (${Math.abs(paceETA.daysLate!)} day${
                        Math.abs(paceETA.daysLate!) === 1 ? "" : "s"
                      } early)`
                    : ""}
                  .
                </p>
              ) : paceETA.status === "behind" ? (
                <p
                  className="text-[11px]"
                  style={{ ...cinzel, color: "#e6b366" }}
                >
                  ⚠ Slightly behind — at your current pace you'll reach{" "}
                  {weightGoal.lbs.toFixed(1)} lbs by{" "}
                  {formatDate(paceETA.etaISO!)} ({paceETA.daysLate} day
                  {paceETA.daysLate === 1 ? "" : "s"} late).
                </p>
              ) : (
                <p
                  className="text-[11px]"
                  style={{ ...cinzel, color: "#dc6868" }}
                >
                  ✗ Off track — at your current pace you won't reach{" "}
                  {weightGoal.lbs.toFixed(1)} lbs until{" "}
                  {formatDate(paceETA.etaISO!)} ({paceETA.daysLate} days
                  late).
                </p>
              ))}
          </div>

          {err && (
            <p className="text-[11px] mt-2" style={{ color: "#dc6868" }}>
              {err}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Options({
  dailyDeficit,
  calorieBenchmark,
  isLossGoal,
}: {
  dailyDeficit: number;
  calorieBenchmark: number;
  isLossGoal: boolean;
}) {
  const mag = Math.abs(dailyDeficit);

  if (!isLossGoal) {
    // Weight gain — only food makes sense
    const eat = Math.round(calorieBenchmark + mag);
    return (
      <div className="space-y-3">
        <OptionRow
          label="Option 1 — Diet Only"
          line1={`Eat ${eat.toLocaleString()} cal/day · zero extra steps needed`}
          bars={[
            { value: eat, max: Math.max(eat, calorieBenchmark * 1.5), kind: "cal" },
          ]}
        />
      </div>
    );
  }

  // Weight loss — three paths
  const opt1Eat = Math.max(0, Math.round(calorieBenchmark - mag));
  const opt2Steps = Math.round((mag / 500) * STEPS_PER_500CAL);
  const halfFood = mag / 2;
  const halfSteps = Math.round((halfFood / 500) * STEPS_PER_500CAL);
  const opt3Eat = Math.max(0, Math.round(calorieBenchmark - halfFood));

  // Step scale: cap visualization at 30k (the warning threshold) for sensible bar lengths.
  const stepMax = 30_000;

  return (
    <div className="space-y-3">
      <OptionRow
        label="Option 1 — Diet Only"
        line1={`Eat ${opt1Eat.toLocaleString()} cal/day · zero extra steps needed`}
        bars={[{ value: opt1Eat, max: calorieBenchmark, kind: "cal" }]}
        warning={
          opt1Eat < 1000
            ? "⚠ This is very low. Consider a longer timeline or adding steps."
            : undefined
        }
      />
      <OptionRow
        label="Option 2 — Exercise Only"
        line1={`Eat normally at ${calorieBenchmark.toLocaleString()} cal · walk ${opt2Steps.toLocaleString()} steps/day`}
        bars={[{ value: Math.min(opt2Steps, stepMax), max: stepMax, kind: "steps" }]}
        warning={
          opt2Steps > 30_000
            ? "⚠ This requires a lot of walking. Consider adjusting your diet too."
            : undefined
        }
      />
      <OptionRow
        label="Option 3 — Balanced"
        recommended
        line1={`Eat ${opt3Eat.toLocaleString()} cal/day + walk ${halfSteps.toLocaleString()} steps/day`}
        bars={[
          { value: opt3Eat, max: calorieBenchmark, kind: "cal" },
          { value: halfSteps, max: stepMax, kind: "steps" },
        ]}
      />
    </div>
  );
}

function OptionRow({
  label,
  line1,
  bars,
  warning,
  recommended,
}: {
  label: string;
  line1: string;
  bars: Array<{ value: number; max: number; kind: "cal" | "steps" }>;
  warning?: string;
  recommended?: boolean;
}) {
  return (
    <div
      className="rounded p-3"
      style={{
        background: recommended ? "rgba(60,40,20,0.55)" : "rgba(20,14,10,0.45)",
        border: recommended
          ? "1px solid rgba(212,168,83,0.65)"
          : "1px solid rgba(212,168,83,0.20)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div
          className="text-[10px] uppercase tracking-[0.22em] font-bold"
          style={{ ...cinzel, color: "#d4a853" }}
        >
          {label}
        </div>
        {recommended && (
          <span
            className="text-[8px] uppercase tracking-[0.20em] font-bold px-1.5 py-0.5 rounded"
            style={{
              ...cinzel,
              color: "#1a0f00",
              background: "linear-gradient(180deg, #e6c66a, #d4a853)",
              border: "1px solid #d4a853",
            }}
          >
            Recommended
          </span>
        )}
      </div>
      <p className="text-[11px]" style={{ ...cinzel, color: "rgba(232,213,163,0.90)" }}>
        {line1}
      </p>
      <div className={`mt-2 ${bars.length > 1 ? "space-y-1" : ""}`}>
        {bars.map((b, i) => (
          <ProgressBar key={i} value={b.value} max={b.max} kind={b.kind} />
        ))}
      </div>
      {warning && (
        <p
          className="text-[10px] italic mt-2"
          style={{ ...cinzel, color: "#e6b366" }}
        >
          {warning}
        </p>
      )}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  kind,
}: {
  value: number;
  max: number;
  kind: "cal" | "steps";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const trackColor = "rgba(212,168,83,0.18)";
  const fill =
    kind === "cal"
      ? "linear-gradient(90deg, #c89436, #e6c66a)"
      : "linear-gradient(90deg, #a855f7, #c084fc)";
  const suffix = kind === "cal" ? "cal" : "steps";
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: trackColor }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <span
        className="text-[9px] tabular-nums"
        style={{ ...cinzel, color: "rgba(216,210,194,0.65)", minWidth: 70, textAlign: "right" }}
      >
        {Math.round(value).toLocaleString()} {suffix}
      </span>
    </div>
  );
}

// ─── Log Weight modal ───────────────────────────────────────────
function LogWeightModal({
  latestWeight,
  todayISO,
  onClose,
  onSave,
}: {
  latestWeight: number | null;
  todayISO: string;
  onClose: () => void;
  onSave: (date: string, weight: number, notes: string) => Promise<void>;
}) {
  const [date, setDate] = useState(todayISO);
  const [weight, setWeight] = useState(
    latestWeight ? String(latestWeight) : ""
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      setErr("Enter a valid weight in lbs.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(date, w, notes);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)" }}
      />
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="tablet relative rounded p-6 w-full max-w-sm"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ ...cinzel, color: "#d4a853" }}>
            Record Your Weight
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-2xl w-8 h-8 flex items-center justify-center text-muted hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.20em] text-muted mb-1" style={cinzel}>
              Weight (lbs)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              autoFocus
              required
              className="w-full text-2xl text-center tabular-nums"
              style={{ minHeight: 56, fontFamily: "var(--font-cinzel), Georgia, serif" }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.20em] text-muted mb-1" style={cinzel}>
              Date
            </label>
            <input
              type="date"
              value={date}
              max={todayISO}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
              style={{ minHeight: 36 }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.20em] text-muted mb-1" style={cinzel}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. morning, post-fast"
              className="w-full"
            />
          </div>
          {err && (
            <p className="text-[11px]" style={{ color: "#dc6868" }}>
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-stone w-full"
            style={{
              ...cinzel,
              background: "linear-gradient(180deg, #c89436, #8a5e1a)",
              borderColor: "#d4a853",
              color: "#f5e6c4",
            }}
          >
            {busy ? "Saving…" : "Record Weight"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Shared Wooden Frame wrapper ────────────────────────────────
function WoodenFrame({
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
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(60,80,70,0.16), rgba(0,0,0,0) 60%), linear-gradient(180deg, #15110a 0%, #0a0805 100%)",
        border: "4px solid #5a3a1f",
        boxShadow:
          "inset 0 0 0 1px #2d1d0f, inset 0 0 24px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.55)",
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
          textShadow: "0 0 8px rgba(212,168,83,0.30), 0 1px 0 rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
