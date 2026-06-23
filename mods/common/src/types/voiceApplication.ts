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

export interface VoiceApplicationClient {
  /** Create the remote application; resolves with its provider ref. */
  createApplication(input: VoiceApplicationInput): Promise<{ ref: string }>;
  /** Update an existing remote application by ref. */
  updateApplication(ref: string, input: VoiceApplicationInput): Promise<{ ref: string }>;
  /** Delete the remote application by ref (best-effort cleanup). */
  deleteApplication(ref: string): Promise<void>;
}
