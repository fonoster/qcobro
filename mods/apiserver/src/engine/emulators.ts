import {
  DispatchError,
  type DispatchErrorKind,
  type EngineEvent,
  type EngineEventSink,
  type OutboundCallClient,
  type SmsClient,
  type EmailClient,
  type EmailSendInput,
  type OutboundCallInput,
  type WhatsAppClient,
  type WhatsAppFetchedTemplate,
  type WhatsAppSendTemplateInput
} from "@qcobro/common";

/**
 * `fail: true` throws a `SYSTEM_ERROR` (matches an unclassified provider crash); pass an
 * explicit `DispatchErrorKind` to simulate the other classification.
 */
type FailOpt = boolean | DispatchErrorKind;

function failError(fail: true | DispatchErrorKind, label: string): DispatchError {
  return new DispatchError(
    fail === true ? "SYSTEM_ERROR" : fail,
    `emulated ${label} dispatch failure`
  );
}

/**
 * Channel emulators — TEST SUPPORT ONLY. They stand in for the real Fonoster/Twilio
 * clients so the engine can be simulated end to end (real DB writes, real reservation
 * and accounting) with the channel as the only faked part. Each emulator records what
 * it was asked to dispatch and returns a deterministic provider ref, so tests assert on
 * the recorded log and the TickReport. NEVER import these from production code — the
 * engine wires the real provider clients via config.
 */

/** Per-instance tag so refs never collide across separate runs (providerRef is unique in the DB). */
const makeRunTag = () => Math.random().toString(36).slice(2, 8);

/** A single recorded would-be dispatch. */
export interface EmulatedDispatch {
  channel: "voice" | "sms" | "email" | "whatsapp";
  to: string;
  from: string;
  ref: string;
  /** Voice only: the application ref + per-call metadata. */
  appRef?: string;
  metadata?: Record<string, string>;
  /** SMS / EMAIL / WHATSAPP: the rendered body. */
  body?: string;
  /** EMAIL only: subject + the per-attempt reply-to address. */
  subject?: string;
  replyTo?: string;
  /** WHATSAPP only: template send-kind ("template" opener vs free-form "text" reply) + named params. */
  kind?: "template" | "text";
  templateName?: string;
  params?: Array<{ parameterName: string; text: string }>;
}

/** Emulated Fonoster outbound-call client. */
export class EmulatedOutboundCallClient implements OutboundCallClient {
  readonly calls: EmulatedDispatch[] = [];
  private seq = 0;
  private readonly run = makeRunTag();

  constructor(private readonly opts: { fail?: FailOpt } = {}) {}

  async createCall(input: OutboundCallInput): Promise<{ ref: string }> {
    if (this.opts.fail) throw failError(this.opts.fail, "voice");
    const ref = `sim-call-${this.run}-${++this.seq}`;
    this.calls.push({
      channel: "voice",
      to: input.to,
      from: input.from,
      appRef: input.appRef,
      metadata: input.metadata,
      ref
    });
    return { ref };
  }
}

/** Emulated Twilio SMS client. */
export class EmulatedSmsClient implements SmsClient {
  readonly messages: EmulatedDispatch[] = [];
  private seq = 0;
  private readonly run = makeRunTag();

  constructor(private readonly opts: { fail?: FailOpt } = {}) {}

  async sendMessage(input: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    if (this.opts.fail) throw failError(this.opts.fail, "sms");
    const sid = `sim-sms-${this.run}-${++this.seq}`;
    this.messages.push({
      channel: "sms",
      to: input.to,
      from: input.from,
      body: input.body,
      ref: sid
    });
    return { sid };
  }
}

/** Emulated Resend email client. */
export class EmulatedEmailClient implements EmailClient {
  readonly emails: EmulatedDispatch[] = [];
  private seq = 0;
  private readonly run = makeRunTag();

  constructor(private readonly opts: { fail?: FailOpt } = {}) {}

  async sendEmail(input: EmailSendInput): Promise<{ id: string }> {
    if (this.opts.fail) throw failError(this.opts.fail, "email");
    const id = `sim-email-${this.run}-${++this.seq}`;
    this.emails.push({
      channel: "email",
      to: input.to,
      from: input.from,
      subject: input.subject,
      body: input.body,
      replyTo: input.replyTo,
      ref: id
    });
    return { id };
  }
}

/**
 * Emulated Meta WhatsApp client. Records each opener (`sendTemplate`) and free-form reply
 * (`sendText`) and returns a deterministic message id, so tests assert on the recorded log
 * without a live Graph API. `fetchTemplate` returns a canned approved template (or the
 * configured map) to back the modal-preview path.
 */
export class EmulatedWhatsAppClient implements WhatsAppClient {
  readonly messages: EmulatedDispatch[] = [];
  private seq = 0;
  private readonly run = makeRunTag();

  constructor(
    private readonly opts: {
      fail?: FailOpt;
      /** Provider-ready sender shown in the recorded log; the real client has it implicit. */
      from?: string;
      /** Templates returned by `fetchTemplate`, keyed by template name. */
      templates?: Record<string, WhatsAppFetchedTemplate>;
    } = {}
  ) {}

  async sendTemplate(input: WhatsAppSendTemplateInput): Promise<{ id: string }> {
    if (this.opts.fail) throw failError(this.opts.fail, "whatsapp");
    const id = `sim-wa-${this.run}-${++this.seq}`;
    this.messages.push({
      channel: "whatsapp",
      to: input.to,
      from: this.opts.from ?? "",
      ref: id,
      kind: "template",
      templateName: input.templateName,
      params: input.params
    });
    return { id };
  }

  async sendText(input: { to: string; body: string }): Promise<{ id: string }> {
    if (this.opts.fail) throw failError(this.opts.fail, "whatsapp");
    const id = `sim-wa-${this.run}-${++this.seq}`;
    this.messages.push({
      channel: "whatsapp",
      to: input.to,
      from: this.opts.from ?? "",
      ref: id,
      kind: "text",
      body: input.body
    });
    return { id };
  }

  async fetchTemplate(templateName: string): Promise<WhatsAppFetchedTemplate | null> {
    return this.opts.templates?.[templateName] ?? null;
  }
}

/** In-memory flight-recorder sink so simulations can hand the stream to `evaluate`. */
export class InMemoryEngineEventSink implements EngineEventSink {
  readonly events: EngineEvent[] = [];

  constructor(private readonly opts: { fail?: boolean } = {}) {}

  async record(events: EngineEvent[]): Promise<void> {
    if (this.opts.fail) throw new Error("emulated event sink failure");
    this.events.push(...events);
  }
}
