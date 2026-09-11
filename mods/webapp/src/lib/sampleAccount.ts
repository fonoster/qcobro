import type { PortfolioAccountRecord } from "@qcobro/common";

/**
 * A stand-in account for previewing a template that isn't bound to a real one yet.
 *
 * Invented, never real customer data. The name is deliberately one that *breaks* GSM-7
 * (`í`): the whole point of the SMS segment hint is that a substituted value, not the
 * template's own text, is usually what doubles a message's cost, so a sample with a plain
 * ASCII name would quietly hide the case the operator most needs to see.
 *
 * The DB-bookkeeping fields exist only to satisfy `PortfolioAccountRecord`; nothing reads
 * them. `buildOutreachContext` uses `fullName` for `firstName`, `daysPastDue` for `isDue`,
 * and formats the money fields for the workspace locale.
 */
const EPOCH = new Date(0);

export const SAMPLE_ACCOUNT: PortfolioAccountRecord = {
  id: "sample",
  portfolioId: "sample",
  externalId: "SAMPLE-0001",
  fullName: "María Rodríguez",
  phone: "+18095550123",
  preferredLanguage: null,
  bestTimeToCall: null,
  customerSegment: null,
  principalAmount: 12000,
  termsAmount: 1250,
  termsFrequency: "MONTHLY",
  termsLength: 12,
  outstandingBalance: 9500,
  daysPastDue: 18,
  missedInstallments: 2,
  lastPaymentDate: EPOCH,
  lastPaymentAmount: 1250,
  negotiationOptions: null,
  archivedAt: null,
  createdAt: EPOCH,
  updatedAt: EPOCH
};
