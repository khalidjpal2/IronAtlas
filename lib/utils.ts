/**
 * Shared date-formatting utility used everywhere user-facing dates are
 * rendered. All comparisons happen in the user's PT calendar — the
 * same calendar the rest of the app uses for "today", scoring windows,
 * and step/nutrition logging.
 *
 * Output rules (per spec):
 *   0 days     → "Today"
 *   1 day      → "Yesterday"
 *   2..6 days  → "N days ago"
 *   7..13 days → "Last <Weekday>"
 *   14..364 in current calendar year → "May 4"
 *   else       → "May 4, 2026"
 */

import { todayPT, daysBetweenPT, ptDateOf } from "./time";

const TZ = "America/Los_Angeles";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: TZ,
});
const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: TZ,
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: TZ,
});

/**
 * Convert a YYYY-MM-DD string OR a Date OR an ISO timestamp into the
 * user-facing relative date label.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";

  const iso = typeof input === "string" ? toDateOnly(input) : ptDateOf(input);
  if (!iso) return "—";

  const today = todayPT();
  const diff = daysBetweenPT(iso, today);
  if (diff == null) return iso;

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff <= 6) return `${diff} days ago`;
  if (diff >= 7 && diff <= 13) {
    return `Last ${WEEKDAY_FORMAT.format(toDate(iso))}`;
  }
  // Future dates fall through to absolute formats — callers shouldn't
  // pass them, but if they do we still render something sensible.
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return sameYear
    ? MONTH_DAY.format(toDate(iso))
    : MONTH_DAY_YEAR.format(toDate(iso));
}

/**
 * Like formatDate but strips the "Today" / "Yesterday" relative
 * shortcuts. Useful in tooltip titles and chart axes where a stable
 * absolute label reads better.
 */
export function formatDateAbsolute(
  input: string | Date | null | undefined
): string {
  if (!input) return "—";
  const iso = typeof input === "string" ? toDateOnly(input) : ptDateOf(input);
  if (!iso) return "—";
  const sameYear = iso.slice(0, 4) === todayPT().slice(0, 4);
  return sameYear
    ? MONTH_DAY.format(toDate(iso))
    : MONTH_DAY_YEAR.format(toDate(iso));
}

/** Convert YYYY-MM-DD (or any ISO-ish string) into a Date pinned to noon UTC,
 * so `Intl.DateTimeFormat` with `timeZone: PT` consistently lands inside
 * the intended calendar day regardless of the host timezone. */
function toDate(iso: string): Date {
  return new Date(iso + "T12:00:00Z");
}

/** Accept a YYYY-MM-DD or a longer ISO string and return YYYY-MM-DD. */
function toDateOnly(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Longer ISO timestamps: convert through the PT calendar so timezone
  // shifts at midnight don't put us on the wrong day.
  return ptDateOf(s);
}
