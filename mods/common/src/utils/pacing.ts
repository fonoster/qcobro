import type { EngineChannel } from "../types/engine.js";

/**
 * The engine's pacing buckets. Rate limits are per bucket, not per channel:
 * both voice channels share one bucket (one caller-ID pool, one concurrency
 * budget). This mapping is THE single encoding of that fact — the engine picks
 * buckets with it and the evaluator groups usage with it, so a future bucket
 * split only changes this function.
 */
export type PacingBucket = "voice" | "sms" | "email" | "whatsApp";

export function bucketOf(channel: EngineChannel): PacingBucket {
  if (channel === "VOICE_AI" || channel === "VOICE_PRERECORDED") return "voice";
  if (channel === "SMS") return "sms";
  if (channel === "EMAIL") return "email";
  return "whatsApp";
}

/**
 * Tokens a bucket may spend in a single tick, from its per-minute rate. Shared
 * by the engine's token buckets and the evaluator's SAF-5 cap check so the two
 * can never drift.
 */
export function perTickCapacity(ratePerMinute: number, tickSeconds: number): number {
  return Math.floor((Math.max(0, ratePerMinute) * Math.max(1, tickSeconds)) / 60);
}
