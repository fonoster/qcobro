import type { Request, Response } from "express";
import { ValidationError } from "@qcobro/common";
import {
  createIngestVoiceEvent,
  type VoiceEventClient
} from "../functions/voice/ingestVoiceEvent.js";

/**
 * Builds the `POST /api/voice/events` handler for the Fonoster autopilot events-hook
 * (conversation.started / conversation.ended). It correlates the event to the gestión
 * created at call placement and updates it with transcript, recording, and duration.
 *
 * FIXME(security): this endpoint is UNAUTHENTICATED and must be secured very soon —
 * the autopilot should sign requests (or carry a shared secret / workspace credential),
 * and correlation must be workspace-scoped. Until then, anyone who can reach this port
 * can write transcript/recording data onto any Voz IA gestión by guessing a call ref.
 */
export function createVoiceEventsHandler(prisma: VoiceEventClient) {
  const ingest = createIngestVoiceEvent(prisma);

  return async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await ingest(req.body);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json(err.toJSON());
        return;
      }
      res.status(500).json({ error: "Failed to ingest voice event" });
    }
  };
}
