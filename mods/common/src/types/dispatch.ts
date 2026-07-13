/**
 * Ports and result types for the channel-dispatch trigger layer. Kept
 * provider-agnostic so dispatch functions depend on these interfaces and tests
 * inject emulators — no live Fonoster/Twilio in unit tests. The same primitives back
 * both the manual outreach flow and the campaigns engine.
 */

/** Channels the dispatch layer can trigger. */
export type DispatchChannel = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS" | "EMAIL" | "WHATSAPP";

/** Inputs for originating an outbound voice call (Fonoster). */
export interface OutboundCallInput {
  /** Caller-ID number (E.164). */
  from: string;
  /** Destination number (E.164). */
  to: string;
  /** The provider application ref to drive the call (AUTOPILOT app). */
  appRef: string;
  /**
   * Rendered, per-customer conversation payload passed as call metadata so
   * personalization does not require re-syncing the application.
   */
  metadata: Record<string, string>;
}

export interface OutboundCallClient {
  /** Originate a call; resolves with the provider call ref. */
  createCall(input: OutboundCallInput): Promise<{ ref: string }>;
}

export interface SmsClient {
  /** Send an SMS; resolves with the provider message ref/sid. */
  sendMessage(input: { from: string; to: string; body: string }): Promise<{ sid: string }>;
}

/** Inputs for sending an email (Resend). */
export interface EmailSendInput {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  /** Per-attempt reply-to address carrying the correlation token. */
  replyTo: string;
  /** When this is a reply within a thread, the upstream Message-ID to thread under. */
  inReplyTo?: string;
}

/**
 * A received inbound email fetched from the provider. The inbound webhook is
 * metadata-only (Resend's `email.received`), so the body must be retrieved
 * separately by provider id before it can be ingested.
 */
export interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
  messageId?: string;
  headers?: Record<string, string>;
}

export interface EmailClient {
  /** Send an email; resolves with the provider message id. */
  sendEmail(input: EmailSendInput): Promise<{ id: string }>;
  /**
   * Fetch a received inbound email's full content by provider id. Optional because
   * not every provider/emulator supports inbound retrieval; the inbound handler
   * uses it to hydrate the body the webhook omits.
   */
  getReceivedEmail?(id: string): Promise<ReceivedEmail | null>;
}

/** A single named WhatsApp template parameter (`{ parameter_name, text }` at the Meta boundary). */
export interface WhatsAppTemplateParam {
  parameterName: string;
  text: string;
}

/** Inputs for sending a Meta-approved WhatsApp template (the conversation opener). */
export interface WhatsAppSendTemplateInput {
  /** Destination number (E.164, no `+` is added here — pass provider-ready). */
  to: string;
  /** Meta-approved template name. */
  templateName: string;
  /** Meta template-send language code (e.g. `es_DO`), sourced from the workspace. */
  languageCode: string;
  /** Named body parameters; matched to the template's `{{placeholders}}` by name. */
  params: WhatsAppTemplateParam[];
}

/**
 * A WhatsApp template resolved from Meta by name. Backs the agent-template modal's
 * read-only preview and the stored `templateName`/`messageBody`.
 */
export interface WhatsAppFetchedTemplate {
  id: string;
  name: string;
  language: string;
  /** Template body text with `{{placeholders}}`. */
  body: string;
  /** Meta approval status (e.g. `APPROVED`, `PENDING`, `REJECTED`). */
  status: string;
}

/**
 * WhatsApp messaging port (Meta Cloud API). Resolved per-call from the owning
 * workspace's integration + selected sender, because credentials are tenant-owned and
 * cannot be injected once at boot like the voice/SMS pools.
 */
export interface WhatsAppClient {
  /** Send an approved template (the opener); resolves with the provider message id. */
  sendTemplate(input: WhatsAppSendTemplateInput): Promise<{ id: string }>;
  /** Send a free-form reply, valid only inside Meta's 24h window; resolves with the message id. */
  sendText(input: { to: string; body: string }): Promise<{ id: string }>;
  /**
   * Fetch a template by name (modal preview / config-time resolution). `language`
   * disambiguates when the WABA has the same template name approved in more than one
   * language (a workspace's `defaultLanguage` is passed here); when omitted, or when no
   * template matches it, the first name match is returned.
   */
  fetchTemplate(templateName: string, language?: string): Promise<WhatsAppFetchedTemplate | null>;
}

/** Picks a sending number from a configured pool. Injectable for determinism. */
export type NumberSelector = (numbers: string[]) => string;

/** Structured result of a single dispatch — what was sent, where, and the provider ref. */
export interface DispatchResult {
  channel: DispatchChannel;
  /** Provider call ref (voice), message sid (sms), or reply-to token (email). */
  providerRef: string;
  /** The sending number used. */
  from: string;
  /** The destination number. */
  to: string;
  /** The rendered body actually delivered (SMS body / voice first line or script). */
  renderedBody: string;
  /** The rendered subject line — present for EMAIL only. */
  renderedSubject?: string;
}

/** Dependencies injected into the dispatch functions. */
export interface DispatchDeps {
  outboundCallClient: OutboundCallClient | null;
  smsClient: SmsClient | null;
  /** Email provider client; null/omitted when email is unconfigured. */
  emailClient?: EmailClient | null;
  /**
   * WhatsApp client for this dispatch. Resolved per-call from the owning workspace's
   * integration + selected sender (decrypt token, build/cache client) and passed in;
   * null/omitted when the dispatch is not WhatsApp or the workspace has no integration.
   */
  whatsAppClient?: WhatsAppClient | null;
  /** E.164 caller-ID pool for voice. */
  fonosterNumbers: string[];
  /** E.164 sender pool for SMS. */
  twilioFromNumbers: string[];
  /** Sending identity for email (from `resend` config); null/omitted when unconfigured. */
  emailFrom?: { email: string; name?: string; inboundDomain: string } | null;
  /** Number selector; defaults to a random pick when omitted by the caller. */
  pickNumber?: NumberSelector;
}
