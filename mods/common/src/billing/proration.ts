import { assertMicroUnits } from "./money.js";

/**
 * Prorates a cycle allowance to the remaining fraction of the billing period —
 * used when a workspace joins mid-cycle or upgrades: Stripe prorates the charge
 * and QCobro grants the matching fraction of the allowance. Integer micro-units
 * out; clamped to [0, allowance] so clock skew can't over- or under-grant.
 */
export function proratedGrantMicro(
  allowanceMicro: number,
  at: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  assertMicroUnits(allowanceMicro);
  const period = periodEnd.getTime() - periodStart.getTime();
  if (period <= 0) return 0;
  const remaining = periodEnd.getTime() - at.getTime();
  const fraction = Math.min(1, Math.max(0, remaining / period));
  return Math.round(allowanceMicro * fraction);
}
