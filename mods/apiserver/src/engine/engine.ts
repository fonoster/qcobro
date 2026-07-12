import {
  BILLING_METER_OF_CHANNEL,
  bucketOf,
  buildOutreachContext,
  createContactLogSchema,
  estimateDispatchCostMicro,
  maskRecipient,
  ValidationError,
  type AccountDecision,
  type BillingClient,
  type BillingConfig,
  type CampaignSnapshot,
  type CampaignTickReport,
  type Clock,
  type CreateContactLogInput,
  type DispatchOutreachInput,
  type EmailClient,
  type EngineChannel,
  type MeterDispatchInput,
  type OutboundCallClient,
  type PortfolioAccountRecord,
  type RateOverrides,
  type Rates,
  type SmsClient,
  type TickReport,
  type WhatsAppClient
} from "@qcobro/common";
import { getLogger } from "@fonoster/logger";
import { createTickRecorder, type TickRecorder } from "./recorder.js";
import { createDispatchOutreach } from "../functions/outreach/dispatchOutreach.js";
import { createReserveAttempt } from "../functions/campaigns/reserveAttempt.js";
import { createRecordOutcome, recordOutcomeTx } from "../functions/campaigns/recordOutcome.js";
import { createGetWorkspaceSettings } from "../functions/workspaceSettings/getWorkspaceSettings.js";
import { isInWindow, isPastEndDate, type WindowCampaign } from "./window.js";
import { runFunnel, type FunnelAccount } from "./funnel.js";
import { meterDispatchTx } from "../functions/billing/meterDispatch.js";
import { parseStoredOverrides, planFromCatalog } from "../functions/billing/meters.js";
import { workspaceBalanceMicroTx } from "../functions/billing/workspaceBalance.js";
import {
  createCreditBucket,
  createTokenBucket,
  perTickCapacity,
  type CreditBucket,
  type TokenBucket
} from "./buckets.js";

/**
 * A workspace's credit gate for one tick. `off` = billing disabled or workspace
 * not enrolled (dispatches unmetered — what makes gradual rollout safe);
 * `payment_failed` = the payer is dunning, all its workspaces suspend;
 * `misconfigured` = enrollment points at an unknown plan (fail closed);
 * `active` = bucket seeded from the ledger, debited per dispatch.
 */
type CreditGate =
  | { kind: "off" }
  | { kind: "payment_failed" }
  | { kind: "misconfigured" }
  | { kind: "active"; bucket: CreditBucket; rates: Rates; overrides?: RateOverrides };

const logger = getLogger({ service: "engine", filePath: import.meta.url });

/** Agent template with the dispatch configs the engine needs. */
export interface EngineTemplate {
  type: string;
  voiceAiConfig: {
    fonosterAppRef: string | null;
    systemPrompt: string;
    firstMessage: string | null;
  } | null;
  voicePrerecordedConfig: { fonosterAppRef: string | null; script: string } | null;
  smsConfig: { messageBody: string } | null;
  emailConfig: {
    subject: string;
    messageBody: string;
    systemPrompt: string;
    maxReplies: number | null;
  } | null;
  whatsAppConfig: { templateName: string; messageBody: string } | null;
}

/** A campaign as the engine loads it (schedule + caps + template + portfolios). */
export interface EngineCampaign extends WindowCampaign {
  id: string;
  /** Display name, embedded in `campaign.evaluated` events for scorecards. */
  name: string;
  workspaceRef: string;
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
  agentTemplate: EngineTemplate | null;
  portfolios: { portfolioId: string }[];
  /** Set for WHATSAPP campaigns; the sender chosen at campaign creation. */
  whatsAppSenderNumberId: string | null;
  /** The chosen sender's Meta-assigned phone_number_id (join of whatsAppSenderNumberId). */
  whatsAppSenderPhoneNumberId: string | null;
}

