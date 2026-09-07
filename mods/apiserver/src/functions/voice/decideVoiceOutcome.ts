import type { PrismaClient } from "@prisma/client";
import {
  buildOutreachContext,
  parseLocale,
  type Path,
  type CreateContactLogInput,
  type EmailAutopilot,
  type PortfolioAccountRecord,
  type Outcome
} from "@qcobro/common";
import { transcriptToThread } from "../../services/voiceAutopilot.js";
import { buildTranscript } from "./generateGestionInsight.js";

/** The gestión + agent config the Voz IA decision step needs, loaded by gestión id. */
export interface VoiceDecisionGestionView {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  debtAmountSnapshot: number | null;
  /** The gestión's own correlation ref (the Fonoster call ref) — reused so `recordOutcome`
   *  enriches this same row instead of inserting a duplicate. */
  providerRef: string | null;
  channelData: unknown;
  agentSystemPrompt: string;
  /** Render context (account fields) for the autopilot. */
  accountContext: Record<string, unknown>;
}

/** The DB surface the decision step needs — a small port so tests inject a fake. */
export interface VoiceDecisionClient {
  loadById(id: string): Promise<VoiceDecisionGestionView | null>;
}

export interface DecideVoiceOutcomeDeps {
  client: VoiceDecisionClient;
  autopilot: EmailAutopilot;
  /** Persists outcome/Objective/suppression (createRecordOutcome) — same as EMAIL/WhatsApp. */
  recordOutcome: (params: CreateContactLogInput) => Promise<unknown>;
  now: () => Date;
}

export type DecideVoiceOutcomeResult =
  | { decided: false; reason: "not_found" | "no_transcript" }
  | { decided: true; outcome: Outcome | null };

/** `outcome` values this decision step may record. `OTHER`/`WRONG_NUMBER` no longer
 *  exist — an unrecognized string from the model (or a hallucinated removed value) collapses
 *  to `null`, same as no outcome at all. */
const VALID_OUTCOMES = new Set<Outcome>([
  "PAYMENT_PROMISE",
  "NEW_TERMS",
  "PAID",
  "CALLBACK_REQUESTED",
  "DISPUTE_RAISED",
  "INFORMATION_REQUEST",
  "REFUSED",
  "OPT_OUT",
  "WRONG_PARTY",
  "RESOLVED"
]);

/** Pure: map the autopilot's raw decision string onto a valid `Outcome`, or null when
 *  absent or unrecognized. */
export function decideOutcome(raw: string | null | undefined): Outcome | null {
  if (!raw) return null;
  return (VALID_OUTCOMES as ReadonlySet<string>).has(raw) ? (raw as Outcome) : null;
}

/** Pure: this decision step only ever runs once a transcript exists (see the
 *  `no_transcript` guard below), so reaching it means the call was answered and
 *  conversational — always `ENGAGED`. */
export function decidePath(): Path {
  return "ENGAGED";
}

/**
 * Runs the Voz IA autopilot decision once over a call's final transcript and records the
 * path/outcome/Objective through the same {@link CreateContactLogInput} path
 * EMAIL/WhatsApp use.
 *
 * No-ops (without calling the autopilot) when the gestión is missing or its transcript is
 * empty — mirrors {@link createGenerateGestionInsight}'s `no_transcript` guard. Once the
 * autopilot has decided, the call was answered and conversational, so `path: ENGAGED` is
 * always recorded — whether or not the decision also carries an `outcome`.
 */
export function createDecideVoiceOutcome(deps: DecideVoiceOutcomeDeps) {
  return async (id: string): Promise<DecideVoiceOutcomeResult> => {
    const g = await deps.client.loadById(id);
    if (!g) return { decided: false, reason: "not_found" };

    const transcript = buildTranscript(g.channelData);
    if (transcript.length === 0) return { decided: false, reason: "no_transcript" };

    const decision = await deps.autopilot.decide({
      systemPrompt: g.agentSystemPrompt,
      thread: transcriptToThread(transcript),
      context: g.accountContext,
      language:
        typeof g.accountContext.preferredLanguage === "string"
          ? g.accountContext.preferredLanguage
          : undefined,
      referenceDate: deps.now().toISOString().slice(0, 10)
    });

    const outcome = decideOutcome(decision.outcome);
    const path = decidePath();
    const obj = decision.objective;
    await deps.recordOutcome({
      portfolioAccountId: g.portfolioAccountId,
      campaignId: g.campaignId ?? undefined,
      agentType: "VOICE_AI",
      contactedAt: deps.now().toISOString(),
      // This step only enriches an existing (already-dispatched) gestión; delivery itself
      // is decided elsewhere (recordVoiceAiCallStatus / resolveVoiceCallFromCdr) and
      // recordOutcomeTx never regresses it off DISPATCHED once it has advanced.
      delivery: "DISPATCHED",
      path,
      outcome: outcome ?? undefined,
      providerRef: g.providerRef ?? undefined,
      debtAmountSnapshot: g.debtAmountSnapshot ?? undefined,
      intentMetadata: obj ? { promisedAmount: obj.amount, promisedDate: obj.dueDate } : undefined
    });
    return { decided: true, outcome };
  };
}

/**
 * Prisma-backed {@link VoiceDecisionClient}: loads the gestión + Voz IA agent config by id.
 * Resolves `agentSystemPrompt` via `campaign.agentTemplate` when a campaign is attached,
 * else a direct `agentTemplateId` lookup for ad-hoc/follow-up dispatches (`campaignId`
 * null) — the same dual-path resolution `whatsAppWebhook.ts` already implements.
 */
export function createPrismaVoiceDecisionClient(prisma: PrismaClient): VoiceDecisionClient {
  return {
    async loadById(id: string): Promise<VoiceDecisionGestionView | null> {
      const log = await prisma.accountContactLog.findUnique({
        where: { id },
        include: {
          campaign: { include: { agentTemplate: { include: { voiceAiConfig: true } } } },
          portfolioAccount: { include: { portfolio: true } }
        }
      });
      if (!log) return null;

      const manualTemplate = log.campaign
        ? null
        : log.agentTemplateId
          ? await prisma.agentTemplate.findUnique({
              where: { id: log.agentTemplateId },
              include: { voiceAiConfig: true }
            })
          : null;
      const voiceCfg =
        log.campaign?.agentTemplate?.voiceAiConfig ?? manualTemplate?.voiceAiConfig ?? null;
      const settings = await prisma.workspaceSettings.findUnique({
        where: { workspaceRef: log.portfolioAccount.portfolio.workspaceRef }
      });

      return {
        id: log.id,
        portfolioAccountId: log.portfolioAccountId,
        campaignId: log.campaignId,
        debtAmountSnapshot: log.debtAmountSnapshot,
        providerRef: log.providerRef,
        channelData: log.channelData,
        agentSystemPrompt: voiceCfg?.systemPrompt ?? "",
        accountContext: buildOutreachContext(
          log.portfolioAccount as unknown as PortfolioAccountRecord,
          { currency: settings?.currency ?? "USD", locale: parseLocale(settings?.locale) }
        )
      };
    }
  };
}
