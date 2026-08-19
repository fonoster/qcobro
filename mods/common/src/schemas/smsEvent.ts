import { z } from "zod";

/**
 * Twilio's outbound message status-callback event. `status` is the raw Twilio
 * `MessageStatus` string (`queued`/`sending`/`sent`/`delivered`/`undelivered`/`failed`/...),
 * kept as an open string rather than a closed enum — Twilio's status vocabulary is
 * broader than the two terminal values this codebase acts on, and a value QCobro doesn't
 * yet recognize should update visibility (`channelData.deliveryStatus`) rather than fail
 * validation. See the sms-events-hook capability.
 */
export const smsStatusCallbackSchema = z.object({
  providerRef: z.string().min(1),
  status: z.string().min(1),
  at: z.string().min(1)
});
export type SmsStatusCallbackInput = z.infer<typeof smsStatusCallbackSchema>;
