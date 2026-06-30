import { z } from "zod";

/**
 * WhatsApp integration contracts: the per-workspace WABA credentials and its sender
 * numbers, plus the inbound Meta webhook body. This is QCobro's first tenant-provided
 * secret — the `accessToken` is encrypted at rest (cloak) and never returned to clients.
 *
 * The webhook schema is a focused port of `../mikro/mods/common/src/schemas/whatsapp.ts`,
 * trimmed to what QCobro ingests (customer messages, delivery/opt-out statuses) and
 * extended with `metadata.phone_number_id` so events resolve to a workspace/sender.
 */

/** What a sender number can do. `messaging` now; `calling` reserved for WhatsApp Voice (future). */
export const whatsAppCapabilitiesSchema = z.object({
  messaging: z.boolean(),
  calling: z.boolean()
});
export type WhatsAppCapabilities = z.infer<typeof whatsAppCapabilitiesSchema>;

/** Connect (or update) the workspace's WABA. The token is the tenant secret. */
export const upsertWhatsAppIntegrationSchema = z.object({
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  /** Token echoed back during Meta's webhook verify-token handshake. */
  verifyToken: z.string().min(1),
  /** Meta template-send language for this workspace (e.g. `es_DO`); the single source for
   * the WhatsApp send language. Kept with the WhatsApp config rather than in WorkspaceSettings. */
  defaultLanguage: z.string().min(1)
});
export type UpsertWhatsAppIntegrationInput = z.infer<typeof upsertWhatsAppIntegrationSchema>;

/** Add a sender number to the workspace's integration. */
export const addWhatsAppSenderNumberSchema = z.object({
  /** Meta per-number messaging endpoint id. Globally unique across the deployment. */
  phoneNumberId: z.string().min(1),
  /** E.164 display number for the UI. */
  displayNumber: z.string().min(1),
  /** Operator label, e.g. "Cobranza Suave". */
  label: z.string().min(1)
});
export type AddWhatsAppSenderNumberInput = z.infer<typeof addWhatsAppSenderNumberSchema>;

export const removeWhatsAppSenderNumberSchema = z.object({
  phoneNumberId: z.string().min(1)
});
export type RemoveWhatsAppSenderNumberInput = z.infer<typeof removeWhatsAppSenderNumberSchema>;

// ── Inbound webhook body (Meta Cloud API) ─────────────────────────────────────

const whatsAppInboundMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional()
});

/** Delivery/read/opt-out status callbacks. `errors` carries opt-out/block signals (code 131050 etc.). */
const whatsAppStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  recipient_id: z.string().optional(),
  timestamp: z.string().optional(),
  errors: z
    .array(z.object({ code: z.number().optional(), title: z.string().optional() }))
    .optional()
});

const whatsAppChangeValueSchema = z.object({
  messaging_product: z.string().optional(),
  metadata: z
    .object({
      display_phone_number: z.string().optional(),
      /** Resolves the event to a `WhatsAppSenderNumber` (and thus a workspace). */
      phone_number_id: z.string()
    })
    .optional(),
  messages: z.array(whatsAppInboundMessageSchema).optional(),
  statuses: z.array(whatsAppStatusSchema).optional(),
  // Quality-rating callbacks: phone_number_id is at the value root, not under metadata.
  phone_number_id: z.string().optional(),
  event: z.string().optional(),
  new_quality_rating: z.string().optional()
});

const whatsAppChangeSchema = z.object({
  field: z.string().optional(),
  value: whatsAppChangeValueSchema.optional()
});

const whatsAppEntrySchema = z.object({
  id: z.string().optional(),
  changes: z.array(whatsAppChangeSchema).optional()
});

/** The full inbound webhook body. Lenient on unknown fields Meta may add. */
export const whatsAppWebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(whatsAppEntrySchema).optional()
});
export type WhatsAppWebhookBody = z.infer<typeof whatsAppWebhookSchema>;
