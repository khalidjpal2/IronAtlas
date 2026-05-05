"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  LEVEL_ORDER,
  LEVEL_RANK,
  REFERENCE_BW,
  ZONE_LABEL,
  ZONE_MUSCLES,
  exercisesForMuscle,
  standardThresholdRatios,
  weightForTargetRatio,
  type Sex,
  type StandardRow,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";
import { formatDate } from "@/lib/utils";

type BestEntry = {
  exercise: string;
  weight: number;
  reps?: number;
  sets?: number;
  date?: string;
  score?: number;
} | null;

type EnrichedSet = {
  exercise: string;
  zone: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
  score: number;
  level: StrengthLevel;
};

type Props = {
  zone: Zone | null;
  zoneLevel: StrengthLevel;
  ageGroup: string;
  sex: Sex | null;
  bodyweight: number | null;
  standards: StandardRow[];
  muscleLevels: Record<string, StrengthLevel>;
  muscleBest: Record<string, BestEntry>;
  enrichedSets: EnrichedSet[];
  onClose: () => void;
  onLogWorkout: (zone: Zone) => void;
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

export default function MuscleDetailPanel({
  zone,
  zoneLevel,
  ageGroup,
  sex,
  bodyweight,
  standards,
  muscleLevels,
  muscleBest,
  enrichedSets,
  onClose,
  onLogWorkout,
}: Props) {
  const open = zone !== null;
  const [displayZone, setDisplayZone] = useState<Zone | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (zone) {
      setDisplayZone(zone);
      setExpanded(new Set()); // collapse all when switching zones
      return;
    }
    const t = setTimeout(() => setDisplayZone(null), 280);
    return () => clearTimeout(t);
  }, [zone]);

  function toggleMuscle(name: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const effectiveBW =
    bodyweight && bodyweight > 0
      ? bodyweight
      : REFERENCE_BW[(sex ?? "male") as Sex] ?? REFERENCE_BW.male;

  const stdMap = useMemo(
    () => new Map(standards.map((s) => [s.exercise_name, s])),
    [standards]
  );

  // Last-trained-date per muscle. Looks at every logged set whose
  // exercise touches this muscle (primary OR secondary OR tertiary)
  // and picks the most recent.
  const lastTrainedByMuscle = useMemo(() => {
    const out: Record<string, string | null> = {};
    if (!displayZone) return out;
    for (const m of ZONE_MUSCLES[displayZone]) {
      const touching = new Set(
        exercisesForMuscle(m).map((e) => e.exercise)
      );
      let latest: string | null = null;
      for (const s of enrichedSets) {
        if (!touching.has(s.exercise)) continue;
        if (!latest || s.date > latest) latest = s.date;
      }
      out[m] = latest;
    }
    return out;
  }, [displayZone, enrichedSets]);

  // Recent 5 sets in this zone, newest first.
  const recentSets = useMemo(() => {
    if (!displayZone) return [];
    return enrichedSets
      .filter((s) => s.zone === displayZone)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5);
  }, [enrichedSets, displayZone]);

  const muscles = displayZone ? ZONE_MUSCLES[displayZone] : [];
  const allMaxed =
    muscles.length > 0 &&
    muscles.every((m) => (muscleLevels[m] ?? "untrained") === "elite");
  const nextZoneLevel: StrengthLevel | null = (() => {
    const i = LEVEL_ORDER.indexOf(zoneLevel);
    if (i < 0 || i >= LEVEL_ORDER.length - 1) return null;
    return LEVEL_ORDER[i + 1];
  })();

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/75 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
        style={{ backdropFilter: open ? "blur(3px)" : undefined }}
      />

      <aside
        role="dialog"
        aria-label={displayZone ? `${ZONE_LABEL[displayZone]} detail` : undefined}
        className={`
          fixed z-50 flex flex-col overflow-hidden
          left-0 right-0 bottom-0 max-h-[92vh] rounded-t-xl border-t
          lg:left-1/2 lg:top-1/2 lg:bottom-auto lg:right-auto
          lg:w-[min(75vw,1024px)] lg:h-[85vh] lg:max-h-[85vh] lg:rounded-xl
          lg:border lg:-translate-x-1/2 lg:-translate-y-1/2
          transition-all duration-300 ease-out
          ${
            open
              ? "translate-y-0 lg:opacity-100 lg:scale-100 pointer-events-auto"
              : "translate-y-full lg:translate-y-[-50%] lg:opacity-0 lg:scale-95 pointer-events-none"
          }
        `}
        style={{
          background: "var(--noise-bg), #0a0a14",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 96px rgba(0,0,0,0.75)",
          borderColor: LEVEL_COLOR[zoneLevel],
        }}
      >
        <div className="lg:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-12 h-1 bg-border-bright rounded-full" />
        </div>

        {/* Header */}
        <header
          className="px-6 lg:px-8 py-5 border-b shrink-0 flex items-start justify-between gap-4"
          style={{ borderColor: "rgba(107, 79, 58, 0.45)" }}
        >
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.32em] text-gold/80"
              style={fontDisplay}
            >
              Muscle Group
            </div>
            <h2
              className="text-3xl lg:text-5xl font-bold tracking-tight mt-1"
              style={{
                ...fontDisplay,
                color: LEVEL_COLOR[zoneLevel],
                textShadow: `0 0 18px ${LEVEL_COLOR[zoneLevel]}55, 0 1px 0 rgba(0,0,0,0.7)`,
              }}
            >
              {displayZone ? ZONE_LABEL[displayZone].toUpperCase() : ""}
            </h2>
            <div className="mt-3">
              <LevelBadge level={zoneLevel} large />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-3xl w-9 h-9 flex items-center justify-center rounded transition shrink-0"
            aria-label="Close panel"
          >
            ×
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
          {/* SECTION 1: Muscle breakdown — expandable cards */}
          <section>
            <SectionTitle>Muscle Breakdown</SectionTitle>
            <div className="space-y-2">
              {muscles.map((m) => (
                <MuscleCard
                  key={m}
                  muscle={m}
                  level={muscleLevels[m] ?? "untrained"}
                  lastTrainedDate={lastTrainedByMuscle[m] ?? null}
                  history={historyForMuscle(m, enrichedSets)}
                  expanded={expanded.has(m)}
                  onToggle={() => toggleMuscle(m)}
                />
              ))}
            </div>
          </section>

          {/* SECTION 2: Path to next level — the marquee section */}
          <section>
            <SectionTitle>
              {allMaxed
                ? "Mastery Achieved"
                : `Path to ${
                    nextZoneLevel ? LEVEL_LABEL[nextZoneLevel] : "Mastery"
                  }`}
            </SectionTitle>

            {allMaxed ? (
              <div
                className="rounded-lg p-6 text-center"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(91, 57, 147, 0.18), rgba(91, 57, 147, 0.05))",
                  border: "1px solid #7747b0",
                  boxShadow: "0 0 28px rgba(91, 57, 147, 0.45)",
                }}
              >
                <div
                  className="text-2xl font-bold tracking-[0.18em] uppercase"
                  style={{
                    ...fontDisplay,
                    color: "#a855f7",
                    textShadow: "0 0 18px rgba(168, 85, 247, 0.6)",
                  }}
                >
                  All Muscles at Legendary
                </div>
                <div
                  className="text-[11px] uppercase tracking-[0.22em] text-gold/85 mt-2"
                  style={fontDisplay}
                >
                  Elite Status Achieved
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {muscles.map((m) => {
                  const lvl = muscleLevels[m] ?? "untrained";
                  if (lvl === "elite") return null;
                  const idx = LEVEL_ORDER.indexOf(lvl);
                  const next = LEVEL_ORDER[idx + 1];
                  return (
                    <PathCard
                      key={m}
                      muscle={m}
                      currentLevel={lvl}
                      nextLevel={next}
                      bodyweight={effectiveBW}
                      stdMap={stdMap}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 3: Recent activity */}
          {recentSets.length > 0 && (
            <section>
              <SectionTitle>Recent Activity</SectionTitle>
              <ul
                className="rounded-lg overflow-hidden divide-y divide-bronze-deep/30"
                style={{
                  background: "rgba(12, 12, 24, 0.6)",
                  border: "1px solid rgba(107, 79, 58, 0.45)",
                }}
              >
                {recentSets.map((s, i) => (
                  <li
                    key={`${s.date}-${s.exercise}-${i}`}
                    className="px-4 py-2.5 flex items-center gap-3 text-[12px]"
                  >
                    <div className="flex-1 min-w-0 truncate text-ink">
                      {s.exercise}
                    </div>
                    <div className="tabular-nums text-gold whitespace-nowrap font-semibold">
                      {s.weight} × {s.reps} × {s.sets}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted whitespace-nowrap w-24 text-right">
                      {formatDate(s.date)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer CTA */}
        <footer
          className="px-6 lg:px-8 py-4 border-t shrink-0"
          style={{
            background: "rgba(8, 8, 16, 0.85)",
            borderColor: "rgba(107, 79, 58, 0.45)",
          }}
        >
          <button
            onClick={() => displayZone && onLogWorkout(displayZone)}
            disabled={!displayZone}
            className="btn-stone w-full text-[11px]"
            style={{
              ...fontDisplay,
              letterSpacing: "0.22em",
              background: "linear-gradient(180deg, #7747b0, #3a2466)",
              borderColor: "#7747b0",
              color: "#f0e6ff",
            }}
          >
            Train {displayZone ? ZONE_LABEL[displayZone] : ""} Now
          </button>
        </footer>
      </aside>
    </>
  );
}

// ─── Muscle card — collapsed by default, expand for two sections ─
type MuscleHistoryEntry = {
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  date: string;
  score: number;
};

function historyForMuscle(
  muscle: string,
  enrichedSets: EnrichedSet[]
): MuscleHistoryEntry[] {
  // Only include exercises that actually target this muscle (any tier).
  const touching = new Set(exercisesForMuscle(muscle).map((e) => e.exercise));
  // For each touching exercise, keep the highest-scoring set.
  const bestByEx = new Map<string, MuscleHistoryEntry>();
  for (const s of enrichedSets) {
    if (!touching.has(s.exercise)) continue;
    const cur = bestByEx.get(s.exercise);
    if (!cur || s.score > cur.score) {
      bestByEx.set(s.exercise, {
        exercise: s.exercise,
        weight: s.weight,
        reps: s.reps,
        sets: s.sets,
        date: s.date,
        score: s.score,
      });
    }
  }
  return Array.from(bestByEx.values()).sort((a, b) => b.score - a.score);
}

function MuscleCard({
  muscle,
  level,
  lastTrainedDate,
  history,
  expanded,
  onToggle,
}: {
  muscle: string;
  level: StrengthLevel;
  lastTrainedDate: string | null;
  history: MuscleHistoryEntry[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = LEVEL_COLOR[level];
  const pct = (LEVEL_RANK[level] / 5) * 100;
  // Pull tiered exercises live so the data here always matches the
  // current EXERCISE_OPTIONS / TARGET_MUSCLES tables.
  const all = exercisesForMuscle(muscle);
  const direct = all
    .filter((e) => e.tier === "primary")
    .map((e) => e.exercise);
  const alsoWorks = all
    .filter((e) => e.tier !== "primary")
    .map((e) => e.exercise);
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "rgba(20, 14, 30, 0.55)",
        border: "1px solid rgba(107, 79, 58, 0.4)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 transition hover:bg-elevated/40"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold text-ink truncate">
            {muscle}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <LevelBadge level={level} />
            <span
              aria-hidden
              className="text-muted text-base"
              style={{
                display: "inline-block",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 180ms ease",
              }}
            >
              ▶
            </span>
          </div>
        </div>
        <div className="xp-track" style={{ height: 6 }}>
          {pct > 0 && (
            <div
              className="xp-fill transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: c }}
            />
          )}
        </div>
        <div className="mt-2 text-[11px] text-muted truncate">
          {lastTrainedDate ? (
            <>
              <span className="text-muted/80">Last trained:</span>{" "}
              <span className="text-ink">{formatDate(lastTrainedDate)}</span>
            </>
          ) : (
            <span className="text-muted/60 italic">Not yet trained</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {/* SECTION A — Training History */}
          <div className="border-t border-bronze-deep/40 pt-3">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-gold/85 font-bold mb-2"
              style={fontDisplay}
            >
              Training History
            </div>
            {history.length === 0 ? (
              <div className="text-[11px] text-muted/60 italic">
                No exercises logged yet
              </div>
            ) : (
              <ul className="space-y-1">
                {history.map((h, i) => (
                  <li
                    key={`${h.exercise}-${i}`}
                    className="flex items-center justify-between gap-3 text-[12px]"
                  >
                    <span className="truncate text-ink">
                      <span className="text-muted/70 mr-1">•</span>
                      {h.exercise}
                    </span>
                    <span className="tabular-nums whitespace-nowrap text-muted">
                      <span className="text-gold/90">
                        {h.weight}
                        {h.exercise === "Plank" ? "s" : ""}
                      </span>
                      <span className="text-muted/60"> × </span>
                      <span className="text-ink">{h.reps}</span>
                      <span className="text-muted/60"> × </span>
                      <span className="text-ink">{h.sets}</span>
                      <span className="text-muted/60 mx-2">·</span>
                      <span className="text-[10px] uppercase tracking-[0.16em]">
                        {formatDate(h.date)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SECTION B — How to Train It */}
          <div className="border-t border-bronze-deep/40 pt-3">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-gold/85 font-bold mb-2"
              style={fontDisplay}
            >
              How to Train It
            </div>
            {direct.length === 0 && alsoWorks.length === 0 ? (
              <div className="text-[11px] text-muted/60 italic">
                No exercises target this muscle in the catalog.
              </div>
            ) : (
              <div className="space-y-1.5 text-[11px]">
                {direct.length > 0 && (
                  <div className="flex items-baseline gap-2">
                    <span
                      className="uppercase tracking-[0.18em] font-bold shrink-0"
                      style={{ ...fontDisplay, color: "#d4a017" }}
                    >
                      Direct
                    </span>
                    <span className="text-ink/85">{direct.join(", ")}</span>
                  </div>
                )}
                {alsoWorks.length > 0 && (
                  <div className="flex items-baseline gap-2">
                    <span
                      className="uppercase tracking-[0.18em] font-bold shrink-0"
                      style={{ ...fontDisplay, color: "#a855f7" }}
                    >
                      Also works it
                    </span>
                    <span className="text-muted/85">
                      {alsoWorks.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Path card — one per muscle that isn't at elite ───────────────
//
// Lets the user pick from every exercise that hits this muscle and
// shows two computed target schemes (3×10 / 4×8) that would clear the
// next-tier threshold at their bodyweight. Muscles with no direct
// (declared-primary) exercise show an N/A note instead.
function PathCard({
  muscle,
  currentLevel,
  nextLevel,
  bodyweight,
  stdMap,
}: {
  muscle: string;
  currentLevel: StrengthLevel;
  nextLevel: StrengthLevel;
  bodyweight: number;
  stdMap: Map<string, StandardRow>;
}) {
  const cNow = LEVEL_COLOR[currentLevel];
  const cNext = LEVEL_COLOR[nextLevel];

  // All exercises that hit this muscle, primary first, then secondary,
  // then tertiary. Used both for the dropdown and for the N/A check.
  const allTouching = useMemo(
    () => exercisesForMuscle(muscle),
    [muscle]
  );
  const directCount = allTouching.filter((e) => e.tier === "primary").length;
  const hasStandardOptions = useMemo(
    () =>
      allTouching.filter((e) => stdMap.has(e.exercise)).map((e) => e.exercise),
    [allTouching, stdMap]
  );

  const [picked, setPicked] = useState<string>(() => {
    // Default to the first direct (primary-tier) option that has a
    // standards row, falling back to whatever's available.
    const firstDirect = allTouching.find(
      (e) => e.tier === "primary" && stdMap.has(e.exercise)
    );
    if (firstDirect) return firstDirect.exercise;
    return hasStandardOptions[0] ?? "";
  });

  const targets = useMemo(() => {
    if (!picked) return null;
    const std = stdMap.get(picked);
    if (!std) return null;
    const ratios = standardThresholdRatios(std);
    const target =
      nextLevel === "below"
        ? ratios.below
        : nextLevel === "average"
        ? ratios.average
        : nextLevel === "above"
        ? ratios.above
        : nextLevel === "exceptional"
        ? ratios.exceptional
        : ratios.elite;
    const project = (reps: number, sets: number) => {
      const raw = weightForTargetRatio(target, reps, sets, bodyweight);
      const rounded = Math.round(raw / 5) * 5;
      return {
        reps,
        sets,
        weight: Math.max(0, rounded),
        isBodyweight: rounded <= 0,
      };
    };
    return [project(10, 3), project(8, 4)];
  }, [picked, nextLevel, bodyweight, stdMap]);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: `linear-gradient(180deg, ${cNext}14, transparent)`,
        border: `1px solid ${cNext}55`,
        boxShadow: `0 0 16px ${cNext}1F`,
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-ink truncate">{muscle}</span>
        <span
          className="text-[10px] uppercase tracking-[0.22em] font-bold whitespace-nowrap"
          style={fontDisplay}
        >
          <span style={{ color: cNow }}>{LEVEL_LABEL[currentLevel]}</span>
          <span className="mx-1.5 text-muted">→</span>
          <span style={{ color: cNext }}>{LEVEL_LABEL[nextLevel]}</span>
        </span>
      </div>

      {directCount === 0 ? (
        <p className="text-[11px] text-muted/80 italic">
          N/A — this muscle is trained indirectly through compound movements
          only.
        </p>
      ) : (
        <>
          <label
            className="block text-[10px] uppercase tracking-[0.22em] text-muted mb-1.5"
            style={fontDisplay}
          >
            Choose an exercise to train {muscle}
          </label>
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="w-full mb-3"
          >
            {/* Group: Direct first */}
            <optgroup label="Direct">
              {allTouching
                .filter(
                  (e) => e.tier === "primary" && stdMap.has(e.exercise)
                )
                .map((e) => (
                  <option key={e.exercise} value={e.exercise}>
                    {e.exercise}
                  </option>
                ))}
            </optgroup>
            {allTouching.some(
              (e) => e.tier !== "primary" && stdMap.has(e.exercise)
            ) && (
              <optgroup label="Also works it">
                {allTouching
                  .filter(
                    (e) => e.tier !== "primary" && stdMap.has(e.exercise)
                  )
                  .map((e) => (
                    <option key={e.exercise} value={e.exercise}>
                      {e.exercise}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>

          {picked && targets && (
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-muted/85 mb-2"
                style={fontDisplay}
              >
                To reach {LEVEL_LABEL[nextLevel]} with{" "}
                <span style={{ color: cNext }}>{picked}</span>
              </div>
              <ul className="space-y-1">
                {targets.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-[12px]"
                  >
                    <span className="text-muted/85">
                      {i === 0 ? "Target" : "Alternative"}
                    </span>
                    <span
                      className="tabular-nums whitespace-nowrap"
                      style={{ color: "#d4a017" }}
                    >
                      {t.sets}×{t.reps}{" "}
                      <span className="text-muted/70 mx-0.5">@</span>{" "}
                      {t.isBodyweight ? "bodyweight" : `${t.weight} lbs`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Small UI primitives ──────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] uppercase tracking-[0.32em] text-gold font-bold mb-3"
      style={fontDisplay}
    >
      {children}
    </h3>
  );
}

function LevelBadge({
  level,
  large,
}: {
  level: StrengthLevel;
  large?: boolean;
}) {
  const c = LEVEL_COLOR[level];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${
        large ? "px-3 py-1" : "px-2 py-0.5"
      }`}
      style={{
        background: `${c}1F`,
        border: `1px solid ${c}`,
        boxShadow: `0 0 12px ${c}44`,
      }}
    >
      <span
        aria-hidden
        className="seal"
        style={{
          width: large ? 10 : 7,
          height: large ? 10 : 7,
          background: c,
          boxShadow: `0 0 6px ${c}`,
        }}
      />
      <span
        className={`uppercase tracking-[0.22em] font-bold ${
          large ? "text-[12px]" : "text-[10px]"
        }`}
        style={{ ...fontDisplay, color: c }}
      >
        {LEVEL_LABEL[level]}
      </span>
    </span>
  );
}
