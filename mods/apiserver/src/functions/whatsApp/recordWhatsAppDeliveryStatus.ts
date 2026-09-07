import type { PrismaClient } from "@prisma/client";
import {
  whatsAppStatusCallbackSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type Delivery,
  type Outcome,
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
        delivery: true;
        deliveryReason: true;
        outcome: true;
        channelData: true;
      };
    }): Promise<{
      id: string;
      portfolioAccountId: string;
      delivery: Delivery;
      deliveryReason: DeliveryReason | null;
      outcome: Outcome | null;
      channelData: unknown;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        delivery?: Delivery;
        deliveryReason?: DeliveryReason | null;
        outcome?: Outcome;
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
      delivery: Delivery;
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

/**
 * The first code Meta sends that this codebase actually maps, falling back to `PROVIDER_ERROR`.
 * Scanning rather than taking `codes[0]` matters because a multi-error status can lead with a
 * generic code and carry the specific one behind it — taking the first would bucket a known,
 * permanently-undeliverable destination as a vague provider error.
 */
function deliveryReasonForFailure(codes: readonly number[]): DeliveryReason {
  for (const code of codes) {
    const reason = META_ERROR_CODE_REASON[code];
    if (reason) return reason;
  }
  return "PROVIDER_ERROR";
}

/**
 * Records a WHATSAPP gestión's real delivery status from Meta's webhook `statuses` array (see
 * `whatsapp-channel`). Correlates on `providerRef`, which for this channel is the `wamid` Meta
 * returns at send time and echoes back on every status — no second key is needed, unlike EMAIL.
 *
 * Every status updates `channelData.deliveryStatus` to the raw value, terminal or not, so an
 * operator can see a message's progress before it finalizes. Only `delivered` and `failed`
 * finalize `delivery` (+ `deliveryReason` on failure); `sent` updates visibility only.
 *
 * `read` writes `channelData.openedAt` and moves no axis. Unlike an email open — a tracking
 * pixel that proxies inflate and blocked images suppress — Meta's read receipt is a genuine
 * signal, but read-but-unengaged stays unmodelled on both channels so the two render the same
 * `Path` progression and neither enters a metric.
 *
 * A `failed` status carrying error code 131050 (the recipient opted out) always records
 * `channelData.optOutAt`, and additionally sets `outcome: OPT_OUT` when the gestión has no
 * outcome yet. `outcome` is single-valued, so a complaint arriving after the customer
 * already produced a payment promise must not erase it — `optOutAt` is what keeps the block
 * findable in that case. Neither is enforced suppression: the account-level `OPT_OUT` flag no
 * longer exists, and the workspace Do Not Contact list that replaces it is not built yet
 * (#101). Under the three-axis model an opt-out is also a delivery failure, so it writes the
 * delivery axis too — the axes are independent by design, and recording only the `outcome`
 * would leave platform blocks invisible to the contactability KPI.
 *
 * Idempotent per message id: `delivery` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` — by a prior status, or by a customer reply, which races these freely — a
 * repeated or later terminal status preserves the existing `delivery`/`deliveryReason`.
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
        delivery: true,
        deliveryReason: true,
        outcome: true,
        channelData: true
      }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, deliveryStatus: input.status };

    // First read wins, so the timestamp records when the message was first opened.
    const alreadyOpened = typeof existing.openedAt === "string" ? existing.openedAt : null;
    if (input.status === "read" && !alreadyOpened) channelData.openedAt = input.at;

    const codes = input.errorCodes ?? [];
    const failed = FAILED_STATUSES.has(input.status);
    const terminal: Delivery | null = DELIVERED_STATUSES.has(input.status)
      ? "DELIVERED"
      : failed
        ? "FAILED"
        : null;

    // Never move delivery back off DISPATCHED once it has already left it.
    const shouldFinalize = terminal !== null && match.delivery === "DISPATCHED";
    const delivery: Delivery | undefined = shouldFinalize ? terminal : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && terminal === "FAILED" ? deliveryReasonForFailure(codes) : undefined;

    // An opt-out is a *failed* status carrying 131050 anywhere in its error list. Both halves
    // matter: `.includes` rather than the first code, because Meta can lead with a generic
    // error; and the `failed` check, because 131050 riding on a non-failed status would
    // otherwise write a suppression marker for a message that was actually delivered.
    const optOut = failed && codes.includes(META_OPT_OUT_ERROR_CODE);
    // Recorded on every opt-out, even when `outcome` is left alone below — this is the
    // durable trace of the block, and the axis write is best-effort on top of it.
    if (optOut && typeof existing.optOutAt !== "string") channelData.optOutAt = input.at;
    // `outcome` is single-valued, so an opt-out does not overwrite a richer outcome the
    // conversation already produced (a payment promise, a dispute). `channelData.optOutAt`
    // above is what guarantees the signal survives that case.
    const outcome: Outcome | undefined = optOut && !match.outcome ? "OPT_OUT" : undefined;

    await client.accountContactLog.update({
      where: { id: match.id },
      data: {
        ...(delivery ? { delivery } : {}),
        ...(deliveryReason ? { deliveryReason } : {}),
        ...(outcome ? { outcome } : {}),
        channelData
      }
    });
    return {
      matched: true,
      id: match.id,
      portfolioAccountId: match.portfolioAccountId,
      delivery: delivery ?? match.delivery,
      deliveryReason: deliveryReason ?? (delivery ? null : match.deliveryReason),
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
