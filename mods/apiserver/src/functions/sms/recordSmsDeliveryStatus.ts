import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  smsStatusCallbackSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Entrega
} from "@qcobro/common";

/**
 * `smsStatusCallbackSchema` (in `@qcobro/common`) covers the fields every SMS provider
 * callback carries; Twilio's `ErrorCode` is Twilio-specific and only present on a failed
 * delivery, so it is layered on locally rather than added to the shared schema.
 */
const smsDeliveryStatusInputSchema = smsStatusCallbackSchema.extend({
  /** Twilio's `ErrorCode` form field, present only on `undelivered`/`failed` callbacks. */
  errorCode: z.string().optional()
});
export type SmsDeliveryStatusInput = z.infer<typeof smsDeliveryStatusInputSchema>;

/** Minimal Prisma surface this completion needs. */
export interface SmsDeliveryStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "SMS" };
      select: { id: true; entrega: true; deliveryReason: true; channelData: true };
    }): Promise<{
      id: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      channelData: unknown;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        entrega?: Entrega;
        deliveryReason?: DeliveryReason | null;
        channelData: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
}

export type RecordSmsDeliveryStatusResult =
  | { matched: false }
  | { matched: true; id: string; entrega: Entrega; deliveryReason: DeliveryReason | null };

/** Twilio `MessageStatus` values that mean the message reached the handset. */
const DELIVERED_STATUSES = new Set(["delivered"]);
/** Twilio `MessageStatus` values that mean the message definitively did not. */
const NOT_DELIVERED_STATUSES = new Set(["undelivered", "failed"]);

/**
 * Twilio `ErrorCode` → `deliveryReason`. Only the codes this codebase branches on today are
 * listed; anything else (or a missing code) falls back to the generic `PROVIDER_ERROR`
 * bucket, which is still actionable but carries no retry-policy assumption.
 * https://www.twilio.com/docs/api/errors
 */
const TWILIO_ERROR_CODE_REASON: Readonly<Record<string, DeliveryReason>> = {
  // Permanent — the destination itself is wrong. Retrying this number never helps.
  "21211": "INVALID_DESTINATION", // Invalid 'To' phone number.
  "30003": "INVALID_DESTINATION", // Unreachable destination handset.
  "30005": "INVALID_DESTINATION", // Unknown destination handset.
  // Permanent for SMS specifically — the number is real but cannot receive it.
  "21614": "CHANNEL_UNSUPPORTED", // 'To' number cannot receive SMS (e.g. a landline).
  "30006": "CHANNEL_UNSUPPORTED", // Landline or unreachable carrier.
  // Refused rather than undeliverable: the number works, the message was blocked.
  "21610": "REJECTED", // Recipient has opted out (carrier STOP block).
  "30007": "REJECTED", // Carrier filtered the message as spam/violation.
  // Transient — worth retrying.
  "30008": "UNREACHABLE" // Unknown error, commonly a temporary carrier failure.
};

function deliveryReasonForFailure(errorCode: string | undefined): DeliveryReason {
  if (!errorCode) return "PROVIDER_ERROR";
  return TWILIO_ERROR_CODE_REASON[errorCode] ?? "PROVIDER_ERROR";
}

/**
 * Records an SMS gestión's real delivery status from Twilio's status callback (see
 * `sms-events-hook`). Every callback updates `channelData.deliveryStatus` to the raw
 * status, terminal or not, so an operator can see a message's progress even before it
 * finalizes. Only a terminal status (`delivered` / `undelivered` / `failed`) finalizes the
 * gestión's `entrega` (+ `deliveryReason` when it failed); any other status (`queued`,
 * `sending`, `sent`, ...) updates visibility only.
 *
 * Idempotent per call ref: `entrega` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` (by a prior call to this function), a repeated or later terminal callback
 * preserves the existing `entrega`/`deliveryReason` and does not overwrite them — Twilio may
 * retry delivery of the callback itself, and interim statuses can arrive after a terminal one
 * out of order.
 */
export function createRecordSmsDeliveryStatus(client: SmsDeliveryStatusClient) {
  const fn = async (input: SmsDeliveryStatusInput): Promise<RecordSmsDeliveryStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "SMS" },
      select: { id: true, entrega: true, deliveryReason: true, channelData: true }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, deliveryStatus: input.status };

    const terminal: Entrega | null = DELIVERED_STATUSES.has(input.status)
      ? "DELIVERED"
      : NOT_DELIVERED_STATUSES.has(input.status)
        ? "FAILED"
        : null;

    // Never move entrega back off DISPATCHED once it has already left it.
    const shouldFinalize = terminal !== null && match.entrega === "DISPATCHED";
    const entrega: Entrega | undefined = shouldFinalize ? terminal : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && terminal === "FAILED"
        ? deliveryReasonForFailure(input.errorCode)
        : undefined;

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(entrega ? { entrega } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        channelData
      }
    });
    return {
      matched: true,
      id: match.id,
      entrega: entrega ?? match.entrega,
      deliveryReason: deliveryReason ?? (entrega ? null : match.deliveryReason)
    };
  };

  return withErrorHandlingAndValidation(fn, smsDeliveryStatusInputSchema);
}

/** Prisma-backed {@link SmsDeliveryStatusClient}. */
export function createPrismaSmsDeliveryStatusClient(prisma: PrismaClient): SmsDeliveryStatusClient {
  return prisma as unknown as SmsDeliveryStatusClient;
}
