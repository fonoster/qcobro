import type { PrismaClient } from "@prisma/client";
import {
  buildOutreachContext,
  parseLocale,
  type Camino,
  type CreateContactLogInput,
  type EmailAutopilot,
  type PortfolioAccountRecord,
  type Resultado
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
  | { decided: true; resultado: Resultado | null };

/** `resultado` values this decision step may record. `OTHER`/`WRONG_NUMBER` no longer
 *  exist — an unrecognized string from the model (or a hallucinated removed value) collapses
 *  to `null`, same as no resultado at all. */
const VALID_RESULTADOS = new Set<Resultado>([
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

/** Pure: map the autopilot's raw decision string onto a valid `Resultado`, or null when
 *  absent or unrecognized. */
export function decideResultado(raw: string | null | undefined): Resultado | null {
  if (!raw) return null;
  return (VALID_RESULTADOS as ReadonlySet<string>).has(raw) ? (raw as Resultado) : null;
}

/** Pure: this decision step only ever runs once a transcript exists (see the
 *  `no_transcript` guard below), so reaching it means the call was answered and
 *  conversational — always `ENGAGED`. */
export function decideCamino(): Camino {
  return "ENGAGED";
}

/**
 * Runs the Voz IA autopilot decision once over a call's final transcript and records the
 * camino/resultado/Objective through the same {@link CreateContactLogInput} path
 * EMAIL/WhatsApp use.
 *
 * No-ops (without calling the autopilot) when the gestión is missing or its transcript is
 * empty — mirrors {@link createGenerateGestionInsight}'s `no_transcript` guard. Once the
 * autopilot has decided, the call was answered and conversational, so `camino: ENGAGED` is
 * always recorded — whether or not the decision also carries a `resultado`.
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

    const resultado = decideResultado(decision.resultado);
    const camino = decideCamino();
    const obj = decision.objective;
    await deps.recordOutcome({
      portfolioAccountId: g.portfolioAccountId,
      campaignId: g.campaignId ?? undefined,
      agentType: "VOICE_AI",
      contactedAt: deps.now().toISOString(),
      // This step only enriches an existing (already-dispatched) gestión; entrega itself
      // is decided elsewhere (recordVoiceAiCallStatus / resolveVoiceCallFromCdr) and
      // recordOutcomeTx never regresses it off DISPATCHED once it has advanced.
      entrega: "DISPATCHED",
      camino,
      resultado: resultado ?? undefined,
      providerRef: g.providerRef ?? undefined,
      debtAmountSnapshot: g.debtAmountSnapshot ?? undefined,
      intentMetadata: obj ? { promisedAmount: obj.amount, promisedDate: obj.dueDate } : undefined
    });
    return { decided: true, resultado };
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
