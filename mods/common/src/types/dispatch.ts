/**
 * Ports and result types for the channel-dispatch trigger layer. Kept
 * provider-agnostic so dispatch functions depend on these interfaces and tests
 * inject emulators — no live Fonoster/Twilio in unit tests. The same primitives back
 * both the manual outreach flow and the campaigns engine.
 */

/** Channels the dispatch layer can trigger. */
export type DispatchChannel = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS";

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

/** Picks a sending number from a configured pool. Injectable for determinism. */
export type NumberSelector = (numbers: string[]) => string;

/** Structured result of a single dispatch — what was sent, where, and the provider ref. */
export interface DispatchResult {
  channel: DispatchChannel;
  /** Provider call ref (voice) or message sid (sms). */
  providerRef: string;
  /** The sending number used. */
  from: string;
  /** The destination number. */
  to: string;
  /** The rendered body actually delivered (SMS body / voice first line or script). */
  renderedBody: string;
}

/** Dependencies injected into the dispatch functions. */
export interface DispatchDeps {
  outboundCallClient: OutboundCallClient | null;
  smsClient: SmsClient | null;
  /** E.164 caller-ID pool for voice. */
  fonosterNumbers: string[];
  /** E.164 sender pool for SMS. */
  twilioFromNumbers: string[];
  /** Number selector; defaults to a random pick when omitted by the caller. */
  pickNumber?: NumberSelector;
}
