import { z } from "zod";

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120)
});
export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

export const updatePortfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  // `archived` toggles the portfolio's archived state: true sets `archivedAt` to
  // now, false clears it (restore). There is no separate status concept.
  archived: z.boolean().optional()
});
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

export const deletePortfolioSchema = z.object({
  id: z.string().min(1)
});
export type DeletePortfolioInput = z.infer<typeof deletePortfolioSchema>;

export const accountRowSchema = z.object({
  externalId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  preferredLanguage: z.string().optional(),
  bestTimeToCall: z.string().optional(),
  customerSegment: z.string().optional(),
  principalAmount: z.number().nonnegative().default(0),
  termsAmount: z.number().nonnegative().default(0),
  termsFrequency: z.string().optional(),
  termsLength: z.number().int().nonnegative().default(0),
  outstandingBalance: z.number().nonnegative(),
  daysPastDue: z.number().int().nonnegative().default(0),
  missedInstallments: z.number().int().nonnegative().default(0),
  lastPaymentDate: z.string().optional(),
  lastPaymentAmount: z.number().nonnegative().optional(),
  negotiationOptions: z.string().optional()
});
export type AccountRowInput = z.infer<typeof accountRowSchema>;

export const syncAccountsInputSchema = z.object({
  portfolioId: z.string().min(1),
  mode: z.enum(["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"]),
  rows: z.array(accountRowSchema).min(1)
});
export type SyncAccountsInput = z.infer<typeof syncAccountsInputSchema>;
