import { z } from "zod";

/**
 * Longest pre-recorded script that can be saved. It is rendered against the account's
 * `context` and passed as call metadata to the Fonoster-side EXTERNAL application, which
 * speaks it via `res.say()` — an unbounded script risks an excessively long call and a
 * metadata payload larger than Fonoster expects. Real scripts run a couple of hundred
 * characters, so this is generous headroom rather than a tight fit.
 */
export const PRERECORDED_SCRIPT_MAX_LENGTH = 2000;

/**
 * Deployment defaults for a VOICE_AI agent's Fonoster AUTOPILOT idle options — the line the
 * agent speaks when the caller goes silent (`message`), how long it waits for speech before
 * speaking it (`timeout`, in **milliseconds**), and how many consecutive idle timeouts it
 * tolerates before hanging up (`maxTimeoutCount`).
 *
 * Single source of truth for three consumers: the `.default()` on the schema fields below,
 * the console create-form pre-fill, and `FonosterVoiceApplicationClient.evaluate()` (the
 * ephemeral eval path, which has no template row to read). The Prisma migration that adds
 * the columns backfills existing rows from these same literal values.
 *
 * `timeout` was 4500 ms in PR #165; deliberately widened to ~8 s here after field feedback
 * that the agent still gave up too soon.
 */
export const DEFAULT_VOICE_IDLE_OPTIONS = {
  message: "¿Se encuentra en la línea? Necesito confirmar una fecha de pago para su cuenta.",
  timeout: 8000,
  maxTimeoutCount: 3
} as const;

export const agentTypeSchema = z.enum([
  "SMS",
  "VOICE_PRERECORDED",
  "VOICE_AI",
  "EMAIL",
  "WHATSAPP"
]);
export type AgentType = z.infer<typeof agentTypeSchema>;

const baseFields = {
  name: z.string().min(1).max(120)
};

const digitSchema = z.string().regex(/^[0-9]$/, "must be a single digit 0-9");

/**
 * Fields for the optional DTMF menu offered after a pre-recorded script plays: a "repeat"
 * digit that replays it and an "opt-out" digit that ends the call and records `outcome:
 * OPT_OUT` (see the `prerecorded-audio` and `account-contact-log` specs). Both pairs are
 * independently optional; neither set means no menu is offered at all.
 */
const voicePrerecordedDtmfFields = {
  repeatDigit: digitSchema.optional(),
  repeatMessage: z.string().min(1).optional(),
  /** How many times the script may be replayed in one call; only meaningful with `repeatDigit`. */
  maxRepeats: z.number().int().positive().optional(),
  optOutDigit: digitSchema.optional(),
  /** Invitation prompt, played before the gather (e.g. "Presione 9 para darse de baja"). */
  optOutMessage: z.string().min(1).optional(),
  /** Close-out prompt, played once the opt-out digit is detected and before hangup (e.g.
   * "Hemos registrado su solicitud"). Without it the call just ends with no acknowledgment. */
  optOutConfirmationMessage: z.string().min(1).optional()
};

/**
 * A message is required exactly when its digit is set, and the two digits (when both set)
 * must differ. Shared by the create schema (full config, checked via superRefine on the
 * union) and by the update path (which merges a partial `config` patch onto the persisted
 * row before re-checking, since `updateAgentTemplateSchema.config` is an unvalidated bag).
 */
