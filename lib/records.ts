/**
 * Personal records — strength (lbs), endurance (time), athleticism (inches).
 *
 * Each record has its own grading rubric mapping a numeric value (or
 * time-in-seconds) to a StrengthLevel tier so the UI can show a level
 * badge consistent with the muscle-group system.
 */

import type { StrengthLevel } from "./strength";

export type RecordKind =
  | "bench_press"
  | "squat"
  | "deadlift"
  | "mile_run"
  | "5k_run"
  | "10k_run"
  | "vertical_jump";

export type RecordCategory = "strength" | "endurance" | "athleticism";

export type RecordDef = {
  id: RecordKind;
  category: RecordCategory;
  label: string;
  /** Whether the value is bigger-is-better (lifts/jump) or smaller (runs). */
  inverse: boolean;
  /** "lbs" / "in" / "min:sec" / "h:mm:ss" */
  unit: string;
};

export const RECORDS: RecordDef[] = [
  { id: "bench_press",   category: "strength",     label: "Bench Press",  inverse: false, unit: "lbs" },
  { id: "squat",         category: "strength",     label: "Squat",        inverse: false, unit: "lbs" },
  { id: "deadlift",      category: "strength",     label: "Deadlift",     inverse: false, unit: "lbs" },
  { id: "mile_run",      category: "endurance",    label: "1 Mile Run",   inverse: true,  unit: "min:sec" },
  { id: "5k_run",        category: "endurance",    label: "5K Run",       inverse: true,  unit: "min:sec" },
  { id: "10k_run",       category: "endurance",    label: "10K Run",      inverse: true,  unit: "h:mm:ss" },
  { id: "vertical_jump", category: "athleticism",  label: "Vertical Jump",inverse: false, unit: "in" },
];

export const RECORDS_BY_ID: Record<RecordKind, RecordDef> = Object.fromEntries(
  RECORDS.map((r) => [r.id, r])
) as Record<RecordKind, RecordDef>;

export const RECORD_CATEGORY_LABEL: Record<RecordCategory, string> = {
  strength: "Strength Records",
  endurance: "Endurance Records",
  athleticism: "Athleticism Records",
};

// ──────────────────────────────────────────────────────────────────
// Tier rubrics
// ──────────────────────────────────────────────────────────────────

/**
 * Strength records compare the lift to bodyweight (multiplier).
 * Khalid's spec is for male 18-25; we apply it uniformly until per-
 * sex/age scaling is added.
 *
 * key = ratio threshold (>=); value = level
 */
const STRENGTH_RATIO: Record<RecordKind, Array<[number, StrengthLevel]>> = {
  bench_press: [
    [1.5,  "elite"],
    [1.25, "exceptional"],
    [1.0,  "above"],
    [0.75, "average"],
    [0.5,  "below"],
    [0,    "untrained"],
  ],
  squat: [
    [2.5, "elite"],
    [2.0, "exceptional"],
    [1.5, "above"],
    [1.0, "average"],
    [0.75,"below"],
    [0,   "untrained"],
  ],
  deadlift: [
    [3.0, "elite"],
    [2.5, "exceptional"],
    [2.0, "above"],
    [1.5, "average"],
    [1.0, "below"],
    [0,   "untrained"],
  ],
  mile_run:      [], // handled separately (time-based)
  "5k_run":      [],
  "10k_run":     [],
  vertical_jump: [], // handled separately (inches)
};

/** Time thresholds in TOTAL SECONDS, smaller = better. */
const ENDURANCE_TIME: Record<RecordKind, Array<[number, StrengthLevel]>> = {
  bench_press:   [],
  squat:         [],
  deadlift:      [],
  // 1 mile (minutes → seconds)
  mile_run: [
    [6 * 60,  "elite"],
    [7 * 60,  "exceptional"],
    [8 * 60,  "above"],
    [10 * 60, "average"],
    [12 * 60, "below"],
    [Infinity,"untrained"],
  ],
  // 5K
  "5k_run": [
    [17 * 60, "elite"],
    [20 * 60, "exceptional"],
    [25 * 60, "above"],
    [30 * 60, "average"],
    [40 * 60, "below"],
    [Infinity,"untrained"],
  ],
  // 10K
  "10k_run": [
    [35 * 60, "elite"],
    [42 * 60, "exceptional"],
    [50 * 60, "above"],
    [60 * 60, "average"],
    [80 * 60, "below"],
    [Infinity,"untrained"],
  ],
  vertical_jump: [],
};

/** Athleticism — vertical jump in inches. */
const ATHLETICISM_THRESHOLDS: Array<[number, StrengthLevel]> = [
  [28, "elite"],
  [24, "exceptional"],
  [20, "above"],
  [16, "average"],
  [12, "below"],
  [0,  "untrained"],
];

/**
 * Compute the tier for a record. `value` units match the record:
 *   strength → weight in lbs (will be divided by bodyweight)
 *   endurance → time in seconds
 *   athleticism (vertical_jump) → inches
 */
export function levelForRecord(
  kind: RecordKind,
  value: number,
  bodyweight?: number
): StrengthLevel {
  const def = RECORDS_BY_ID[kind];
  if (def.category === "strength") {
    if (!bodyweight || bodyweight <= 0) return "untrained";
    const ratio = value / bodyweight;
    const ladder = STRENGTH_RATIO[kind];
    for (const [min, lvl] of ladder) {
      if (ratio >= min) return lvl;
    }
    return "untrained";
  }
  if (def.category === "endurance") {
    if (value <= 0) return "untrained";
    // Smaller time = better; ladder sorted descending in best-ness.
    const ladder = ENDURANCE_TIME[kind];
    for (const [maxSeconds, lvl] of ladder) {
      if (value <= maxSeconds) return lvl;
    }
    return "untrained";
  }
  if (def.category === "athleticism") {
    if (value <= 0) return "untrained";
    for (const [min, lvl] of ATHLETICISM_THRESHOLDS) {
      if (value >= min) return lvl;
    }
    return "untrained";
  }
  return "untrained";
}

// ──────────────────────────────────────────────────────────────────
// Time formatting helpers
// ──────────────────────────────────────────────────────────────────

/** Format total seconds as "mm:ss" or "h:mm:ss" depending on length. */
export function formatTime(totalSeconds: number, longForm = false): string {
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (longForm || h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseTimeToSeconds(min: string, sec: string, hr?: string): number {
  const h = Number(hr ?? 0) || 0;
  const m = Number(min) || 0;
  const s = Number(sec) || 0;
  return h * 3600 + m * 60 + s;
}

/** Display the value formatted per record type. */
export function formatRecordValue(
  kind: RecordKind,
  weight: number,
  timeSeconds: number | null
): string {
  const def = RECORDS_BY_ID[kind];
  if (def.category === "endurance") {
    if (!timeSeconds) return "—";
    return formatTime(timeSeconds, kind === "10k_run");
  }
  if (def.category === "athleticism") {
    if (!weight) return "—";
    return `${weight}″`;
  }
  if (!weight) return "—";
  return `${weight} lbs`;
}
