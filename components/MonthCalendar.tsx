"use client";

import { useMemo, useState } from "react";
import { todayPT } from "@/lib/time";

export type CalendarStatus = "none" | "low" | "met" | "over" | "future";

export type CalendarCell = {
  date: string; // YYYY-MM-DD
  status: CalendarStatus;
  /** Optional small text/value (no longer displayed in compact mode
   *  — kept for the title attribute). */
  hint?: string;
};

const fontDisplay = { fontFamily: "var(--font-cinzel), Georgia, serif" };

const STATUS_COLORS: Record<CalendarStatus, string> = {
  none:   "#3a3340",
  low:    "#3a5a8a",
  met:    "#a855f7",
  over:   "#a0432a",
  future: "transparent",
};

/** Generic month-grid calendar. Renders the full month as 7 columns
 *  starting on Sunday. Days outside the month are blank. */
export default function MonthCalendar({
  cells,
  onDayClick,
  initialMonth,
  legend,
}: {
  /** Map from YYYY-MM-DD → CalendarCell. Days not in the map render as
   *  "none" (no-data) within the current month. */
  cells: Map<string, CalendarCell>;
  onDayClick: (dateISO: string) => void;
  /** Defaults to the current month. */
  initialMonth?: { year: number; month: number };
  /** Optional legend chips rendered below the calendar. */
  legend?: Array<{ status: CalendarStatus; label: string }>;
}) {
  const today = new Date();
  const [view, setView] = useState<{ year: number; month: number }>(
    initialMonth ?? {
      year: today.getFullYear(),
      month: today.getMonth(),
    }
  );

  const grid = useMemo(() => buildGrid(view.year, view.month), [view]);
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" }
  );
  const todayISO = todayPT();

  return (
    <div className="mx-auto" style={{ maxWidth: 320 }}>
      {/* Header — compact month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => stepMonth(view, -1, setView)}
          className="text-muted hover:text-ink transition w-6 h-6 flex items-center justify-center rounded text-xs"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div
          className="text-[11px] uppercase tracking-[0.22em] text-gold font-bold"
          style={fontDisplay}
        >
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => stepMonth(view, 1, setView)}
          className="text-muted hover:text-ink transition w-6 h-6 flex items-center justify-center rounded text-xs"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header — single-letter labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-[9px] uppercase tracking-wider text-muted/60 text-center leading-none py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cells — small, dot-style */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((cell, i) => {
          if (!cell) {
            return (
              <div
                key={i}
                style={{ width: 32, height: 32 }}
                className="mx-auto"
              />
            );
          }
          const data = cells.get(cell.iso);
          const isFuture = cell.iso > todayISO;
          const status: CalendarStatus = data
            ? data.status
            : isFuture
            ? "future"
            : "none";
          const isToday = cell.iso === todayISO;
          const color = STATUS_COLORS[status];
          const hasData = status !== "none" && status !== "future";
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onDayClick(cell.iso)}
              disabled={isFuture && !data}
              title={`${cell.iso}${data?.hint ? ` · ${data.hint}` : ""}`}
              className="mx-auto relative flex items-center justify-center transition rounded-full hover:bg-elevated"
              style={{
                width: 32,
                height: 32,
                opacity: isFuture && !data ? 0.25 : 1,
                cursor: isFuture && !data ? "default" : "pointer",
                outline: isToday ? "1px solid #b8860b" : undefined,
                outlineOffset: isToday ? -2 : undefined,
              }}
            >
              <span
                className="text-[10px] tabular-nums leading-none"
                style={{
                  color: isToday
                    ? "#b8860b"
                    : hasData
                    ? "#d8d2c2"
                    : isFuture
                    ? "#5a5246"
                    : "#8b8275",
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {cell.day}
              </span>
              {hasData && (
                <span
                  aria-hidden
                  className="absolute"
                  style={{
                    bottom: 4,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 4px ${color}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {legend && legend.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-muted"
          style={fontDisplay}
        >
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{
                  background: STATUS_COLORS[l.status],
                  boxShadow: `0 0 4px ${STATUS_COLORS[l.status]}`,
                }}
              />
              <span>{l.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function stepMonth(
  view: { year: number; month: number },
  delta: number,
  setView: (v: { year: number; month: number }) => void
) {
  const d = new Date(view.year, view.month + delta, 1);
  setView({ year: d.getFullYear(), month: d.getMonth() });
}

/**
 * Build a flat array of 6×7 cells (or fewer) covering the full month
 * starting on Sunday. Cells outside the month are null.
 */
function buildGrid(
  year: number,
  month: number
): Array<{ day: number; iso: string } | null> {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const out: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < total; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      out.push(null);
    } else {
      // Build ISO from local y/m/d directly — using toISOString() would
      // shift back to UTC and could put us in the previous day.
      const m = String(month + 1).padStart(2, "0");
      const d = String(dayNum).padStart(2, "0");
      out.push({ day: dayNum, iso: `${year}-${m}-${d}` });
    }
  }
  return out;
}
