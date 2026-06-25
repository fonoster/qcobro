import {
  createContactLogSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type CreateContactLogInput
} from "@qcobro/common";
import { reserveAttemptTx } from "./reserveAttempt.js";
import { recordOutcomeTx } from "./recordOutcome.js";

/**
 * Writes a gestión and counts the attempt in one transaction — the combined
 * reserve + record used by the operator console's manual gestión-create and the
 * external contact-log ingress (callers that record an attempt and its outcome
 * together). The engine instead calls {@link reserveAttemptTx} before dispatch and
 * {@link recordOutcomeTx} after, so it gets at-most-once.
 *
 * `timeZone` drives the daily-cap reset (see {@link reserveAttemptTx}).
 */
export function createCreateContactLog(client: CampaignClient, timeZone: string) {
  const fn = (params: CreateContactLogInput) =>
    client.$transaction(async (tx) => {
      await reserveAttemptTx(
        tx,
        {
          campaignId: params.campaignId,
          portfolioAccountId: params.portfolioAccountId,
          at: params.contactedAt
        },
        timeZone
      );
      return recordOutcomeTx(tx, params);
    });

  return withErrorHandlingAndValidation(fn, createContactLogSchema);
}
