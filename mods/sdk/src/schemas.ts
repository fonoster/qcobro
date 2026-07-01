import { z } from "zod";

// ── Portfolio schemas (mirrored from @qcobro/common so the SDK has no runtime
//    dependency on an unpublished internal package) ───────────────────────────

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120)
});

export const updatePortfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  archived: z.boolean().optional()
});

export const deletePortfolioSchema = z.object({
  id: z.string().min(1)
});

const accountRowSchema = z.object({
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

export const syncAccountsInputSchema = z.object({
  portfolioId: z.string().min(1),
  mode: z.enum(["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"]),
  rows: z.array(accountRowSchema).min(1)
});

// ── List/get/listAccounts (apiserver-inline shapes) ───────────────────────────

/** Input for `portfolios.list`. */
export const listPortfoliosSchema = z
  .object({
    includeArchived: z.boolean().optional()
  })
  .optional();
export type ListPortfoliosInput = z.infer<typeof listPortfoliosSchema>;

/** Input for `portfolios.get`. */
export const getPortfolioSchema = z.object({
  id: z.string().min(1)
});
export type GetPortfolioInput = z.infer<typeof getPortfolioSchema>;

/** Input for `portfolios.listAccounts`. */
export const listAccountsSchema = z.object({
  portfolioId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
});
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
