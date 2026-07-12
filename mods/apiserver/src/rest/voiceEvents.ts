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
import type { ProviderEventRecorder } from "../engine/eventSink.js";

export interface VoiceEventsDeps {
  /** Insight generator (null when AI insights are disabled). */
  generator: InsightGenerator | null;
  /** Generation mode from the `ai` config. */
  generation: NonNullable<AiConfig>["generation"];
  /** Flight recorder; each conversation event is recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
  /**
   * Voice usage settlement (billing; null when billing is disabled). Called
   * fire-and-forget on `conversation.ended` with the call's answered duration —
   * idempotent per call ref, so webhook replays settle once.
   */
  settleUsage?:
    | ((input: { providerRef: string; answeredSeconds: number; at: string }) => Promise<unknown>)
    | null;
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

      deps.recordEvent?.({
        providerRef: typeof req.body?.callRef === "string" ? req.body.callRef : undefined,
        matched: result.matched,
        summary:
          typeof req.body?.eventType === "string" ? { eventType: req.body.eventType } : undefined
      });

      // Billing settlement: the call ended, so replace the dispatch-time estimate
      // with the increment-billed amount for the answered duration. Best-effort
      // after responding; idempotent per call ref (usage-ledger spec).
      if (
        deps.settleUsage &&
        req.body?.eventType === "conversation.ended" &&
        typeof req.body?.callRef === "string"
      ) {
        deps
          .settleUsage({
            providerRef: req.body.callRef,
            answeredSeconds:
              typeof req.body?.durationSeconds === "number" ? req.body.durationSeconds : 0,
            at: new Date().toISOString()
          })
          .catch((err: unknown) =>
            console.error(
              "[billing] voice settlement failed:",
              err instanceof Error ? err.message : err
            )
          );
      }

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
