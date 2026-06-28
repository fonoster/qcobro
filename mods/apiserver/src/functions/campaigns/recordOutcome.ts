import {
  createContactLogSchema,
  withErrorHandlingAndValidation,
  type AccountContactLogRecord,
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

/** The columns a gestión carries, derived from the input (minus correlation). */
function logData(params: CreateContactLogInput, contactedAt: Date): Record<string, unknown> {
  return {
    portfolioAccountId: params.portfolioAccountId,
    campaignId: params.campaignId ?? null,
    agentTemplateId: params.agentTemplateId ?? null,
    paymentPromiseId: params.paymentPromiseId ?? null,
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
    channelData: params.channelData ?? null,
    providerRef: params.providerRef ?? null
  };
}

/** Outcomes that imply a payment commitment QCobro can adjudicate (→ a PaymentPromise). */
function isPaymentOutcome(outcome: ContactOutcome): boolean {
  return outcome === "PAYMENT_PROMISE" || outcome === "PARTIAL_PAYMENT_AGREED";
}

/**
 * Applies the outcome-driven effects of a gestión (no attempt counting — that is
 * {@link reserveAttempt}'s job): the global `intentStatus` on hard outcomes, a linked
 * `PaymentPromise` for payment outcomes only (idempotent via the `@@unique([contactLogId])`
 * guard), and the campaign-local `suppressUntil` (Lever B), fed by the promise due date or
 * a requested callback time.
 */
async function applyOutcomeEffectsTx(
  tx: CampaignClient,
  log: AccountContactLogRecord,
  params: CreateContactLogInput,
  effectiveOutcome: ContactOutcome
): Promise<void> {
  const contactedAt = new Date(params.contactedAt);
  const meta = params.intentMetadata ?? {};

  // Global hard-outcome suppression.
  const intentStatus = globalIntentFor(effectiveOutcome);
  if (intentStatus) {
    await tx.portfolioAccount.update({
      where: { id: params.portfolioAccountId },
      data: { intentStatus }
    });
  }

  // PaymentPromise for payment outcomes only — guarded so a re-delivered outcome doesn't
  // duplicate (one promise per gestión). Non-payment outcomes create no tracked entity.
  let promiseDueDate: Date | null = null;
  const isPayment = isPaymentOutcome(effectiveOutcome);

  if (isPayment) {
    const amount =
      effectiveOutcome === "PAYMENT_PROMISE"
        ? typeof meta.promisedAmount === "number"
          ? meta.promisedAmount
          : null
        : typeof meta.installmentAmount === "number"
          ? meta.installmentAmount
          : null;
    const dateStr = effectiveOutcome === "PAYMENT_PROMISE" ? meta.promisedDate : meta.startDate;
    promiseDueDate = typeof dateStr === "string" ? new Date(dateStr) : null;

    const existing = await tx.paymentPromise.findFirst({
      where: { contactLogId: log.id }
    });
    if (!existing) {
      await tx.paymentPromise.create({
        data: {
          contactLogId: log.id,
          portfolioAccountId: params.portfolioAccountId,
          amount,
          dueDate: promiseDueDate ?? contactedAt,
          status: "PENDING"
        }
      });
    }
  }

  // Campaign-local suppression from the outcome (Lever B).
  if (params.campaignId) {
    const triggers = await tx.campaignTrigger.findMany({
      where: { campaignId: params.campaignId }
    });

    let suppressUntil: Date | null = null;
    if (isPayment) {
      const suppressDays = triggerNumber(triggers, "PAYMENT_PROMISE", "suppressDays", 7);
      suppressUntil = promiseDueDate ?? addDays(contactedAt, suppressDays);
    } else if (effectiveOutcome === "CALLBACK_REQUESTED") {
      const requested =
        typeof meta.requestedDate === "string" ? new Date(meta.requestedDate) : null;
      const suppressHours = triggerNumber(triggers, "CALLBACK_REQUESTED", "suppressHours", 24);
      suppressUntil = requested ?? addHours(contactedAt, suppressHours);
    }

    if (suppressUntil) {
      await tx.campaignAccountState.upsert({
        where: {
          campaignId_portfolioAccountId: {
            campaignId: params.campaignId,
            portfolioAccountId: params.portfolioAccountId
          }
        },
        // Reserve normally creates the row first; guard the create branch with zeroed
        // counters in case an outcome arrives without a prior reservation.
        create: {
          campaignId: params.campaignId,
          portfolioAccountId: params.portfolioAccountId,
          attemptCount: 0,
          attemptsToday: 0,
          suppressUntil
        },
        update: { suppressUntil }
      });
    }
  }
}

/**
 * Writes (or enriches) the single gestión for an attempt and applies its outcome
 * effects — but does NOT count the attempt ({@link reserveAttempt} owns counters).
 *
 * Correlated by `providerRef`: when a row with that ref exists, it is enriched in place
 * (one gestión per attempt). A dispatch-time placeholder (`OTHER`) SHALL NOT downgrade a
 * real outcome already recorded by an earlier callback. When no `providerRef` is given,
 * a new gestión is always created.
 */
export async function recordOutcomeTx(
  tx: CampaignClient,
  params: CreateContactLogInput
): Promise<AccountContactLogRecord> {
  const contactedAt = new Date(params.contactedAt);
  const existing = params.providerRef
    ? await tx.accountContactLog.findFirst({ where: { providerRef: params.providerRef } })
    : null;

  let log: AccountContactLogRecord;
  let effectiveOutcome: ContactOutcome = params.outcome;

  if (existing) {
    // Never downgrade: a placeholder OTHER must not overwrite a recorded real outcome.
    effectiveOutcome =
      params.outcome === "OTHER" && existing.outcome !== "OTHER"
        ? existing.outcome
        : params.outcome;
    const data = logData(params, contactedAt);
    data.outcome = effectiveOutcome;
    // Preserve the original correlation + merge channel data.
    data.providerRef = existing.providerRef;
    data.channelData = { ...(existing.channelData ?? {}), ...(params.channelData ?? {}) };
    log = await tx.accountContactLog.update({ where: { id: existing.id }, data });
  } else {
    log = await tx.accountContactLog.create({ data: logData(params, contactedAt) });
  }

  await applyOutcomeEffectsTx(tx, log, params, effectiveOutcome);
  return log;
}

/** Factory: record/enrich a gestión in its own transaction. */
export function createRecordOutcome(client: CampaignClient) {
  const fn = (params: CreateContactLogInput) =>
    client.$transaction((tx) => recordOutcomeTx(tx, params));
  return withErrorHandlingAndValidation(fn, createContactLogSchema);
}
