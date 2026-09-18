import { getLogger } from "@fonoster/logger";
import * as SDK from "@fonoster/sdk";
import {
  DEFAULT_VOICE_IDLE_OPTIONS,
  MULTILINGUAL_LANGUAGE,
  toCallMetadata,
  ttsProductRefForVoice,
  type FonosterConfig,
  type VoiceApplicationClient,
  type VoiceApplicationEvalInput,
  type VoiceApplicationEvalEvent,
  type VoiceApplicationEvalScenario,
  type VoiceApplicationInput
} from "@qcobro/common";
import { createRequire } from "node:module";
import { isAuthTokenFailure } from "./fonosterAuthErrors.js";
const require = createRequire(import.meta.url);

const autopilotTemplate =
  require("./autopilotTemplate.json") as typeof import("./autopilotTemplate.json");

const logger = getLogger({
  service: "fonoster-voice-application-client",
  filePath: import.meta.url
});

type FonosterSettings = NonNullable<FonosterConfig>;

/** Deepgram models that accept `multi` (fonoster/fonoster#910); the phonecall and
 * conversationalai variants are English-only and Fonoster rejects them with `multi`. */
const MULTILINGUAL_STT_MODELS = ["nova-3", "nova-2"];

/** Speech-to-text config for one agent: the template's language as-is. A multilingual
 * (`multi`) agent keeps the deployment model if it can do `multi`, and otherwise falls back
 * to `nova-3` so the sync isn't rejected. */
export function buildSpeechToTextConfig(
  sttModel: string,
  language: string
): { model: string; languageCode: string } {
  const model =
    language === MULTILINGUAL_LANGUAGE && !MULTILINGUAL_STT_MODELS.includes(sttModel)
      ? "nova-3"
      : sttModel;
  return { model, languageCode: language };
}

