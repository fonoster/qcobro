import type { PrismaClient } from "@prisma/client";
import {
  whatsAppStatusCallbackSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Entrega,
  type Resultado,
  type WhatsAppStatusCallbackInput
} from "@qcobro/common";

/** Minimal Prisma surface this completion needs. */
export interface WhatsAppDeliveryStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string; agentType: "WHATSAPP" };
      select: {
        id: true;
        portfolioAccountId: true;
        entrega: true;
        deliveryReason: true;
        resultado: true;
        channelData: true;
      };
    }): Promise<{
      id: string;
      portfolioAccountId: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      resultado: Resultado | null;
      channelData: unknown;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        entrega?: Entrega;
        deliveryReason?: DeliveryReason | null;
        resultado?: Resultado;
        channelData: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
}

export type RecordWhatsAppDeliveryStatusResult =
  | { matched: false }
  | {
      matched: true;
      id: string;
      portfolioAccountId: string;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      optOut: boolean;
    };

/** Meta `status` values that mean the message reached the handset. */
const DELIVERED_STATUSES = new Set(["delivered"]);
/** Meta `status` values that mean the message definitively did not. */
const FAILED_STATUSES = new Set(["failed"]);

/**
 * Meta error code → `deliveryReason`. Only the codes with a genuinely different retry policy
 * are listed; anything else (or a missing code) falls back to the generic `PROVIDER_ERROR`
 * bucket, which is still actionable but carries no retry-policy assumption.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
const META_ERROR_CODE_REASON: Readonly<Record<number, DeliveryReason>> = {
  // Permanent — the destination itself is wrong. Retrying this number never helps.
  131026: "INVALID_DESTINATION", // Undeliverable: not a WhatsApp user / cannot receive.
  // Refused rather than undeliverable: the number works, the message was blocked.
  131047: "REJECTED", // Outside the 24h re-engagement window.
  131048: "REJECTED", // Spam rate limit hit for this recipient.
  131049: "REJECTED", // Per-user marketing limit (healthy-ecosystem policy).
  131050: "REJECTED" // Recipient opted out of receiving messages.
};

/** Meta's code for "the user opted out" — the one status that is also a suppression signal. */
export const META_OPT_OUT_ERROR_CODE = 131050;

function deliveryReasonForFailure(errorCode: number | undefined): DeliveryReason {
  if (errorCode === undefined) return "PROVIDER_ERROR";
  return META_ERROR_CODE_REASON[errorCode] ?? "PROVIDER_ERROR";
}

/**
 * Records a WHATSAPP gestión's real delivery status from Meta's webhook `statuses` array (see
 * `whatsapp-channel`). Correlates on `providerRef`, which for this channel is the `wamid` Meta
 * returns at send time and echoes back on every status — no second key is needed, unlike EMAIL.
 *
 * Every status updates `channelData.deliveryStatus` to the raw value, terminal or not, so an
 * operator can see a message's progress before it finalizes. Only `delivered` and `failed`
 * finalize `entrega` (+ `deliveryReason` on failure); `sent` updates visibility only.
 *
 * `read` writes `channelData.openedAt` and moves no axis. Unlike an email open — a tracking
 * pixel that proxies inflate and blocked images suppress — Meta's read receipt is a genuine
 * signal, but read-but-unengaged stays unmodelled on both channels so the two render the same
 * `Camino` progression and neither enters a metric.
 *
 * Error code 131050 (the recipient opted out) additionally sets `resultado: OPT_OUT`. That is
 * a findable marker in the console, **not** enforced suppression: the account-level `OPT_OUT`
 * flag no longer exists, and the workspace Do Not Contact list that replaces it is not built
 * yet (#101). Under the three-axis model an opt-out is also a delivery failure, so it writes
 * both axes — the axes are independent by design, and recording only the `resultado` would
 * leave platform blocks invisible to the contactability KPI.
 *
 * Idempotent per message id: `entrega` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` — by a prior status, or by a customer reply, which races these freely — a
 * repeated or later terminal status preserves the existing `entrega`/`deliveryReason`.
 */
export function createRecordWhatsAppDeliveryStatus(client: WhatsAppDeliveryStatusClient) {
  const fn = async (
    input: WhatsAppStatusCallbackInput
  ): Promise<RecordWhatsAppDeliveryStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerRef: input.providerRef, agentType: "WHATSAPP" },
      select: {
        id: true,
        portfolioAccountId: true,
        entrega: true,
        deliveryReason: true,
        resultado: true,
        channelData: true
      }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, deliveryStatus: input.status };

    // First read wins, so the timestamp records when the message was first opened.
    const alreadyOpened = typeof existing.openedAt === "string" ? existing.openedAt : null;
    if (input.status === "read" && !alreadyOpened) channelData.openedAt = input.at;

    const terminal: Entrega | null = DELIVERED_STATUSES.has(input.status)
      ? "DELIVERED"
      : FAILED_STATUSES.has(input.status)
        ? "FAILED"
        : null;

    // Never move entrega back off DISPATCHED once it has already left it.
    const shouldFinalize = terminal !== null && match.entrega === "DISPATCHED";
    const entrega: Entrega | undefined = shouldFinalize ? terminal : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && terminal === "FAILED"
        ? deliveryReasonForFailure(input.errorCode)
        : undefined;

    // The opt-out marker is independent of the delivery axis: it is recorded even when a
    // prior status already finalized entrega, since the block is the signal that matters.
    const optOut = input.errorCode === META_OPT_OUT_ERROR_CODE;
    const resultado: Resultado | undefined = optOut && !match.resultado ? "OPT_OUT" : undefined;

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(entrega ? { entrega } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        ...(resultado ? { resultado } : {}),
        channelData
      }
    });
    return {
      matched: true,
      id: match.id,
      portfolioAccountId: match.portfolioAccountId,
      entrega: entrega ?? match.entrega,
      deliveryReason: deliveryReason ?? (entrega ? null : match.deliveryReason),
      optOut
    };
  };

  return withErrorHandlingAndValidation(fn, whatsAppStatusCallbackSchema);
}

/** Prisma-backed {@link WhatsAppDeliveryStatusClient}. */
export function createPrismaWhatsAppDeliveryStatusClient(
  prisma: PrismaClient
): WhatsAppDeliveryStatusClient {
  return prisma as unknown as WhatsAppDeliveryStatusClient;
}
