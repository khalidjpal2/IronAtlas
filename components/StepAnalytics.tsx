"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartPalette, tooltipStyle } from "@/lib/chartTheme";
import { todayPT } from "@/lib/time";
import { formatDate } from "@/lib/utils";

const cinzel = { fontFamily: "var(--font-cinzel), Georgia, serif" };

export type StepsRow = { date: string; steps: number; goal: number };

type Props = {
  allTimeRows: StepsRow[]; // full history
  baseGoal: number;
  personalGoal: number;
};

// ── Main export ──────────────────────────────────────────────────
export default function StepAnalytics({
  allTimeRows,
  baseGoal,
  personalGoal,
}: Props) {
  return (
    <section className="space-y-6">
      <h2
        className="text-center font-bold"
        style={{
          ...cinzel,
          fontSize: 18,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "#d4a853",
          textShadow: "0 0 12px rgba(212,168,83,0.35), 0 1px 0 rgba(0,0,0,0.7)",
        }}
      >
        ✦ Step Analytics ✦
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WeeklyRhythm allTimeRows={allTimeRows} baseGoal={baseGoal} />
        <MomentumMeter allTimeRows={allTimeRows} />
      </div>
      <RecordsVault
        allTimeRows={allTimeRows}
        baseGoal={baseGoal}
        personalGoal={personalGoal}
      />
    </section>
  );
}

// ─── Shared wooden card wrapper ─────────────────────────────────
function GadgetCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative rounded-md p-5"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(60,40,80,0.18), rgba(0,0,0,0) 60%), linear-gradient(180deg, #15110a 0%, #0a0805 100%)",
        border: "4px solid #5a3a1f",
        boxShadow:
          "inset 0 0 0 1px #2d1d0f, inset 0 0 24px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.55)",
        borderRadius: 6,
      }}
    >
      <h3
        className="font-bold"
        style={{
          ...cinzel,
          fontSize: 14,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#d4a853",
          textShadow: "0 0 8px rgba(212,168,83,0.30), 0 1px 0 rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className="text-[10px] italic mb-3"
          style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
        >
          {subtitle}
        </p>
      )}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//   GADGET 2 — THE WEEKLY RHYTHM
// ═══════════════════════════════════════════════════════════════
type RhythmRange = "4w" | "3m" | "all";
// Display order — Monday first, matches how most people read a week.
// Each entry maps to JS's getDay() index (0=Sun .. 6=Sat).
const RHYTHM_DAYS: Array<{ initial: string; short: string; long: string; dow: number }> = [
  { initial: "M", short: "Mon", long: "Monday", dow: 1 },
  { initial: "T", short: "Tue", long: "Tuesday", dow: 2 },
  { initial: "W", short: "Wed", long: "Wednesday", dow: 3 },
  { initial: "T", short: "Thu", long: "Thursday", dow: 4 },
  { initial: "F", short: "Fri", long: "Friday", dow: 5 },
  { initial: "S", short: "Sat", long: "Saturday", dow: 6 },
  { initial: "S", short: "Sun", long: "Sunday", dow: 0 },
];

