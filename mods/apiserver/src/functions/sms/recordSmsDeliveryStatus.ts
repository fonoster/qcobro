import type { PrismaClient } from "@prisma/client";
import {
  smsStatusCallbackSchema,
  withErrorHandlingAndValidation,
  type ContactOutcome,
  type SmsStatusCallbackInput
} from "@qcobro/common";

/** Minimal Prisma surface this completion needs. */
export interface SmsDeliveryStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "SMS" };
      select: { id: true; outcome: true; channelData: true };
    }): Promise<{ id: string; outcome: ContactOutcome; channelData: unknown } | null>;
    update(args: {
      where: { id: string };
      data: { outcome?: ContactOutcome; channelData: Record<string, unknown> };
    }): Promise<unknown>;
  };
}

export type RecordSmsDeliveryStatusResult =
  | { matched: false }
  | { matched: true; id: string; outcome: ContactOutcome };

/** Twilio `MessageStatus` values that mean the message reached the handset. */
const DELIVERED_STATUSES = new Set(["delivered"]);
/** Twilio `MessageStatus` values that mean the message definitively did not. */
const NOT_DELIVERED_STATUSES = new Set(["undelivered", "failed"]);

/**
 * Records an SMS gestión's real delivery status from Twilio's status callback (see
 * `sms-events-hook`). Every callback updates `channelData.deliveryStatus` to the raw
 * status, terminal or not, so an operator can see a message's progress even before it
 * finalizes. Only a terminal status (`delivered` / `undelivered` / `failed`) finalizes the
 * gestión's `outcome`; any other status (`queued`, `sending`, `sent`, ...) updates
 * visibility only.
 *
 * Idempotent per call ref: once the outcome has left the dispatch-time `OTHER` placeholder
 * (by a prior call to this function), a repeated or later terminal callback preserves the
 * existing outcome and does not overwrite it — Twilio may retry delivery of the callback
 * itself, and interim statuses can arrive after a terminal one out of order.
 */
export function createRecordSmsDeliveryStatus(client: SmsDeliveryStatusClient) {
  const fn = async (input: SmsStatusCallbackInput): Promise<RecordSmsDeliveryStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "SMS" },
      select: { id: true, outcome: true, channelData: true }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, deliveryStatus: input.status };

    const terminal: ContactOutcome | null = DELIVERED_STATUSES.has(input.status)
      ? "DELIVERED"
      : NOT_DELIVERED_STATUSES.has(input.status)
        ? "NOT_DELIVERED"
        : null;
    // Never downgrade a finalized outcome; only the dispatch-time OTHER is replaced, and
    // only by a terminal status.
    const outcome: ContactOutcome | undefined =
      terminal && match.outcome === "OTHER" ? terminal : undefined;

    await client.accountContactLog.update({
      where: { id: match.id },
      data: { ...(outcome ? { outcome } : {}), channelData }
    });
    return { matched: true, id: match.id, outcome: outcome ?? match.outcome };
  };

  return withErrorHandlingAndValidation(fn, smsStatusCallbackSchema);
}

/** Prisma-backed {@link SmsDeliveryStatusClient}. */
export function createPrismaSmsDeliveryStatusClient(prisma: PrismaClient): SmsDeliveryStatusClient {
  return prisma as unknown as SmsDeliveryStatusClient;
}
