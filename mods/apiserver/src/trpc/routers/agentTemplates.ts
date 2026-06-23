import { z } from "zod";
import {
  agentTypeSchema,
  createAgentTemplateSchema,
  updateAgentTemplateSchema,
  deleteAgentTemplateSchema,
  syncAgentTemplateSchema
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createCreateAgentTemplate } from "../../functions/agentTemplates/createAgentTemplate.js";
import { createUpdateAgentTemplate } from "../../functions/agentTemplates/updateAgentTemplate.js";
import { createDeleteAgentTemplate } from "../../functions/agentTemplates/deleteAgentTemplate.js";
import { createSyncAgentTemplate } from "../../functions/agentTemplates/syncAgentTemplate.js";

export const agentTemplatesRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({ type: agentTypeSchema.optional(), includeArchived: z.boolean().optional() })
        .optional()
    )
    .query(({ input, ctx }) =>
      ctx.prisma.agentTemplate.findMany({
        where: {
          workspaceRef: ctx.workspace.accessKeyId,
          ...(input?.type ? { type: input.type } : {}),
          ...(input?.includeArchived ? {} : { archivedAt: null })
        },
        orderBy: { createdAt: "desc" }
      })
    ),

  get: workspaceProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
    ctx.prisma.agentTemplate.findFirstOrThrow({
      where: { id: input.id, workspaceRef: ctx.workspace.accessKeyId },
      include: {
        voiceAiConfig: true,
        voicePrerecordedConfig: true,
        smsConfig: true,
        emailConfig: true,
        whatsAppConfig: true,
        campaigns: { orderBy: { createdAt: "desc" } }
      }
    })
  ),

  create: workspaceProcedure
    .input(createAgentTemplateSchema)
    .mutation(({ input, ctx }) =>
      createCreateAgentTemplate(
        ctx.prisma as never,
        ctx.workspace.accessKeyId,
        ctx.voiceApplications
      )(input)
    ),

  update: workspaceProcedure
    .input(updateAgentTemplateSchema)
    .mutation(({ input, ctx }) =>
      createUpdateAgentTemplate(
        ctx.prisma as never,
        ctx.workspace.accessKeyId,
        ctx.voiceApplications
      )(input)
    ),

  sync: workspaceProcedure
    .input(syncAgentTemplateSchema)
    .mutation(({ input, ctx }) =>
      createSyncAgentTemplate(
        ctx.prisma as never,
        ctx.workspace.accessKeyId,
        ctx.voiceApplications
      )(input)
    ),

  delete: workspaceProcedure
    .input(deleteAgentTemplateSchema)
    .mutation(({ input, ctx }) =>
      createDeleteAgentTemplate(ctx.prisma as never, ctx.workspace.accessKeyId)(input)
    )
});
