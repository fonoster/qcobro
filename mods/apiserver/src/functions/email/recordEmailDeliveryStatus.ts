import type { PrismaClient } from "@prisma/client";
import {
  emailEventCallbackSchema,
  withErrorHandlingAndValidation,
  type DeliveryReason,
  type EmailEventCallbackInput,
  type Entrega,
  type Resultado
} from "@qcobro/common";

/** Minimal Prisma surface this completion needs. */
export interface EmailDeliveryStatusClient {
  accountContactLog: {
    findFirst(args: {
      where: { providerMessageId: string; agentType: "EMAIL" };
      select: {
        id: true;
        providerRef: true;
        entrega: true;
        deliveryReason: true;
        resultado: true;
        channelData: true;
      };
    }): Promise<{
      id: string;
      providerRef: string | null;
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

export type RecordEmailDeliveryStatusResult =
  | { matched: false }
  | {
      matched: true;
      id: string;
      /**
       * The matched gestión's `providerRef`. Passed back so the caller can attribute the
       * `provider.event` to a workspace — the flight recorder resolves the workspace through
       * it, and a row recorded without one is invisible to every fetch.
       */
      providerRef: string | null;
      entrega: Entrega;
      deliveryReason: DeliveryReason | null;
      openedAt: string | null;
    };

/**
 * Resend events that prove the message reached the receiving mail server. A spam complaint
 * counts: the recipient could not have complained about a message they never received.
 */
const DELIVERED_EVENTS = new Set(["email.delivered", "email.complained"]);
/** Resend events that mean the message definitively did not arrive. */
const FAILED_EVENTS = new Set(["email.bounced", "email.failed"]);

/**
 * Resend bounce classification → `deliveryReason`, keyed `<type>/<subType>` and falling back
 * to `<type>` alone. Only the distinctions with a different retry policy are spelled out:
 * a `Transient` bounce is worth retrying, a `Permanent` one is not, and `Suppressed` is a
 * refusal rather than a bad address (the address works; Resend's suppression list blocked it).
 * https://resend.com/docs/dashboard/emails/introduction
 */
const RESEND_BOUNCE_REASON: Readonly<Record<string, DeliveryReason>> = {
  "Permanent/Suppressed": "REJECTED",
  "Permanent/NoEmail": "INVALID_DESTINATION",
  "Permanent/General": "INVALID_DESTINATION",
  Permanent: "INVALID_DESTINATION",
  "Transient/MailboxFull": "UNREACHABLE",
  "Transient/General": "UNREACHABLE",
  Transient: "UNREACHABLE"
};

function deliveryReasonForFailure(input: EmailEventCallbackInput): DeliveryReason {
  // `email.failed` carries no bounce block at all — Resend could not evaluate the send.
  if (!input.bounceType) return "PROVIDER_ERROR";
  const specific = input.bounceSubType
    ? RESEND_BOUNCE_REASON[`${input.bounceType}/${input.bounceSubType}`]
    : undefined;
  return specific ?? RESEND_BOUNCE_REASON[input.bounceType] ?? "PROVIDER_ERROR";
}

/**
 * Records an EMAIL gestión's real delivery status from Resend's outbound event webhook (see
 * `email-events-hook`). Correlates on `providerMessageId` — Resend's `data.email_id` — because
 * an outbound event carries nothing else; `providerRef` holds the reply-to token that inbound
 * replies correlate on, so the two keys coexist rather than compete.
 *
 * Every event updates `channelData.deliveryStatus` to the raw event type, terminal or not, so
 * an operator can see progress before the gestión finalizes. Only a terminal event
 * (`delivered` / `complained` / `bounced` / `failed`) finalizes `entrega` (+ `deliveryReason`
 * on failure); `sent` and `delivery_delayed` update visibility only.
 *
 * `email.opened` writes `channelData.openedAt` and moves no axis. Read-but-unengaged is
 * deliberately unmodelled: open tracking is a pixel signal that image proxies inflate and
 * blocked images suppress, so it stays display-only and enters no metric. The first open wins,
 * so the timestamp records when the message was first read rather than when a proxy last
 * re-fetched it.
 *
 * `email.complained` always records `channelData.optOutAt` and additionally sets
 * `resultado: OPT_OUT` when the gestión has no resultado yet, mirroring the WhatsApp 131050
 * path. Both are findable markers in the console, not enforced suppression, which belongs to
 * the workspace Do Not Contact list (#101).
 *
 * Idempotent per message id: `entrega` only ever advances. Once it has left the dispatch-time
 * `DISPATCHED` — by a prior event, or by a customer reply, which races these events freely —
 * a repeated or later terminal event preserves the existing `entrega`/`deliveryReason`.
 */
export function createRecordEmailDeliveryStatus(client: EmailDeliveryStatusClient) {
  const fn = async (input: EmailEventCallbackInput): Promise<RecordEmailDeliveryStatusResult> => {
    const match = await client.accountContactLog.findFirst({
      where: { providerMessageId: input.providerMessageId, agentType: "EMAIL" },
      select: {
        id: true,
        providerRef: true,
        entrega: true,
        deliveryReason: true,
        resultado: true,
        channelData: true
      }
    });
    if (!match) return { matched: false };

    const existing = (match.channelData as Record<string, unknown> | null) ?? {};
    const channelData: Record<string, unknown> = { ...existing, deliveryStatus: input.type };

    // First open wins — a later re-fetch by an image proxy must not overwrite the real read.
    const alreadyOpened = typeof existing.openedAt === "string" ? existing.openedAt : null;
    if (input.type === "email.opened" && !alreadyOpened) channelData.openedAt = input.at;

    const terminal: Entrega | null = DELIVERED_EVENTS.has(input.type)
      ? "DELIVERED"
      : FAILED_EVENTS.has(input.type)
        ? "FAILED"
        : null;

    // Never move entrega back off DISPATCHED once it has already left it.
    const shouldFinalize = terminal !== null && match.entrega === "DISPATCHED";
    const entrega: Entrega | undefined = shouldFinalize ? terminal : undefined;
    const deliveryReason: DeliveryReason | undefined =
      shouldFinalize && terminal === "FAILED" ? deliveryReasonForFailure(input) : undefined;

    const complained = input.type === "email.complained";
    // Recorded on every complaint, even when `resultado` is left alone below — this is the
    // durable trace of it, and the axis write is best-effort on top of it.
    if (complained && typeof existing.optOutAt !== "string") channelData.optOutAt = input.at;
    // `resultado` is single-valued, so a complaint does not overwrite a richer outcome the
    // conversation already produced. The realistic ordering makes this matter: the customer
    // replies (the autopilot writes PAYMENT_PROMISE or DISPUTE_RAISED), then marks the thread
    // as spam days later. `channelData.optOutAt` above is what guarantees the complaint
    // survives that case rather than vanishing.
    const resultado: Resultado | undefined = complained && !match.resultado ? "OPT_OUT" : undefined;

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
      providerRef: match.providerRef,
      entrega: entrega ?? match.entrega,
      deliveryReason: deliveryReason ?? (entrega ? null : match.deliveryReason),
      openedAt: typeof channelData.openedAt === "string" ? channelData.openedAt : null
    };
  };

  return withErrorHandlingAndValidation(fn, emailEventCallbackSchema);
}

/** Prisma-backed {@link EmailDeliveryStatusClient}. */
export function createPrismaEmailDeliveryStatusClient(
  prisma: PrismaClient
): EmailDeliveryStatusClient {
  return prisma as unknown as EmailDeliveryStatusClient;
}
