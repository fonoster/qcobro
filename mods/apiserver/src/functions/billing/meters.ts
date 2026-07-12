import type {
  BillingConfig,
  BillingMeter,
  BillingPlan,
  DbBillingMeter,
  RateOverrides
} from "@qcobro/common";
import { rateOverridesSchema } from "@qcobro/common";
import { businessError } from "../businessError.js";

/** Common meter key ↔ Prisma enum spelling. */
export const DB_METER: Record<BillingMeter, DbBillingMeter> = {
  sms: "SMS",
  email: "EMAIL",
  whatsappMessage: "WHATSAPP_MESSAGE",
  voicePrerecorded: "VOICE_PRERECORDED",
  voiceAi: "VOICE_AI",
  whatsappVoicePrerecorded: "WHATSAPP_VOICE_PRERECORDED",
  whatsappVoiceAi: "WHATSAPP_VOICE_AI"
};

/** Resolves a plan from the config catalog; unknown keys are a business error. */
export function planFromCatalog(billing: NonNullable<BillingConfig>, planKey: string): BillingPlan {
  const plan = billing.plans.find((p) => p.key === planKey);
  if (!plan)
    throw businessError("planKey", `Unknown plan "${planKey}" — not in the billing catalog`);
  return plan;
}

/**
 * Parses a workspace's stored rate overrides (JSON column). Invalid stored
 * overrides are a business error — better to fail the dispatch than misprice it.
 */
export function parseStoredOverrides(raw: unknown): RateOverrides | undefined {
  if (raw == null) return undefined;
  const parsed = rateOverridesSchema.safeParse(raw);
  if (!parsed.success) {
    throw businessError("rateOverrides", "Stored rate overrides do not match the rates schema");
  }
  return parsed.data;
}
