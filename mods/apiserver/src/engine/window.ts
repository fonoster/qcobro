import { isWithinScheduleWindow, localDateString, type CampaignSkipReason } from "@qcobro/common";

/** The campaign fields the schedule-window gate reads. */
export interface WindowCampaign {
  status: string;
  startDate: Date;
  endDate: Date | null;
  /** ISO weekdays the campaign runs on (1 = Monday … 7 = Sunday). */
  daysOfWeek: number[];
  /** Local wall-clock bounds, `HH:MM` (24h). */
  startTime: string;
  endTime: string;
}

export type WindowResult = { ok: true } | { ok: false; reason: CampaignSkipReason };

/**
 * Whether a campaign may dispatch at `now`, evaluated in the given `timeZone` (the
 * campaign's workspace timezone). In-window means: status ACTIVE,
 * `startDate ≤ today ≤ endDate` (endDate optional),
 * the local weekday is in `daysOfWeek`, and the local time is within
 * `startTime`..`endTime`. Windows do not span midnight (`startTime < endTime`).
 */
export function isInWindow(c: WindowCampaign, now: Date, timeZone: string): WindowResult {
  if (c.status !== "ACTIVE") return { ok: false, reason: "not_active" };
  // The schedule rule itself is shared with the evaluator's SAF-1 check.
  if (!isWithinScheduleWindow(c, now, timeZone)) return { ok: false, reason: "out_of_window" };
  return { ok: true };
}

/**
 * Whether the campaign's end date has passed in the given `timeZone` (the campaign's
 * workspace timezone) — the engine's trigger to auto-complete. Open-ended campaigns
 * (no `endDate`) never pass.
 */
export function isPastEndDate(
  c: Pick<WindowCampaign, "endDate">,
  now: Date,
  timeZone: string
): boolean {
  if (!c.endDate) return false;
  return localDateString(now, timeZone) > localDateString(c.endDate, timeZone);
}
