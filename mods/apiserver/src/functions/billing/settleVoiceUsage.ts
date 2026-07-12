import {
  billedSeconds,
  parseIncrements,
  settleVoiceUsageSchema,
  withErrorHandlingAndValidation,
  type BillingClient,
  type SettleVoiceUsageInput,
  type UsageRecordRow
} from "@qcobro/common";

/**
 * Settles a voice usage record to its actual answered duration: corrects the
 * row's quantity/amount and writes the signed ADJUSTMENT ledger entry so the
 * net charge equals the increment-billed amount (unanswered → net zero).
 *
 * Idempotent per call ref: an already-settled record (or one whose ref matches
 * no voice usage) is a no-op — completion webhooks are fire-and-forget and may
 * replay. Prices with the rate + increments frozen on the row at dispatch.
 */
export async function settleVoiceUsageTx(
  tx: BillingClient,
  input: SettleVoiceUsageInput
): Promise<UsageRecordRow | null> {
  const record = await tx.usageRecord.findUnique({ where: { providerRef: input.providerRef } });
  if (!record || !record.increments || record.settledAt) return null;

  const seconds = billedSeconds(input.answeredSeconds, parseIncrements(record.increments));
  const unitPriceMicro = Number(record.unitPriceMicro);
  const estimatedMicro = Number(record.amountMicro);
  const actualMicro = Math.round((seconds * unitPriceMicro) / 60);
  const at = new Date(input.at);

  const updated = await tx.usageRecord.update({
    where: { id: record.id },
    data: { quantity: seconds, amountMicro: BigInt(actualMicro), settledAt: at }
  });
  const deltaMicro = estimatedMicro - actualMicro;
  if (deltaMicro !== 0) {
    // The (usageRecordId, kind) unique makes a racing double-settle impossible.
    await tx.ledgerEntry.create({
      data: {
        workspaceRef: record.workspaceRef,
        kind: "ADJUSTMENT",
        amountMicro: BigInt(deltaMicro),
        at,
        usageRecordId: record.id
      }
    });
  }
  return updated;
}

/** Factory: settle one voice usage in its own transaction. */
export function createSettleVoiceUsage(client: BillingClient) {
  const fn = (input: SettleVoiceUsageInput) =>
    client.$transaction((tx) => settleVoiceUsageTx(tx, input));
  return withErrorHandlingAndValidation(fn, settleVoiceUsageSchema);
}
