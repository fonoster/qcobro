import {
  inboundEmailSchema,
  withErrorHandlingAndValidation,
  type CreateContactLogInput,
  type EmailAutopilot,
  type EmailAutopilotDecision,
  type EmailClient,
  type EmailThread,
  type EmailThreadMessage,
  type InboundEmailInput
} from "@qcobro/common";

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
function extractToken(to: string[]): string | null {
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
 * reached, it generates + sends the reply and counts it. Outcomes/Objectives are captured
 * via {@link recordOutcomeTx} (never downgrade a real outcome; idempotent Objective).
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
              : undefined
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

    // When the reply implies an outcome, persist it (+ Objective/suppression) through
    // recordOutcome, which also writes the merged channelData on the same gestión row.
    if (decision.outcome) {
      const obj = decision.objective;
      await deps.recordOutcome({
        portfolioAccountId: g.portfolioAccountId,
        campaignId: g.campaignId ?? undefined,
        agentType: "EMAIL",
        contactedAt: nowIso,
        outcome: decision.outcome as CreateContactLogInput["outcome"],
        providerRef: token,
        debtAmountSnapshot: g.debtAmountSnapshot ?? undefined,
        channelData,
        intentMetadata: obj ? { promisedAmount: obj.amount, promisedDate: obj.dueDate } : undefined
      });
    } else {
      await deps.client.updateChannelData(g.id, channelData);
    }

    return { matched: true, id: g.id, action };
  };

  return withErrorHandlingAndValidation(fn, inboundEmailSchema);
}
