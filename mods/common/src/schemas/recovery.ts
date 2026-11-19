import { z } from "zod";
import { checkExitEntry, checkUniqueExits, EXIT_REASONS, exitEntrySchema } from "./portfolios.js";

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-13-01 and 2026-02-30). */
function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const time = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(v);
}

const dateString = z.string().refine(isCalendarDate, {
  error: (issue) => `invalid date "${String(issue.input)}" (use YYYY-MM-DD)`
});

// A calendar period: both dates inclusive, resolved in the workspace's timezone.
const period = { from: dateString, to: dateString };

function checkPeriod(input: { from: string; to: string }, ctx: z.RefinementCtx): void {
  if (isCalendarDate(input.from) && isCalendarDate(input.to) && input.from > input.to) {
    ctx.addIssue({ code: "custom", path: ["from"], message: "from must be on or before to" });
  }
}

const paging = {
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0)
};

export const RECOVERY_BREAKDOWN_DIMENSIONS = [
  "CAMPAIGN",
  "CHANNEL",
  "OUTCOME",
  "DAYS_SINCE_TOUCH"
] as const;

export const recoverySummaryInputSchema = z
  .object({ ...period, portfolioId: z.string().min(1).optional() })
  .superRefine(checkPeriod);
export type RecoverySummaryInput = z.infer<typeof recoverySummaryInputSchema>;

export const recoveryBreakdownInputSchema = z
  .object({
    ...period,
    by: z.enum(RECOVERY_BREAKDOWN_DIMENSIONS),
    portfolioId: z.string().min(1).optional()
  })
  .superRefine(checkPeriod);
export type RecoveryBreakdownInput = z.infer<typeof recoveryBreakdownInputSchema>;

export const recoveryListInputSchema = z
  .object({
    ...period,
    portfolioId: z.string().min(1).optional(),
    kind: z.enum(["PARTIAL", "CAUGHT_UP", "PAID_OFF"]).optional(),
    hasGestion: z.boolean().optional(),
    ...paging
  })
  .superRefine(checkPeriod);
export type RecoveryListInput = z.infer<typeof recoveryListInputSchema>;

export const listExitsInputSchema = z.object({
  portfolioId: z.string().min(1),
  reason: z.enum([...EXIT_REASONS, "UNKNOWN"]).optional(),
  ...paging
});
export type ListExitsInput = z.infer<typeof listExitsInputSchema>;

// Same entry rules as the sync's `exits`: CAUGHT_UP and PAID_OFF carry the installments now paid
// and the installment amount.
export const classifyExitsInputSchema = z
  .object({
    portfolioId: z.string().min(1),
    exits: z.array(exitEntrySchema).min(1).max(1000)
  })
  .superRefine((input, ctx) => {
    input.exits.forEach((exit, i) => checkExitEntry(exit, ["exits", i], ctx));
    checkUniqueExits(input.exits, ctx);
  });
export type ClassifyExitsInput = z.infer<typeof classifyExitsInputSchema>;
