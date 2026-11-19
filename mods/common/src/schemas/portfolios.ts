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
  // termsAmount and missedInstallments have no default: an omitted value means "not sent",
  // so the sync keeps the stored one instead of overwriting it with 0 (which would read as
  // every account catching up on all its installments).
  termsAmount: z.number().nonnegative().optional(),
  termsFrequency: z.string().optional(),
  termsLength: z.number().int().nonnegative().default(0),
  outstandingBalance: z.number().nonnegative(),
  daysPastDue: z.number().int().nonnegative().default(0),
  missedInstallments: z.number().int().nonnegative().optional(),
  lastPaymentDate: z.string().optional(),
  lastPaymentAmount: z.number().nonnegative().optional(),
  negotiationOptions: z.string().optional()
});
export type AccountRowInput = z.infer<typeof accountRowSchema>;

export const EXIT_REASONS = ["CAUGHT_UP", "PAID_OFF", "WRITTEN_OFF", "OTHER"] as const;
export type ExitReasonInput = (typeof EXIT_REASONS)[number];

// Why an account left a portfolio. CAUGHT_UP and PAID_OFF record a recovery of
// missedInstallments (the installments that were overdue and are now paid) × termsAmount, so
// both are required for those reasons; WRITTEN_OFF and OTHER need only the reason. The
// reason-dependent rules are checked by the enclosing schema so this stays a plain object.
export const exitEntrySchema = z.object({
  externalId: z.string().min(1),
  reason: z.enum(EXIT_REASONS, {
    error: "reason must be one of CAUGHT_UP, PAID_OFF, WRITTEN_OFF, OTHER"
  }),
  missedInstallments: z.number().int().optional(),
  termsAmount: z.number().optional()
});
export type ExitEntryInput = z.infer<typeof exitEntrySchema>;

/** Adds the reason-dependent issues for one exit entry at `path` (shared with classifyExits). */
export function checkExitEntry(
  entry: ExitEntryInput,
  path: (string | number)[],
  ctx: z.RefinementCtx
): void {
  if (entry.reason !== "CAUGHT_UP" && entry.reason !== "PAID_OFF") return;
  for (const field of ["missedInstallments", "termsAmount"] as const) {
    const value = entry[field];
    if (value === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [...path, field],
        message: "required when reason is CAUGHT_UP or PAID_OFF"
      });
    } else if (value <= 0) {
      ctx.addIssue({ code: "custom", path: [...path, field], message: "must be greater than 0" });
    }
  }
}

/** Adds an issue for every externalId repeated within `exits`. */
export function checkUniqueExits(exits: ExitEntryInput[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  exits.forEach((exit, i) => {
    if (seen.has(exit.externalId)) {
      ctx.addIssue({
        code: "custom",
        path: ["exits", i, "externalId"],
        message: `externalId "${exit.externalId}" appears twice in exits`
      });
    }
    seen.add(exit.externalId);
  });
}

// A batch may be empty only in REPLACE mode: a REPLACE batch is a full snapshot of the
// portfolio, so an empty snapshot legitimately means "this portfolio has no accounts now" and
// archives every existing one. For APPEND_ONLY and UPDATE_EXISTING a batch with neither rows
// nor exits changes nothing and is almost certainly a caller bug, so it is rejected; a batch
// of exits alone is valid in any mode.
export const syncAccountsInputSchema = z
  .object({
    portfolioId: z.string().min(1),
    mode: z.enum(["APPEND_ONLY", "UPDATE_EXISTING", "REPLACE"]),
    rows: z.array(accountRowSchema),
    exits: z.array(exitEntrySchema).default([])
  })
  .superRefine((input, ctx) => {
    if (input.mode !== "REPLACE" && input.rows.length === 0 && input.exits.length === 0) {
      ctx.addIssue({
        code: "too_small",
        origin: "array",
        minimum: 1,
        inclusive: true,
        input: input.rows,
        path: ["rows"],
        message: `rows and exits must not both be empty in ${input.mode} mode (only REPLACE accepts an empty batch)`
      });
    }
    const rowIds = new Set(input.rows.map((r) => r.externalId));
    input.exits.forEach((exit, i) => {
      if (rowIds.has(exit.externalId)) {
        ctx.addIssue({
          code: "custom",
          path: ["exits", i, "externalId"],
          message: `externalId "${exit.externalId}" appears in both rows and exits`
        });
      }
      checkExitEntry(exit, ["exits", i], ctx);
    });
    checkUniqueExits(input.exits, ctx);
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
