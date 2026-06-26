import type {
  OutboundCallClient,
  SmsClient,
  EmailClient,
  EmailSendInput,
  OutboundCallInput
} from "@qcobro/common";

/**
 * Channel emulators — TEST SUPPORT ONLY. They stand in for the real Fonoster/Twilio
 * clients so the engine can be simulated end to end (real DB writes, real reservation
 * and accounting) with the channel as the only faked part. Each emulator records what
 * it was asked to dispatch and returns a deterministic provider ref, so tests assert on
 * the recorded log and the TickReport. NEVER import these from production code — the
 * engine wires the real provider clients via config.
 */

/** A single recorded would-be dispatch. */
export interface EmulatedDispatch {
  channel: "voice" | "sms" | "email";
  to: string;
  from: string;
  ref: string;
  /** Voice only: the application ref + per-call metadata. */
  appRef?: string;
  metadata?: Record<string, string>;
  /** SMS / EMAIL: the rendered body. */
  body?: string;
  /** EMAIL only: subject + the per-attempt reply-to address. */
  subject?: string;
  replyTo?: string;
}

/** Emulated Fonoster outbound-call client. */
export class EmulatedOutboundCallClient implements OutboundCallClient {
  readonly calls: EmulatedDispatch[] = [];
  private seq = 0;

  constructor(private readonly opts: { fail?: boolean } = {}) {}

  async createCall(input: OutboundCallInput): Promise<{ ref: string }> {
    if (this.opts.fail) throw new Error("emulated voice dispatch failure");
    const ref = `sim-call-${++this.seq}`;
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

  constructor(private readonly opts: { fail?: boolean } = {}) {}

  async sendMessage(input: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    if (this.opts.fail) throw new Error("emulated sms dispatch failure");
    const sid = `sim-sms-${++this.seq}`;
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

  constructor(private readonly opts: { fail?: boolean } = {}) {}

  async sendEmail(input: EmailSendInput): Promise<{ id: string }> {
    if (this.opts.fail) throw new Error("emulated email dispatch failure");
    const id = `sim-email-${++this.seq}`;
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
