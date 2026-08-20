import { z } from "zod";
import {
  resultadoSchema,
  withErrorHandlingAndValidation,
  type CreateContactLogInput,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type Resultado,
  type WhatsAppClient,
  type WhatsAppThread,
  type WhatsAppThreadMessage
} from "@qcobro/common";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Maps the autopilot's raw decision string onto a valid `Resultado`, or null when absent
 *  or unrecognized (e.g. a removed value like `OTHER`/`WRONG_NUMBER` the model hallucinates). */
function toResultado(raw: string | null | undefined): Resultado | null {
  if (!raw) return null;
  const parsed = resultadoSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The gestión + agent config the autopilot needs, loaded from the DB. */
export interface WhatsAppGestionView {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  debtAmountSnapshot: number | null;
  customerPhone: string;
  workspaceRef: string;
  /** Sender number used to dispatch the outbound template message. */
  phoneNumberId: string;
  /** Meta message id stored at dispatch time — used to correlate recordOutcome. */
  providerRef: string | null;
  channelData: Record<string, unknown> | null;
  agentSystemPrompt: string;
  agentMaxReplies: number | null;
  accountContext: Record<string, unknown>;
}

/** The DB surface ingestion needs — a small port so tests inject a fake. */
export interface WhatsAppInboundClient {
  /**
   * Find the most recent WHATSAPP gestión where our sender (`phoneNumberId`) dispatched
   * to `customerPhone`. Returns null when no match (e.g. unsolicited / unknown contact).
   */
  loadByPhoneAndSender(
    phoneNumberId: string,
    customerPhone: string
  ): Promise<WhatsAppGestionView | null>;
  updateChannelData(id: string, channelData: Record<string, unknown>): Promise<void>;
}

export interface IngestWhatsAppMessageDeps {
  client: WhatsAppInboundClient;
  autopilot: EmailAutopilot;
  recordOutcome: (params: CreateContactLogInput) => Promise<unknown>;
  /**
   * Resolve the WhatsApp send client for a workspace + sender.
   * Same function injected into the engine and start.ts.
   */
  getWhatsAppClient: (
    workspaceRef: string,
    phoneNumberId: string
  ) => Promise<WhatsAppClient | null>;
  /** Deployment-wide default reply cap (per gestión). Per-agent `maxReplies` can only lower it. */
  maxRepliesDefault: number;
  now: () => Date;
}

export const inboundWhatsAppMessageSchema = z.object({
  /** Customer's E.164 phone number (the message sender). */
  from: z.string().min(1),
  metaMessageId: z.string().min(1),
  /** Unix-seconds timestamp string from the Meta webhook payload. */
  timestamp: z.string(),
  text: z.string().default(""),
  /** Our sender number that received the message. */
  phoneNumberId: z.string().min(1)
});
export type InboundWhatsAppMessageInput = z.infer<typeof inboundWhatsAppMessageSchema>;

export type IngestWhatsAppResult =
  | { matched: false }
  | { matched: true; id: string; action: string; providerRef?: string };

function isWindowOpen(lastCustomerMessageAt: string, now: Date): boolean {
  return now.getTime() - new Date(lastCustomerMessageAt).getTime() < TWENTY_FOUR_HOURS_MS;
}

/**
 * Ingests an inbound customer WhatsApp message into its originating gestión and runs the
 * WHATSAPP autopilot.
 *
 * Correlates by `phoneNumberId + customerPhone` (the most recent WHATSAPP gestión our
 * sender dispatched to that customer). Appends the inbound message to the WhatsApp thread
 * in `channelData.whatsAppThread`, runs the autopilot, and — if in window and under cap —
 * sends a free-form text reply via `WhatsAppClient.sendText`. An inbound message is proof of
 * delivery, so every call records through `recordOutcome` (never downgrades `entrega` off
 * DISPATCHED; idempotent Objective): `entrega: DELIVERED` and `camino: ENGAGED` are always
 * recorded, and `resultado` is set when the decision implies one.
 *
 * 24 h window: if the customer's last message is more than 24 h old, free-form text is
 * forbidden by Meta; the action is escalated rather than sent.
 */
export function createIngestWhatsAppMessage(deps: IngestWhatsAppMessageDeps) {
  const fn = async (msg: InboundWhatsAppMessageInput): Promise<IngestWhatsAppResult> => {
    const g = await deps.client.loadByPhoneAndSender(msg.phoneNumberId, msg.from);
    if (!g) return { matched: false };

    const now = deps.now();
    const nowIso = now.toISOString();
    const existing = g.channelData ?? {};

    // Load or initialize the WhatsApp thread stored on this gestión.
    const thread: WhatsAppThread = (existing.whatsAppThread as WhatsAppThread | undefined) ?? {
      customerPhone: msg.from,
      messages: [],
      agentReplyCount: 0,
      lastCustomerMessageAt: nowIso
    };

    const inboundMsg: WhatsAppThreadMessage = {
      direction: "inbound",
      from: msg.from,
      at: nowIso,
      body: msg.text,
      metaMessageId: msg.metaMessageId
    };
    thread.messages.push(inboundMsg);
    thread.lastCustomerMessageAt = nowIso;

    const cap = Math.min(g.agentMaxReplies ?? deps.maxRepliesDefault, deps.maxRepliesDefault);
    const atCap = thread.agentReplyCount >= cap;
    const inWindow = isWindowOpen(thread.lastCustomerMessageAt, now);

    const decision: EmailAutopilotDecision = await deps.autopilot.decide({
      systemPrompt: g.agentSystemPrompt,
      thread: thread.messages,
      context: g.accountContext,
      language:
        typeof g.accountContext.preferredLanguage === "string"
          ? g.accountContext.preferredLanguage
          : undefined
    });

    let action = decision.action;
    // Suppress the reply when the cap is reached or the 24 h window has closed.
    if (action === "reply" && (atCap || !inWindow)) action = "escalate";

    if (action === "reply" && decision.replyBody) {
      const waClient = await deps.getWhatsAppClient(g.workspaceRef, g.phoneNumberId);
      if (waClient) {
        await waClient.sendText({ to: msg.from, body: decision.replyBody });
        const agentMsg: WhatsAppThreadMessage = {
          direction: "outbound",
          from: g.phoneNumberId,
          at: deps.now().toISOString(),
          body: decision.replyBody
        };
        thread.messages.push(agentMsg);
        thread.agentReplyCount += 1;
      }
    }

    const channelData = { ...existing, whatsAppThread: thread };

    const resultado = toResultado(decision.resultado);
    const obj = decision.objective;

    // `recordOutcome` correlates only by `providerRef`. A gestión without one (legacy or
    // manually created rows — the field is nullable) would therefore be *inserted* rather than
    // enriched, and because the new row also has a null ref it would become the match for the
    // next inbound message, duplicating a gestión per customer reply. Persist the thread
    // directly instead; the axes stay as they are for those rare rows.
    if (!g.providerRef) {
      await deps.client.updateChannelData(g.id, channelData);
      return { matched: true, id: g.id, action, providerRef: undefined };
    }

    await deps.recordOutcome({
      portfolioAccountId: g.portfolioAccountId,
      campaignId: g.campaignId ?? undefined,
      agentType: "WHATSAPP",
      contactedAt: nowIso,
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: resultado ?? undefined,
      providerRef: g.providerRef ?? undefined,
      debtAmountSnapshot: g.debtAmountSnapshot ?? undefined,
      channelData,
      intentMetadata: obj ? { promisedAmount: obj.amount, promisedDate: obj.dueDate } : undefined
    });

    return { matched: true, id: g.id, action, providerRef: g.providerRef ?? undefined };
  };

  return withErrorHandlingAndValidation(fn, inboundWhatsAppMessageSchema);
}
