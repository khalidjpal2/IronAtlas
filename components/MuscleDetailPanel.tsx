"use client";

import { useEffect, useState } from "react";
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  LEVEL_RANK,
  SEX_LABEL,
  ZONE_LABEL,
  ZONE_MUSCLES,
  type Sex,
  type StrengthLevel,
  type Zone,
} from "@/lib/strength";

type Props = {
  zone: Zone | null;
  zoneLevel: StrengthLevel;
  ageGroup: string;
  sex: Sex | null;
  muscleLevels: Record<string, StrengthLevel>;
  muscleBest: Record<
    string,
    {
      exercise: string;
      weight: number;
      reps?: number;
      sets?: number;
      score?: number;
    } | null
  >;
  onClose: () => void;
  onLogWorkout: (zone: Zone) => void;
};

export default function MuscleDetailPanel({
  zone,
  zoneLevel,
  ageGroup,
  sex,
  muscleLevels,
  muscleBest,
  onClose,
  onLogWorkout,
}: Props) {
  const demographic = sex
    ? `${ageGroup} ${SEX_LABEL[sex].toLowerCase()} lifters`
    : `${ageGroup} lifters`;
  const open = zone !== null;

  const [displayZone, setDisplayZone] = useState<Zone | null>(null);
  useEffect(() => {
    if (zone) {
      setDisplayZone(zone);
      return;
    }
    const t = setTimeout(() => setDisplayZone(null), 280);
    return () => clearTimeout(t);
  }, [zone]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const muscles = displayZone ? ZONE_MUSCLES[displayZone] : [];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label={displayZone ? `${ZONE_LABEL[displayZone]} detail` : undefined}
        className={`
          fixed z-50 bg-panel flex flex-col overflow-hidden
          left-0 right-0 bottom-0 max-h-[88vh] rounded-t-xl border-t border-border
          lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-[440px] lg:max-h-none
          lg:rounded-none lg:border-l lg:border-t-0
          transition-transform duration-300 ease-out
          ${
            open
              ? "translate-y-0 lg:translate-x-0"
              : "translate-y-full lg:translate-y-0 lg:translate-x-full"
          }
        `}
        style={{
          backgroundImage: "var(--noise-bg)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5), -16px 0 48px rgba(0,0,0,0.6)",
        }}
      >
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border-bright rounded-full" />
        </div>

        <header className="px-7 py-6 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-gold mb-2 font-bold"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              Muscle Group
            </div>
            <h2
              className="text-2xl font-bold tracking-tight text-ink"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              {displayZone ? ZONE_LABEL[displayZone] : ""}
            </h2>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="seal"
                style={{
                  width: 12,
                  height: 12,
                  background: LEVEL_COLOR[zoneLevel],
                }}
              />
              <span
                className="text-sm font-semibold uppercase tracking-[0.18em]"
                style={{ color: LEVEL_COLOR[zoneLevel] }}
              >
                {LEVEL_LABEL[zoneLevel]}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted">
              Compared to {demographic}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-2xl w-8 h-8 flex items-center justify-center rounded-md hover:bg-elevated transition"
            aria-label="Close panel"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-2.5">
          {muscles.map((m) => {
            const lvl = muscleLevels[m] ?? "untrained";
            const best = muscleBest[m];
            const pct = (LEVEL_RANK[lvl] / 5) * 100;
            const color = LEVEL_COLOR[lvl];
            return (
              <div
                key={m}
                className="bg-elevated border border-border rounded-md p-4 transition hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="seal shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        background: color,
                      }}
                    />
                    <span className="text-sm font-medium truncate text-ink">
                      {m}
                    </span>
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-[0.18em] whitespace-nowrap font-semibold"
                    style={{ color }}
                  >
                    {LEVEL_LABEL[lvl]}
                  </span>
                </div>
                <div className="xp-track" style={{ height: 4 }}>
                  {pct > 0 && (
                    <div
                      className="xp-fill transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: color,
                      }}
                    />
                  )}
                </div>
                <div className="mt-2.5 text-xs text-muted flex items-baseline justify-between gap-2">
                  {best ? (
                    <span className="truncate">
                      <span className="text-ink">{best.exercise}</span>
                      <span className="mx-1.5 text-muted/40">·</span>
                      <span className="text-ink">
                        {best.weight}
                        {best.exercise === "Plank" ? "s" : " lbs"}
                      </span>
                      {best.reps != null && best.sets != null && (
                        <>
                          <span className="mx-1.5 text-muted/40">·</span>
                          <span className="text-ink">
                            {best.sets}x{best.reps}
                          </span>
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted/60 italic">
                      Not yet awakened
                    </span>
                  )}
                  {best?.score != null && (
                    <span className="font-mono text-[10px] text-muted whitespace-nowrap">
                      {best.score.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="px-7 py-5 border-t border-border bg-panel">
          <button
            onClick={() => displayZone && onLogWorkout(displayZone)}
            disabled={!displayZone}
            className="btn-stone w-full"
          >
            Train {displayZone ? ZONE_LABEL[displayZone] : ""}
          </button>
        </footer>
      </aside>
    </>
  );
}
