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

// `rows` may be empty only in REPLACE mode: a REPLACE batch is a full snapshot of the
// portfolio, so an empty snapshot legitimately means "this portfolio has no accounts now" and
// archives every existing one. For APPEND_ONLY and UPDATE_EXISTING an empty batch changes
// nothing and is almost certainly a caller bug, so it is still rejected.
export const syncAccountsInputSchema = z
  .object({
    portfolioId: z.string().min(1),
    mode: z.enum(["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"]),
    rows: z.array(accountRowSchema)
  })
  .superRefine((input, ctx) => {
    if (input.mode !== "REPLACE" && input.rows.length === 0) {
      ctx.addIssue({
        code: "too_small",
        origin: "array",
        minimum: 1,
        inclusive: true,
        input: input.rows,
        path: ["rows"],
        message: `rows must not be empty in ${input.mode} mode (only REPLACE accepts an empty batch)`
      });
    }
  });
export type SyncAccountsInput = z.infer<typeof syncAccountsInputSchema>;

// Window a contact-rate query can be computed over. 7 days is the default: a whole number of
// weeks (collections activity has a weekday shape, so a window that isn't a multiple of 7 mixes
// weekday compositions as it slides) balancing responsiveness against week-over-week stability.
// 28 rather than 30 for the same reason. 24h is noisy but is the one window that catches a
// same-day provider outage.
export const contactStatsPeriodSchema = z.enum(["24h", "7d", "14d", "28d"]);
export type ContactStatsPeriod = z.infer<typeof contactStatsPeriodSchema>;

export const contactStatsInputSchema = z.object({
  period: contactStatsPeriodSchema.default("7d")
});
export type ContactStatsInput = z.infer<typeof contactStatsInputSchema>;
