import { z } from "zod";
import { on } from "node:events";
import {
  agentTypeSchema,
  campaignStatusSchema,
  entregaSchema,
  resultadoSchema,
  createCampaignSchema,
  updateCampaignSchema,
  updateCampaignStatusSchema,
  deleteCampaignSchema,
  createContactLogSchema,
  updatePaymentPromiseSchema,
  followUpPaymentPromiseSchema,
  generateInsightInputSchema,
  recordingUrlForCall
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { config } from "../../config.js";
import { createCreateCampaign } from "../../functions/campaigns/createCampaign.js";
import { createUpdateCampaign } from "../../functions/campaigns/updateCampaign.js";
import { createUpdateCampaignStatus } from "../../functions/campaigns/updateCampaignStatus.js";
import { createDeleteCampaign } from "../../functions/campaigns/deleteCampaign.js";
import { createCreateContactLog } from "../../functions/campaigns/createContactLog.js";
import { createResolvePaymentPromise } from "../../functions/campaigns/resolvePaymentPromise.js";
import { createFollowUpPaymentPromise } from "../../functions/campaigns/followUpPaymentPromise.js";
import { createGenerateGestionInsight } from "../../functions/voice/generateGestionInsight.js";
import {
  contactLogEvents,
  CONTACT_LOG_CHANGED,
  type ContactLogChangeEvent
} from "../../services/contactLogEvents.js";

/** Gestión (contact-log) procedures scoped to the active workspace. */
const contactLogRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        entrega: entregaSchema.optional(),
        resultado: resultadoSchema.optional(),
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
        entrega: input.entrega,
        resultado: input.resultado,
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
            portfolioAccount: { select: { fullName: true, externalId: true, portfolioId: true } },
            campaign: { select: { name: true } }
          }
        }),
        ctx.prisma.accountContactLog.count({ where })
      ]);
      return { items, total };
    }),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const gestion = await ctx.prisma.accountContactLog.findFirstOrThrow({
      where: {
        id: input.id,
        portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
      },
      include: {
        portfolioAccount: true,
        campaign: { select: { name: true, agentTemplateId: true } },
        paymentPromises: { orderBy: { dueDate: "asc" } }
      }
    });

    // Recordings live in Fonoster, so the URL is derived from the deployment base URL
    // and the provider call ref rather than stored per row — changing the base fixes
    // every historical gestión at once. Falls back to whatever URL the provider reported
    // at completion time when no base URL is configured.
    const channelData = (gestion.channelData ?? {}) as Record<string, unknown>;
    const recordingUrl =
      recordingUrlForCall(gestion.providerRef, config.fonoster?.recordingBaseUrl) ??
      (typeof channelData.recordingUrl === "string" ? channelData.recordingUrl : undefined);

    return { ...gestion, recordingUrl: recordingUrl ?? null };
  }),

  create: workspaceProcedure
    .input(createContactLogSchema)
    .mutation(({ input, ctx }) => createCreateContactLog(ctx.prisma as never, ctx.timezone)(input)),

  // Generate (and persist) the AI analysis for a gestión from its transcript. The
  // gestión is workspace-scoped first; generation no-ops when insights are disabled,
  // the gestión has no transcript, or it was already analyzed.
  generateInsight: workspaceProcedure
    .input(generateInsightInputSchema)
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.accountContactLog.findFirstOrThrow({
        where: {
          id: input.id,
          portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
        }
      });
      return createGenerateGestionInsight({
        prisma: ctx.prisma as never,
        generator: ctx.insightGenerator
      })(input);
    }),

  // Realtime-streaming capability: streams a change signal — `{ id }`, never row data —
  // whenever a gestión (or a payment promise linked to one) in the caller's active
  // workspace is created or updated. Unfiltered (no `id`) for the Gestiones list; scoped to
  // one gestión (ownership-checked up front, same as `get`) for the Gestión detail view.
  // Clients react by invalidating/refetching `list`/`get` — this procedure never pushes data.
  onChange: workspaceProcedure
    .input(z.object({ id: z.string().optional() }))
    .subscription(async function* ({ ctx, input, signal }) {
      if (input.id) {
        await ctx.prisma.accountContactLog.findFirstOrThrow({
          where: {
            id: input.id,
            portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
          },
          select: { id: true }
        });
      }
      for await (const [event] of on(contactLogEvents, CONTACT_LOG_CHANGED, { signal })) {
        const change = event as ContactLogChangeEvent;
        if (change.workspaceRef !== ctx.workspace.accessKeyId) continue;
        if (input.id && change.id !== input.id) continue;
        yield { id: change.id };
      }
    })
});

/** Payment-promise (worklist) procedures scoped to the active workspace. */
const paymentPromiseRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          status: z.enum(["PENDING", "MET", "EXPIRED", "CANCELLED"]).optional(),
          portfolioId: z.string().optional()
        })
        .optional()
    )
    .query(({ input, ctx }) =>
      ctx.prisma.paymentPromise.findMany({
        where: {
          status: input?.status,
          portfolioAccount: {
            portfolioId: input?.portfolioId,
            portfolio: { workspaceRef: ctx.workspace.accessKeyId }
          }
        },
        orderBy: { dueDate: "asc" },
        include: {
          portfolioAccount: { select: { fullName: true, externalId: true, portfolioId: true } },
          contactLog: { select: { agentType: true } }
        }
      })
    ),

  // Operator resolution: MET (paid — feeds recoveredAmount) or CANCELLED. v1 manual-only.
  resolve: workspaceProcedure.input(updatePaymentPromiseSchema).mutation(async ({ input, ctx }) => {
    // Workspace-scope the target before mutating.
    await ctx.prisma.paymentPromise.findFirstOrThrow({
      where: {
        id: input.id,
        portfolioAccount: { portfolio: { workspaceRef: ctx.workspace.accessKeyId } }
      }
    });
    return createResolvePaymentPromise(ctx.prisma as never)(input);
  }),

  // Follow up via ad-hoc agent dispatch (no campaign attached).
  followUp: workspaceProcedure
    .input(followUpPaymentPromiseSchema)
    .mutation(({ input, ctx }) =>
      createFollowUpPaymentPromise(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    )
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

  updateStatus: workspaceProcedure
    .input(updateCampaignStatusSchema)
    .mutation(({ input, ctx }) =>
      createUpdateCampaignStatus(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  delete: workspaceProcedure
    .input(deleteCampaignSchema)
    .mutation(({ input, ctx }) =>
      createDeleteCampaign(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    ),

  contactLog: contactLogRouter,
  paymentPromise: paymentPromiseRouter
});
