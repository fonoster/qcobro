/**
 * Types for the bidirectional EMAIL channel: the per-gestión email thread (stored in the
 * gestión `channelData`, the email analog of the voice transcript) and the autopilot
 * decision contract used by `ingestEmailReply`.
 */

/** One message in an email thread. */
export interface EmailThreadMessage {
  direction: "outbound" | "inbound";
  /** "agent" (autopilot/notice) or the customer's address. */
  from: string;
  at: string;
  subject?: string;
  body: string;
  /** Provider Message-ID, for header-based threading fallback. */
  messageId?: string;
}

/** The email thread + reply accounting carried on an EMAIL gestión's channelData. */
export interface EmailThread {
  /** Correlation token, mirrored from the gestión providerRef. */
  token: string;
  messages: EmailThreadMessage[];
  /** Count of autopilot replies sent on this thread (governs the reply cap). */
  agentReplyCount: number;
}

/** Actions the EMAIL autopilot may take on an inbound reply. */
export type EmailAutopilotAction = "reply" | "ignore" | "resolve" | "escalate";

/** Structured result of the autopilot decision step over a thread. */
export interface EmailAutopilotDecision {
  action: EmailAutopilotAction;
  /** Present when `action === "reply"`. Gemini's JSON mode may send `null` instead of omitting. */
  replyBody?: string | null;
  /** Outcome to record on the gestión, when the reply implies one. May come back `null`. */
  outcome?: string | null;
  /** Promise/objective details to capture, when applicable. */
  objective?: { type: string; amount?: number; dueDate?: string; note?: string } | null;
}

/** What the autopilot is given to decide on. */
export interface EmailAutopilotRequest {
  systemPrompt: string;
  thread: EmailThreadMessage[];
  context?: Record<string, unknown>;
  language?: string;
  /**
   * "Today" as an ISO date (`YYYY-MM-DD`), so the model can resolve relative promises
   * ("mañana", "el viernes") into the absolute `objective.dueDate` it must return.
   */
  referenceDate?: string;
}

/** The autopilot decision engine (LLM-backed in prod, deterministic mock offline). */
export interface EmailAutopilot {
  decide(req: EmailAutopilotRequest): Promise<EmailAutopilotDecision>;
}

/** Normalized inbound email as received from the provider webhook. */
export interface InboundEmail {
  from: string;
  to: string[];
  subject?: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  /** Raw header lookups used for auto-reply detection (`Auto-Submitted`, `Precedence`). */
  headers?: Record<string, string>;
}
