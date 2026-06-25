import { TRPCError } from "@trpc/server";
import {
  buildOutreachContext,
  manualOutreachSchema,
  type DispatchOutreachInput
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { createDispatchOutreach } from "../../functions/outreach/dispatchOutreach.js";
import { createReserveAttempt } from "../../functions/campaigns/reserveAttempt.js";
import { createRecordOutcome } from "../../functions/campaigns/recordOutcome.js";

/** An agent template with its three dispatchable channel configs loaded. */
type TemplateWithConfigs = {
  type: string;
  voiceAiConfig: {
    fonosterAppRef: string | null;
    systemPrompt: string;
    firstMessage: string | null;
  } | null;
  voicePrerecordedConfig: { fonosterAppRef: string | null; script: string } | null;
  smsConfig: { messageBody: string } | null;
};

/** Map a resolved template + destination + context into a normalized dispatch request. */
function buildDispatchRequest(
  template: TemplateWithConfigs,
  to: string,
  context: Record<string, unknown>,
  prerecordedAppRef: string | null
): DispatchOutreachInput {
  switch (template.type) {
    case "SMS":
      if (!template.smsConfig)
        throw new TRPCError({ code: "BAD_REQUEST", message: "SMS config missing" });
      return { channel: "SMS", to, context, body: template.smsConfig.messageBody };
    case "VOICE_AI":
      if (!template.voiceAiConfig)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Voice config missing" });
      return {
        channel: "VOICE_AI",
        to,
        context,
        appRef: template.voiceAiConfig.fonosterAppRef ?? undefined,
        firstMessage: template.voiceAiConfig.firstMessage ?? undefined,
        systemPrompt: template.voiceAiConfig.systemPrompt
      };
    case "VOICE_PRERECORDED":
      if (!template.voicePrerecordedConfig)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Voice config missing" });
      // Pre-recorded uses the deployment's shared EXTERNAL app (VoiceServer); the
      // per-customer script rides as metadata.
      return {
        channel: "VOICE_PRERECORDED",
        to,
        context,
        appRef: prerecordedAppRef ?? undefined,
        firstMessage: template.voicePrerecordedConfig.script
      };
    default:
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Channel ${template.type} is not supported for manual outreach`
      });
  }
}

export const outreachRouter = router({
  /**
   * Manual one-off outreach to a single customer. Runs the selected campaign's agent
   * against this account: loads the account + campaign (workspace-scoped), derives the
   * campaign's agent template, dispatches via the channel-dispatch trigger, and records
   * the attempt as a gestión of the campaign so it appears in the account's history.
   */
  dispatch: workspaceProcedure.input(manualOutreachSchema).mutation(async ({ input, ctx }) => {
    const workspaceRef = ctx.workspace.accessKeyId;

    const account = await ctx.prisma.portfolioAccount.findFirst({
      where: { id: input.portfolioAccountId, portfolio: { workspaceRef } },
      include: { portfolio: true }
    });
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
    if (!account.phone)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no phone number" });

    const campaign = await ctx.prisma.campaign.findFirst({
      where: { id: input.campaignId, workspaceRef }
    });
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

    const template = await ctx.prisma.agentTemplate.findFirst({
      where: { id: campaign.agentTemplateId, workspaceRef },
      include: { voiceAiConfig: true, voicePrerecordedConfig: true, smsConfig: true }
    });
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Agent template not found" });

    const context = buildOutreachContext(account, account.portfolio);
    const request = buildDispatchRequest(
      template,
      account.phone,
      context,
      ctx.fonosterPrerecordedAppRef
    );

    const dispatch = createDispatchOutreach({
      outboundCallClient: ctx.outboundCallClient,
      smsClient: ctx.smsClient,
      fonosterNumbers: ctx.fonosterNumbers,
      twilioFromNumbers: ctx.twilioFromNumbers
    });

    const at = new Date().toISOString();

    // Manual = a first-class campaign attempt, counted like the engine's. Operator
    // override: we reserve (count) the attempt before dialing, but do not gate on caps.
    await createReserveAttempt(
      ctx.prisma as never,
      ctx.timezone
    )({ campaignId: input.campaignId, portfolioAccountId: account.id, at });

    const result = await dispatch(request);

    // One gestión per attempt, correlated by providerRef (richer outcomes arrive via
    // callbacks and enrich this same row).
    await createRecordOutcome(ctx.prisma as never)({
      portfolioAccountId: account.id,
      campaignId: input.campaignId,
      agentType: template.type as DispatchOutreachInput["channel"],
      contactedAt: at,
      outcome: "OTHER",
      notes: "Contacto manual",
      debtAmountSnapshot: account.outstandingBalance,
      providerRef: result.providerRef,
      channelData: {
        from: result.from,
        to: result.to,
        messageBody: result.renderedBody
      }
    });

    return result;
  })
});
