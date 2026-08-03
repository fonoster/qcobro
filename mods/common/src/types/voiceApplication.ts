/**
 * Port for syncing VOICE_AI agent templates to an external voice-application
 * provider (Fonoster Autopilot). Kept provider-agnostic so service functions
 * depend on this interface and tests inject a stub — no live SDK in unit tests.
 */

/** Domain-level inputs the engine needs to (re)build a voice application. */
export interface VoiceApplicationInput {
  /** Application name (maps to VoiceAiConfig.fonosterAppName). */
  name: string;
  /** Provider voice id (e.g. an ElevenLabs voice id). */
  voice: string;
  /** The AI agent's persona/instructions. */
  systemPrompt: string;
  /** The opening line spoken to the contact; optional — falls back to the autopilot
   * template's default greeting when the agent has no scripted first message. */
  firstMessage?: string;
  /** Language code (e.g. `es`, `en`). */
  language: string;
}

/** One scripted turn within a VOICE_AI eval scenario, translated into Fonoster's
 * `conversation[].userInput`/`expected` shape by the client implementation. */
export interface VoiceApplicationEvalTurn {
  input: string;
  expected?: {
    text?: { type: "EXACT" | "SIMILAR"; response: string };
    tools?: { tool: string; parameters?: Record<string, unknown> }[];
  };
}

/** One scenario within a VOICE_AI eval run. `account` is the rendered outreach context
 * (see `buildOutreachContext`); the client implementation maps it onto whatever ad-hoc
 * metadata bag the provider expects (Fonoster's `telephonyContext.metadata`). */
export interface VoiceApplicationEvalScenario {
  ref: string;
  /** Forwarded to Fonoster's required `scenarios[].description`; defaults to `ref` when unset. */
  description?: string;
  account: Record<string, unknown>;
  turns: VoiceApplicationEvalTurn[];
}

/** Input to evaluate a `VOICE_AI` agent's conversation logic. No application ref is
 * required — evaluation is inherently ephemeral (see design.md). */
export interface VoiceApplicationEvalInput {
  systemPrompt: string;
  firstMessage?: string;
  language: string;
  scenarios: VoiceApplicationEvalScenario[];
}

/** Mirrors Fonoster's `EvaluateIntelligenceEvent` (`@fonoster/types`), so the apiserver
 * relays it without inventing a parallel shape. */
export type VoiceApplicationEvalEvent =
  | {
      type: "stepResult";
      scenarioRef: string;
      stepResult: {
        humanInput: string;
        expectedResponse: string;
        aiResponse: string;
        evaluationType: "EXACT" | "SIMILAR";
        passed: boolean;
        errorMessage?: string;
        toolEvaluations?: {
          expectedTool: string;
          actualTool: string;
          passed: boolean;
          expectedParameters?: Record<string, unknown>;
          actualParameters?: Record<string, unknown>;
          errorMessage?: string;
        }[];
      };
    }
  | { type: "scenarioSummary"; scenarioRef: string; overallPassed: boolean }
  | { type: "evalError"; message: string };

export interface VoiceApplicationClient {
  /** Create the remote application; resolves with its provider ref. */
  createApplication(input: VoiceApplicationInput): Promise<{ ref: string }>;
  /** Update an existing remote application by ref. */
  updateApplication(ref: string, input: VoiceApplicationInput): Promise<{ ref: string }>;
  /** Delete the remote application by ref (best-effort cleanup). */
  deleteApplication(ref: string): Promise<void>;
  /** Evaluate a `VOICE_AI` agent's conversation logic — existing or ephemeral, no
   * application ref required. Streams Fonoster's per-turn/per-scenario events unchanged. */
  evaluate(input: VoiceApplicationEvalInput): AsyncGenerator<VoiceApplicationEvalEvent>;
}
