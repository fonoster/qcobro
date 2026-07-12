import { toMicroUnits } from "./money.js";
import type {
  BillingMeter,
  MessageMeter,
  MessageRate,
  RateOverrides,
  Rates,
  VoiceMeter,
  VoiceRate
} from "./rates.js";
import { MESSAGE_METERS } from "./rates.js";

/**
 * Pricing math: increment billing, meter pricing, and rate resolution.
 *
 * Rates are resolved and applied exactly once, when a usage record is written;
 * the resulting unit price and amount are stored on the record so history never
 * reprices (see the usage-ledger spec).
 */

/** A parsed increment pair (seconds). */
export interface IncrementPair {
  initialSeconds: number;
  subsequentSeconds: number;
}

/** Parses `"initial/subsequent"` notation (e.g. `"15/15"`, `"60/6"`). */
export function parseIncrements(notation: string): IncrementPair {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(notation);
  if (!match) throw new RangeError(`Invalid increment notation: "${notation}"`);
  return { initialSeconds: Number(match[1]), subsequentSeconds: Number(match[2]) };
}

/**
 * Billed seconds for an answered duration under an increment pair:
 * 0 when never answered; the initial increment for any answered duration up to
 * it; then rounded up to whole subsequent increments. Canonical 15/15 vectors:
 * 1→15, 15→15, 16→30, 35→45, unanswered→0.
 */
export function billedSeconds(answeredSeconds: number, increments: IncrementPair): number {
  if (answeredSeconds <= 0) return 0;
  const { initialSeconds, subsequentSeconds } = increments;
  if (answeredSeconds <= initialSeconds) return initialSeconds;
  return (
    initialSeconds +
    Math.ceil((answeredSeconds - initialSeconds) / subsequentSeconds) * subsequentSeconds
  );
}

/** The unit price of one message on a message meter, in micro-units. */
export function priceMessageMicro(rate: MessageRate): number {
  return toMicroUnits(rate.perMessage);
}

/** A priced voice usage: what gets stored on the usage record. */
export interface VoicePrice {
  /** Increment-billed seconds (the record's quantity). */
  billedSeconds: number;
  /** The per-minute rate in micro-units (the record's unit price). */
  perMinuteMicro: number;
  /** billedSeconds × perMinuteMicro / 60, rounded to the nearest micro-unit. */
  amountMicro: number;
}

/** Prices an answered duration on a voice meter. Unanswered (≤ 0s) prices to zero. */
export function priceVoiceMicro(answeredSeconds: number, rate: VoiceRate): VoicePrice {
  const seconds = billedSeconds(answeredSeconds, parseIncrements(rate.increments));
  const perMinuteMicro = toMicroUnits(rate.perMinute);
  return {
    billedSeconds: seconds,
    perMinuteMicro,
    amountMicro: Math.round((seconds * perMinuteMicro) / 60)
  };
}

/**
 * The pre-dispatch credit-bucket debit for a voice call: the configured
 * estimate, never less than the initial increment (an answered call can never
 * bill less than that).
 */
export function estimateVoiceDebitMicro(rate: VoiceRate, estimateSeconds: number): number {
  const { initialSeconds } = parseIncrements(rate.increments);
  return priceVoiceMicro(Math.max(estimateSeconds, initialSeconds), rate).amountMicro;
}

/**
 * Resolves the effective rate for a meter: a per-workspace enterprise override
 * when present, otherwise the plan's rate.
 */
export function resolveRate(
  meter: MessageMeter,
  rates: Rates,
  overrides?: RateOverrides
): MessageRate;
export function resolveRate(meter: VoiceMeter, rates: Rates, overrides?: RateOverrides): VoiceRate;
export function resolveRate(
  meter: BillingMeter,
  rates: Rates,
  overrides?: RateOverrides
): MessageRate | VoiceRate {
  return overrides?.[meter] ?? rates[meter];
}

/** Whether a meter bills per message (vs. per voice increment). */
export function isMessageMeter(meter: BillingMeter): meter is MessageMeter {
  return (MESSAGE_METERS as readonly string[]).includes(meter);
}
