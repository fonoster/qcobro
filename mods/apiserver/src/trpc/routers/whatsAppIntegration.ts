import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  addWhatsAppSenderNumberSchema,
  removeWhatsAppSenderNumberSchema,
  upsertWhatsAppIntegrationSchema
} from "@qcobro/common";
import { router, workspaceProcedure, adminProcedure } from "../trpc.js";
import { config } from "../../config.js";
import { createGetWhatsAppIntegration } from "../../functions/whatsApp/getWhatsAppIntegration.js";
import { createUpsertWhatsAppIntegration } from "../../functions/whatsApp/upsertWhatsAppIntegration.js";
import { createAddWhatsAppSenderNumber } from "../../functions/whatsApp/addWhatsAppSenderNumber.js";
import { createListWhatsAppSenderNumbers } from "../../functions/whatsApp/listWhatsAppSenderNumbers.js";
import { createRemoveWhatsAppSenderNumber } from "../../functions/whatsApp/removeWhatsAppSenderNumber.js";
import { resolveWhatsAppClient } from "../../services/resolveWhatsAppClient.js";

/**
 * The Workspace Integrations area for WhatsApp: connect a WABA, manage sender numbers, and
 * preview a Meta template. Storing the tenant `accessToken` requires the cloak encryption
 * key — without it the area is disabled (mutations fail clean) rather than persisting a
 * secret in plaintext. Reads are workspace-scoped (the campaign sender selector needs the
 * list); credential mutations require admin/owner.
 */
function requireCloak(): void {
  if (!config.security?.cloakEncryptionKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Workspace Integrations are disabled: no encryption key configured (security.cloakEncryptionKey)"
    });
  }
}

export const whatsAppIntegrationRouter = router({
  get: workspaceProcedure.query(({ ctx }) =>
    createGetWhatsAppIntegration(ctx.prisma as never)(ctx.workspace.accessKeyId)
  ),

  listSenders: workspaceProcedure.query(({ ctx }) =>
    createListWhatsAppSenderNumbers(ctx.prisma as never)(ctx.workspace.accessKeyId)
  ),

  upsert: adminProcedure.input(upsertWhatsAppIntegrationSchema).mutation(({ input, ctx }) => {
    requireCloak();
    return createUpsertWhatsAppIntegration(ctx.prisma as never, ctx.workspace.accessKeyId)(input);
  }),

  addSender: adminProcedure.input(addWhatsAppSenderNumberSchema).mutation(({ input, ctx }) => {
    requireCloak();
    return createAddWhatsAppSenderNumber(ctx.prisma as never, ctx.workspace.accessKeyId)(input);
  }),

  removeSender: adminProcedure
    .input(removeWhatsAppSenderNumberSchema)
    .mutation(({ input, ctx }) => {
      requireCloak();
      return createRemoveWhatsAppSenderNumber(
        ctx.prisma as never,
        ctx.workspace.accessKeyId
      )(input);
    }),

  // Backs the agent-template modal's read-only preview: fetch a Meta template by id from the
  // workspace's WABA. Returns null when no integration exists or the id is unknown.
  previewTemplate: workspaceProcedure
    .input(z.object({ templateId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const client = await resolveWhatsAppClient(
        ctx.prisma as never,
        ctx.workspace.accessKeyId,
        config.whatsapp
      );
      if (!client) return null;
      return client.fetchTemplate(input.templateId);
    })
});
