import {
  billedSeconds,
  estimateVoiceDebitMicro,
  isMessageMeter,
  meterDispatchSchema,
  parseIncrements,
  priceMessageMicro,
  resolveRate,
  toMicroUnits,
  withErrorHandlingAndValidation,
  type BillingClient,
  type BillingConfig,
  type MeterDispatchInput,
  type UsageRecordRow
} from "@qcobro/common";
import { DB_METER, parseStoredOverrides, planFromCatalog } from "./meters.js";

/**
 * Prices and records one billable dispatch — the usage-ledger write that MUST
 * share the dispatch's transaction (a failed ledger write fails the dispatch).
 *
 * Message meters bill their exact unit price. Voice meters debit the configured
 * estimate (`voiceDebitEstimateSeconds`, never below the initial increment) and
 * freeze the rate + increments on the row so the completion webhook settles at
 * dispatch-time pricing even if the plan changed mid-call.
 *
 * Returns null without writing when the workspace is not enrolled (no
 * WorkspaceBilling row): unenrolled workspaces dispatch unmetered — this is
 * what makes gradual rollout/backfill safe.
 */
export async function meterDispatchTx(
  tx: BillingClient,
  billing: NonNullable<BillingConfig>,
  input: MeterDispatchInput
): Promise<UsageRecordRow | null> {
  const enrollment = await tx.workspaceBilling.findUnique({
    where: { workspaceRef: input.workspaceRef }
  });
  if (!enrollment) return null;

  const plan = planFromCatalog(billing, enrollment.planKey);
  const overrides = parseStoredOverrides(enrollment.rateOverrides);
  const at = new Date(input.at);

  let quantity: number;
  let unitPriceMicro: number;
  let amountMicro: number;
  let increments: string | null = null;

  if (isMessageMeter(input.meter)) {
    quantity = 1;
    unitPriceMicro = priceMessageMicro(resolveRate(input.meter, plan.rates, overrides));
    amountMicro = unitPriceMicro;
  } else {
    const rate = resolveRate(input.meter, plan.rates, overrides);
    const pair = parseIncrements(rate.increments);
    const estimateSeconds = Math.max(billing.voiceDebitEstimateSeconds, pair.initialSeconds);
    quantity = billedSeconds(estimateSeconds, pair);
    unitPriceMicro = toMicroUnits(rate.perMinute);
    amountMicro = estimateVoiceDebitMicro(rate, billing.voiceDebitEstimateSeconds);
    increments = rate.increments;
  }

  const record = await tx.usageRecord.create({
    data: {
      workspaceRef: input.workspaceRef,
      meter: DB_METER[input.meter],
      quantity,
      unitPriceMicro: BigInt(unitPriceMicro),
      amountMicro: BigInt(amountMicro),
      increments,
      campaignId: input.campaignId ?? null,
      portfolioAccountId: input.portfolioAccountId ?? null,
      providerRef: input.providerRef ?? null,
      at
    }
  });
  await tx.ledgerEntry.create({
    data: {
      workspaceRef: input.workspaceRef,
      kind: "USAGE_DEBIT",
      amountMicro: BigInt(-amountMicro),
      at,
      usageRecordId: record.id
    }
  });
  return record;
}

/** Factory: meter one dispatch in its own transaction (webhook/manual paths). */
export function createMeterDispatch(client: BillingClient, billing: NonNullable<BillingConfig>) {
  const fn = (input: MeterDispatchInput) =>
    client.$transaction((tx) => meterDispatchTx(tx, billing, input));
  return withErrorHandlingAndValidation(fn, meterDispatchSchema);
}
