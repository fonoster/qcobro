import { TRPCError } from "@trpc/server";
import {
  BILLING_METER_OF_CHANNEL,
  buildOutreachContext,
  createContactLogSchema,
  manualOutreachSchema,
  ValidationError,
  type BillingClient,
  type BillingMeter,
  type DispatchOutreachInput,
  type EngineChannel
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { config } from "../../config.js";
import { createDispatchOutreach } from "../../functions/outreach/dispatchOutreach.js";
import { createRecordOutcome, recordOutcomeTx } from "../../functions/campaigns/recordOutcome.js";
import { assessManualDispatch } from "../../functions/billing/manualDispatchGate.js";
import { meterDispatchTx } from "../../functions/billing/meterDispatch.js";
import { resolveWhatsAppClient } from "../../services/resolveWhatsAppClient.js";

/** An agent template with its five dispatchable channel configs loaded. */
type TemplateWithConfigs = {
  type: string;
  voiceAiConfig: {
    fonosterAppRef: string | null;
    systemPrompt: string;
    firstMessage: string | null;
  } | null;
  voicePrerecordedConfig: { fonosterAppRef: string | null; script: string } | null;
  smsConfig: { messageBody: string } | null;
  emailConfig: { subject: string; messageBody: string; systemPrompt: string } | null;
  whatsAppConfig: { templateName: string; messageBody: string } | null;
};

/**
 * Map a resolved template + destination + context into a normalized dispatch request.
 * `languageCode` is only known for WHATSAPP (the workspace integration's `defaultLanguage`,
 * resolved by the caller since it requires a DB read) — unused for every other channel.
 */
function buildDispatchRequest(
  template: TemplateWithConfigs,
  to: string,
  context: Record<string, unknown>,
  prerecordedAppRef: string | null,
  whatsAppLanguageCode?: string
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
        firstMessage: template.voiceAiConfig.firstMessage ?? undefined
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
        script: template.voicePrerecordedConfig.script
      };
    case "EMAIL":
      if (!template.emailConfig)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email config missing" });
      return {
        channel: "EMAIL",
        to,
        context,
        subject: template.emailConfig.subject,
        body: template.emailConfig.messageBody
      };
    case "WHATSAPP":
      if (!template.whatsAppConfig)
        throw new TRPCError({ code: "BAD_REQUEST", message: "WhatsApp config missing" });
      if (!whatsAppLanguageCode)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WhatsApp integration not configured"
        });
      return {
        channel: "WHATSAPP",
        to,
        context,
        templateName: template.whatsAppConfig.templateName,
        languageCode: whatsAppLanguageCode,
        body: template.whatsAppConfig.messageBody
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
   * Manual one-off outreach to a single customer — agent-based, not campaign-based. Loads
   * the account + the chosen agent template (workspace-scoped), dispatches via the
   * channel-dispatch trigger, and records a campaign-less gestión (`campaignId` null,
   * `agentTemplateId` set) so it appears in the account's history. No campaign is involved
   * and no `CampaignAccountState` is touched.
   */
  dispatch: workspaceProcedure.input(manualOutreachSchema).mutation(async ({ input, ctx }) => {
    const workspaceRef = ctx.workspace.accessKeyId;

    const account = await ctx.prisma.portfolioAccount.findFirst({
      where: { id: input.portfolioAccountId, portfolio: { workspaceRef } },
      include: { portfolio: true }
    });
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });

    const template = await ctx.prisma.agentTemplate.findFirst({
      where: { id: input.agentTemplateId, workspaceRef },
      include: {
        voiceAiConfig: true,
        voicePrerecordedConfig: true,
        smsConfig: true,
        emailConfig: true,
        whatsAppConfig: true
      }
    });
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Agent template not found" });

    const isEmail = template.type === "EMAIL";

    if (isEmail && !account.email)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no email address" });
    if (!isEmail && !account.phone)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no phone number" });

    const to = isEmail ? account.email! : account.phone!;

    // WhatsApp credentials are tenant-owned and resolved per-call (mirrors the campaigns
    // engine). Campaigns require the operator to explicitly assign a sender number
    // (senders aren't a fungible pool like voice/SMS — quality rating differs per number);
    // manual outreach has no such assignment, so it deterministically takes the workspace's
    // oldest/first-configured sender rather than an arbitrary unordered row.
    let whatsAppClient = null;
    let whatsAppLanguageCode: string | undefined;
    if (template.type === "WHATSAPP") {
      const sender = await ctx.prisma.whatsAppSenderNumber.findFirst({
        where: { workspaceRef },
        orderBy: { createdAt: "asc" }
      });
      if (!sender) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WhatsApp dispatch has no configured sender numbers"
        });
      }
      const resolved = await resolveWhatsAppClient(
        ctx.prisma as never,
        workspaceRef,
        config.whatsapp,
        sender.phoneNumberId
      );
      if (!resolved) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WhatsApp integration not configured"
        });
      }
      whatsAppClient = resolved.client;
      whatsAppLanguageCode = resolved.languageCode;
    }

    const context = buildOutreachContext(account, { currency: ctx.currency });
    const base = buildDispatchRequest(
      template,
      to,
      context,
      ctx.fonosterPrerecordedAppRef,
      whatsAppLanguageCode
    );

    // Apply operator overrides (pre-rendered on the client — safe to use as-is).
    const request: DispatchOutreachInput = {
      ...base,
      ...(input.subject != null && { subject: input.subject }),
      ...(input.body != null && { body: input.body }),
      ...(input.firstMessage != null && { firstMessage: input.firstMessage }),
      ...(input.script != null && { script: input.script })
    };

    // Billing gate (billing-enforcement spec): manual dispatches verify the
    // balance BEFORE any provider call and reject with a structured error.
    // The SAME channel→meter mapping the engine uses, so manual and campaign
    // dispatch can never meter the same traffic differently. buildDispatchRequest
    // has already rejected non-dispatchable template types.
    const meter: BillingMeter | undefined =
      BILLING_METER_OF_CHANNEL[template.type as EngineChannel];
    const billingDb = ctx.prisma as unknown as BillingClient;
    const gate = meter
      ? await assessManualDispatch(billingDb, config.billing, workspaceRef, meter)
      : ({ kind: "unmetered" } as const);
    if (gate.kind === "insufficient_credits") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "insufficient_credits" });
    }
    if (gate.kind === "payment_failed") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "payment_failed" });
    }

    const dispatch = createDispatchOutreach({
      outboundCallClient: ctx.outboundCallClient,
      smsClient: ctx.smsClient,
      emailClient: ctx.emailClient,
      emailFrom: ctx.emailFrom,
      whatsAppClient,
      fonosterNumbers: ctx.fonosterNumbers,
      twilioFromNumbers: ctx.twilioFromNumbers
    });

    const at = new Date().toISOString();

    const result = await dispatch(request);

    // One campaign-less gestión per attempt, correlated by providerRef (richer outcomes
    // arrive via callbacks and enrich this same row). No campaign → no CampaignAccountState.
    const logParams = {
      portfolioAccountId: account.id,
      agentTemplateId: input.agentTemplateId,
      agentType: template.type as DispatchOutreachInput["channel"],
      contactedAt: at,
      outcome: "OTHER" as const,
      notes: "Contacto manual",
      debtAmountSnapshot: account.outstandingBalance,
      providerRef: result.providerRef,
      channelData: {
        from: result.from,
        to: result.to,
        messageBody: result.renderedBody,
        ...(result.renderedSubject != null && { subject: result.renderedSubject })
      }
    };
    if (gate.kind === "metered" && config.billing) {
      const billing = config.billing;
      // Same validation contract as createRecordOutcome — coverage must not
      // depend on billing enrollment.
      const parsed = createContactLogSchema.safeParse(logParams);
      if (!parsed.success) {
        // Surface as a proper TRPCError — a bare ValidationError isn't a TRPCError,
        // so the adapter would otherwise coerce it to an opaque INTERNAL_SERVER_ERROR.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: new ValidationError(parsed.error).message
        });
      }
      // Gestión + priced usage + ledger debit in ONE transaction (usage-ledger spec).
      await billingDb.$transaction(async (tx) => {
        await recordOutcomeTx(tx as never, parsed.data as typeof logParams);
        await meterDispatchTx(tx, billing, {
          workspaceRef,
          meter,
          at,
          portfolioAccountId: account.id,
          providerRef: result.providerRef
        });
      });
    } else {
      await createRecordOutcome(ctx.prisma as never)(logParams);
    }

    return result;
  })
});
