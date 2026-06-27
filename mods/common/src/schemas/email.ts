import { z } from "zod";

/**
 * The structured decision the EMAIL autopilot returns for an inbound reply. Validated so a
 * model can't drive the loop with malformed output. `outcome` mirrors the contact-log
 * outcomes; `objective` carries promise details when the reply implies one.
 */
export const emailAutopilotDecisionSchema = z.object({
  action: z.enum(["reply", "ignore", "resolve", "escalate"]),
  replyBody: z.string().optional(),
  outcome: z.string().optional(),
  objective: z
    .object({
      type: z.string(),
      amount: z.number().optional(),
      dueDate: z.string().optional(),
      note: z.string().optional()
    })
    .nullish()
});

/**
 * Normalized inbound email from the provider webhook. The provider payload is mapped to
 * this before ingestion so the function stays provider-agnostic.
 */
export const inboundEmailSchema = z.object({
  from: z.string().min(1),
  to: z.array(z.string()).default([]),
  subject: z.string().optional(),
  text: z.string().default(""),
  messageId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional()
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
