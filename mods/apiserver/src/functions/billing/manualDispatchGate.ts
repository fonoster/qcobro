import {
  estimateVoiceDebitMicro,
  isMessageMeter,
  priceMessageMicro,
  resolveRate,
  type BillingClient,
  type BillingConfig,
  type BillingMeter
} from "@qcobro/common";
import { parseStoredOverrides, planFromCatalog } from "./meters.js";
import { workspaceBalanceMicroTx } from "./workspaceBalance.js";

/** The gate's verdict for one manual dispatch. */
export type ManualDispatchGateResult =
  | { kind: "unmetered" } // billing disabled or workspace not enrolled
  | { kind: "metered"; estimatedCostMicro: number }
  | { kind: "insufficient_credits"; balanceMicro: number; estimatedCostMicro: number }
  | { kind: "payment_failed" };

/**
 * Direct balance check for manual/ad-hoc outreach (billing-enforcement spec):
 * dispatches outside the engine tick verify the workspace can cover the
 * estimated cost BEFORE any provider call, with no side effects. Voice
 * estimates use `voiceDebitEstimateSeconds` (never below the initial
 * increment), exactly like the engine's credit bucket.
 */
export async function assessManualDispatch(
  db: BillingClient,
  billing: BillingConfig,
  workspaceRef: string,
  meter: BillingMeter
): Promise<ManualDispatchGateResult> {
  if (!billing?.enabled) return { kind: "unmetered" };

  const enrollment = await db.workspaceBilling.findUnique({ where: { workspaceRef } });
  if (!enrollment) return { kind: "unmetered" };

  const account = await db.billingAccount.findUnique({
    where: { id: enrollment.billingAccountId }
  });
  if (account?.paymentFailed) return { kind: "payment_failed" };

  const plan = planFromCatalog(billing, enrollment.planKey);
  const overrides = parseStoredOverrides(enrollment.rateOverrides);
  const estimatedCostMicro = isMessageMeter(meter)
    ? priceMessageMicro(resolveRate(meter, plan.rates, overrides))
    : estimateVoiceDebitMicro(
        resolveRate(meter, plan.rates, overrides),
        billing.voiceDebitEstimateSeconds
      );

  const balanceMicro = await workspaceBalanceMicroTx(db, workspaceRef);
  if (balanceMicro < estimatedCostMicro) {
    return { kind: "insufficient_credits", balanceMicro, estimatedCostMicro };
  }
  return { kind: "metered", estimatedCostMicro };
}
