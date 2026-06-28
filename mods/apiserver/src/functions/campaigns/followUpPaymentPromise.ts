import {
  followUpPaymentPromiseSchema,
  withErrorHandlingAndValidation,
  type AccountContactLogRecord,
  type CampaignClient,
  type FollowUpPaymentPromiseInput
} from "@qcobro/common";
import { recordOutcomeTx } from "./recordOutcome.js";

/**
 * Follow up on a payment promise with an ad-hoc agent dispatch — no campaign attached.
 * Writes a standalone gestión (`campaignId` null, the chosen `agentTemplateId`, and a link
 * to the promise) via {@link recordOutcomeTx}, which counts no attempt and — because there
 * is no `campaignId` — never creates or modifies a `CampaignAccountState`. The gestión is
 * recorded with a placeholder `OTHER` outcome that a later callback enriches, mirroring the
 * engine's dispatch-then-callback flow. Escalation is just choosing a firmer template.
 */
export function createFollowUpPaymentPromise(client: CampaignClient, workspaceRef: string) {
  const fn = (input: FollowUpPaymentPromiseInput) =>
    client.$transaction(async (tx): Promise<AccountContactLogRecord> => {
      const promise = await tx.paymentPromise.findFirst({
        where: {
          id: input.paymentPromiseId,
          portfolioAccount: { portfolio: { workspaceRef } }
        }
      });
      if (!promise) {
        throw new Error(`PaymentPromise ${input.paymentPromiseId} not found`);
      }

      const template = await tx.agentTemplate.findFirst({
        where: { id: input.agentTemplateId, workspaceRef }
      });
      if (!template) {
        throw new Error(`AgentTemplate ${input.agentTemplateId} not found`);
      }

      return recordOutcomeTx(tx, {
        portfolioAccountId: promise.portfolioAccountId,
        agentTemplateId: template.id,
        paymentPromiseId: promise.id,
        agentType: template.type,
        contactedAt: new Date().toISOString(),
        outcome: "OTHER"
      });
    });

  return withErrorHandlingAndValidation(fn, followUpPaymentPromiseSchema);
}
