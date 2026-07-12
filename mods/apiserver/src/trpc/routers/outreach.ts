import { TRPCError } from "@trpc/server";
import {
  buildOutreachContext,
  manualOutreachSchema,
  type BillingClient,
  type BillingMeter,
  type DispatchOutreachInput
} from "@qcobro/common";
import { router, workspaceProcedure } from "../trpc.js";
import { config } from "../../config.js";
import { createDispatchOutreach } from "../../functions/outreach/dispatchOutreach.js";
import { createRecordOutcome, recordOutcomeTx } from "../../functions/campaigns/recordOutcome.js";
import { assessManualDispatch } from "../../functions/billing/manualDispatchGate.js";
import { meterDispatchTx } from "../../functions/billing/meterDispatch.js";

/** Manual-outreach template type → billing meter (WhatsApp is not manual-dispatchable). */
const MANUAL_METER: Record<string, BillingMeter> = {
  SMS: "sms",
  EMAIL: "email",
  VOICE_AI: "voiceAi",
  VOICE_PRERECORDED: "voicePrerecorded"
};

/** An agent template with its four dispatchable channel configs loaded. */
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
        emailConfig: true
      }
    });
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Agent template not found" });

    const isEmail = template.type === "EMAIL";

    if (isEmail && !account.email)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no email address" });
    if (!isEmail && !account.phone)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Account has no phone number" });

    const to = isEmail ? account.email! : account.phone!;

    const context = buildOutreachContext(account, { currency: ctx.currency });
    const base = buildDispatchRequest(template, to, context, ctx.fonosterPrerecordedAppRef);

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
    const meter = MANUAL_METER[template.type];
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
      // Gestión + priced usage + ledger debit in ONE transaction (usage-ledger spec).
      await billingDb.$transaction(async (tx) => {
        await recordOutcomeTx(tx as never, logParams);
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