/** A candidate account with its campaign-local state (filtered to the campaign). */
export interface EngineCandidate {
  id: string;
  phone: string | null;
  email: string | null;
  intentStatus: string | null;
  suppressUntil: Date | null;
  outstandingBalance: number;
  campaignStates: {
    attemptCount: number;
    attemptsToday: number;
    lastAttemptAt: Date | null;
    suppressUntil: Date | null;
  }[];
}

/** The DB surface the engine reads — satisfied structurally by the Prisma client. */
export interface EngineClient {
  listActiveCampaigns(): Promise<EngineCampaign[]>;
  listCandidates(campaignId: string, portfolioIds: string[]): Promise<EngineCandidate[]>;
  completeCampaign(id: string): Promise<void>;
}

export interface EngineDeps {
  db: EngineClient;
  /** Same client the reserve/record functions use (the Prisma client). */
  reserveRecordClient: unknown;
  outboundCallClient: OutboundCallClient | null;
  smsClient: SmsClient | null;
  emailClient?: EmailClient | null;
  emailFrom?: { email: string; name?: string; inboundDomain: string } | null;
  fonosterNumbers: string[];
  twilioFromNumbers: string[];
  fonosterPrerecordedAppRef: string | null;
  clock: Clock;
  voicePerMinute: number;
  smsPerMinute: number;
  emailPerMinute: number;
  whatsAppPerMinute: number;
  tickSeconds: number;
  /** Hard cap on dispatches per tick across all campaigns (keeps ticks bounded). */
  perTickMax?: number;
  /**
   * Resolve a per-workspace WhatsApp client and its send language. Called once per
   * WHATSAPP dispatch; credentials are tenant-owned so the client cannot be injected
   * at boot like the voice/SMS pools.
   */
  resolveWhatsApp: (
    workspaceRef: string,
    phoneNumberId: string
  ) => Promise<{ client: WhatsAppClient; languageCode: string } | null>;
  /**
   * Billing config (the qcobro.json `billing` section). When absent or
   * `enabled:false`, dispatch paths neither meter usage nor enforce credit
   * gates — pre-billing behavior, and the rollback switch. The billing tables
   * are reached through `reserveRecordClient` (the same Prisma client).
   */
  billing?: BillingConfig;
}

type Readiness =
  | { ok: true; channel: EngineChannel; appRef: string | null }
  | { ok: false; reason: NonNullable<CampaignTickReport["skipReason"]> };

function channelOf(type: string | undefined): EngineChannel | null {
  if (
    type === "VOICE_AI" ||
    type === "VOICE_PRERECORDED" ||
    type === "SMS" ||
    type === "EMAIL" ||
    type === "WHATSAPP"
  )
    return type;
  return null;
}

