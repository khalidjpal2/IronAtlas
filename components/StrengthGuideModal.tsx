"use client";

import { useEffect, useState } from "react";
import { LEVEL_COLOR, type StrengthLevel } from "@/lib/strength";

type ZoneEntry = {
  zone: string;
  label: string;
  currentLevel: StrengthLevel;
  currentLevelLabel: string;
  currentScore: number;
  bestMuscle: string | null;
  bestSource: {
    exercise: string;
    weight: number;
    reps: number;
    sets: number;
  } | null;
  primaryExercise: string | null;
  breakdown: Array<{
    level: StrengthLevel;
    label: string;
    min: number;
    max: number | null;
    examples: string[];
  }>;
  nextLevel: StrengthLevel | null;
  nextLevelLabel: string | null;
  nextTargetRatio: number | null;
  nextTargetExamples: string[];
};

type GuideData = {
  ageGroup: string;
  sex: string | null;
  bodyweight: number | null;
  effectiveBodyweight: number;
  experience: string;
  zones: ZoneEntry[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const LEVEL_NUM: Record<StrengthLevel, number> = {
  untrained: 0,
  below: 1,
  average: 2,
  above: 3,
  exceptional: 4,
  elite: 5,
};

const LADDER: Array<{ level: StrengthLevel; label: string }> = [
  { level: "untrained", label: "Dormant" },
  { level: "below", label: "Awakened" },
  { level: "average", label: "Trained" },
  { level: "above", label: "Powerful" },
  { level: "exceptional", label: "Mighty" },
  { level: "elite", label: "Legendary" },
];

export default function StrengthGuideModal({ open, onClose }: Props) {
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch("/api/strength-guide", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-6 transition-all duration-200 ${
        open
          ? "bg-black/70 backdrop-blur-sm opacity-100"
          : "bg-transparent opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-panel border border-gold/40 w-full md:max-w-2xl md:rounded-xl flex flex-col overflow-hidden"
        style={{
          maxHeight: "100vh",
          boxShadow:
            "0 0 48px rgba(245, 158, 11, 0.25), 0 24px 64px rgba(0, 0, 0, 0.6)",
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245, 158, 11, 0.08), transparent 60%)",
        }}
      >
        <header className="px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.32em] text-gold/80 mb-1.5"
                style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
              >
                Tome of
              </div>
              <h2
                className="text-2xl font-bold tracking-tight text-gold"
                style={{
                  fontFamily: "var(--font-cinzel), Georgia, serif",
                  textShadow: "0 0 16px rgba(245, 158, 11, 0.40)",
                }}
              >
                Strength
              </h2>
              {data && (
                <div className="text-[11px] text-muted mt-2">
                  Forged for:{" "}
                  <span className="text-ink font-semibold">
                    {data.ageGroup}
                    {data.sex ? ` ${data.sex}` : ""}, {Math.round(data.effectiveBodyweight)} lbs
                  </span>
                  {data.bodyweight == null && (
                    <span className="ml-1 text-muted/60">(default)</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded-md hover:bg-elevated transition shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="rune-divider mt-4 mb-3" />

          {/* Tier legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] uppercase tracking-[0.16em]">
            {LADDER.map((l) => (
              <span key={l.level} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{
                    background: LEVEL_COLOR[l.level],
                    boxShadow: `0 0 4px ${LEVEL_COLOR[l.level]}`,
                  }}
                />
                <span style={{ color: LEVEL_COLOR[l.level] }}>
                  L{LEVEL_NUM[l.level]} · {l.label}
                </span>
              </span>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-2">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-elevated border border-border rounded-md animate-pulse"
                />
              ))}
            </div>
          )}
          {err && (
            <div className="bg-danger/10 border border-danger/40 rounded-md px-3 py-2 text-xs text-danger">
              {err}
            </div>
          )}
          {data?.zones.map((z) => (
            <ZoneRow
              key={z.zone}
              entry={z}
              expanded={expanded === z.zone}
              onToggle={() =>
                setExpanded(expanded === z.zone ? null : z.zone)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: ZoneEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isUntrained = entry.currentLevel === "untrained";
  const currentNum = LEVEL_NUM[entry.currentLevel];

  return (
    <div className="bg-elevated border border-border rounded-md overflow-hidden">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 text-left hover:bg-panel transition"
      >
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
          style={{
            background: LEVEL_COLOR[entry.currentLevel],
            boxShadow: `0 0 6px ${LEVEL_COLOR[entry.currentLevel]}`,
          }}
        />
        <span className="text-sm font-medium truncate text-ink">
          {entry.label}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.18em] whitespace-nowrap font-semibold"
          style={{ color: LEVEL_COLOR[entry.currentLevel] }}
        >
          L{currentNum} · {entry.currentLevelLabel}
        </span>
        <span className="font-mono text-xs text-muted tabular-nums w-12 text-right">
          {isUntrained ? "0.00" : entry.currentScore.toFixed(2)}
        </span>
        <span
          className={`text-gold/70 text-xs transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>

      {/* Expand */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 py-4 space-y-5">
            {/* YOUR LEVEL — big colored badge */}
            <YourLevel entry={entry} />

            {/* LEVEL LADDER */}
            {entry.breakdown.length > 0 && (
              <Section title="Level Ladder">
                <div className="space-y-1.5">
                  {LADDER.map((rung) => {
                    if (rung.level === "untrained") {
                      return (
                        <LadderRow
                          key="untrained"
                          dotColor={LEVEL_COLOR.untrained}
                          number={0}
                          name="Dormant"
                          example="No training recorded"
                          highlight={isUntrained}
                          range={null}
                        />
                      );
                    }
                    const b = entry.breakdown.find((x) => x.level === rung.level);
                    if (!b) return null;
                    const isCurrent = entry.currentLevel === rung.level;
                    return (
                      <LadderRow
                        key={rung.level}
                        dotColor={LEVEL_COLOR[rung.level]}
                        number={LEVEL_NUM[rung.level]}
                        name={rung.label}
                        example={
                          entry.primaryExercise
                            ? `e.g. ${entry.primaryExercise} ${b.examples[0] ?? ""}`
                            : (b.examples[0] ?? "")
                        }
                        highlight={isCurrent}
                        range={
                          b.max != null
                            ? `${b.min.toFixed(2)} – ${b.max.toFixed(2)}`
                            : `${b.min.toFixed(2)}+`
                        }
                      />
                    );
                  })}
                </div>
              </Section>
            )}

            {/* NEXT LEVEL — big card */}
            {entry.nextLevel &&
              entry.nextTargetRatio != null &&
              entry.nextTargetExamples.length > 0 && (
                <NextLevelCard
                  exercise={entry.primaryExercise}
                  nextLevel={entry.nextLevel}
                  nextLabel={entry.nextLevelLabel ?? ""}
                  examples={entry.nextTargetExamples}
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function YourLevel({ entry }: { entry: ZoneEntry }) {
  const num = LEVEL_NUM[entry.currentLevel];
  const color = LEVEL_COLOR[entry.currentLevel];
  return (
    <div
      className="rounded-md border-2 px-4 py-4 flex items-center gap-4"
      style={{
        borderColor: color,
        background: color + "12",
        boxShadow: `0 0 16px ${color}33`,
      }}
    >
      <div
        className="w-14 h-14 rounded-md flex flex-col items-center justify-center text-bg shrink-0"
        style={{
          background: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      >
        <div
          className="text-[9px] uppercase tracking-wider opacity-90 font-bold"
          style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
        >
          Lv
        </div>
        <div className="text-2xl font-bold leading-none">{num}</div>
      </div>
      <div className="min-w-0">
        <div className="text-sm leading-snug text-ink">
          You stand at{" "}
          <span
            className="font-bold uppercase tracking-wide"
            style={{ color }}
          >
            Level {num} — {entry.currentLevelLabel}
          </span>{" "}
          in {entry.label}.
        </div>
        {entry.bestSource && entry.currentLevel !== "untrained" && (
          <div className="text-[11px] text-muted mt-1">
            Best: {entry.bestSource.exercise} · {entry.bestSource.sets}x
            {entry.bestSource.reps} @ {entry.bestSource.weight} lbs · score{" "}
            {entry.currentScore.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

function LadderRow({
  dotColor,
  number,
  name,
  example,
  highlight,
  range,
}: {
  dotColor: string;
  number: number;
  name: string;
  example: string;
  highlight: boolean;
  range: string | null;
}) {
  return (
    <div
      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2 rounded-md border transition ${
        highlight
          ? "border-2"
          : "border-transparent"
      }`}
      style={
        highlight
          ? {
              borderColor: dotColor,
              boxShadow: `0 0 0 1px ${dotColor}30, 0 0 12px ${dotColor}25`,
              background: dotColor + "10",
            }
          : undefined
      }
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: dotColor }}
      />
      <span
        className={`text-[11px] tracking-wide font-medium w-32 ${
          highlight ? "text-ink" : "text-muted"
        }`}
      >
        Level {number} · {name}
        {highlight && (
          <span
            className="ml-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: dotColor }}
          >
            ← YOU
          </span>
        )}
      </span>
      <span
        className={`text-[11px] truncate ${
          highlight ? "text-ink/80" : "text-muted/80"
        }`}
      >
        {example}
      </span>
      {range && (
        <span className="font-mono text-[10px] tabular-nums text-muted/70 whitespace-nowrap">
          {range}
        </span>
      )}
    </div>
  );
}

function NextLevelCard({
  exercise,
  nextLevel,
  nextLabel,
  examples,
}: {
  exercise: string | null;
  nextLevel: StrengthLevel;
  nextLabel: string;
  examples: string[];
}) {
  const num = LEVEL_NUM[nextLevel];
  const color = LEVEL_COLOR[nextLevel];
  return (
    <div
      className="rounded-md border px-4 py-4"
      style={{
        borderColor: color,
        background: color + "10",
        boxShadow: `0 0 12px ${color}33`,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.22em] text-gold mb-2 font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
      >
        Quest Objective
      </div>
      <div className="text-sm font-medium mb-3 text-ink">
        <span>
          Reach{" "}
          <span
            className="font-bold uppercase tracking-wide"
            style={{ color }}
          >
            Level {num} — {nextLabel}
          </span>
          :
        </span>
      </div>
      {exercise && (
        <div className="text-[11px] text-muted mb-2">
          Technique: <span className="text-ink">{exercise}</span>
        </div>
      )}
      <ul className="space-y-1">
        {examples.slice(0, 3).map((ex, i) => (
          <li
            key={i}
            className="text-[12px] font-mono text-ink flex items-baseline gap-2"
          >
            <span className="text-muted/60 text-[10px] w-6 shrink-0">
              {i === 0 ? "" : "OR"}
            </span>
            <span>{ex}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.22em] text-gold mb-2 font-bold"
        style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
