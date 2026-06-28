import {
  isSameLocalDay,
  reserveAttemptSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type ReserveAttemptInput
} from "@qcobro/common";

/**
 * Reserves a campaign attempt by incrementing the counters BEFORE the provider call
 * (the engine's at-most-once step) — it writes no gestión. Always bumps the account's
 * `lastContactedAt`/`totalAttempts`; when a campaign initiated the contact it also
 * increments `CampaignAccountState`, resetting `attemptsToday` to 1 when the previous
 * attempt was on a different local day (in the caller-provided `timeZone`, normally the
 * workspace timezone), so the daily cap is correct without a midnight reset job.
 */
export async function reserveAttemptTx(
  tx: CampaignClient,
  params: ReserveAttemptInput,
  timeZone: string
): Promise<void> {
  const at = new Date(params.at);

  await tx.portfolioAccount.update({
    where: { id: params.portfolioAccountId },
    data: { lastContactedAt: at, totalAttempts: { increment: 1 } }
  });

  if (!params.campaignId) return;

  const key = {
    campaignId_portfolioAccountId: {
      campaignId: params.campaignId,
      portfolioAccountId: params.portfolioAccountId
    }
  };
  const existing = await tx.campaignAccountState.findUnique({ where: key });
  const sameDay = existing?.lastAttemptAt
    ? isSameLocalDay(existing.lastAttemptAt, at, timeZone)
    : false;
  const attemptsToday = sameDay ? existing!.attemptsToday + 1 : 1;

  await tx.campaignAccountState.upsert({
    where: key,
    create: {
      campaignId: params.campaignId,
      portfolioAccountId: params.portfolioAccountId,
      attemptCount: 1,
      attemptsToday: 1,
      lastAttemptAt: at
    },
    update: {
      attemptCount: { increment: 1 },
      attemptsToday,
      lastAttemptAt: at
    }
  });
}

/** Factory: reserve an attempt in its own transaction. */
export function createReserveAttempt(client: CampaignClient, timeZone: string) {
  const fn = (params: ReserveAttemptInput) =>
    client.$transaction((tx) => reserveAttemptTx(tx, params, timeZone));
  return withErrorHandlingAndValidation(fn, reserveAttemptSchema);
}
