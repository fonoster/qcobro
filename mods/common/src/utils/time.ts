/**
 * Timezone-aware wall-clock helpers. The campaigns engine evaluates schedule
 * windows and daily caps in the deployment timezone (from `qcobro.json`), not UTC.
 * All functions take an IANA timezone string and use `Intl` so DST is handled.
 */

interface LocalParts {
  /** Local calendar date as `YYYY-MM-DD`. */
  date: string;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Local time as `HH:MM` (24h, zero-padded). */
  time: string;
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
};

/** Decompose an instant into local date/weekday/time parts for the given timezone. */
export function localParts(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  // `hour` can come back as "24" at midnight under hour12:false; normalize to "00".
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_TO_ISO[parts.weekday] ?? 0,
    time: `${hour}:${parts.minute}`
  };
}

/** Local calendar date (`YYYY-MM-DD`) for an instant in the given timezone. */
export function localDateString(date: Date, timeZone: string): string {
  return localParts(date, timeZone).date;
}

/** True when two instants fall on the same local calendar day in the timezone. */
export function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return localDateString(a, timeZone) === localDateString(b, timeZone);
}

/** ISO weekday (1=Mon … 7=Sun) for an instant in the timezone. */
export function localWeekdayISO(date: Date, timeZone: string): number {
  return localParts(date, timeZone).weekday;
}

/** Local `HH:MM` (24h) for an instant in the timezone. */
export function localTimeHHMM(date: Date, timeZone: string): string {
  return localParts(date, timeZone).time;
}

/** The schedule fields a contact window comprises (a campaign row or an event snapshot). */
export interface ScheduleWindow {
  startDate: Date;
  endDate: Date | null;
  /** ISO weekdays (1 = Monday … 7 = Sunday). */
  daysOfWeek: number[];
  /** Local wall-clock bounds, `HH:MM` 24h. Windows do not span midnight. */
  startTime: string;
  endTime: string;
}

/**
 * Whether `at` falls inside the schedule window, evaluated in `timeZone`. The
 * single window rule shared by the engine's dispatch gate and the evaluator's
 * SAF-1 check, so the judge can never disagree with the engine about a window.
 */
export function isWithinScheduleWindow(w: ScheduleWindow, at: Date, timeZone: string): boolean {
  const { date, weekday, time } = localParts(at, timeZone);
  if (date < localDateString(w.startDate, timeZone)) return false;
  if (w.endDate && date > localDateString(w.endDate, timeZone)) return false;
  if (!w.daysOfWeek.includes(weekday)) return false;
  if (time < w.startTime || time > w.endTime) return false;
  return true;
}
