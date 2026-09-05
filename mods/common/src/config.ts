import { z } from "zod";
import { ratesSchema } from "./billing/rates.js";
import { PRERECORDED_SCRIPT_MAX_LENGTH } from "./schemas/agentTemplates.js";

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
        temperature: z.number().default(0),
        /**
         * Model for Fonoster's `evaluateIntelligence` judge (`testCases.evalsLanguageModel`) —
         * a required field on every VOICE_AI eval request, always `provider: "openai"` (the only
         * provider Fonoster's evals grader supports, independent of the agent's own
         * `llmProvider`/`llmModel` above). Confirmed against the live service that Fonoster
         * supplies its own default OpenAI key when none is given, so no apiKey field is exposed
         * here yet — add one if a deployment ever needs its own quota.
         */
        evalsModel: z.string().default("gpt-4o-mini")
      })
      .default({
        sttProductRef: "stt.deepgram",
        sttModel: "nova-3",
        llmProductRef: "llm.google",
        llmProvider: "google",
        llmModel: "gemini-2.0-flash",
        maxTokens: 300,
        temperature: 0,
        evalsModel: "gpt-4o-mini"
      }),
    /**
     * Selectable voice catalog for voice agent templates (Voz IA + pre-recorded).
     * Voices are Fonoster-only, so they live here. Seeded with three Spanish
     * voices; deployments override in `qcobro.json`. The TTS product ref is
     * derived from each voice's `provider` (see {@link ttsProductRefForVoice}).
     */
    // Shape only — the actual catalog is supplied by qcobro.json (see config/*.json),
    // not defaulted in the schema.
    voices: z.array(voiceCatalogEntrySchema).optional(),
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
     * ngrok URL). Syncing a Voz IA agent registers the autopilot events-hook at
     * `${webhookBaseUrl}/api/voice/events` so conversation events return as gestiones.
     *
     * **Required whenever a `fonoster` section is present.** The section itself stays
     * optional — omitting it disables the voice channels entirely. What is not allowed is
     * the in-between: dispatching calls with no callback registered, which strands every
     * gestión at `entrega: DISPATCHED` forever with no way to learn what happened.
     */
    webhookBaseUrl: z.string().url({
      message:
        "fonoster.webhookBaseUrl is required. Voice dispatch without a callback URL strands " +
        "every gestión at entrega=DISPATCHED with no way to learn the call result. Set it to " +
        "the apiserver's externally reachable base URL, or remove the whole `fonoster` " +
        "section to disable the voice channels."
    }),
    /**
     * Campaigns-engine pacing: the maximum number of voice calls the engine will
     * originate per minute, deployment-wide (the caller-ID pool is shared by all
     * workspaces). A conservative value bounds in-flight concurrency given the pool
     * size and typical call duration. Reserve `0` to pause voice dispatch.
     */
    maxCallsPerMinute: z.number().int().nonnegative().default(6),
    /**
     * How long Fonoster lets an outbound call ring before giving up, in seconds.
     *
     * Fonoster's own default is 30s, and that is not 30 seconds of ringing: SIP setup
     * (gateway auth, the carrier's own handshake, PSTN ringback) consumes several
     * seconds before the handset rings at all, leaving barely 21s of real ring time.
     * Recipients who answer at a normal 25–26 seconds were being cancelled a moment
     * before they picked up — and because the cancel loses the race with the carrier's
     * answer, they answered into a dead line. Anyone slower than about 21 seconds was
     * being filtered out of every campaign, invisibly, since the result is
     * indistinguishable from a genuine no-answer.
     *
     * Fonoster's validator caps this at 120.
     */
    callTimeoutSeconds: z.number().int().positive().max(120).default(60),
    /**
     * Where call recordings are served from, e.g.
     * `https://app.fonoster.com/api/recordings`. Recordings live in Fonoster, not here,
     * so the console links to them rather than storing copies; the recording's file
     * name is appended to this base (see {@link recordingUrlForFile}).
     *
     * Must match the deployment's `AUTOPILOT_RECORDING_BASE_URL`, since that is the base
     * Voz IA reports its own recordings against.
     *
     * Used for PRE-RECORDED calls, whose file name we derive ourselves at call time
     * ({@link recordingFileNameForCall}) and resolve on read, so changing this base fixes
     * every historical pre-recorded gestión at once. Voz IA is unaffected: the autopilot
     * reports a complete URL with the transcript, and that URL is used as reported.
     */
    recordingBaseUrl: z.string().url().optional()
  })
  .optional();

