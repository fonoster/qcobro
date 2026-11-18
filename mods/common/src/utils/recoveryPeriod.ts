import { localDateString } from "./time.js";

/** The periods Recuperado can be read for. "Este mes" is the default. */
export const RECOVERY_PERIODS = ["thisMonth", "lastMonth", "thisYear"] as const;
export type RecoveryPeriod = (typeof RECOVERY_PERIODS)[number];

/**
 * A period as the `from`/`to` dates `recovery.summary` takes (`YYYY-MM-DD`, both inclusive),
 * computed from today's date in the workspace's timezone, not the browser's.
 */
export function recoveryPeriodRange(
  period: RecoveryPeriod,
  timeZone: string,
  now: Date = new Date()
): { from: string; to: string } {
  const today = localDateString(now, timeZone);
  const [year, month] = today.split("-").map(Number);
  if (period === "thisYear") return { from: `${year}-01-01`, to: today };
  if (period === "thisMonth") return { from: `${today.slice(0, 7)}-01`, to: today };
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  // Day 0 of the current month is the last day of the previous one.
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const ym = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  return { from: `${ym}-01`, to: `${ym}-${String(lastDay).padStart(2, "0")}` };
}
