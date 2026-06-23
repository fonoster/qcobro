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
     * Caller-ID numbers outbound voice dispatch rotates through. Use the format the
     * carrier expects — Fonoster passes the number through as given, so whether a
     * leading "+" is required depends on the carrier (here, no "+", e.g.
     * `18297340812`). Empty by default — voice dispatch fails clearly until set.
     */
    numbers: z.array(z.string().min(1)).default([]),
    /**
     * The Fonoster EXTERNAL application ref used for ALL pre-recorded voice
     * dispatch (one shared app pointing at the embedded VoiceServer). The
     * per-customer script is passed as call metadata; this ref is deployment-wide,
     * not per agent. Voz IA uses each template's own AUTOPILOT app ref instead.
     */
    prerecordedAppRef: z.string().min(1).optional(),
    /**
     * Externally reachable base URL of the apiserver for Fonoster callbacks (e.g. an
     * ngrok URL). When set, syncing a Voz IA agent registers the autopilot events-hook
     * at `${webhookBaseUrl}/api/voice/events` so conversation events return as gestiones.
     */
    webhookBaseUrl: z.string().url().optional()
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

/**
 * AI-insight generation. Produces a gestión's structured analysis from its
 * conversation transcript. Optional — when absent or `enabled:false`, no LLM is
 * called and gestiones keep their unanalyzed / generic-insight state.
 *
 * Providers mirror the Fonoster autopilot / Mikro vendor set, reached over each
 * vendor's REST API (no SDK dependency). `mock` is an offline provider that
 * synthesizes a deterministic analysis from the transcript — for local dev,
 * demos, and tests, with no key and no network/cost.
 */
export const aiProviderSchema = z.enum(["mock", "google", "openai", "anthropic"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

/** Valid models per provider; used to reject misconfiguration at load. */
export const AI_MODELS: Record<AiProvider, string[]> = {
  mock: ["mock"],
  google: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"]
};

export const aiConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: aiProviderSchema.default("mock"),
    apiKey: z.string().optional(),
    model: z.string().default("gemini-2.5-flash"),
    temperature: z.number().min(0).max(2).default(0),
    maxTokens: z.number().int().positive().default(600),
    /** When the analysis is produced. `onDemand` = on first detail open (then
     * cached); `onIngestion` = when the transcript is first stored. */
    generation: z.enum(["onDemand", "onIngestion"]).default("onDemand")
  })
  .superRefine((cfg, ctx) => {
    if (!AI_MODELS[cfg.provider].includes(cfg.model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["model"],
        message: `Invalid model "${cfg.model}" for provider "${cfg.provider}". Valid: ${AI_MODELS[cfg.provider].join(", ")}`
      });
    }
    // apiKey is optional here: it may be omitted and sourced from the Fonoster
    // integrations file by provider (the adapter resolves it and errors clearly if
    // none is found at call time).
  })
  .optional();

export type AiConfig = z.infer<typeof aiConfigSchema>;

/**
 * Text-to-speech for previewing pre-recorded agent scripts in the console (the
 * Pre-grabada gestión detail plays the script as audio). Optional — when absent, the
 * apiKey falls back to `ELEVENLABS_API_KEY` / the Fonoster integrations file, and if no
 * key resolves the player is simply unavailable. Voices come from `fonoster.voices`.
 */
export const ttsConfigSchema = z
  .object({
    provider: z.literal("elevenlabs").default("elevenlabs"),
    apiKey: z.string().optional(),
    model: z.string().default("eleven_multilingual_v2")
  })
  .optional();

export type TtsConfig = z.infer<typeof ttsConfigSchema>;

export const qcobroConfigSchema = z.object({
  /** Application (apiserver) database. */
  database: z.object({ url: z.string().min(1) }),
  /**
   * Deployment-wide IANA timezone for interpreting campaign wall-clock outreach
   * windows (`startTime`/`endTime`). A general, top-level setting (not apiserver-
   * specific). Reserved: declared here for deployments, not yet consumed by code.
   */
  timezone: z.string().default("America/Costa_Rica"),
  identity: identityConfigSchema,
  apiserver: z
    .object({
      port: z.number().default(3000),
      /**
       * Port for the embedded Fonoster VoiceServer (external voice application).
       * Pre-recorded voice agents are EXTERNAL Fonoster apps that call back into
       * this server; it answers and plays the rendered script via the Say verb.
       */
      voicePort: z.number().default(50061),
      /** External contact-log ingress (`POST /api/contact-logs`) auth gate. */
      contactLogAuth: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
    })
    .default({
      port: 3000,
      voicePort: 50061,
      contactLogAuth: { enabled: false }
    }),
  fonoster: fonosterConfigSchema,
  twilio: twilioConfigSchema,
  ai: aiConfigSchema,
  tts: ttsConfigSchema
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type QCobroConfig = z.infer<typeof qcobroConfigSchema>;
