import type { TranscriptLine } from "../schemas/voiceEvent.js";
import type { GestionInsight } from "../schemas/insight.js";

/** What the insight generator receives to analyze one gestión. */
export interface InsightRequest {
  transcript: TranscriptLine[];
  /** Language to write the analysis in (e.g. account preferred language). */
  language?: string;
  /** Light grounding context; never required. */
  context?: { customerName?: string; outstandingBalance?: number };
}

/**
 * Port for producing a gestión's structured analysis from its transcript. The
 * production adapter wraps an LLM (provider from `qcobro.json` `ai`); tests inject a
 * stub. Reached through the tRPC context like other service ports.
 */
export interface InsightGenerator {
  analyze(req: InsightRequest): Promise<GestionInsight>;
}
