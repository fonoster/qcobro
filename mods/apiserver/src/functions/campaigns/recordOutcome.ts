import {
  createContactLogSchema,
  withErrorHandlingAndValidation,
  type AccountContactLogRecord,
  type CampaignClient,
  type CampaignTriggerRecord,
  type Resultado,
  type CreateContactLogInput
} from "@qcobro/common";

/**
 * Hard resultados that set a global, cross-campaign `intentStatus`. `OPT_OUT` and
 * `WRONG_PARTY` are recorded on the gestión and set no account flag — the engine does not
 * infer suppression from an identity/opt-out claim made during an interaction (that is an
 * explicit, labelled decision on the workspace Do Not Contact list; see issue #101).
 */
function globalIntentFor(resultado: Resultado | null): "INTENT_MET" | null {
  switch (resultado) {
    case "RESOLVED":
    case "PAID":
      return "INTENT_MET";
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

/**
 * Parse a date the LLM autopilot extracted from free text into a *valid* Date, or null.
 * Vague replies ("mañana", "next week") yield an Invalid Date — which is a Date object, not
 * null, so it would slip past a `?? fallback` guard and reach Prisma as `new Date("Invalid
 * Date")`. Collapse those to null so callers fall back to a real date.
 */
function parseValidDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    entrega: params.entrega,
    deliveryReason: params.deliveryReason ?? null,
    camino: params.camino ?? null,
    resultado: params.resultado ?? null,
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

/** Resultados that imply a payment commitment QCobro can adjudicate (→ a PaymentPromise). */
function isPaymentOutcome(resultado: Resultado | null): boolean {
  return resultado === "PAYMENT_PROMISE";
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
  effectiveResultado: Resultado | null
): Promise<void> {
  const contactedAt = new Date(params.contactedAt);
  const meta = params.intentMetadata ?? {};

  // Global hard-resultado suppression.
  const intentStatus = globalIntentFor(effectiveResultado);
  if (intentStatus) {
    await tx.portfolioAccount.update({
      where: { id: params.portfolioAccountId },
      data: { intentStatus }
    });
  }

  // PaymentPromise for payment resultados only — guarded so a re-delivered resultado doesn't
  // duplicate (one promise per gestión). Non-payment resultados create no tracked entity.
  let promiseDueDate: Date | null = null;
  const isPayment = isPaymentOutcome(effectiveResultado);

  if (isPayment) {
    const amount = typeof meta.promisedAmount === "number" ? meta.promisedAmount : null;
    promiseDueDate = parseValidDate(meta.promisedDate);

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

  // Campaign-local suppression from the resultado (Lever B).
  if (params.campaignId) {
    const triggers = await tx.campaignTrigger.findMany({
      where: { campaignId: params.campaignId }
    });

    let suppressUntil: Date | null = null;
    if (isPayment) {
      const suppressDays = triggerNumber(triggers, "PAYMENT_PROMISE", "suppressDays", 7);
      suppressUntil = promiseDueDate ?? addDays(contactedAt, suppressDays);
    } else if (effectiveResultado === "CALLBACK_REQUESTED") {
      const requested = parseValidDate(meta.requestedDate);
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
 * (one gestión per attempt). `entrega` only ever advances — once a prior callback moved it
 * off `DISPATCHED` (to `DELIVERED` or `FAILED`), a later write SHALL NOT move it back to
 * `DISPATCHED` or flip it between `DELIVERED`/`FAILED`; its `deliveryReason` travels with it.
 * `camino`/`resultado` merge forward: a null incoming value never overwrites a non-null
 * stored value. When no `providerRef` is given, a new gestión is always created.
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
  let effectiveResultado: Resultado | null = params.resultado ?? null;

  if (existing) {
    const data = logData(params, contactedAt);

    // entrega only ever advances: once it has left DISPATCHED it is never changed again.
    if (existing.entrega !== "DISPATCHED") {
      data.entrega = existing.entrega;
      data.deliveryReason = existing.deliveryReason;
    }

    // Enrichment arrives piecemeal from several sources — the dispatch writes the template and
    // notes, the channel webhook writes the duration, the AI pass writes the insights — and
    // each one calls this with only the fields it knows. `logData` rebuilds every column from
    // the input, so without merging forward, whichever source lands last would null everything
    // the others recorded (e.g. a Voz IA outcome decision wiping the duration stored moments
    // earlier by `ingestVoiceEvent`). A later signal may add a value or replace one, never
    // erase one.
    const MERGE_FORWARD = [
      "campaignId",
      "agentTemplateId",
      "paymentPromiseId",
      "durationSeconds",
      "notes",
      "debtAmountSnapshot",
      "aiSummary",
      "aiSentiment",
      "aiDebtReason",
      "aiResult",
      "aiNextStep",
      "intentMetadata",
      "camino",
      "resultado"
    ] as const;
    const prior = existing as unknown as Record<string, unknown>;
    for (const field of MERGE_FORWARD) {
      data[field] = data[field] ?? prior[field] ?? null;
    }
    effectiveResultado = data.resultado as Resultado | null;

    // Preserve the original correlation + merge channel data.
    data.providerRef = existing.providerRef;
    data.channelData = { ...(existing.channelData ?? {}), ...(params.channelData ?? {}) };
    log = await tx.accountContactLog.update({ where: { id: existing.id }, data });
  } else {
    log = await tx.accountContactLog.create({ data: logData(params, contactedAt) });
  }

  await applyOutcomeEffectsTx(tx, log, params, effectiveResultado);
  return log;
}

/** Factory: record/enrich a gestión in its own transaction. */
export function createRecordOutcome(client: CampaignClient) {
  const fn = (params: CreateContactLogInput) =>
    client.$transaction((tx) => recordOutcomeTx(tx, params));
  return withErrorHandlingAndValidation(fn, createContactLogSchema);
}
