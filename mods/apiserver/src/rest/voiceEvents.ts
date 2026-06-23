import type { Request, Response } from "express";
import { ValidationError, type AiConfig, type InsightGenerator } from "@qcobro/common";
import {
  createIngestVoiceEvent,
  type VoiceEventClient
} from "../functions/voice/ingestVoiceEvent.js";
import {
  createGenerateGestionInsight,
  type GenerateInsightClient
} from "../functions/voice/generateGestionInsight.js";

export interface VoiceEventsDeps {
  /** Insight generator (null when AI insights are disabled). */
  generator: InsightGenerator | null;
  /** Generation mode from the `ai` config. */
  generation: NonNullable<AiConfig>["generation"];
}

/**
 * Builds the `POST /api/voice/events` handler for the Fonoster autopilot events-hook
 * (conversation.started / conversation.ended). It correlates the event to the gestión
 * created at call placement and updates it with transcript, recording, and duration.
 * When `ai.generation` is `onIngestion`, it also generates the analysis inline once the
 * transcript has been stored.
 *
 * FIXME(security): this endpoint is UNAUTHENTICATED and must be secured very soon —
 * the autopilot should sign requests (or carry a shared secret / workspace credential),
 * and correlation must be workspace-scoped. Until then, anyone who can reach this port
 * can write transcript/recording data onto any Voz IA gestión by guessing a call ref.
 */
export function createVoiceEventsHandler(
  prisma: VoiceEventClient & GenerateInsightClient,
  deps: VoiceEventsDeps
) {
  const ingest = createIngestVoiceEvent(prisma);
  const generate = createGenerateGestionInsight({ prisma, generator: deps.generator });

  return async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await ingest(req.body);
      res.status(200).json(result);

      // On-ingestion analysis: best-effort, after responding (the autopilot does not
      // wait for our response). Failures must not affect ingestion.
      if (
        result.matched &&
        deps.generation === "onIngestion" &&
        deps.generator &&
        req.body?.eventType === "conversation.ended"
      ) {
        generate({ id: result.id }).catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json(err.toJSON());
        return;
      }
      res.status(500).json({ error: "Failed to ingest voice event" });
    }
  };
}
