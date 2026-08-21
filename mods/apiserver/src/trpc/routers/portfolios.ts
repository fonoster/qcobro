import { z } from "zod";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema,
  contactStatsInputSchema
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createCreatePortfolio } from "../../functions/portfolios/createPortfolio.js";
import { createUpdatePortfolio } from "../../functions/portfolios/updatePortfolio.js";
import { createDeletePortfolio } from "../../functions/portfolios/deletePortfolio.js";
import { createSyncAccounts } from "../../functions/portfolios/syncAccounts.js";
import { createContactStats } from "../../functions/portfolios/contactStats.js";

export const portfoliosRouter = router({
  list: workspaceProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).optional())
    .query(({ input, ctx }) =>
      ctx.prisma.portfolio.findMany({
        where: {
          workspaceRef: ctx.workspace.accessKeyId,
          ...(input?.includeArchived ? {} : { archivedAt: null })
        },
        orderBy: { createdAt: "desc" }
      })
    ),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.portfolio.findFirstOrThrow({
      where: { id: input.id, workspaceRef: ctx.workspace.accessKeyId }
    })
  ),

  // Windowed contact rate for the selected period (defaults to 7 days): accounts attempted
  // vs. accounts actually reached, plus total gestión volume for the same window. `input` is
  // optional so an existing caller that omits it (e.g. `useQuery()` with no args) keeps working
  // unchanged at the default period.
  contactStats: workspaceProcedure
    .input(contactStatsInputSchema.optional())
    .query(({ input, ctx }) =>
      createContactStats(ctx.prisma as never, ctx.workspace.accessKeyId)(input ?? {})
    ),

  create: workspaceProcedure
    .input(createPortfolioSchema)
    .mutation(({ input, ctx }) =>
      createCreatePortfolio(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  update: workspaceProcedure
    .input(updatePortfolioSchema)
    .mutation(({ input, ctx }) =>
      createUpdatePortfolio(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  delete: workspaceProcedure
    .input(deletePortfolioSchema)
    .mutation(({ input, ctx }) =>
      createDeletePortfolio(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  listAccounts: workspaceProcedure
    .input(
      z.object({
        portfolioId: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0)
      })
    )
    .query(async ({ input, ctx }) => {
      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.portfolioAccount.findMany({
          where: { portfolioId: input.portfolioId, archivedAt: null },
          orderBy: { fullName: "asc" },
          take: input.limit,
          skip: input.offset
        }),
        ctx.prisma.portfolioAccount.count({
          where: { portfolioId: input.portfolioId, archivedAt: null }
        })
      ]);
      return { items, total };
    }),

  syncAccounts: workspaceProcedure
    .input(syncAccountsInputSchema)
    .mutation(({ input, ctx }) => createSyncAccounts(ctx.prisma as never)(input))
});
