import { z } from "zod";

export const agentTypeSchema = z.enum([
  "SMS",
  "VOICE_PRERECORDED",
  "VOICE_AI",
  "EMAIL",
  "WHATSAPP"
]);
export type AgentType = z.infer<typeof agentTypeSchema>;

export const collectionStrategySchema = z.enum(["SOFT", "MODERATE", "FIRM"]);
export type CollectionStrategy = z.infer<typeof collectionStrategySchema>;

const baseFields = {
  name: z.string().min(1).max(120),
  collectionStrategy: collectionStrategySchema.default("MODERATE")
};

/**
 * Creating an agent template is a discriminated union on `type`: each channel
 * carries its own config fields, never mixed across types. `fonosterAppName` is
 * optional on voice types — the create function defaults it to the template name.
 */
export const createAgentTemplateSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseFields,
    type: z.literal("VOICE_AI"),
    voice: z.string().min(1),
    systemPrompt: z.string().min(1),
    firstMessage: z.string().min(1),
    language: z.string().min(1),
    fonosterAppName: z.string().min(1).optional()
  }),
  z.object({
    ...baseFields,
    type: z.literal("VOICE_PRERECORDED"),
    voice: z.string().min(1),
    script: z.string().min(1),
    firstMessage: z.string().min(1),
    language: z.string().min(1),
    fonosterAppName: z.string().min(1).optional()
  }),
  z.object({
    ...baseFields,
    type: z.literal("SMS"),
    messageBody: z.string().min(1),
    senderId: z.string().min(1).optional()
  }),
  z.object({
    ...baseFields,
    type: z.literal("EMAIL"),
    subject: z.string().min(1),
    messageBody: z.string().min(1),
    fromName: z.string().min(1),
    fromEmail: z.string().email()
  }),
  z.object({
    ...baseFields,
    type: z.literal("WHATSAPP"),
    templateName: z.string().min(1),
    messageBody: z.string().min(1)
  })
]);
export type CreateAgentTemplateInput = z.infer<typeof createAgentTemplateSchema>;

/**
 * Updating an agent template: mutable base fields plus a loose `config` bag of
 * type-specific fields applied to the stored child table. `type` is immutable —
 * `.strict()` rejects any attempt to pass it (or other unknown keys).
 */
export const updateAgentTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    collectionStrategy: collectionStrategySchema.optional(),
    // `archived` toggles the template's archived state: true sets `archivedAt` to
    // now, false clears it (restore). Templates have no status concept.
    archived: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
export type UpdateAgentTemplateInput = z.infer<typeof updateAgentTemplateSchema>;

export const deleteAgentTemplateSchema = z.object({
  id: z.string().min(1)
});
export type DeleteAgentTemplateInput = z.infer<typeof deleteAgentTemplateSchema>;
