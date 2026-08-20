import type { Request, Response } from "express";
import { getLogger } from "@fonoster/logger";
import twilio from "twilio";
import { ValidationError } from "@qcobro/common";
import {
  createRecordSmsDeliveryStatus,
  type SmsDeliveryStatusClient
} from "../functions/sms/recordSmsDeliveryStatus.js";
import type { ProviderEventRecorder } from "../engine/eventSink.js";

const logger = getLogger({ service: "sms-events", filePath: import.meta.url });

export interface SmsEventsDeps {
  /** The account's Twilio auth token, used to validate `X-Twilio-Signature`. */
  authToken: string;
  /** The exact callback URL Twilio was configured with — must match byte-for-byte. */
  callbackUrl: string;
  /** Flight recorder; each callback is recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
}

/**
 * Builds the `POST /api/sms/events` handler for Twilio's message-status callback (see
 * `sms-events-hook`). Every request is validated against `X-Twilio-Signature` before
 * anything else runs — unlike `voiceEvents.ts`, this endpoint is authenticated from the
 * start, using Twilio's own documented signature scheme against the configured
 * `authToken`.
 */
export function createSmsEventsHandler(prisma: SmsDeliveryStatusClient, deps: SmsEventsDeps) {
  const record = createRecordSmsDeliveryStatus(prisma);

  return async (req: Request, res: Response): Promise<void> => {
    const signature = req.header("X-Twilio-Signature");
    const valid =
      typeof signature === "string" &&
      twilio.validateRequest(deps.authToken, signature, deps.callbackUrl, req.body ?? {});

    if (!valid) {
      logger.warn(`rejected request with invalid or missing X-Twilio-Signature`);
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

    const messageSid = typeof req.body?.MessageSid === "string" ? req.body.MessageSid : undefined;
    const messageStatus =
      typeof req.body?.MessageStatus === "string" ? req.body.MessageStatus : undefined;
    const errorCode = typeof req.body?.ErrorCode === "string" ? req.body.ErrorCode : undefined;

    logger.verbose(`received MessageSid=${messageSid} MessageStatus=${messageStatus}`);

    try {
      const result = await record({
        providerRef: messageSid ?? "",
        status: messageStatus ?? "",
        at: new Date().toISOString(),
        errorCode
      });

      // Always 200 once the signature is valid — a callback that doesn't correlate to a
      // known gestión can't resolve differently on retry, so acknowledging it stops
      // Twilio from redelivering (sms-events-hook spec).
      res.status(200).json({ result: "success" });

      if (!result.matched) {
        logger.warn(`no gestión matched MessageSid=${messageSid} — event dropped`);
      }

      deps.recordEvent?.({
        providerRef: messageSid,
        matched: result.matched,
        summary: messageStatus ? { status: messageStatus } : undefined
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.error(
          `400 validation failed: ${JSON.stringify(err.toJSON())} MessageSid=${messageSid}`
        );
        res.status(400).json(err.toJSON());
        return;
      }
      logger.error(`unexpected error: ${err instanceof Error ? err.message : err}`);
      res.status(500).json({ error: "Failed to ingest SMS event" });
    }
  };
}