export function createEngine(deps: EngineDeps) {
  const baseDeps = {
    outboundCallClient: deps.outboundCallClient,
    smsClient: deps.smsClient,
    emailClient: deps.emailClient,
    emailFrom: deps.emailFrom,
    fonosterNumbers: deps.fonosterNumbers,
    twilioFromNumbers: deps.twilioFromNumbers,
    pickNumber: undefined as undefined
  };
  const dispatch = createDispatchOutreach(baseDeps);
  const record = createRecordOutcome(deps.reserveRecordClient as never);
  // Per-workspace timezone + currency, resolved once per campaign per tick. A workspace
  // without a settings row is seeded on read via the column defaults.
  const getSettings = createGetWorkspaceSettings(deps.reserveRecordClient as never);
  const billingCfg = deps.billing?.enabled ? deps.billing : null;
  const billingDb = deps.reserveRecordClient as BillingClient;

  /**
   * Writes the dispatch gestión and, when the workspace is metered, the priced
   * usage record + ledger debit in the SAME transaction — a failed ledger write
   * fails the dispatch record (usage-ledger spec).
   */
  async function recordDispatch(params: CreateContactLogInput, meter: MeterDispatchInput | null) {
    if (!meter || !billingCfg) return record(params);
    // Same validation contract as createRecordOutcome — coverage must not
    // depend on whether the workspace happens to be metered.
    const parsed = createContactLogSchema.safeParse(params);
    if (!parsed.success) throw new ValidationError(parsed.error);
    return billingDb.$transaction(async (tx) => {
      const log = await recordOutcomeTx(tx as never, parsed.data as CreateContactLogInput);
      await meterDispatchTx(tx, billingCfg, meter);
      return log;
    });
  }

  /** The pre-dispatch credit-bucket debit for one dispatch on this gate. */
  function estimateCostMicro(
    gate: Extract<CreditGate, { kind: "active" }>,
    channel: EngineChannel
  ): number {
    return estimateDispatchCostMicro(
      BILLING_METER_OF_CHANNEL[channel],
      gate.rates,
      gate.overrides,
      billingCfg!.voiceDebitEstimateSeconds
    );
  }

  /** Channel readiness for a campaign (Topic 5 tier A — catches config up-front). */
  function readiness(c: EngineCampaign): Readiness {
    const type = c.agentTemplate?.type;
    const channel = channelOf(type);
    if (!channel) return { ok: false, reason: "channel_not_supported" };
    if (channel === "SMS") {
      if (!deps.smsClient) return { ok: false, reason: "channel_not_configured" };
      if (deps.twilioFromNumbers.length === 0) return { ok: false, reason: "empty_number_pool" };
      return { ok: true, channel, appRef: null };
    }
    if (channel === "EMAIL") {
      if (!deps.emailClient || !deps.emailFrom) {
        return { ok: false, reason: "channel_not_configured" };
      }
      return { ok: true, channel, appRef: null };
    }
    if (channel === "WHATSAPP") {
      // The WhatsApp client is resolved per-call from tenant creds (can't be pre-injected).
      // We only need to verify the campaign nominated a sender number at creation time.
      if (!c.whatsAppSenderNumberId) return { ok: false, reason: "channel_not_configured" };
      return { ok: true, channel, appRef: null };
    }
    if (!deps.outboundCallClient) return { ok: false, reason: "channel_not_configured" };
    if (deps.fonosterNumbers.length === 0) return { ok: false, reason: "empty_number_pool" };
    const appRef =
      channel === "VOICE_AI"
        ? (c.agentTemplate?.voiceAiConfig?.fonosterAppRef ?? null)
        : deps.fonosterPrerecordedAppRef;
    if (!appRef) return { ok: false, reason: "voice_not_synced" };
    return { ok: true, channel, appRef };
  }

  /** Build the normalized dispatch request for an account (configs are pre-validated). */
  function buildRequest(
    c: EngineCampaign,
    acc: EngineCandidate,
    channel: EngineChannel,
    appRef: string | null,
    currency: string,
    whatsAppLanguageCode?: string
  ): DispatchOutreachInput {
    const context = buildOutreachContext(acc as unknown as PortfolioAccountRecord, { currency });
    const t = c.agentTemplate!;
    if (channel === "SMS") {
      return { channel, to: acc.phone!, context, body: t.smsConfig?.messageBody ?? "" };
    }
    if (channel === "EMAIL") {
      return {
        channel,
        to: acc.email!,
        context,
        subject: t.emailConfig?.subject ?? "",
        body: t.emailConfig?.messageBody ?? ""
      };
    }
    if (channel === "WHATSAPP") {
      return {
        channel,
        to: acc.phone!,
        context,
        templateName: t.whatsAppConfig?.templateName ?? "",
        languageCode: whatsAppLanguageCode ?? "",
        body: t.whatsAppConfig?.messageBody ?? ""
      };
    }
    if (channel === "VOICE_AI") {
      return {
        channel,
        to: acc.phone!,
        context,
        appRef: appRef ?? undefined,
        firstMessage: t.voiceAiConfig?.firstMessage ?? undefined
      };
    }
    return {
      channel,
      to: acc.phone!,
      context,
      appRef: appRef ?? undefined,
      script: t.voicePrerecordedConfig?.script
    };
  }

  /** The campaign parameters in force this tick, embedded so the stream is self-contained. */
  function snapshotOf(c: EngineCampaign, tz: string): CampaignSnapshot {
    return {
      status: c.status,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate ? c.endDate.toISOString() : null,
      daysOfWeek: c.daysOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      maxAttemptsPerAccount: c.maxAttemptsPerAccount,
      maxAttemptsPerDay: c.maxAttemptsPerDay,
      timezone: tz,
      channel: channelOf(c.agentTemplate?.type)
    };
  }

  /** Reserve (before send) → dispatch → record. Returns the per-account decision. */
  async function reserveAndDispatch(
    c: EngineCampaign,
    acc: EngineCandidate,
    channel: EngineChannel,
    appRef: string | null,
    reserve: ReturnType<typeof createReserveAttempt>,
    currency: string,
    recorder: TickRecorder,
    metered: boolean
  ): Promise<{ decision: AccountDecision; providerRef?: string }> {
    // For WHATSAPP, resolve the per-workspace client before reserving the attempt so a
    // missing integration skips cleanly without consuming an attempt slot.
    let whatsAppLanguageCode: string | undefined;
    let dispatchFn = dispatch;
    if (channel === "WHATSAPP") {
      const resolved = await deps.resolveWhatsApp(c.workspaceRef, c.whatsAppSenderPhoneNumberId!);
      if (!resolved) {
        logger.error(`WhatsApp integration not found campaign=${c.id} workspace=${c.workspaceRef}`);
        // Recorded as a failed dispatch so the scorecard's error rate sees it —
        // without this, a campaign failing 100% this way would judge as 0% errors.
        recorder.emit({
          kind: "dispatch.failed",
          workspaceRef: c.workspaceRef,
          campaignId: c.id,
          portfolioAccountId: acc.id,
          channel,
          latencyMs: 0,
          errorClass: "IntegrationMissing",
          errorMessage: "WhatsApp integration not found for workspace",
          toMasked: maskRecipient(acc.phone ?? "")
        });
        return { decision: "dispatch_failed" };
      }
      whatsAppLanguageCode = resolved.languageCode;
      dispatchFn = createDispatchOutreach({ ...baseDeps, whatsAppClient: resolved.client });
    }

    const at = deps.clock.now().toISOString();
    await reserve({ campaignId: c.id, portfolioAccountId: acc.id, at });
    recorder.emit({
      kind: "attempt.reserved",
      workspaceRef: c.workspaceRef,
      campaignId: c.id,
      portfolioAccountId: acc.id
    });

    const toMasked = maskRecipient((channel === "EMAIL" ? acc.email : acc.phone) ?? "");
    recorder.emit({
      kind: "dispatch.requested",
      workspaceRef: c.workspaceRef,
      campaignId: c.id,
      portfolioAccountId: acc.id,
      channel,
      toMasked
    });
    const dispatchStartedMs = Date.now();

    let result;
    try {
      result = await dispatchFn(
        buildRequest(c, acc, channel, appRef, currency, whatsAppLanguageCode)
      );
    } catch (err) {
      // Attempt stays consumed (at-most-once); no gestión for a failed dispatch.
      // Surface the reason — a swallowed dispatch error is undebuggable in prod.
      logger.error(
        `dispatch failed campaign=${c.id} account=${acc.id} channel=${channel}:`,
        err instanceof Error ? err.message : err
      );
      recorder.emit({
        kind: "dispatch.failed",
        workspaceRef: c.workspaceRef,
        campaignId: c.id,
        portfolioAccountId: acc.id,
        channel,
        latencyMs: Date.now() - dispatchStartedMs,
        errorClass: err instanceof Error ? err.constructor.name : "Error",
        errorMessage: err instanceof Error ? err.message : String(err),
        toMasked
      });
      return { decision: "dispatch_failed" };
    }
    recorder.emit({
      kind: "dispatch.succeeded",
      workspaceRef: c.workspaceRef,
      campaignId: c.id,
      portfolioAccountId: acc.id,
      channel,
      providerRef: result.providerRef,
      latencyMs: Date.now() - dispatchStartedMs,
      toMasked
    });

    await recordDispatch(
      {
        portfolioAccountId: acc.id,
        campaignId: c.id,
        agentType: channel,
        contactedAt: at,
        outcome: "OTHER",
        debtAmountSnapshot: acc.outstandingBalance,
        providerRef: result.providerRef,
        channelData: { from: result.from, to: result.to, messageBody: result.renderedBody }
      },
      metered
        ? {
            workspaceRef: c.workspaceRef,
            meter: BILLING_METER_OF_CHANNEL[channel],
            at,
            campaignId: c.id,
            portfolioAccountId: acc.id,
            providerRef: result.providerRef
          }
        : null
    );
    return { decision: "dispatched", providerRef: result.providerRef };
  }

  function toFunnelAccount(acc: EngineCandidate): FunnelAccount {
    const state = acc.campaignStates[0] ?? null;
    return {
      portfolioAccountId: acc.id,
      phone: acc.phone,
      email: acc.email,
      intentStatus: acc.intentStatus,
      accountSuppressUntil: acc.suppressUntil,
      state
    };
  }

  async function tick(): Promise<TickReport> {
    const now = deps.clock.now();
    const recorder = createTickRecorder(deps.clock);
    const tickStartedMs = Date.now();
    const buckets: Record<"voice" | "sms" | "email" | "whatsApp", TokenBucket> = {
      voice: createTokenBucket(perTickCapacity(deps.voicePerMinute, deps.tickSeconds)),
      sms: createTokenBucket(perTickCapacity(deps.smsPerMinute, deps.tickSeconds)),
      email: createTokenBucket(perTickCapacity(deps.emailPerMinute, deps.tickSeconds)),
      whatsApp: createTokenBucket(perTickCapacity(deps.whatsAppPerMinute, deps.tickSeconds))
    };
    const usage = {
      VOICE_AI: { dispatched: 0, budget: 0 },
      VOICE_PRERECORDED: { dispatched: 0, budget: 0 },
      SMS: { dispatched: 0, budget: buckets.sms.remaining() },
      EMAIL: { dispatched: 0, budget: buckets.email.remaining() },
      WHATSAPP: { dispatched: 0, budget: buckets.whatsApp.remaining() }
    };
    const voiceBudget = buckets.voice.remaining();
    usage.VOICE_AI.budget = voiceBudget;
    usage.VOICE_PRERECORDED.budget = voiceBudget;
    recorder.emit({
      kind: "tick.started",
      budgets: {
        VOICE_AI: voiceBudget,
        VOICE_PRERECORDED: voiceBudget,
        SMS: usage.SMS.budget,
        EMAIL: usage.EMAIL.budget,
        WHATSAPP: usage.WHATSAPP.budget
      },
      perTickMax: deps.perTickMax
    });

    const report: TickReport = { at: now.toISOString(), campaigns: [], channelUsage: {} };
    let totalDispatched = 0;

    // One credit gate per workspace per tick, seeded from the ledger on first
    // touch. Campaign iteration order is the de-facto priority order when the
    // bucket runs low (documented v1 behavior).
    const gates = new Map<string, CreditGate>();
    const settingsCache = new Map<string, Awaited<ReturnType<typeof getSettings>>>();
    async function creditGateFor(workspaceRef: string): Promise<CreditGate> {
      if (!billingCfg) return { kind: "off" };
      const cached = gates.get(workspaceRef);
      if (cached) return cached;
      let gate: CreditGate;
      try {
        const enrollment = await billingDb.workspaceBilling.findUnique({
          where: { workspaceRef }
        });
        if (!enrollment) {
          gate = { kind: "off" };
        } else {
          const account = await billingDb.billingAccount.findUnique({
            where: { id: enrollment.billingAccountId }
          });
          if (account?.paymentFailed) {
            gate = { kind: "payment_failed" };
          } else {
            const plan = planFromCatalog(billingCfg, enrollment.planKey);
            const overrides = parseStoredOverrides(enrollment.rateOverrides);
            const balance = await workspaceBalanceMicroTx(billingDb, workspaceRef);
            gate = {
              kind: "active",
              bucket: createCreditBucket(balance),
              rates: plan.rates,
              overrides
            };
          }
        }
      } catch (err) {
        // Fail closed: a broken enrollment (unknown plan, bad overrides) must not
        // dispatch unpriced — but it must not kill the tick for other workspaces.
        console.error(
          `[engine] billing gate failed workspace=${workspaceRef} (failing closed):`,
          err instanceof Error ? err.message : err
        );
        gate = { kind: "misconfigured" };
      }
      gates.set(workspaceRef, gate);
      return gate;
    }

    for (const c of await deps.db.listActiveCampaigns()) {
      const cr: CampaignTickReport = {
        campaignId: c.id,
        inWindow: false,
        decisions: [],
        dispatched: 0,
        suppressed: 0,
        skipped: 0
      };

      // Resolve this campaign's workspace settings once per WORKSPACE per tick
      // (a tenant with N campaigns must not issue N identical reads); timezone
      // drives the wall-clock window + daily-cap reset, currency the templates.
      let ws = settingsCache.get(c.workspaceRef);
      if (!ws) {
        ws = await getSettings(c.workspaceRef);
        settingsCache.set(c.workspaceRef, ws);
      }
      const tz = ws.timezone;
      const reserve = createReserveAttempt(deps.reserveRecordClient as never, tz);

      const evaluated = (over: {
        inWindow: boolean;
        skipReason?: string;
        completed?: boolean;
        candidateCount?: number;
      }) =>
        recorder.emit({
          kind: "campaign.evaluated",
          workspaceRef: c.workspaceRef,
          campaignId: c.id,
          campaignName: c.name,
          inWindow: over.inWindow,
          skipReason: over.skipReason,
          completed: over.completed,
          candidateCount: over.candidateCount ?? 0,
          snapshot: snapshotOf(c, tz)
        });

      if (isPastEndDate(c, now, tz)) {
        await deps.db.completeCampaign(c.id);
        cr.completed = true;
        evaluated({ inWindow: false, completed: true });
        report.campaigns.push(cr);
        continue;
      }

      const win = isInWindow(c, now, tz);
      if (!win.ok) {
        cr.skipReason = win.reason;
        evaluated({ inWindow: false, skipReason: win.reason });
        report.campaigns.push(cr);
        continue;
      }
      cr.inWindow = true;

      const ready = readiness(c);
      if (!ready.ok) {
        cr.skipReason = ready.reason;
        evaluated({ inWindow: true, skipReason: ready.reason });
        report.campaigns.push(cr);
        continue;
      }

      // Credit gate (billing-enforcement): a payer in dunning or an exhausted
      // (or misconfigured, failing closed) balance skips the whole campaign.
      const gate = await creditGateFor(c.workspaceRef);
      if (gate.kind === "payment_failed") {
        cr.skipReason = "payment_failed";
        evaluated({ inWindow: true, skipReason: cr.skipReason });
        report.campaigns.push(cr);
        continue;
      }
      if (
        gate.kind === "misconfigured" ||
        (gate.kind === "active" && gate.bucket.remainingMicro() <= 0)
      ) {
        cr.skipReason = "credits_exhausted";
        evaluated({ inWindow: true, skipReason: cr.skipReason });
        report.campaigns.push(cr);
        continue;
      }

      const candidates = await deps.db.listCandidates(
        c.id,
        c.portfolios.map((p) => p.portfolioId)
      );
      evaluated({ inWindow: true, candidateCount: candidates.length });
      const { eligible, decisions } = runFunnel(
        c,
        candidates.map(toFunnelAccount),
        now,
        tz,
        ready.channel === "EMAIL"
      );
      const candidateById = new Map(candidates.map((a) => [a.id, a]));

      const decided = (portfolioAccountId: string, decision: AccountDecision, ref?: string) =>
        recorder.emit({
          kind: "account.decided",
          workspaceRef: c.workspaceRef,
          campaignId: c.id,
          portfolioAccountId,
          decision,
          providerRef: ref
        });

      for (const d of decisions) {
        cr.decisions.push(d);
        cr.suppressed += 1;
        decided(d.portfolioAccountId, d.decision);
      }

      const bucket = buckets[bucketOf(ready.channel)];
      for (const fa of eligible) {
        if (deps.perTickMax !== undefined && totalDispatched >= deps.perTickMax) {
          cr.decisions.push({
            portfolioAccountId: fa.portfolioAccountId,
            decision: "budget_exhausted"
          });
          decided(fa.portfolioAccountId, "budget_exhausted");
          cr.skipped += 1;
          continue;
        }
        // Peek credits BEFORE taking a channel token, but only debit AFTER the
        // token is granted — otherwise accounts blocked by the channel budget
        // would burn in-tick credit headroom and mislabel later accounts as
        // credits_exhausted.
        const costMicro = gate.kind === "active" ? estimateCostMicro(gate, ready.channel) : 0;
        if (gate.kind === "active" && gate.bucket.remainingMicro() < costMicro) {
          cr.decisions.push({
            portfolioAccountId: fa.portfolioAccountId,
            decision: "credits_exhausted"
          });
          decided(fa.portfolioAccountId, "credits_exhausted");
          cr.skipped += 1;
          continue;
        }
        if (!bucket.tryTake()) {
          cr.decisions.push({
            portfolioAccountId: fa.portfolioAccountId,
            decision: "budget_exhausted"
          });
          decided(fa.portfolioAccountId, "budget_exhausted");
          cr.skipped += 1;
          continue;
        }
        if (gate.kind === "active") gate.bucket.tryDebit(costMicro);
        const acc = candidateById.get(fa.portfolioAccountId)!;
        const { decision, providerRef } = await reserveAndDispatch(
          c,
          acc,
          ready.channel,
          ready.appRef,
          reserve,
          ws.currency,
          recorder,
          gate.kind === "active"
        );
        cr.decisions.push({ portfolioAccountId: acc.id, decision, providerRef });
        decided(acc.id, decision, providerRef);
        if (decision === "dispatched") {
          cr.dispatched += 1;
          totalDispatched += 1;
          usage[ready.channel].dispatched += 1;
        } else {
          cr.skipped += 1;
        }
      }

      report.campaigns.push(cr);
    }

    // The event reports tokens CONSUMED (budget - remaining), not successes: a failed
    // dispatch still spends its token, and budget-utilization checks must see that.
    // The two voice channels share one bucket; its consumption is reported on VOICE_AI.
    recorder.emit({
      kind: "tick.completed",
      durationMs: Date.now() - tickStartedMs,
      dispatched: totalDispatched,
      perTickMaxReached: deps.perTickMax !== undefined && totalDispatched >= deps.perTickMax,
      channelUsage: {
        VOICE_AI: { dispatched: voiceBudget - buckets.voice.remaining(), budget: voiceBudget },
        VOICE_PRERECORDED: { dispatched: 0, budget: voiceBudget },
        SMS: { dispatched: usage.SMS.budget - buckets.sms.remaining(), budget: usage.SMS.budget },
        EMAIL: {
          dispatched: usage.EMAIL.budget - buckets.email.remaining(),
          budget: usage.EMAIL.budget
        },
        WHATSAPP: {
          dispatched: usage.WHATSAPP.budget - buckets.whatsApp.remaining(),
          budget: usage.WHATSAPP.budget
        }
      }
    });
    report.channelUsage = usage;
    report.events = recorder.events();
    return report;
  }

  return { tick };
}