function checkVoicePrerecordedDtmfFields(
  value: {
    repeatDigit?: string;
    repeatMessage?: string;
    optOutDigit?: string;
    optOutMessage?: string;
    optOutConfirmationMessage?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (value.repeatDigit && !value.repeatMessage) {
    ctx.addIssue({
      code: "custom",
      path: ["repeatMessage"],
      message: "repeatMessage is required when repeatDigit is set"
    });
  }
  if (value.repeatMessage && !value.repeatDigit) {
    ctx.addIssue({
      code: "custom",
      path: ["repeatDigit"],
      message: "repeatDigit is required when repeatMessage is set"
    });
  }
  if (value.optOutDigit && !value.optOutMessage) {
    ctx.addIssue({
      code: "custom",
      path: ["optOutMessage"],
      message: "optOutMessage is required when optOutDigit is set"
    });
  }
  if (value.optOutMessage && !value.optOutDigit) {
    ctx.addIssue({
      code: "custom",
      path: ["optOutDigit"],
      message: "optOutDigit is required when optOutMessage is set"
    });
  }
  // The confirmation is what closes the call out for the caller — "we've stopped calling
  // you" — not merely a nice-to-have, so it's required on the same terms as the invitation:
  // whenever optOutDigit is configured, both of its messages must be authored.
  if (value.optOutDigit && !value.optOutConfirmationMessage) {
    ctx.addIssue({
      code: "custom",
      path: ["optOutConfirmationMessage"],
      message: "optOutConfirmationMessage is required when optOutDigit is set"
    });
  }
  if (value.optOutConfirmationMessage && !value.optOutDigit) {
    ctx.addIssue({
      code: "custom",
      path: ["optOutDigit"],
      message: "optOutDigit is required when optOutConfirmationMessage is set"
    });
  }
  if (value.repeatDigit && value.optOutDigit && value.repeatDigit === value.optOutDigit) {
    ctx.addIssue({
      code: "custom",
      path: ["optOutDigit"],
      message: "optOutDigit must differ from repeatDigit"
    });
  }
}

/** Standalone reusable schema for the update path (see {@link checkVoicePrerecordedDtmfFields}). */
export const voicePrerecordedDtmfSchema = z
  .object(voicePrerecordedDtmfFields)
  .superRefine(checkVoicePrerecordedDtmfFields);
export type VoicePrerecordedDtmfConfig = z.infer<typeof voicePrerecordedDtmfSchema>;

/**
 * Creating an agent template is a discriminated union on `type`: each channel
 * carries its own config fields, never mixed across types. `fonosterAppName` is
 * optional on voice types — the create function defaults it to the template name.
 */
export const createAgentTemplateSchema = z
  .discriminatedUnion("type", [
    z.object({
      ...baseFields,
      type: z.literal("VOICE_AI"),
      voice: z.string().min(1),
      systemPrompt: z.string().min(1),
      // Optional: a VOICE_AI agent may rely on its system prompt with no scripted opening line.
      firstMessage: z.string().optional(),
      language: z.string().min(1),
      fonosterAppName: z.string().min(1).optional(),
      // Fonoster AUTOPILOT idle options, per template. All three `.default()` to
      // `DEFAULT_VOICE_IDLE_OPTIONS` so `evalTemplateSchema` (which `.extend`s this exact
      // member) and `agents:create` calls that omit them keep working — "required" is
      // enforced by the NOT NULL columns and the console form, not by this shape.
      idleMessage: z.string().min(1).default(DEFAULT_VOICE_IDLE_OPTIONS.message),
      idleTimeout: z.number().int().min(3000).default(DEFAULT_VOICE_IDLE_OPTIONS.timeout),
      idleMaxTimeoutCount: z
        .number()
        .int()
        .min(1)
        .default(DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount)
    }),
    z.object({
      ...baseFields,
      type: z.literal("VOICE_PRERECORDED"),
      voice: z.string().min(1),
      script: z.string().min(1).max(PRERECORDED_SCRIPT_MAX_LENGTH),
      language: z.string().min(1),
      fonosterAppName: z.string().min(1).optional(),
      ...voicePrerecordedDtmfFields
    }),
    z.object({
      ...baseFields,
      type: z.literal("SMS"),
      messageBody: z.string().min(1),
      senderId: z.string().min(1).optional(),
      /** Substitute the characters that cost a message its 7-bit encoding (`á í ó ú ç`) for
       *  ASCII before sending, halving the segment count of an otherwise-fine message.
       *  Defaults off: it changes what the customer reads. */
      normalizeGsm7: z.boolean().optional()
    }),
    z.object({
      ...baseFields,
      type: z.literal("EMAIL"),
      subject: z.string().min(1),
      messageBody: z.string().min(1),
      /** Autopilot decision brain: governs reply/ignore/resolve/escalate on each inbound reply. */
      systemPrompt: z.string().min(1),
      /** Per-agent cap on autopilot replies per collection attempt; falls back to the
       * `resend.maxRepliesDefault` deployment default when omitted. */
      maxReplies: z.number().int().nonnegative().optional()
    }),
    z.object({
      ...baseFields,
      type: z.literal("WHATSAPP"),
      /** Meta template name the operator enters; QCobro resolves + previews the template from
       * the WABA by this name, and it's the same name used to send. */
      templateName: z.string().min(1),
      /** Fetched template body (read-only preview); its `{{vars}}` are sent as named parameters. */
      messageBody: z.string().min(1),
      /** Smart-agent decision brain for replies after the customer responds (mirrors EMAIL). */
      systemPrompt: z.string().min(1),
      /** Per-agent cap on automated replies per gestión; falls back to the deployment default when omitted. */
      maxReplies: z.number().int().nonnegative().optional()
    })
  ])
  .superRefine((value, ctx) => {
    if (value.type === "VOICE_PRERECORDED") {
      checkVoicePrerecordedDtmfFields(value, ctx);
    }
  });
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

/** Manually re-attempt the Fonoster sync for a voice template. */
export const syncAgentTemplateSchema = z.object({
  id: z.string().min(1)
});
export type SyncAgentTemplateInput = z.infer<typeof syncAgentTemplateSchema>;
