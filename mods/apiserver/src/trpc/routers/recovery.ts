import {
  recoveryBreakdownInputSchema,
  recoveryListInputSchema,
  recoverySummaryInputSchema
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { assertPortfolioInWorkspace } from "../portfolioScope.js";
import { createRecoverySummary } from "../../functions/recovery/summary.js";
import { createRecoveryBreakdown } from "../../functions/recovery/breakdown.js";
import { createRecoveryList } from "../../functions/recovery/list.js";

// Recuperado for a calendar period (`from`/`to` inclusive, in the workspace's timezone), for the
// whole workspace or one portfolio.
export const recoveryRouter = router({
  summary: workspaceProcedure.input(recoverySummaryInputSchema).query(async ({ input, ctx }) => {
    if (input.portfolioId) {
      await assertPortfolioInWorkspace(ctx.prisma, input.portfolioId, ctx.workspace.accessKeyId);
    }
    return createRecoverySummary(ctx.prisma as never, ctx.workspace.accessKeyId)(input);
  }),

  breakdown: workspaceProcedure
    .input(recoveryBreakdownInputSchema)
    .query(async ({ input, ctx }) => {
      if (input.portfolioId) {
        await assertPortfolioInWorkspace(ctx.prisma, input.portfolioId, ctx.workspace.accessKeyId);
      }
      return createRecoveryBreakdown(ctx.prisma as never, ctx.workspace.accessKeyId)(input);
    }),

  list: workspaceProcedure.input(recoveryListInputSchema).query(async ({ input, ctx }) => {
    if (input.portfolioId) {
      await assertPortfolioInWorkspace(ctx.prisma, input.portfolioId, ctx.workspace.accessKeyId);
    }
    return createRecoveryList(ctx.prisma as never, ctx.workspace.accessKeyId)(input);
  })
});