/** Cap provider calls so an unreachable Fonoster can't hang the request path. */
const CALL_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Fonoster ${label} timed out`)), CALL_TIMEOUT_MS)
    )
  ]);
}

/** The subset of `SDK.Applications` this client actually drives — the seam tests inject a fake through. */
export type AppsApi = Pick<
  SDK.Applications,
  "createApplication" | "updateApplication" | "deleteApplication" | "evaluateIntelligence"
>;

/** Logs in and hands back a ready `Applications` client. The production {@link CreateAppsApi}. */
async function loginAndCreateAppsApi(settings: FonosterSettings): Promise<AppsApi> {
  const client = new SDK.Client({
    accessKeyId: settings.accessKeyId,
    ...(settings.endpoint ? { endpoint: settings.endpoint } : {})
  } as ConstructorParameters<typeof SDK.Client>[0]);
  await client.loginWithApiKey(settings.apiKey, settings.apiSecret);
  return new SDK.Applications(client);
}

export type CreateAppsApi = (settings: FonosterSettings) => Promise<AppsApi>;

/**
 * Fonoster-backed {@link VoiceApplicationClient}. Syncs VOICE_AI agent templates
 * to Fonoster as AUTOPILOT applications: TTS voice, STT language, and the LLM
 * conversation settings (system prompt + first message) are assembled from the
 * template plus the deployment's Autopilot defaults (`qcobro.json`).
 *
 * Auth mirrors {@link FonosterOutboundCallClient}: a workspace access key, then an API
 * key/secret login. The login promise is memoized once it succeeds, so login only happens
 * once per process; a failed login is not memoized and is retried on the next call. A
 * *successful* login can still go bad later (the session's token stops refreshing
 * server-side) — {@link invalidateOnAuthFailure} watches for that on every call and drops
 * the memoized client so the next one re-logs in, rather than reusing the same wedged
 * session for the life of the process.
 *
 * `createAppsApi` defaults to the real Fonoster login (`loginAndCreateAppsApi`) and only
 * exists as a constructor parameter so tests can substitute a fake `AppsApi`.
 */
export class FonosterVoiceApplicationClient implements VoiceApplicationClient {
  private readonly settings: FonosterSettings;
  private readonly createAppsApi: CreateAppsApi;
  private appsPromise: Promise<AppsApi> | null = null;

  constructor(settings: FonosterSettings, createAppsApi: CreateAppsApi = loginAndCreateAppsApi) {
    this.settings = settings;
    this.createAppsApi = createAppsApi;
  }

  private apps(): Promise<AppsApi> {
    if (!this.appsPromise) {
      this.appsPromise = this.createAppsApi(this.settings).catch((err) => {
        // A failed login must not be memoized — otherwise one transient auth error
        // permanently breaks every future call for the life of this process, since
        // appsPromise would stay set to a rejection.
        this.appsPromise = null;
        throw err;
      });
    }
    return this.appsPromise;
  }

  /**
   * Drops the memoized client the moment a call reports its token is no longer good, so the
   * *next* call re-runs the login instead of retrying forever against the same wedged
   * session — see {@link isAuthTokenFailure}. Never awaited or retried itself: this call's
   * own error still propagates unchanged, this only clears the way for the one after it to
   * recover.
   *
   * `usedAppsPromise` must be the exact promise this failing call read from `this.apps()`,
   * compared by reference before clearing — see `FonosterOutboundCallClient` for why a
   * shared, module-level singleton needs that compare-and-swap rather than an unconditional
   * reset.
   */
  private invalidateOnAuthFailure(err: unknown, usedAppsPromise: Promise<AppsApi>): void {
    if (!isAuthTokenFailure(err)) return;
    if (this.appsPromise !== usedAppsPromise) return; // already replaced by another call
    logger.warn(
      `Fonoster client session invalid — forcing re-login on next call: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    this.appsPromise = null;
  }

  /** Build the AUTOPILOT application request from the template + Autopilot defaults. */
  private buildRequest(input: VoiceApplicationInput) {
    const { autopilot, webhookBaseUrl } = this.settings;
    // When a public base URL is configured, register the events-hook so the autopilot
    // posts conversation events back to QCobro (correlated into the gestión). Subscribe
    // to "all" so both conversation.started (partial capture) and conversation.ended
    // (transcript + recording) arrive.
    const eventsHook = webhookBaseUrl
      ? {
          url: `${webhookBaseUrl.replace(/\/+$/, "")}/api/voice/events`,
          events: ["all"]
        }
      : undefined;
    return {
      name: input.name,
      type: "AUTOPILOT",
      speechToText: {
        productRef: autopilot.sttProductRef,
        config: buildSpeechToTextConfig(autopilot.sttModel, input.language)
      },
      textToSpeech: {
        productRef: ttsProductRefForVoice(input.voice, this.settings.voices ?? []),
        config: { voice: input.voice }
      },
      intelligence: {
        productRef: autopilot.llmProductRef,
        credentials: {},
        config: {
          conversationSettings: {
            // Static conversation defaults (goodbyeMessage, systemErrorMessage) come
            // from the autopilot template (derived from autopilot.yaml; required by
            // Fonoster). Per-agent firstMessage + systemPrompt + idleOptions +
            // allowUserBargeIn override on top.
            ...autopilotTemplate.conversationSettings,
            allowUserBargeIn: input.allowUserBargeIn,
            // Only override the template's default greeting when the agent has a
            // scripted first message; otherwise the autopilot default stands.
            ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
            systemPrompt: input.systemPrompt,
            // Per-template idle options (the shared block was removed from the
            // autopilot template — both call paths now set this explicitly).
            idleOptions: {
              message: input.idleMessage,
              timeout: input.idleTimeout,
              maxTimeoutCount: input.idleMaxTimeoutCount
            }
          },
          languageModel: {
            provider: autopilot.llmProvider,
            model: autopilot.llmModel,
            maxTokens: autopilot.maxTokens,
            temperature: autopilot.temperature
          },
          // Audio filters run in Fonoster's media server, on the caller's audio,
          // before speech recognition and voice activity detection — that is what
          // keeps a television or a second person in the room out of the
          // transcript. Comes from the template so every synced agent gets it.
          ...(autopilotTemplate.audioFilters?.length
            ? { audioFilters: autopilotTemplate.audioFilters }
            : {}),
          ...(eventsHook ? { eventsHook } : {})
        }
      }
    };
  }

  async createApplication(input: VoiceApplicationInput): Promise<{ ref: string }> {
    const appsPromise = this.apps();
    try {
      const apps = await withTimeout(appsPromise, "login");
      const request = this.buildRequest(input);
      const { ref } = await withTimeout(
        apps.createApplication(request as Parameters<SDK.Applications["createApplication"]>[0]),
        "createApplication"
      );
      return { ref };
    } catch (err) {
      this.invalidateOnAuthFailure(err, appsPromise);
      throw err;
    }
  }

  async updateApplication(ref: string, input: VoiceApplicationInput): Promise<{ ref: string }> {
    const appsPromise = this.apps();
    try {
      const apps = await withTimeout(appsPromise, "login");
      const request = { ref, ...this.buildRequest(input) };
      const result = await withTimeout(
        apps.updateApplication(request as Parameters<SDK.Applications["updateApplication"]>[0]),
        "updateApplication"
      );
      return { ref: result.ref };
    } catch (err) {
      this.invalidateOnAuthFailure(err, appsPromise);
      throw err;
    }
  }

  async deleteApplication(ref: string): Promise<void> {
    const appsPromise = this.apps();
    try {
      const apps = await withTimeout(appsPromise, "login");
      await withTimeout(apps.deleteApplication(ref), "deleteApplication");
    } catch (err) {
      this.invalidateOnAuthFailure(err, appsPromise);
      throw err;
    }
  }

  /** Translates one eval scenario into Fonoster's `testCases.scenarios[]` shape. The
   * telephony fields are placeholders — `evaluateIntelligence` grades the LLM's text/tool
   * output, not real dialing, so any well-formed numbers satisfy the schema. `description`
   * and every turn's `expected.text` are required by Fonoster's live service (confirmed
   * empirically — not merely typed as required); `resolveEvalTarget` rejects a VOICE_AI
   * scenario missing `expected.text` before this is ever called, so the fallback below is
   * defense-in-depth, not the expected path. */
  private buildEvalScenario(scenario: VoiceApplicationEvalScenario) {
    return {
      ref: scenario.ref,
      description: scenario.description ?? scenario.ref,
      telephonyContext: {
        callDirection: "TO_PSTN",
        ingressNumber: "+10000000000",
        callerNumber: "+10000000000",
        // Same allow-list projection a real Voz IA dispatch uses (`dispatchOutreach`), so
        // an eval sees exactly the account metadata a production call would — no more
        // (`isDue`, `locale`, synthetic ids, timestamps) and no less.
        metadata: toCallMetadata(scenario.account)
      },
      conversation: scenario.turns.map((turn) => {
        if (!turn.expected?.text) {
          throw new Error(
            `VOICE_AI eval turn missing expected.text after resolveEvalTarget validation ` +
              `(scenario "${scenario.ref}")`
          );
        }
        return {
          userInput: turn.input,
          expected: {
            text: turn.expected.text,
            ...(turn.expected.tools
              ? {
                  tools: turn.expected.tools.map((t) => ({
                    tool: t.tool,
                    parameters: t.parameters ?? {}
                  }))
                }
              : {})
          }
        };
      })
    };
  }

  /**
   * Evaluates a `VOICE_AI` agent's conversation logic via Fonoster's
   * `Applications.evaluateIntelligence` — no application ref required, ever: the request
   * is just `{ intelligence: { productRef, config } }`, so an existing or ephemeral
   * YAML-defined agent are evaluated identically (see design.md). Relays Fonoster's
   * stream unchanged; this capability's runner is responsible for aggregating a
   * run-level summary, since Fonoster itself only summarizes per scenario.
   */
  async *evaluate(input: VoiceApplicationEvalInput): AsyncGenerator<VoiceApplicationEvalEvent> {
    const { autopilot } = this.settings;
    const appsPromise = this.apps();
    const apps = await withTimeout(appsPromise, "login");
    const request = {
      intelligence: {
        productRef: autopilot.llmProductRef,
        config: {
          conversationSettings: {
            ...autopilotTemplate.conversationSettings,
            // Barge-in is a live-call behavior evaluateIntelligence never exercises, but
            // Fonoster requires the field; off, like a template that never set it.
            allowUserBargeIn: false,
            ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
            systemPrompt: input.systemPrompt,
            // No template row here (ephemeral eval agent) — use the deployment default.
            // Idle timing is never exercised by evaluateIntelligence, but Fonoster
            // requires a well-formed idleOptions in conversationSettings.
            idleOptions: {
              message: DEFAULT_VOICE_IDLE_OPTIONS.message,
              timeout: DEFAULT_VOICE_IDLE_OPTIONS.timeout,
              maxTimeoutCount: DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount
            }
          },
          languageModel: {
            provider: autopilot.llmProvider,
            model: autopilot.llmModel,
            maxTokens: autopilot.maxTokens,
            temperature: autopilot.temperature
          },
          testCases: {
            evalsLanguageModel: { provider: "openai", model: autopilot.evalsModel },
            scenarios: input.scenarios.map((s) => this.buildEvalScenario(s))
          }
        }
      }
    };
    try {
      const stream = apps.evaluateIntelligence(
        request as Parameters<SDK.Applications["evaluateIntelligence"]>[0]
      );
      for await (const event of stream) {
        yield event as VoiceApplicationEvalEvent;
      }
    } catch (err) {
      this.invalidateOnAuthFailure(err, appsPromise);
      throw err;
    }
  }
}
