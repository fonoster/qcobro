import { startOfLocalDay } from "@qcobro/common";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A calendar period (`from` and `to` inclusive, `YYYY-MM-DD`) as a half-open UTC range in the
 * workspace's timezone: `[from 00:00, the day after to 00:00)`. Consecutive periods never
 * share an instant, so a recovery counts in exactly one month.
 */
export function periodRange(from: string, to: string, timeZone: string): { gte: Date; lt: Date } {
  const dayAfterTo = new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  return { gte: startOfLocalDay(from, timeZone), lt: startOfLocalDay(dayAfterTo, timeZone) };
}

/** Recoveries of the caller's workspace, optionally one portfolio, detected in the range. */
export function recoveryWhere(
  workspaceRef: string,
  range: { gte: Date; lt: Date },
  portfolioId?: string
): Record<string, unknown> {
  return {
    portfolio: { workspaceRef },
    ...(portfolioId ? { portfolioId } : {}),
    detectedAt: range
  };
}
