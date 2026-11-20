import type { useI18n } from "./i18n.js";

type Translate = ReturnType<typeof useI18n>["t"];

export interface CampaignScheduleInput {
  status: string;
  daysOfWeek: number[];
  startDate: Date | string;
  endDate: Date | string | null;
  startTime: string;
  endTime: string;
}

export type NextRun =
  | { kind: "now"; until: string }
  | { kind: "at"; dayOffset: number; ymd: string; isoWeekday: number; time: string };

/** A stored campaign date (midnight UTC, date-only semantics) as "YYYY-MM-DD". */
export function toYmd(val: Date | string | null | undefined): string {
  if (!val) return "";
  return new Date(val).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → "dd/mm/yyyy". */
export function formatDmy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const js = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Today's date ("YYYY-MM-DD") and time ("HH:mm") in `timeZone`. */
function localNow(now: Date, timeZone: string): { ymd: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hm: `${get("hour")}:${get("minute")}`
  };
}

/**
 * When an ACTIVE campaign next opens its run window, computed client-side from its days,
 * hours and dates in the workspace's time zone. `null` when it will not run (not active,
 * no days, or past its end date).
 */
export function nextRun(
  c: CampaignScheduleInput,
  timeZone: string,
  now: Date = new Date()
): NextRun | null {
  if (c.status !== "ACTIVE" || c.daysOfWeek.length === 0) return null;
  const today = localNow(now, timeZone);
  const start = toYmd(c.startDate);
  const end = toYmd(c.endDate);
  const begin = start > today.ymd ? start : today.ymd;
  for (let i = 0; i < 8; i++) {
    const ymd = addDays(begin, i);
    if (end && ymd > end) return null;
    const wd = isoWeekday(ymd);
    if (!c.daysOfWeek.includes(wd)) continue;
    if (ymd === today.ymd) {
      if (today.hm < c.startTime) {
        return { kind: "at", dayOffset: 0, ymd, isoWeekday: wd, time: c.startTime };
      }
      if (today.hm < c.endTime) return { kind: "now", until: c.endTime };
      continue;
    }
    const dayOffset = Math.round(
      (Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${today.ymd}T00:00:00Z`)) / 86_400_000
    );
    return { kind: "at", dayOffset, ymd, isoWeekday: wd, time: c.startTime };
  }
  return null;
}

/** "Hoy, 15:00" · "Mañana, 09:00" · "Lun 23 jun" · "En curso · hasta 18:00". */
export function formatNextRun(run: NextRun, t: Translate, language: string): string {
  if (run.kind === "now") return t("campaigns.next.now").replace("{time}", run.until);
  if (run.dayOffset === 0) return t("campaigns.next.today").replace("{time}", run.time);
  if (run.dayOffset === 1) return t("campaigns.next.tomorrow").replace("{time}", run.time);
  const [y, m, d] = run.ymd.split("-").map(Number);
  const month = new Intl.DateTimeFormat(language, { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y!, m! - 1, d!)))
    .replace(".", "");
  const weekday = t(`campaigns.days.${run.isoWeekday}` as Parameters<Translate>[0]);
  return `${weekday} ${d} ${month}`;
}

/** "America/Santo_Domingo" → "Santo Domingo". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}
