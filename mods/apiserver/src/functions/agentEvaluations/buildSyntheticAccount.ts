import {
  buildOutreachContext,
  type EvalAccountInput,
  type PortfolioAccountRecord
} from "@qcobro/common";

/** A fixed, deterministic clock for the synthetic account's bookkeeping timestamps —
 * eval runs never touch real portfolio data, so these values are never read back. */
const EPOCH = new Date(0);

/**
 * Builds the render context an eval scenario runs against, reusing
 * `buildOutreachContext` unchanged — the same function a real dispatch uses — rather than
 * re-implementing context assembly for eval. `buildOutreachContext` needs a full
 * `PortfolioAccountRecord`; this fills the DB-bookkeeping fields an eval author never
 * supplies (`id`, `portfolioId`, `externalId`, timestamps) with synthetic placeholders.
 */
export function buildSyntheticAccountContext(account: EvalAccountInput): Record<string, unknown> {
  const record: PortfolioAccountRecord = {
    id: "eval",
    portfolioId: "eval",
    externalId: "eval",
    fullName: account.fullName,
    phone: null,
    preferredLanguage: account.preferredLanguage ?? null,
    bestTimeToCall: account.bestTimeToCall ?? null,
    customerSegment: account.customerSegment ?? null,
    principalAmount: account.principalAmount,
    termsAmount: account.termsAmount,
    termsFrequency: account.termsFrequency ?? null,
    termsLength: account.termsLength,
    outstandingBalance: account.outstandingBalance,
    daysPastDue: account.daysPastDue,
    missedInstallments: account.missedInstallments,
    lastPaymentDate: account.lastPaymentDate ? new Date(account.lastPaymentDate) : null,
    lastPaymentAmount: account.lastPaymentAmount ?? null,
    negotiationOptions: null,
    archivedAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH
  };
  return buildOutreachContext(record, { currency: account.currency });
}
