/**
 * Pacific Time helpers.
 *
 * The app stores timestamps as UTC in the database (Postgres timestamptz)
 * but the user's "today" should always be the calendar day they see in
 * California (America/Los_Angeles). These helpers convert any Date or
 * ISO string into the PT calendar day, so logging a step at 11pm PT
 * lands on the correct PT date even when UTC has rolled over.
 */

const TZ = "America/Los_Angeles";

/**
 * Return the current PT calendar day as YYYY-MM-DD.
 * Uses Intl.DateTimeFormat — every modern browser + Node version
 * supports IANA zone names.
 */
export function todayPT(): string {
  return ptDateOf(new Date());
}

/**
 * Convert any Date or ISO string into its PT calendar day (YYYY-MM-DD).
 * This handles the case where a UTC moment near midnight maps to a
 * different day in PT.
 */
export function ptDateOf(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // en-CA gives "YYYY-MM-DD" naturally.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Return the YYYY-MM-DD that is `days` calendar-days before today (PT).
 * `days = 0` returns today.
 */
export function ptDateNDaysAgo(days: number, ref: Date = new Date()): string {
  // Strategy: shift the reference timestamp by N days then format in PT.
  // Because PT has DST, naive 86400e3 arithmetic on UTC milliseconds
  // can occasionally drift across a DST boundary; using PT-formatted
  // arithmetic (build a date from the PT y/m/d, subtract N days, format
  // back) avoids that.
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const get = (type: string) =>
    Number(todayParts.find((p) => p.type === type)?.value);
  // Use UTC arithmetic on a stripped y/m/d (no time-of-day) — the day
  // count is guaranteed correct because we only care about the date.
  const utcMidnight = Date.UTC(get("year"), get("month") - 1, get("day"));
  const shifted = new Date(utcMidnight - days * 86_400_000);
  // Build a YYYY-MM-DD directly from UTC components (no tz conversion).
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Iterate the last N PT calendar days ending today, oldest first.
 * Useful for chart scaffolding / score windows.
 */
export function lastNPTDays(n: number, ref: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(ptDateNDaysAgo(i, ref));
  }
  return out;
}

/**
 * Diff in calendar days (PT) between two YYYY-MM-DD strings.
 * Positive = `later` is after `earlier`. Returns null on invalid input.
 */
export function daysBetweenPT(earlier: string, later: string): number | null {
  const a = parseISODate(earlier);
  const b = parseISODate(later);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86_400_000);
}

function parseISODate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Format a YYYY-MM-DD as a human-friendly PT date (e.g. "Wed · May 7").
 */
export function formatPTDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }
): string {
  if (!iso) return "—";
  // Add T12:00 so we're firmly inside the day in any tz, then format in PT.
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { ...opts, timeZone: TZ });
}
