import {
  createContactLogSchema,
  withErrorHandlingAndValidation,
  type CampaignClient,
  type CampaignTriggerRecord,
  type ContactOutcome,
  type CreateContactLogInput
} from "@qcobro/common";

/** Hard outcomes that set a global, cross-campaign `intentStatus`. */
function globalIntentFor(
  outcome: ContactOutcome
): "INTENT_MET" | "WRONG_NUMBER" | "OPT_OUT" | null {
  switch (outcome) {
    case "RESOLVED":
    case "PAID":
      return "INTENT_MET";
    case "WRONG_NUMBER":
      return "WRONG_NUMBER";
    case "OPT_OUT":
      return "OPT_OUT";
    default:
      return null;
  }
}

function triggerNumber(
  triggers: CampaignTriggerRecord[],
  type: CampaignTriggerRecord["type"],
  key: string,
  fallback: number
): number {
  const trigger = triggers.find((t) => t.type === type);
  const value = trigger?.config?.[key];
  return typeof value === "number" ? value : fallback;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Writes a gestión (contact log) entry and runs the hot-path updates the engine
 * relies on, all in one transaction:
 *
 * - Always: bump `PortfolioAccount.lastContactedAt` and `totalAttempts`.
 * - Hard outcomes (RESOLVED/PAID/WRONG_NUMBER/OPT_OUT): set the global
 *   `PortfolioAccount.intentStatus`, suppressing the account across all campaigns.
 * - Payment outcomes (PAYMENT_PROMISE / PARTIAL_PAYMENT_AGREED): create a linked
 *   `Objective` and set campaign-local `CampaignAccountState.suppressUntil` to the
 *   promised date (fallback `contactedAt + suppressDays`). The global suppression
 *   field is left untouched — other campaigns stay eligible.
 * - CALLBACK_REQUESTED: set campaign-local suppression to the requested time
 *   (fallback `now + suppressHours`).
 * - Per campaign: increment `CampaignAccountState` counters. Agent templates carry
 *   no denormalized counters — outreach is aggregated from contact logs at query time.
 */
export function createCreateContactLog(client: CampaignClient) {
  const fn = async (params: CreateContactLogInput) => {
    return client.$transaction(async (tx) => {
      const contactedAt = new Date(params.contactedAt);
      const meta = params.intentMetadata ?? {};

      const log = await tx.accountContactLog.create({
        data: {
          portfolioAccountId: params.portfolioAccountId,
          campaignId: params.campaignId ?? null,
          agentType: params.agentType,
          contactedAt,
          durationSeconds: params.durationSeconds ?? null,
          outcome: params.outcome,
          notes: params.notes ?? null,
          debtAmountSnapshot: params.debtAmountSnapshot ?? null,
          aiSummary: params.aiSummary ?? null,
          aiSentiment: params.aiSentiment ?? null,
          aiDebtReason: params.aiDebtReason ?? null,
          aiResult: params.aiResult ?? null,
          aiNextStep: params.aiNextStep ?? null,
          intentMetadata: params.intentMetadata ?? null,
          channelData: params.channelData ?? null
        }
      });

      // Global hot-path fields.
      const accountData: Record<string, unknown> = {
        lastContactedAt: contactedAt,
        totalAttempts: { increment: 1 }
      };
      const intentStatus = globalIntentFor(params.outcome);
      if (intentStatus) accountData.intentStatus = intentStatus;
      await tx.portfolioAccount.update({
        where: { id: params.portfolioAccountId },
        data: accountData
      });

      // Objective creation for payment outcomes.
      let promiseDueDate: Date | null = null;
      if (params.outcome === "PAYMENT_PROMISE") {
        const promisedDate =
          typeof meta.promisedDate === "string" ? new Date(meta.promisedDate) : null;
        const promisedAmount = typeof meta.promisedAmount === "number" ? meta.promisedAmount : null;
        promiseDueDate = promisedDate;
        await tx.objective.create({
          data: {
            contactLogId: log.id,
            portfolioAccountId: params.portfolioAccountId,
            type: "PAYMENT_PROMISE",
            amount: promisedAmount,
            dueDate: promisedDate ?? contactedAt,
            status: "PENDING"
          }
        });
      } else if (params.outcome === "PARTIAL_PAYMENT_AGREED") {
        const startDate = typeof meta.startDate === "string" ? new Date(meta.startDate) : null;
        const installmentAmount =
          typeof meta.installmentAmount === "number" ? meta.installmentAmount : null;
        promiseDueDate = startDate;
        await tx.objective.create({
          data: {
            contactLogId: log.id,
            portfolioAccountId: params.portfolioAccountId,
            type: "PARTIAL_PAYMENT",
            amount: installmentAmount,
            dueDate: startDate ?? contactedAt,
            status: "PENDING"
          }
        });
      }

      // Campaign-scoped updates (only when a campaign initiated the contact).
      if (params.campaignId) {
        const triggers = await tx.campaignTrigger.findMany({
          where: { campaignId: params.campaignId }
        });

        let suppressUntil: Date | null = null;
        if (params.outcome === "PAYMENT_PROMISE" || params.outcome === "PARTIAL_PAYMENT_AGREED") {
          const suppressDays = triggerNumber(triggers, "PAYMENT_PROMISE", "suppressDays", 7);
          suppressUntil = promiseDueDate ?? addDays(contactedAt, suppressDays);
        } else if (params.outcome === "CALLBACK_REQUESTED") {
          const requested =
            typeof meta.requestedDate === "string" ? new Date(meta.requestedDate) : null;
          const suppressHours = triggerNumber(triggers, "CALLBACK_REQUESTED", "suppressHours", 24);
          suppressUntil = requested ?? addHours(contactedAt, suppressHours);
        }

        await tx.campaignAccountState.upsert({
          where: {
            campaignId_portfolioAccountId: {
              campaignId: params.campaignId,
              portfolioAccountId: params.portfolioAccountId
            }
          },
          create: {
            campaignId: params.campaignId,
            portfolioAccountId: params.portfolioAccountId,
            attemptCount: 1,
            attemptsToday: 1,
            lastAttemptAt: contactedAt,
            suppressUntil
          },
          update: {
            attemptCount: { increment: 1 },
            attemptsToday: { increment: 1 },
            lastAttemptAt: contactedAt,
            ...(suppressUntil ? { suppressUntil } : {})
          }
        });
      }

      return log;
    });
  };

  return withErrorHandlingAndValidation(fn, createContactLogSchema);
}
