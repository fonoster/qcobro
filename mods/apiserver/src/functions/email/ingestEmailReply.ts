import {
  inboundEmailSchema,
  resultadoSchema,
  withErrorHandlingAndValidation,
  type CreateContactLogInput,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type EmailClient,
  type EmailThread,
  type EmailThreadMessage,
  type InboundEmailInput,
  type Resultado
} from "@qcobro/common";

/** Maps the autopilot's raw decision string onto a valid `Resultado`, or null when absent
 *  or unrecognized (e.g. a removed value like `OTHER`/`WRONG_NUMBER` the model hallucinates). */
function toResultado(raw: string | null | undefined): Resultado | null {
  if (!raw) return null;
  const parsed = resultadoSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The gestión + agent config the autopilot needs, loaded by correlation token. */
export interface EmailGestionView {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  debtAmountSnapshot: number | null;
  /** The customer's email (reply recipient). */
  customerEmail: string;
  channelData: Record<string, unknown> | null;
  agentSystemPrompt: string;
  /** Per-agent reply cap; null → use the deployment default. */
  agentMaxReplies: number | null;
  /** Render context (account fields) for the autopilot. */
  accountContext: Record<string, unknown>;
}

/** The DB surface ingestion needs — a small port so tests inject a fake. */
export interface EmailInboundClient {
  loadByProviderRef(token: string): Promise<EmailGestionView | null>;
  updateChannelData(id: string, channelData: Record<string, unknown>): Promise<void>;
}

export interface IngestEmailReplyDeps {
  client: EmailInboundClient;
  autopilot: EmailAutopilot;
  /** Persists outcome/Objective/suppression (createRecordOutcome) — same guarantees as voice. */
  recordOutcome: (params: CreateContactLogInput) => Promise<unknown>;
  emailClient: EmailClient | null;
  emailFrom: { email: string; name?: string; inboundDomain: string } | null;
  /** Deployment default reply cap (ceiling); per-agent `maxReplies` can only lower it. */
  maxRepliesDefault: number;
  now: () => Date;
}

export type IngestEmailReplyResult =
  | { matched: false }
  | { matched: true; id: string; action: "reply" | "ignore" | "resolve" | "escalate" };

/** Pulls the per-attempt correlation token out of the reply-to addresses (`reply+<token>@…`). */
export function extractToken(to: string[]): string | null {
  for (const addr of to) {
    const m = addr.match(/reply\+([^@>\s]+)@/i);
    if (m) return m[1];
  }
  return null;
}

/** Out-of-office / bulk auto-replies must not drive the conversation or burn the cap. */
function isAutoReply(headers?: Record<string, string>): boolean {
  if (!headers) return false;
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const autoSubmitted = lower["auto-submitted"];
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return true;
  const precedence = (lower["precedence"] ?? "").toLowerCase();
  return precedence === "bulk" || precedence === "auto_reply" || precedence === "junk";
}

/**
 * Ingests an inbound email reply into its originating gestión and runs the EMAIL autopilot.
 *
 * Correlates by the per-attempt reply-to token (the gestión `providerRef`), appends the
 * reply to the email thread (in `channelData`, the email analog of the voice transcript),
 * then asks the autopilot what to do. Auto-replies are ignored without counting. When the
 * decision is `reply` and the per-attempt cap (min(agent, deployment default)) is not yet
 * reached, it generates + sends the reply and counts it.
 *
 * An inbound reply is proof of delivery, so every call records through {@link recordOutcomeTx}
 * (never downgrades `entrega` off DISPATCHED, idempotent Objective): `entrega: DELIVERED` and
 * `camino: ENGAGED` are always recorded, and `resultado` is set when the decision implies one.
 */
export function createIngestEmailReply(deps: IngestEmailReplyDeps) {
  const fn = async (inbound: InboundEmailInput): Promise<IngestEmailReplyResult> => {
    const token = extractToken(inbound.to);
    if (!token) return { matched: false };

    const g = await deps.client.loadByProviderRef(token);
    if (!g) return { matched: false };

    const nowIso = deps.now().toISOString();
    const existing = g.channelData ?? {};
    const thread: EmailThread = (existing.emailThread as EmailThread | undefined) ?? {
      token,
      messages: [],
      agentReplyCount: 0
    };

    thread.messages.push({
      direction: "inbound",
      from: inbound.from,
      at: nowIso,
      subject: inbound.subject,
      body: inbound.text,
      messageId: inbound.messageId
    });

    const cap = Math.min(g.agentMaxReplies ?? deps.maxRepliesDefault, deps.maxRepliesDefault);
    const atCap = thread.agentReplyCount >= cap;

    const decision: EmailAutopilotDecision = isAutoReply(inbound.headers)
      ? { action: "ignore" }
      : await deps.autopilot.decide({
          systemPrompt: g.agentSystemPrompt,
          thread: thread.messages,
          context: g.accountContext,
          language:
            typeof g.accountContext.preferredLanguage === "string"
              ? g.accountContext.preferredLanguage
              : undefined,
          referenceDate: nowIso.slice(0, 10)
        });

    // Cap reached → never auto-reply; surface for an operator instead.
    let action = decision.action;
    if (action === "reply" && atCap) action = "escalate";

    if (action === "reply" && decision.replyBody && deps.emailClient && deps.emailFrom) {
      const sent = await deps.emailClient.sendEmail({
        from: deps.emailFrom.email,
        fromName: deps.emailFrom.name,
        to: g.customerEmail,
        subject: `Re: ${inbound.subject ?? thread.messages[0]?.subject ?? ""}`.trim(),
        body: decision.replyBody,
        replyTo: `reply+${token}@${deps.emailFrom.inboundDomain}`,
        inReplyTo: inbound.messageId
      });
      const agentMsg: EmailThreadMessage = {
        direction: "outbound",
        from: deps.emailFrom.email,
        at: deps.now().toISOString(),
        body: decision.replyBody,
        messageId: sent.id
      };
      thread.messages.push(agentMsg);
      thread.agentReplyCount += 1;
    }

    const channelData = { ...existing, emailThread: thread };

    // An inbound reply is proof of delivery: entrega advances to DELIVERED (recordOutcomeTx
    // never regresses it if a prior callback already moved it further) and camino is
    // ENGAGED. resultado is set only when the decision implies one; this also writes the
    // merged channelData on the same gestión row.
    const resultado = toResultado(decision.resultado);
    const obj = decision.objective;
    await deps.recordOutcome({
      portfolioAccountId: g.portfolioAccountId,
      campaignId: g.campaignId ?? undefined,
      agentType: "EMAIL",
      contactedAt: nowIso,
      entrega: "DELIVERED",
      camino: "ENGAGED",
      resultado: resultado ?? undefined,
      providerRef: token,
      debtAmountSnapshot: g.debtAmountSnapshot ?? undefined,
      channelData,
      intentMetadata: obj ? { promisedAmount: obj.amount, promisedDate: obj.dueDate } : undefined
    });

    return { matched: true, id: g.id, action };
  };

  return withErrorHandlingAndValidation(fn, inboundEmailSchema);
}
