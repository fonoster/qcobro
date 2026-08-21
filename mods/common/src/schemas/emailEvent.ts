import { z } from "zod";

/**
 * Resend's outbound email event. `type` is the raw event name (`email.sent`,
 * `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`,
 * `email.complained`, `email.opened`, ...), kept as an open string rather than a closed enum
 * for the same reason as the SMS callback: Resend's vocabulary is broader than the events
 * this codebase acts on, and an unrecognized one should update visibility
 * (`channelData.deliveryStatus`) rather than fail validation. See the email-events-hook
 * capability.
 *
 * `providerMessageId` is Resend's `data.email_id` — the id returned by the send call, which
 * is the only correlation handle an outbound event carries. It is deliberately not the
 * gestión's `providerRef`, which on EMAIL holds the reply-to token for inbound replies.
 */
export const emailEventCallbackSchema = z.object({
  providerMessageId: z.string().min(1),
  type: z.string().min(1),
  at: z.string().min(1),
  /**
   * Resend's `data.bounce` detail, present only on `email.bounced`. `type` is `Permanent` or
   * `Transient`; `subType` is `General` / `NoEmail` / `Suppressed` / `MailboxFull` / ...
   * Both open strings — an unmapped value falls back to the generic `PROVIDER_ERROR` bucket.
   */
  bounceType: z.string().optional(),
  bounceSubType: z.string().optional()
});
export type EmailEventCallbackInput = z.infer<typeof emailEventCallbackSchema>;
