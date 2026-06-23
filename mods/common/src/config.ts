import { z } from "zod";

/**
 * QCobro service configuration — the shape of `qcobro.json`.
 *
 * This module exports the schema/type only (no filesystem access) so it stays
 * safe to import from the browser. Server packages load the file and call
 * `qcobroConfigSchema.parse(...)`.
 *
 * Identity runs as an external Fonoster Identity service; QCobro only needs the
 * endpoint to reach it. All Identity service configuration (database, keys,
 * issuer, SMTP, …) lives with that service, not here.
 */
export const identityConfigSchema = z.object({
  /** host:port the apiserver uses to reach the external Identity gRPC service. */
  endpoint: z.string().default("localhost:50051"),
  /** Base URL of the Identity HTTP bridge (accepts invite tokens). */
  httpBridgeUrl: z.string().default("http://localhost:9110")
});

/**
 * A selectable voice in the deployment's catalog. Voice agent templates pick a
 * voice by `id` (the provider's voice identifier, e.g. an ElevenLabs voice id);
 * the console renders the picker from this catalog rather than free text.
 */
export const voiceCatalogEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  gender: z.enum(["female", "male"]),
  provider: z.string().min(1).default("elevenlabs")
});

export type VoiceCatalogEntry = z.infer<typeof voiceCatalogEntrySchema>;

/**
 * Fonoster connection + Autopilot defaults. VOICE_AI agent templates are synced to
 * Fonoster as AUTOPILOT applications; the apiserver authenticates with a workspace
 * access key + API key/secret. Optional — when absent, voice templates save locally
 * and stay unsynced (the console offers a manual re-sync).
 */
export const fonosterConfigSchema = z
  .object({
    accessKeyId: z.string().min(1),
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
    /** Optional override for the Fonoster API endpoint (host:port). */
    endpoint: z.string().optional(),
    /** Default products/model used when building the Autopilot application. The
     * TTS product is NOT set here — it is derived per voice (see `voices`) since
     * both Voz IA and pre-recorded voice use it. */
    autopilot: z
      .object({
        sttProductRef: z.string().default("stt.deepgram"),
        sttModel: z.string().default("nova-3"),
        llmProductRef: z.string().default("llm.google"),
        llmProvider: z.string().default("google"),
        llmModel: z.string().default("gemini-2.0-flash"),
        maxTokens: z.number().default(300),
        temperature: z.number().default(0)
      })
      .default({
        sttProductRef: "stt.deepgram",
        sttModel: "nova-3",
        llmProductRef: "llm.google",
        llmProvider: "google",
        llmModel: "gemini-2.0-flash",
        maxTokens: 300,
        temperature: 0
      }),
    /**
     * Selectable voice catalog for voice agent templates (Voz IA + pre-recorded).
     * Voices are Fonoster-only, so they live here. Seeded with three Spanish
     * voices; deployments override in `qcobro.json`. The TTS product ref is
     * derived from each voice's `provider` (see {@link ttsProductRefForVoice}).
     */
    voices: z.array(voiceCatalogEntrySchema).default([
      {
        id: "86V9x9hrQds83qf7zaGn",
        name: "Sofía",
        language: "es",
        gender: "female",
        provider: "elevenlabs"
      },
      {
        id: "tTQzD8U8Gd5cKQEnxNyf",
        name: "Carmen",
        language: "es",
        gender: "female",
        provider: "elevenlabs"
      },
      {
        id: "Iowum0gIcGfYE94JArBb",
        name: "Andrés",
        language: "es",
        gender: "male",
        provider: "elevenlabs"
      }
    ]),
    /**
     * Caller-ID numbers (E.164) outbound voice dispatch rotates through. Empty by
     * default — voice dispatch fails clearly until at least one number is configured.
     */
    numbers: z.array(z.string().min(1)).default([])
  })
  .optional();

export type FonosterConfig = z.infer<typeof fonosterConfigSchema>;

/**
 * Derives the TTS product ref for a voice from its provider (e.g. an `elevenlabs`
 * voice → `tts.elevenlabs`). Used by both Voz IA (Autopilot) and pre-recorded
 * voice. Falls back to `tts.elevenlabs` when the voice isn't in the catalog.
 */
export function ttsProductRefForVoice(voiceId: string, voices: VoiceCatalogEntry[]): string {
  const voice = voices.find((v) => v.id === voiceId);
  return voice ? `tts.${voice.provider}` : "tts.elevenlabs";
}

/**
 * Twilio connection for SMS dispatch. Optional — when absent, SMS dispatch fails
 * with a clear error. `fromNumbers` (E.164) are rotated through per message.
 */
export const twilioConfigSchema = z
  .object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumbers: z.array(z.string().min(1)).default([])
  })
  .optional();

export type TwilioConfig = z.infer<typeof twilioConfigSchema>;

export const qcobroConfigSchema = z.object({
  /** Application (apiserver) database. */
  database: z.object({ url: z.string().min(1) }),
  identity: identityConfigSchema,
  apiserver: z
    .object({
      port: z.number().default(3000),
      /**
       * Deployment-wide IANA timezone for interpreting campaign wall-clock
       * outreach windows (`startTime`/`endTime`). Per-workspace zones deferred.
       */
      timezone: z.string().default("America/Costa_Rica"),
      /** External contact-log ingress (`POST /api/contact-logs`) auth gate. */
      contactLogAuth: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
    })
    .default({ port: 3000, timezone: "America/Costa_Rica", contactLogAuth: { enabled: false } }),
  fonoster: fonosterConfigSchema,
  twilio: twilioConfigSchema
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type QCobroConfig = z.infer<typeof qcobroConfigSchema>;