export type FonosterConfig = z.infer<typeof fonosterConfigSchema>;

/** Container format Fonoster records calls in; the file name alone has no extension. */
const RECORDING_FILE_EXTENSION = ".wav";

/**
 * The file name Fonoster records a call under.
 *
 * Fonoster records every call from its Asterisk dialplan, before the call ever reaches a
 * voice application: `MixMonitor(${APP_REF}_${UNIQUEID}.wav)` (fonoster,
 * `asterisk/config/extensions.conf`). `UNIQUEID` is the channel the voice app is handed
 * as `mediaSessionRef`, so the pair a voice request already carries names the file
 * exactly. This is the same construction the autopilot uses for the recording URL it
 * reports on Voz IA calls (fonoster, `mods/autopilot/src/handleVoiceRequest.ts`), which
 * is why emulating it here yields URLs that resolve for pre-recorded calls too.
 *
 * The call ref is deliberately NOT part of the name: it is a Fonoster-side call
 * identifier that names no recording file, and a URL built from it 404s.
 */
export function recordingFileNameForCall(
  appRef: string | null | undefined,
  mediaSessionRef: string | null | undefined
): string | undefined {
  if (!appRef || !mediaSessionRef) return undefined;
  return `${appRef}_${mediaSessionRef}${RECORDING_FILE_EXTENSION}`;
}

/**
 * Resolves a recording's URL by appending its file name to the deployment's recording
 * base URL. Returns `undefined` when either is missing, so callers fall back to whatever
 * URL the provider reported.
 *
 * The name is percent-encoded so an odd value cannot break out of the path.
 */