function WeeklyRhythm({
  allTimeRows,
  baseGoal,
}: {
  allTimeRows: StepsRow[];
  baseGoal: number;
}) {
  const [range, setRange] = useState<RhythmRange>("3m");

  const data = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => ({ total: 0, count: 0, hit: 0 }));
    if (allTimeRows.length === 0) {
      return RHYTHM_DAYS.map((d) => ({ ...d, avg: 0, days: 0, hitRate: 0 }));
    }
    const todayISO = todayPT();
    const today = new Date(todayISO + "T00:00:00");
    const days = range === "4w" ? 28 : range === "3m" ? 90 : 99999;
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - days);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    allTimeRows
      .filter((r) => r.date >= cutoffISO && r.steps > 0)
      .forEach((r) => {
        const dow = new Date(r.date + "T00:00:00").getDay();
        buckets[dow].total += r.steps;
        buckets[dow].count += 1;
        if (r.steps >= baseGoal) buckets[dow].hit += 1;
      });
    return RHYTHM_DAYS.map((d) => {
      const b = buckets[d.dow];
      return {
        ...d,
        avg: b.count > 0 ? Math.round(b.total / b.count) : 0,
        days: b.count,
        hitRate: b.count > 0 ? (b.hit / b.count) * 100 : 0,
      };
    });
  }, [allTimeRows, baseGoal, range]);

  const insights = useMemo(() => {
    const tracked = data.filter((d) => d.days > 0);
    if (tracked.length === 0) return null;
    const sorted = [...tracked].sort((a, b) => b.avg - a.avg);
    const goalHitDays = tracked.filter((d) => d.hitRate >= 50).map((d) => d.short);
    return {
      peak: sorted[0],
      low: sorted[sorted.length - 1],
      goalHitDays,
    };
  }, [data]);

  // Scale for both bar fill % and goal-marker position.
  const maxAvg = Math.max(...data.map((d) => d.avg), 0);
  const scale = Math.max(baseGoal * 1.25, maxAvg * 1.08, 5000);
  const goalPct = (baseGoal / scale) * 100;
  const hasData = data.some((d) => d.avg > 0);

  return (
    <GadgetCard title="The Weekly Rhythm">
      {/* Toggle — right aligned, soft */}
      <div className="flex justify-end gap-0 mb-2">
        {(["4w", "3m", "all"] as RhythmRange[]).map((r) => {
          const active = r === range;
          const label = r === "4w" ? "4 wk" : r === "3m" ? "3 mo" : "All";
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="px-2 py-0.5 transition"
              style={{
                ...cinzel,
                fontSize: 8,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#d4a853" : "rgba(216,210,194,0.40)",
                background: "transparent",
                borderBottom: `1px solid ${active ? "#d4a853" : "transparent"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!hasData ? (
        <div
          className="h-32 flex items-center justify-center italic text-[11px]"
          style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
        >
          No step data in this range.
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map((d) => {
            const pct = (d.avg / scale) * 100;
            const hitGoal = d.avg >= baseGoal;
            const barColor = hitGoal ? "#a855f7" : "#4c1d95";
            return (
              <div
                key={d.short}
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: "32px 1fr 56px" }}
                title={`${d.long} · ${d.avg.toLocaleString()} avg over ${d.days} day${
                  d.days === 1 ? "" : "s"
                }`}
              >
                <span
                  className="uppercase"
                  style={{
                    ...cinzel,
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    color: "rgba(216,210,194,0.65)",
                    fontWeight: 700,
                  }}
                >
                  {d.short}
                </span>
                <div className="relative h-2 rounded-full" style={{ background: "rgba(76,29,149,0.10)" }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{
                      width: d.avg > 0 ? `${Math.min(100, pct)}%` : 0,
                      background: barColor,
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute top-[-2px] bottom-[-2px]"
                    style={{
                      left: `${goalPct}%`,
                      width: 1,
                      borderLeft: "1px dashed rgba(212,168,83,0.65)",
                    }}
                  />
                </div>
                <span
                  className="tabular-nums text-right"
                  style={{
                    ...cinzel,
                    fontSize: 10,
                    color: hitGoal ? "#d4a853" : "rgba(216,210,194,0.50)",
                  }}
                >
                  {d.avg > 0 ? d.avg.toLocaleString() : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Two-line insights */}
      {insights && (
        <div
          className="text-[10px] mt-3 pt-2 space-y-0.5"
          style={{
            ...cinzel,
            borderTop: "1px dashed rgba(212,168,83,0.18)",
          }}
        >
          <div style={{ color: "rgba(232,213,163,0.75)" }}>
            Best:{" "}
            <span style={{ color: "#c084fc", fontWeight: 700 }}>
              {insights.peak.long}
            </span>{" "}
            <span className="tabular-nums" style={{ color: "rgba(216,210,194,0.55)" }}>
              · {insights.peak.avg.toLocaleString()} avg
            </span>
          </div>
          <div style={{ color: "rgba(232,213,163,0.65)" }}>
            Weakest:{" "}
            <span style={{ color: "rgba(216,210,194,0.85)", fontWeight: 700 }}>
              {insights.low.long}
            </span>{" "}
            <span className="tabular-nums" style={{ color: "rgba(216,210,194,0.45)" }}>
              · {insights.low.avg.toLocaleString()} avg
            </span>
          </div>
        </div>
      )}
    </GadgetCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//   GADGET 3 — THE MOMENTUM METER
// ═══════════════════════════════════════════════════════════════
function MomentumMeter({ allTimeRows }: { allTimeRows: StepsRow[] }) {
  const chart = useChartPalette();

  const { last7Avg, prev7Avg, changePct } = useMemo(() => {
    if (allTimeRows.length === 0) {
      return { last7Avg: 0, prev7Avg: 0, changePct: 0 };
    }
    const todayISO = todayPT();
    const today = new Date(todayISO + "T00:00:00");
    const map = new Map<string, number>();
    allTimeRows.forEach((r) => map.set(r.date, r.steps));
    const window = (from: number, to: number) => {
      let total = 0;
      let count = 0;
      for (let i = from; i < to; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const s = map.get(iso) ?? 0;
        if (s > 0) {
          total += s;
          count += 1;
        }
      }
      return count > 0 ? total / count : 0;
    };
    const last7Avg = window(0, 7);
    const prev7Avg = window(7, 14);
    const changePct = prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : 0;
    return { last7Avg, prev7Avg, changePct };
  }, [allTimeRows]);

  const rolling8w = useMemo(() => {
    if (allTimeRows.length === 0) return [];
    const todayISO = todayPT();
    const today = new Date(todayISO + "T00:00:00");
    const map = new Map<string, number>();
    allTimeRows.forEach((r) => map.set(r.date, r.steps));
    const out: Array<{ label: string; avg: number }> = [];
    for (let w = 7; w >= 0; w--) {
      let total = 0;
      let count = 0;
      const start = new Date(today);
      start.setDate(today.getDate() - (w + 1) * 7 + 1);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const iso = d.toISOString().slice(0, 10);
        const s = map.get(iso) ?? 0;
        if (s > 0) {
          total += s;
          count += 1;
        }
      }
      out.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        avg: count > 0 ? Math.round(total / count) : 0,
      });
    }
    return out;
  }, [allTimeRows]);

  // Map change% to needle angle. Clamp to [-50%, +50%] → [-90°, +90°].
  const clampedPct = Math.max(-50, Math.min(50, changePct));
  const needleAngle = (clampedPct / 50) * 90;
  const status =
    Math.abs(changePct) < 5
      ? { label: "Stable", color: "#e6b366", arrow: "→" }
      : changePct >= 5
      ? { label: "Improving", color: "#8fc99a", arrow: "↑" }
      : { label: "Declining", color: "#dc6868", arrow: "↓" };

  return (
    <GadgetCard title="The Momentum Meter" subtitle="The wind at your back.">
      {/* Gauge */}
      <div className="flex justify-center">
        <svg viewBox="0 0 220 130" width="100%" height="140" aria-hidden style={{ maxWidth: 280 }}>
          <defs>
            <linearGradient id="gauge-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc6868" />
              <stop offset="40%" stopColor="#dc6868" />
              <stop offset="48%" stopColor="#e6b366" />
              <stop offset="52%" stopColor="#e6b366" />
              <stop offset="60%" stopColor="#8fc99a" />
              <stop offset="100%" stopColor="#8fc99a" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            stroke="#2d1d0f"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          {/* Color arc */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            stroke="url(#gauge-arc)"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Tick marks at ±5% boundaries */}
          {[-90, -9, 9, 90].map((deg, i) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = 110 + 78 * Math.cos(rad);
            const y1 = 110 + 78 * Math.sin(rad);
            const x2 = 110 + 96 * Math.cos(rad);
            const y2 = 110 + 96 * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#d4a853"
                strokeWidth="1.5"
                opacity="0.6"
              />
            );
          })}
          {/* Labels */}
          <text x="22" y="125" fontSize="8" fill="#dc6868" style={{ ...cinzel, letterSpacing: "0.16em" }}>
            DECLINE
          </text>
          <text x="110" y="40" fontSize="8" fill="#e6b366" textAnchor="middle" style={{ ...cinzel, letterSpacing: "0.16em" }}>
            STABLE
          </text>
          <text x="198" y="125" fontSize="8" fill="#8fc99a" textAnchor="end" style={{ ...cinzel, letterSpacing: "0.16em" }}>
            IMPROVE
          </text>
          {/* Needle */}
          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: "110px 110px",
              transition: "transform 1200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <line
              x1="110"
              y1="110"
              x2="110"
              y2="34"
              stroke="#f5e6c4"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="110" cy="110" r="6" fill="#d4a853" stroke="#5a3a1f" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* Numbers */}
      <div className="text-center mt-2 space-y-0.5">
        <div className="text-[11px]" style={{ ...cinzel, color: "rgba(232,213,163,0.75)" }}>
          Last 7 days avg:{" "}
          <span className="tabular-nums" style={{ color: "#d4a853", fontWeight: 700 }}>
            {Math.round(last7Avg).toLocaleString()}
          </span>
        </div>
        <div className="text-[11px]" style={{ ...cinzel, color: "rgba(232,213,163,0.55)" }}>
          Previous 7 days:{" "}
          <span className="tabular-nums" style={{ color: "rgba(216,210,194,0.85)" }}>
            {Math.round(prev7Avg).toLocaleString()}
          </span>
        </div>
        <div
          className="mt-2 text-[13px] font-bold uppercase tracking-[0.20em]"
          style={{
            ...cinzel,
            color: status.color,
            textShadow: `0 0 10px ${status.color}55`,
          }}
        >
          {status.arrow} {prev7Avg > 0 ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%` : "—"} {status.label}
        </div>
      </div>

      {/* 8-week rolling mini-chart */}
      {rolling8w.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}>
          <div
            className="text-[9px] uppercase tracking-[0.22em] font-bold mb-1"
            style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}
          >
            8-week rolling average
          </div>
          <div className="h-24">
            <ResponsiveContainer>
              <LineChart data={rolling8w} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#d8d0bb" fontSize={8} tickLine={false} axisLine={false} />
                <YAxis stroke="#d8d0bb" fontSize={8} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle(chart)}
                  formatter={(v: any) => [`${Number(v).toLocaleString()} avg`, "Steps"]}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a855f7" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </GadgetCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//   GADGET 4 — THE PERSONAL RECORDS VAULT
// ═══════════════════════════════════════════════════════════════
const MILESTONES = [
  { steps: 10_000, name: "First Steps" },
  { steps: 100_000, name: "Road Walker" },
  { steps: 500_000, name: "Trail Blazer" },
  { steps: 1_000_000, name: "Iron Marcher" },
  { steps: 5_000_000, name: "Legend of the Path" },
] as const;

function RecordsVault({
  allTimeRows,
  baseGoal,
  personalGoal,
}: {
  allTimeRows: StepsRow[];
  baseGoal: number;
  personalGoal: number;
}) {
  const stats = useMemo(() => {
    if (allTimeRows.length === 0) {
      return {
        bestDay: null as null | { date: string; steps: number },
        bestWeek: null as null | { startDate: string; total: number },
        bestMonth: null as null | { label: string; total: number },
        longestStreak: { len: 0, start: "", end: "" },
        longestGoalStreak: { len: 0, start: "", end: "" },
        totalSteps: 0,
        pctOverBase: 0,
        pctOverPersonal: 0,
        pattern: "—" as string,
      };
    }
    const sorted = [...allTimeRows].sort((a, b) => a.date.localeCompare(b.date));
    let bestDay: { date: string; steps: number } | null = null;
    const monthly = new Map<string, number>();
    let total = 0;
    let dayCount = 0;
    let overBase = 0;
    let overPersonal = 0;
    const weekdayBuckets = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    for (const r of sorted) {
      if (r.steps > 0) {
        if (!bestDay || r.steps > bestDay.steps) bestDay = { date: r.date, steps: r.steps };
        total += r.steps;
        dayCount += 1;
        if (r.steps >= baseGoal) overBase += 1;
        if (r.steps >= personalGoal) overPersonal += 1;
        const ym = r.date.slice(0, 7);
        monthly.set(ym, (monthly.get(ym) ?? 0) + r.steps);
        const dow = new Date(r.date + "T00:00:00").getDay();
        weekdayBuckets[dow].total += r.steps;
        weekdayBuckets[dow].count += 1;
      }
    }

    // Best 7-day rolling window
    let bestWeek: { startDate: string; total: number } | null = null;
    if (sorted.length >= 1) {
      const stepsBy = new Map(sorted.map((r) => [r.date, r.steps]));
      const dates = sorted.map((r) => r.date);
      const first = new Date(dates[0] + "T00:00:00");
      const last = new Date(dates[dates.length - 1] + "T00:00:00");
      for (let d = new Date(first); d.getTime() <= last.getTime() - 6 * 86_400_000; d.setDate(d.getDate() + 1)) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          const c = new Date(d);
          c.setDate(d.getDate() + i);
          sum += stepsBy.get(c.toISOString().slice(0, 10)) ?? 0;
        }
        if (!bestWeek || sum > bestWeek.total) {
          bestWeek = { startDate: d.toISOString().slice(0, 10), total: sum };
        }
      }
    }

    // Best month
    let bestMonth: { label: string; total: number } | null = null;
    monthly.forEach((sum, ym) => {
      if (!bestMonth || sum > bestMonth.total) {
        const d = new Date(ym + "-01T00:00:00");
        const label = d.toLocaleString("default", { month: "long", year: "numeric" });
        bestMonth = { label, total: sum };
      }
    });

    // Longest streak (any logged day, contiguous)
    const longestStreak = computeLongestStreak(sorted, (s) => s > 0);
    const longestGoalStreak = computeLongestStreak(sorted, (s) => s >= baseGoal);

    // Distribution
    const pctOverBase = dayCount > 0 ? (overBase / dayCount) * 100 : 0;
    const pctOverPersonal = dayCount > 0 ? (overPersonal / dayCount) * 100 : 0;

    // Pattern detection: weekend warrior vs consistent vs variable
    const weekday = [1, 2, 3, 4, 5]
      .map((i) => (weekdayBuckets[i].count > 0 ? weekdayBuckets[i].total / weekdayBuckets[i].count : 0))
      .filter((v) => v > 0);
    const weekend = [0, 6]
      .map((i) => (weekdayBuckets[i].count > 0 ? weekdayBuckets[i].total / weekdayBuckets[i].count : 0))
      .filter((v) => v > 0);
    const avgWeekday = weekday.length > 0 ? weekday.reduce((a, b) => a + b, 0) / weekday.length : 0;
    const avgWeekend = weekend.length > 0 ? weekend.reduce((a, b) => a + b, 0) / weekend.length : 0;
    let pattern: string;
    if (avgWeekday === 0 || avgWeekend === 0) {
      pattern = "—";
    } else if (avgWeekend > avgWeekday * 1.25) {
      pattern = "Weekend Warrior";
    } else if (avgWeekday > avgWeekend * 1.25) {
      pattern = "Weekday Grinder";
    } else {
      // Variance check
      const all = sorted.filter((r) => r.steps > 0).map((r) => r.steps);
      const mean = all.reduce((a, b) => a + b, 0) / all.length;
      const variance = all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length;
      const stddev = Math.sqrt(variance);
      const cv = mean > 0 ? stddev / mean : 0;
      pattern = cv < 0.35 ? "Consistent" : "Variable";
    }

    return {
      bestDay,
      bestWeek,
      bestMonth,
      longestStreak,
      longestGoalStreak,
      totalSteps: total,
      pctOverBase,
      pctOverPersonal,
      pattern,
    };
  }, [allTimeRows, baseGoal, personalGoal]);

  const currentTier = MILESTONES.findLast?.((m) => stats.totalSteps >= m.steps);
  const nextTier = MILESTONES.find((m) => stats.totalSteps < m.steps);

  return (
    <GadgetCard title="Records Vault" subtitle="Trophies from the road.">
      {/* Records */}
      <div className="space-y-1.5 text-[11px]" style={{ ...cinzel }}>
        <RecordRow
          label="Best single day"
          value={
            stats.bestDay
              ? `${stats.bestDay.steps.toLocaleString()} steps · ${formatDate(stats.bestDay.date)}`
              : "—"
          }
        />
        <RecordRow
          label="Best week total"
          value={
            stats.bestWeek
              ? `${stats.bestWeek.total.toLocaleString()} steps · Week of ${formatDate(stats.bestWeek.startDate)}`
              : "—"
          }
        />
        <RecordRow
          label="Best month total"
          value={
            stats.bestMonth
              ? `${stats.bestMonth.total.toLocaleString()} steps · ${stats.bestMonth.label}`
              : "—"
          }
        />
        <RecordRow
          label="Longest streak"
          value={
            stats.longestStreak.len > 0
              ? `${stats.longestStreak.len} days · ${formatDate(stats.longestStreak.start)} – ${formatDate(stats.longestStreak.end)}`
              : "—"
          }
        />
        <RecordRow
          label="Most consecutive goal days"
          value={
            stats.longestGoalStreak.len > 0
              ? `${stats.longestGoalStreak.len} days`
              : "—"
          }
        />
      </div>

      {/* Milestones */}
      <div className="mt-4 pt-3" style={{ borderTop: "1px dashed rgba(212,168,83,0.30)" }}>
        <div
          className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
          style={{ ...cinzel, color: "rgba(232,213,163,0.65)" }}
        >
          Milestones · {stats.totalSteps.toLocaleString()} lifetime steps
        </div>
        <ul className="space-y-1">
          {MILESTONES.map((m) => {
            const unlocked = stats.totalSteps >= m.steps;
            const progress = Math.min(100, (stats.totalSteps / m.steps) * 100);
            return (
              <li
                key={m.steps}
                className="flex items-center gap-2 text-[10px]"
                style={{ ...cinzel }}
              >
                <span
                  className="font-bold w-4 text-center"
                  style={{
                    color: unlocked ? "#d4a853" : "rgba(216,210,194,0.35)",
                    textShadow: unlocked ? "0 0 6px rgba(212,168,83,0.55)" : undefined,
                  }}
                  aria-hidden
                >
                  {unlocked ? "✦" : "○"}
                </span>
                <span
                  className="uppercase tracking-[0.18em]"
                  style={{
                    color: unlocked ? "#c084fc" : "rgba(216,210,194,0.55)",
                    fontWeight: 700,
                    minWidth: 130,
                  }}
                >
                  {m.name}
                </span>
                <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(212,168,83,0.15)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      background: unlocked
                        ? "linear-gradient(90deg, #c89436, #e6c66a)"
                        : "linear-gradient(90deg, #5b21b6, #a855f7)",
                    }}
                  />
                </div>
                <span
                  className="tabular-nums text-[9px]"
                  style={{ color: "rgba(216,210,194,0.65)", minWidth: 60, textAlign: "right" }}
                >
                  {unlocked
                    ? `${(m.steps / 1000).toLocaleString()}k ✓`
                    : `${progress.toFixed(1)}%`}
                </span>
              </li>
            );
          })}
        </ul>
        {nextTier && currentTier && (
          <p
            className="text-[10px] italic mt-2 text-center"
            style={{ ...cinzel, color: "rgba(216,210,194,0.55)" }}
          >
            {(nextTier.steps - stats.totalSteps).toLocaleString()} steps until{" "}
            <span style={{ color: "#c084fc" }}>{nextTier.name}</span>
          </p>
        )}
      </div>

      {/* Distribution */}
      <div className="mt-3 pt-3 text-[11px] space-y-1" style={{
        ...cinzel,
        color: "rgba(232,213,163,0.85)",
        borderTop: "1px dashed rgba(212,168,83,0.30)",
      }}>
        <div>
          <span className="tabular-nums" style={{ color: "#d4a853", fontWeight: 700 }}>
            {stats.pctOverBase.toFixed(1)}%
          </span>{" "}
          of your days exceed {baseGoal.toLocaleString()} steps
        </div>
        <div>
          <span className="tabular-nums" style={{ color: "#d4a853", fontWeight: 700 }}>
            {stats.pctOverPersonal.toFixed(1)}%
          </span>{" "}
          of your days exceed your personal goal ({personalGoal.toLocaleString()})
        </div>
        <div>
          Your step pattern:{" "}
          <span style={{ color: "#c084fc", fontWeight: 700 }}>{stats.pattern}</span>
        </div>
      </div>
    </GadgetCard>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span style={{ color: "rgba(232,213,163,0.65)" }}>{label}</span>
      <span className="tabular-nums text-right" style={{ color: "#d4a853", fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

function computeLongestStreak(
  rows: StepsRow[],
  predicate: (steps: number) => boolean
): { len: number; start: string; end: string } {
  let best = { len: 0, start: "", end: "" };
  let run = 0;
  let runStart = "";
  let runEnd = "";
  let prevDate: Date | null = null;
  for (const r of rows) {
    const cur = new Date(r.date + "T00:00:00");
    if (!predicate(r.steps)) {
      run = 0;
      runStart = "";
      runEnd = "";
      prevDate = cur;
      continue;
    }
    if (prevDate) {
      const gap = Math.round((cur.getTime() - prevDate.getTime()) / 86_400_000);
      if (gap === 1 && run > 0) {
        run += 1;
        runEnd = r.date;
      } else {
        run = 1;
        runStart = r.date;
        runEnd = r.date;
      }
    } else {
      run = 1;
      runStart = r.date;
      runEnd = r.date;
    }
    if (run > best.len) best = { len: run, start: runStart, end: runEnd };
    prevDate = cur;
  }
  return best;
}
