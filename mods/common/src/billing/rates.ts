import { z } from "zod";

/**
 * The billable-meter catalog and per-meter rate schemas.
 *
 * The catalog is closed-world: exactly seven meters, one per dispatchable
 * channel/mode. Message meters bill per message; voice meters bill answered
 * duration under a telecom increment pair. Each meter kind has its own strict
 * schema so a rate object with fields from the wrong kind (e.g. `increments`
 * on `sms`) fails validation instead of being silently ignored.
 *
 * The two WhatsApp voice meters are reserved: they must be priced in every
 * plan, but no dispatch path produces them until Fonoster ships that transport.
 */

export const MESSAGE_METERS = ["sms", "email", "whatsappMessage"] as const;
export const VOICE_METERS = [
  "voicePrerecorded",
  "voiceAi",
  "whatsappVoicePrerecorded",
  "whatsappVoiceAi"
] as const;
export const BILLING_METERS = [...MESSAGE_METERS, ...VOICE_METERS] as const;

export type MessageMeter = (typeof MESSAGE_METERS)[number];
export type VoiceMeter = (typeof VOICE_METERS)[number];
export type BillingMeter = (typeof BILLING_METERS)[number];

export const billingMeterSchema = z.enum(BILLING_METERS);

/**
 * Telecom billing-increment notation `"initial/subsequent"` in seconds — the
 * industry standard (15/15 rounds every call up to 15s blocks; 60/6 bills a
 * full first minute then 6s steps).
 */
export const incrementNotationSchema = z
  .string()
  .regex(
    /^[1-9]\d*\/[1-9]\d*$/,
    'increments must be "initial/subsequent" in positive whole seconds (e.g. "15/15")'
  );

/** A message meter's rate: decimal currency units per message. */
export const messageRateSchema = z.strictObject({
  perMessage: z.number().positive()
});
export type MessageRate = z.infer<typeof messageRateSchema>;

/** A voice meter's rate: decimal currency units per minute + increment pair. */
export const voiceRateSchema = z.strictObject({
  perMinute: z.number().positive(),
  increments: incrementNotationSchema
});
export type VoiceRate = z.infer<typeof voiceRateSchema>;

/** A complete rate card: all seven meters, each with its kind's schema. */
export const ratesSchema = z.strictObject({
  sms: messageRateSchema,
  email: messageRateSchema,
  whatsappMessage: messageRateSchema,
  voicePrerecorded: voiceRateSchema,
  voiceAi: voiceRateSchema,
  whatsappVoicePrerecorded: voiceRateSchema,
  whatsappVoiceAi: voiceRateSchema
});
export type Rates = z.infer<typeof ratesSchema>;

/**
 * Per-workspace enterprise overrides: any subset of the rate card, validated
 * with the same per-meter schemas. Stored on workspace billing state (DB),
 * never in configuration.
 */
export const rateOverridesSchema = ratesSchema.partial();
export type RateOverrides = z.infer<typeof rateOverridesSchema>;
