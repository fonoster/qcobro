import { z } from "zod";
import {
  agentTypeSchema,
  campaignStatusSchema,
  contactOutcomeSchema,
  createCampaignSchema,
  updateCampaignSchema,
  deleteCampaignSchema,
  createContactLogSchema,
  updateObjectiveSchema
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createCreateCampaign } from "../../functions/campaigns/createCampaign.js";
import { createUpdateCampaign } from "../../functions/campaigns/updateCampaign.js";
import { createDeleteCampaign } from "../../functions/campaigns/deleteCampaign.js";
import { createCreateContactLog } from "../../functions/campaigns/createContactLog.js";

/** Gestión (contact-log) procedures scoped to the active workspace. */
const contactLogRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        outcome: contactOutcomeSchema.optional(),
        agentType: agentTypeSchema.optional(),
        portfolioId: z.string().optional(),
        campaignId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0)
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        portfolioAccount: {
          portfolioId: input.portfolioId,
          portfolio: { workspaceRef: ctx.workspace.accessKeyId }
        },
        outcome: input.outcome,
        agentType: input.agentType,
        campaignId: input.campaignId,
        ...(input.from || input.to
          ? {
              contactedAt: {
                ...(input.from ? { gte: new Date(input.from) } : {}),
                ...(input.to ? { lte: new Date(input.to) } : {})
              }
            }
          : {})
      };
      const [items, total] = await ctx.prisma.$transaction([
        ctx.prisma.accountContactLog.findMany({
          where,
          orderBy: { contactedAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            portfolioAccount: { select: { fullName: true, portfolioId: true } },
            campaign: { select: { name: true } }
          }
        }),
        ctx.prisma.accountContactLog.count({ where })
      ]);
      return { items, total };
    }),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.accountContactLog.findFirstOrThrow({
      where: {
        id: input.id,
        portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
      },
      include: {
        portfolioAccount: true,
        campaign: { select: { name: true, agentTemplateId: true } },
        objectives: { orderBy: { dueDate: "asc" } }
      }
    })
  ),

  create: workspaceProcedure
    .input(createContactLogSchema)
    .mutation(({ input, ctx }) => createCreateContactLog(ctx.prisma as never)(input))
});

/** Objective procedures scoped to the active workspace. */
const objectiveRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          status: z.enum(["PENDING", "MET", "BROKEN", "CANCELLED"]).optional(),
          portfolioId: z.string().optional()
        })
        .optional()
    )
    .query(({ input, ctx }) =>
      ctx.prisma.objective.findMany({
        where: {
          status: input?.status,
          portfolioAccount: {
            portfolioId: input?.portfolioId,
            portfolio: { workspaceRef: ctx.workspace.accessKeyId }
          }
        },
        orderBy: { dueDate: "asc" },
        include: { portfolioAccount: { select: { fullName: true, portfolioId: true } } }
      })
    ),

  updateStatus: workspaceProcedure.input(updateObjectiveSchema).mutation(async ({ input, ctx }) => {
    // Workspace-scope the target before mutating.
    await ctx.prisma.objective.findFirstOrThrow({
      where: {
        id: input.id,
        portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
      }
    });
    return ctx.prisma.objective.update({
      where: { id: input.id },
      data: { status: input.status }
    });
  })
});

export const campaignsRouter = router({
  list: workspaceProcedure
    .input(z.object({ status: campaignStatusSchema.optional() }).optional())
    .query(({ input, ctx }) =>
      ctx.prisma.campaign.findMany({
        where: {
          workspaceRef: ctx.workspace.accessKeyId,
          status: input?.status ?? { notIn: ["ARCHIVED"] }
        },
        orderBy: { createdAt: "desc" },
        include: { agentTemplate: { select: { name: true, type: true } } }
      })
    ),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.campaign.findFirstOrThrow({
      where: { id: input.id, workspaceRef: ctx.workspace.accessKeyId },
      include: {
        agentTemplate: true,
        triggers: true,
        portfolios: { include: { portfolio: { select: { id: true, name: true } } } },
        contactLogs: {
          orderBy: { contactedAt: "desc" },
          take: 50,
          include: { portfolioAccount: { select: { fullName: true } } }
        }
      }
    })
  ),

  create: workspaceProcedure
    .input(createCampaignSchema)
    .mutation(({ input, ctx }) =>
      createCreateCampaign(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  update: workspaceProcedure
    .input(updateCampaignSchema)
    .mutation(({ input, ctx }) =>
      createUpdateCampaign(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  delete: workspaceProcedure
    .input(deleteCampaignSchema)
    .mutation(({ input, ctx }) =>
      createDeleteCampaign(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  contactLog: contactLogRouter,
  objective: objectiveRouter
});