export function recordingUrlForFile(
  fileName: string | null | undefined,
  baseUrl: string | null | undefined
): string | undefined {
  if (!fileName || !baseUrl) return undefined;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(fileName)}`;
}

/**
 * The recording URL for a gestión, from what its channel actually reported.
 *
 * The two voice channels report different halves, and the difference is not cosmetic:
 *
 * - Voz IA stores a whole `recordingUrl`, sent by the autopilot with the transcript.
 *   The autopilot runs inside Fonoster and builds that URL against its own recording
 *   base, so it is the provider's own answer about where the audio lives and is used
 *   verbatim.
 * - Pre-recorded stores only `recordingFile`, the name Fonoster recorded under (our
 *   voice server knows the name but not the deployment's public recordings host). The
 *   URL is composed here, on read, so moving that host fixes every historical gestión
 *   at once instead of only the ones recorded afterwards.
 *
 * Returns `undefined` when the gestión has neither — a channel with no recording, a
 * call that never connected, or a pre-recorded row on a deployment with no
 * `recordingBaseUrl` set. Nothing is ever derived from the call ref: it names no
 * recording file, and a URL built from it 404s.
 */
export function resolveRecordingUrl(
  channelData: Record<string, unknown> | null | undefined,
  baseUrl: string | null | undefined
): string | undefined {
  const reportedUrl = channelData?.recordingUrl;
  if (typeof reportedUrl === "string" && reportedUrl) return reportedUrl;

  const fileName = channelData?.recordingFile;
  return recordingUrlForFile(typeof fileName === "string" ? fileName : undefined, baseUrl);
}

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
    fromNumbers: z.array(z.string().min(1)).default([]),
    /**
     * Campaigns-engine pacing: the maximum number of SMS messages the engine will
     * send per minute, deployment-wide (the sender pool is shared by all workspaces).
     * Reserve `0` to pause SMS dispatch.
     */
    maxSmsPerMinute: z.number().int().nonnegative().default(60),
    /**
     * Public base URL Twilio can reach. Outbound SMS registers a `statusCallback` at
     * `${webhookBaseUrl}/api/sms/events` so delivery status returns as a gestión update
     * (see the sms-events-hook capability).
     *
     * **Required whenever a `twilio` section is present.** The section itself stays
     * optional — omitting it disables SMS entirely. Fire-and-forget SMS is no longer a
     * supported configuration: without the callback every SMS gestión sits at
     * `entrega: DISPATCHED` permanently, which is indistinguishable from a message still
     * in flight and makes delivery rate uncomputable.
     */
    webhookBaseUrl: z.string().url({
      message:
        "twilio.webhookBaseUrl is required. SMS dispatch without a status callback strands " +
        "every gestión at entrega=DISPATCHED, which is indistinguishable from a message still " +
        "in flight. Set it to the apiserver's externally reachable base URL, or remove the " +
        "whole `twilio` section to disable SMS."
    })
  })
  .optional();

export type TwilioConfig = z.infer<typeof twilioConfigSchema>;

/**
 * Resend connection for the bidirectional EMAIL channel. Optional — when absent, EMAIL
 * dispatch is inert (the engine reports EMAIL campaigns as not-configured) and the webhook
 * rejects everything. Outbound uses `apiKey` + `fromEmail`/`fromName`; inbound replies arrive
 * at `reply+<token>@<inboundDomain>`. The per-attempt reply cap defaults to `maxRepliesDefault`.
 *
 * One webhook endpoint carries both directions — customer replies (`email.received`) and our
 * own sends' delivery/open/bounce events — so there is a single `inboundSigningSecret`. Resend
 * issues a signing secret per endpoint, so a second endpoint would have meant a second secret
 * here for no behavioural gain.
 */
export const resendConfigSchema = z
  .object({
    apiKey: z.string().min(1),
    fromEmail: z.string().email(),
    fromName: z.string().min(1).optional(),
    /** Domain the per-attempt reply-to token addresses are minted on (inbound). */
    inboundDomain: z.string().min(1),
    /**
     * Shared secret used to verify webhook signatures, for both customer replies and delivery
     * events. Optional in the schema, but the endpoint rejects every request without it.
     */
    inboundSigningSecret: z.string().min(1).optional(),
    /**
     * Campaigns-engine pacing: the maximum number of emails the engine will send per
     * minute, deployment-wide. Reserve `0` to pause email dispatch.
     */
    maxEmailsPerMinute: z.number().int().nonnegative().default(60),
    /**
     * Default cap on autopilot replies per collection attempt (per gestión) when an EMAIL
     * agent does not set its own `maxReplies`. Bounds the back-and-forth so a debtor can't
     * keep the AI talking indefinitely.
     */
    maxRepliesDefault: z.number().int().nonnegative().default(3)
  })
  .optional();

export type ResendConfig = z.infer<typeof resendConfigSchema>;

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
    // apiKey is optional here: it may be omitted and supplied via an environment
    // variable instead (the adapter resolves it and errors clearly if none is found
    // at call time).
  })
  .optional();

export type AiConfig = z.infer<typeof aiConfigSchema>;

/**
 * Text-to-speech for previewing pre-recorded agent scripts in the console (the
 * Pre-grabada gestión detail plays the script as audio). Optional — when absent, the
 * apiKey falls back to `ELEVENLABS_API_KEY`, and if no key resolves the player is simply
 * unavailable. Voices come from `fonoster.voices`.
 */
const ttsConfigObjectSchema = z.object({
  provider: z.literal("elevenlabs").default("elevenlabs"),
  apiKey: z.string().optional(),
  model: z.string().default("eleven_multilingual_v2"),
  /**
   * Maximum accepted length (characters) for the `text` query parameter on
   * `/api/voice/tts`; over-long requests are rejected with 400 before any provider call.
   * This bounds the cost and cached size of any ONE synthesis, not how many can be
   * requested — the endpoint is unauthenticated and does not dedupe in flight, so a
   * caller sending distinct strings can still drive an unbounded number of billed calls.
   * Auth or rate limiting on the route is the control for that; this is not it.
   *
   * Kept equal to `PRERECORDED_SCRIPT_MAX_LENGTH` so a script the console accepts is
   * always one the player can speak.
   */
  maxTextLength: z.number().int().positive().default(PRERECORDED_SCRIPT_MAX_LENGTH),
  /**
   * Bounds for the in-memory cache of synthesized audio (keyed by `voiceId:text`).
   * Both limits are enforced together as an LRU: entry count alone isn't enough
   * because a synthesized MP3 can run from tens of KB to a few MB depending on
   * script length, so a handful of long scripts could exhaust memory well under any
   * reasonable entry cap.
   */
  cache: z
    .object({
      /**
       * Max distinct `voiceId:text` entries retained at once. Sized for a working
       * set of concurrently-referenced per-account scripts, not the full account
       * base — least-recently-used entries are evicted first.
       */
      maxEntries: z.number().int().positive().default(100),
      /**
       * Max total bytes of cached audio. This runs alongside Postgres on a 2 vCPU /
       * 2 GB VM with no container memory limit, so the cache needs a hard ceiling
       * rather than growing with account count; 25 MiB keeps resident TTS audio to a
       * small, fixed slice of that budget while still holding a realistic working
       * set of scripts.
       */
      maxBytes: z
        .number()
        .int()
        .positive()
        .default(25 * 1024 * 1024)
    })
    // `prefault` runs the value through this schema, so the field defaults above stay the
    // single source of truth — restating them here would drift the moment one changed.
    .prefault({})
});

export const ttsConfigSchema = ttsConfigObjectSchema.optional();

/**
 * The TTS settings a deployment gets when `qcobro.json` has no `tts` section at all — which
 * is a real configuration, since the ElevenLabs key can also arrive via `ELEVENLABS_API_KEY`.
 * Callers MUST use this rather than restating the numbers, or those deployments would silently
 * keep the old bounds whenever a default here changes.
 */
export const ttsDefaults = ttsConfigObjectSchema.parse({});

export type TtsConfig = z.infer<typeof ttsConfigSchema>;

/**
 * A piece of user-facing copy that may be localized. Either a single string
 * (same text for every language) or a map of language code → string
 * (e.g. `{ "en": "Early access", "es": "Acceso temprano" }`). The console
 * resolves it against the active UI language, falling back to any available value.
 */
export const localizedStringSchema = z.union([
  z.string().min(1),
  z.record(z.string(), z.string().min(1))
]);
export type LocalizedString = z.infer<typeof localizedStringSchema>;

/**
 * A deployment-wide announcement rendered as a dismissible banner across the
 * console (and the workspace picker). Optional — when absent, no banner shows.
 *
 * `variant` selects the color scheme and `icon` the leading glyph, so a
 * deployment can style it as a neutral announcement, an amber alert, etc.
 * `title` and `message` are localizable (see {@link localizedStringSchema}).
 */
export const announcementConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    /** Color scheme: `announcement` (blue), `alert` (amber), `success` (green), `danger` (red). */
    variant: z.enum(["announcement", "alert", "success", "danger"]).default("announcement"),
    /** Leading icon from a curated set. */
    icon: z
      .enum(["megaphone", "info", "alert-triangle", "sparkles", "rocket", "bell"])
      .default("megaphone"),
    /** Whether the user can dismiss the banner. */
    dismissible: z.boolean().default(true),
    title: localizedStringSchema.optional(),
    message: localizedStringSchema
  })
  .optional();

export type AnnouncementConfig = z.infer<typeof announcementConfigSchema>;

/**
 * One sellable plan. Plans are quoted in the deployment's billing currency;
 * `monthlyPrice` (what the card is charged) and `monthlyAllowance` (the usage
 * credit granted each cycle) are separate on purpose — "pay 29, get 35" is a
 * config edit, not a schema change. `stripePriceId` joins the catalog to the
 * Stripe price backing the subscription item.
 */
export const billingPlanSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/, "plan key must be kebab-case (e.g. 'starter')"),
  name: localizedStringSchema,
  monthlyPrice: z.number().nonnegative(),
  monthlyAllowance: z.number().nonnegative(),
  stripePriceId: z.string().min(1),
  rates: ratesSchema
});
export type BillingPlan = z.infer<typeof billingPlanSchema>;

/**
 * Usage-based billing. The plan catalog is deployment config (this section);
 * all billing STATE — workspace→plan assignment, balances, ledger, Stripe ids,
 * enterprise rate overrides — lives in the database. `plans` is ORDERED: array
 * index defines the upgrade path shown in the console. When `enabled` is false,
 * dispatch paths neither meter usage nor enforce credit gates (pre-billing
 * behavior, and the rollback switch). Stripe credentials are optional so
 * metering-only and self-hosted deployments can run without payment; checkout
 * and webhook surfaces error clearly when they're absent.
 */
export const billingConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Billing currency (ISO 4217) — distinct from WorkspaceSettings.currency. */
    currency: z.string().length(3).default("USD"),
    stripe: z
      .object({
        secretKey: z.string().min(1),
        webhookSigningSecret: z.string().min(1)
      })
      .optional(),
    /**
     * Seconds of answered time the engine's credit bucket debits per voice
     * dispatch before the call settles to its actual duration (never less than
     * the meter's initial increment).
     */
    voiceDebitEstimateSeconds: z.number().int().positive().default(60),
    plans: z
      .array(billingPlanSchema)
      .min(1)
      .superRefine((plans, ctx) => {
        const seen = new Set<string>();
        for (const [index, plan] of plans.entries()) {
          if (seen.has(plan.key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "key"],
              message: `Duplicate plan key "${plan.key}" — plan keys must be unique`
            });
          }
          seen.add(plan.key);
        }
      })
  })
  .optional();
export type BillingConfig = z.infer<typeof billingConfigSchema>;

export const qcobroConfigSchema = z.object({
  /** Application (apiserver) database. */
  database: z.object({
    url: z.string().min(1),
    /**
     * Server-side `statement_timeout` (ms) applied to the apiserver's connections. Bounds how
     * long Postgres will let a single statement run before cancelling it.
     *
     * This is not a nicety: without it, a stalled query blocks its connection indefinitely
     * and holds up whatever work was waiting on it — a stalled query inside a tick stalls
     * that tick, and the engine's single-flight guard then skips every scheduled tick behind
     * it until the stall clears on its own. A client-side timeout does not solve this — it
     * stops the client waiting, but the server keeps executing and the connection stays busy.
     * Only a server-side cancellation actually frees it.
     *
     * Applies per statement, not per transaction, so a long import made of many fast
     * statements is unaffected. `0` disables it (Postgres semantics) and restores the old
     * unbounded behavior.
     */
    statementTimeoutMs: z.number().int().nonnegative().default(30_000)
  }),
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
  resend: resendConfigSchema,
  ai: aiConfigSchema,
  tts: ttsConfigSchema,
  announcement: announcementConfigSchema,
  billing: billingConfigSchema,
  /**
   * Secret-at-rest. `cloakEncryptionKey` is a versioned AES-GCM-256 key
   * (`k1.aesgcm256.<base64-32-byte>`) used by `prisma-field-encryption` (the Fonoster/Routr
   * "cloak" pattern) to encrypt tenant-provided secrets — today the WhatsApp WABA access
   * token. Optional: when absent, features that store tenant secrets (the Workspace
   * Integrations area) are disabled rather than crashing boot. Only the *key* is global; the
   * *secret* is per-workspace in the DB.
   */
  security: z.object({ cloakEncryptionKey: z.string().min(1).optional() }).optional(),
  /**
   * WhatsApp (Meta Cloud API) connection defaults. Per-workspace credentials (WABA id +
   * access token) live in the DB, not here — only the shared Graph API base/version are
   * deployment config.
   */
  whatsapp: z
    .object({
      apiBaseUrl: z.string().url().default("https://graph.facebook.com"),
      apiVersion: z.string().default("v18.0"),
      /** Engine pacing: max template messages the engine may dispatch per minute. */
      maxMessagesPerMinute: z.number().int().positive().default(60),
      /**
       * Meta App Secret — used to verify the `X-Hub-Signature-256` on inbound webhook
       * events. Optional: when absent, signature verification is skipped (not recommended
       * in production).
       */
      appSecret: z.string().min(1).optional(),
      /**
       * Default cap on autopilot replies per collection attempt (per gestión) when a
       * WHATSAPP agent does not set its own `maxReplies`. Mirrors `resend.maxRepliesDefault`.
       */
      maxRepliesDefault: z.number().int().nonnegative().default(3)
    })
    .default({
      apiBaseUrl: "https://graph.facebook.com",
      apiVersion: "v18.0",
      maxMessagesPerMinute: 60,
      maxRepliesDefault: 3
    }),
  /**
   * Campaigns engine. The autonomous in-process loop that originates campaign
   * outreach. Disabled by default so it never auto-dials in local development;
   * enable it in production. Per-channel pacing lives in the `fonoster`/`twilio`
   * blocks (the provider pools they configure are deployment-wide).
   */
  engine: z
    .object({
      enabled: z.boolean().default(false),
      /** Seconds between engine ticks. */
      tickSeconds: z.number().int().positive().default(60),
      /**
       * Seconds an engine lease claim stays valid without renewal. The lease is what makes
       * exactly one instance tick; its holder renews it on a heartbeat, so this bounds how
       * long an ungracefully-killed instance blocks its peers — not how long a tick may run.
       * A graceful shutdown releases the lease immediately, so redeploys don't wait on it.
       * Defaults to two tick intervals (minimum 120s).
       *
       * Floored at 10s: below roughly that, the renewal interval (a third of the TTL) leaves
       * so little slack that ordinary scheduling jitter or a slow round-trip lets a peer
       * claim the lease from a perfectly healthy holder.
       */
      leaseTtlSeconds: z.number().int().min(10).optional(),
      /**
       * Days the flight-recorder event stream (`engine_events`) is kept before the
       * runner prunes it. `0` disables pruning. Telemetry only — gestiones are the
       * record of contact attempts and are never pruned.
       */
      eventsRetentionDays: z.number().int().nonnegative().default(30),
      /**
       * Consecutive `SYSTEM_ERROR` dispatch failures (per campaign) before the engine
       * auto-pauses that campaign (`Campaign.pauseReason: AUTO_ERROR_THRESHOLD`). Resets on
       * any success or `DELIVERY_REJECTED` failure. Sized to ride out a short blip without
       * silently burning through every account's attempt cap during a real outage.
       */
      consecutiveSystemErrorPauseThreshold: z.number().int().positive().default(10),
      /**
       * Minutes a VOICE_AI/VOICE_PRERECORDED gestión may sit at entrega=DISPATCHED with no
       * completion signal (autopilot conversation.ended webhook / pre-recorded VoiceServer
       * onCompleted) before the timeout sweep finalizes it FAILED (deliveryReason:
       * PROVIDER_ERROR) — the replacement for the old Fonoster-CDR polling recovery path.
       * A single shared value across both channels, not per-channel, to keep this simple.
       */
      voiceCompletionTimeoutMinutes: z.number().int().positive().default(10),
      /** How often the timeout sweep itself runs, piggybacked on the engine tick loop. */
      voiceCompletionSweepIntervalSeconds: z.number().int().positive().default(120)
    })
    .prefault({})
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type QCobroConfig = z.infer<typeof qcobroConfigSchema>;
