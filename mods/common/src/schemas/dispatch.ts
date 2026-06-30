import { z } from "zod";

/** The channels the dispatch layer triggers (subset of AgentType). */
export const dispatchChannelSchema = z.enum([
  "VOICE_AI",
  "VOICE_PRERECORDED",
  "SMS",
  "EMAIL",
  "WHATSAPP"
]);

/**
 * A normalized dispatch request: a channel, a destination, the render context
 * (the customer's account fields), and the raw template body fields for that
 * channel. The dispatch function renders the bodies against `context` before
 * sending, so callers pass raw templates — not pre-rendered strings.
 */
export const dispatchOutreachSchema = z
  .object({
    channel: dispatchChannelSchema,
    /** Destination number (E.164). */
    to: z.string().min(1),
    /** Render context — the customer's account fields plus derived values. */
    context: z.record(z.string(), z.unknown()).default({}),
    /** Optional explicit caller-ID/sender; otherwise picked from the pool. */
    from: z.string().min(1).optional(),
    /** Voice: the provider application ref to drive the call. */
    appRef: z.string().min(1).optional(),
    /** Voz IA: opening line template (the autopilot may also open silently). */
    firstMessage: z.string().optional(),
    /** Voz pregrabada: the whole spoken script template (locuted via TTS). */
    script: z.string().optional(),
    /** SMS / EMAIL / WHATSAPP: message body template. For WHATSAPP this is the fetched
     * template body whose `{{vars}}` are extracted and sent as named parameters. */
    body: z.string().optional(),
    /** EMAIL: subject line template. */
    subject: z.string().optional(),
    /** WHATSAPP: Meta-approved template name to send. */
    templateName: z.string().optional(),
    /** WHATSAPP: Meta template-send language code (sourced from the workspace, e.g. `es_DO`). */
    languageCode: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.channel === "SMS" && (value.body ?? "").length === 0) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "SMS requires a message body" });
    }
    if (value.channel === "EMAIL") {
      if ((value.subject ?? "").length === 0) {
        ctx.addIssue({ code: "custom", path: ["subject"], message: "Email requires a subject" });
      }
      if ((value.body ?? "").length === 0) {
        ctx.addIssue({ code: "custom", path: ["body"], message: "Email requires a body" });
      }
    }
    if (value.channel === "WHATSAPP") {
      if ((value.templateName ?? "").length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["templateName"],
          message: "WhatsApp requires a templateName"
        });
      }
      if ((value.languageCode ?? "").length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["languageCode"],
          message: "WhatsApp requires a languageCode"
        });
      }
      if ((value.body ?? "").length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["body"],
          message: "WhatsApp requires a template body for parameter extraction"
        });
      }
    }
    // Voice dispatch needs the synced application ref. Neither voice channel requires a
    // `firstMessage`: VOICE_AI may open silently (the autopilot places the call and waits
    // for the customer to speak first), and pre-recorded has no first message at all.
    // EMAIL and SMS are not voice and need no appRef.
    const isVoice = value.channel === "VOICE_AI" || value.channel === "VOICE_PRERECORDED";
    if (isVoice && !value.appRef) {
      ctx.addIssue({
        code: "custom",
        path: ["appRef"],
        message: "Voice dispatch requires appRef"
      });
    }
  });

export type DispatchOutreachInput = z.infer<typeof dispatchOutreachSchema>;

/**
 * Input for the manual "Contactar manualmente" procedure: which customer and which
 * campaign. A manual contact runs the campaign's agent against this one customer, so
 * the campaign (required) determines the agent/channel; the server resolves these to
 * a {@link dispatchOutreachSchema} request.
 */
export const manualOutreachSchema = z.object({
  portfolioAccountId: z.string().min(1),
  // Manual outreach is agent-based, not campaign-based: it dispatches the chosen agent
  // template ad-hoc and records a campaign-less gestión (no CampaignAccountState).
  agentTemplateId: z.string().min(1),
  /** Operator override for the email subject (rendered, replaces template value). */
  subject: z.string().optional(),
  /** Operator override for the message body — SMS or EMAIL (rendered). */
  body: z.string().optional(),
  /** Operator override for the Voz IA opening line (rendered). */
  firstMessage: z.string().optional(),
  /** Operator override for the Voz pregrabada spoken script (rendered). */
  script: z.string().optional()
});

export type ManualOutreachInput = z.infer<typeof manualOutreachSchema>;
