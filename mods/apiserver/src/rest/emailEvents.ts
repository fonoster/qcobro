import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { getLogger } from "@fonoster/logger";
import { ValidationError, type EmailEventCallbackInput, type ResendConfig } from "@qcobro/common";
import type { ProviderEventRecorder } from "../engine/eventSink.js";
import {
  createPrismaEmailDeliveryStatusClient,
  createRecordEmailDeliveryStatus
} from "../functions/email/recordEmailDeliveryStatus.js";
import { verifySvixSignature } from "./svixSignature.js";

const logger = getLogger({ service: "email-events", filePath: import.meta.url });

export interface EmailEventsDeps {
  resend: ResendConfig;
  /** Flight recorder; each event is recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
}

/**
 * Map Resend's event envelope onto the normalized callback input, defensively — the payload
 * is provider-shaped and versioned, so every field is probed rather than assumed.
 *
 * `data.email_id` is the send-time message id and the only correlation handle an outbound
 * event carries. The timestamp prefers the event-specific one (`data.open.timestamp` on an
 * open) over the envelope's `created_at`, so `openedAt` records the read rather than the
 * webhook delivery.
 */
export function normalizeEmailEvent(body: unknown): EmailEventCallbackInput | null {
  const root = (body ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;

  const type = typeof root.type === "string" ? root.type : undefined;
  const rawId = data.email_id ?? data.emailId ?? data.id ?? root.email_id;
  const providerMessageId = typeof rawId === "string" ? rawId : undefined;
  if (!type || !providerMessageId) return null;

  const open = (data.open ?? {}) as Record<string, unknown>;
  const at =
    (typeof open.timestamp === "string" ? open.timestamp : undefined) ??
    (typeof root.created_at === "string" ? root.created_at : undefined) ??
    (typeof data.created_at === "string" ? data.created_at : undefined) ??
    new Date().toISOString();

  const bounce = (data.bounce ?? {}) as Record<string, unknown>;
  return {
    providerMessageId,
    type,
    at,
    bounceType: typeof bounce.type === "string" ? bounce.type : undefined,
    bounceSubType:
      (typeof bounce.subType === "string" ? bounce.subType : undefined) ??
      (typeof bounce.sub_type === "string" ? bounce.sub_type : undefined)
  };
}

/**
 * Builds the `POST /api/email/events` handler for Resend's outbound email event webhook (see
 * `email-events-hook`). Separate from `/api/email/inbound`: that route ingests customer
 * replies, hydrates their bodies from the Received Emails API, and runs the autopilot, while
 * this one is a small status mapping. Resend issues a distinct signing secret per endpoint,
 * hence `eventsSigningSecret` rather than `inboundSigningSecret`.
 *
 * Responds 200 once the signature is valid, including for an event that correlates to no known
 * gestión — a redelivery cannot resolve differently, so acknowledging it stops Resend from
 * retrying (same contract as `/api/sms/events`).
 */
export function createEmailEventsHandler(prisma: PrismaClient, deps: EmailEventsDeps) {
  const resend = deps.resend;
  const record = createRecordEmailDeliveryStatus(createPrismaEmailDeliveryStatusClient(prisma));

  return async (req: Request, res: Response): Promise<void> => {
    if (!resend) {
      res.status(503).json({ error: "Email channel is not configured" });
      return;
    }
    if (resend.eventsSigningSecret) {
      if (!verifySvixSignature(req, resend.eventsSigningSecret)) {
        logger.warn("rejected request with invalid or missing svix-signature");
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const event = normalizeEmailEvent(req.body);
    if (!event) {
      // Acknowledged, not rejected: an unparseable payload is a Resend-shape change or an
      // event kind with no email id, and neither resolves differently on redelivery.
      logger.warn("event carried no type or email_id — ignoring");
      res.status(200).json({ ignored: true, reason: "unrecognized_payload" });
      return;
    }

    logger.verbose(`received type=${event.type} emailId=${event.providerMessageId}`);

    try {
      const result = await record(event);

      res.status(200).json({ result: "success" });

      if (!result.matched) {
        logger.warn(`no gestión matched emailId=${event.providerMessageId} — event dropped`);
      }

      deps.recordEvent?.({
        // Attribution runs through the matched gestión's providerRef; the Resend message id
        // is not a key the recorder can resolve a workspace from.
        providerRef: result.matched ? (result.providerRef ?? undefined) : undefined,
        providerAt: event.at,
        matched: result.matched,
        summary: { status: event.type }
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.error(
          `400 validation failed: ${JSON.stringify(err.toJSON())} emailId=${event.providerMessageId}`
        );
        res.status(400).json(err.toJSON());
        return;
      }
      logger.error(`unexpected error: ${err instanceof Error ? err.message : err}`);
      res.status(500).json({ error: "Failed to ingest email event" });
    }
  };
}
