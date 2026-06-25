/**
 * Campaigns-engine contracts: the injectable clock and the TickReport.
 *
 * These are provider- and DB-agnostic so the engine's decision logic is testable
 * with an injected clock and asserted against the report, with no live services.
 * The channel-dispatch ports (`OutboundCallClient`, `SmsClient`, `NumberSelector`)
 * are reused from `./dispatch.js` — channel emulators implement those interfaces.
 */

/** Injectable time source so window/scheduling math is deterministic under test. */
export interface Clock {
  now(): Date;
}

/** Channels the engine can dispatch (the subset `dispatchOutreach` supports). */
export type EngineChannel = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS";

/** Why a campaign was not dispatched at all this tick. */
export type CampaignSkipReason =
  | "not_active"
  | "out_of_window"
  | "channel_not_configured"
  | "channel_not_supported"
  | "empty_number_pool"
  | "voice_not_synced";

/** The outcome of considering a single account during a tick. */
export type AccountDecision =
  | "dispatched"
  | "dispatch_failed"
  | "no_phone"
  | "intent_suppressed"
  | "account_suppressed"
  | "promise_suppressed"
  | "lifetime_cap"
  | "daily_cap"
  | "budget_exhausted";

/** Per-account line in the tick report. */
export interface AccountDecisionEntry {
  portfolioAccountId: string;
  decision: AccountDecision;
  /** Provider ref when `decision === "dispatched"`. */
  providerRef?: string;
}

/** Per-campaign section of the tick report. */
export interface CampaignTickReport {
  campaignId: string;
  inWindow: boolean;
  /** Set when the whole campaign was skipped (status/window/readiness). */
  skipReason?: CampaignSkipReason;
  decisions: AccountDecisionEntry[];
  dispatched: number;
  suppressed: number;
  skipped: number;
  /** Set when the engine auto-completed the campaign this tick. */
  completed?: boolean;
}

/** Per-channel token-bucket usage for a tick. */
export interface ChannelUsage {
  dispatched: number;
  budget: number;
}

/** The full result of one engine tick — logged in production, asserted in tests. */
export interface TickReport {
  at: string;
  campaigns: CampaignTickReport[];
  channelUsage: Partial<Record<EngineChannel, ChannelUsage>>;
}
