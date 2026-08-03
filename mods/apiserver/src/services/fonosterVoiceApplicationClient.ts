import * as SDK from "@fonoster/sdk";
import {
  ttsProductRefForVoice,
  type FonosterConfig,
  type VoiceApplicationClient,
  type VoiceApplicationEvalInput,
  type VoiceApplicationEvalEvent,
  type VoiceApplicationEvalScenario,
  type VoiceApplicationInput
} from "@qcobro/common";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const autopilotTemplate =
  require("./autopilotTemplate.json") as typeof import("./autopilotTemplate.json");

type FonosterSettings = NonNullable<FonosterConfig>;

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

/**
 * Fonoster-backed {@link VoiceApplicationClient}. Syncs VOICE_AI agent templates
 * to Fonoster as AUTOPILOT applications: TTS voice, STT language, and the LLM
 * conversation settings (system prompt + first message) are assembled from the
 * template plus the deployment's Autopilot defaults (`qcobro.json`).
 *
 * Auth mirrors the Fonoster SDK demo: a workspace access key, then an API
 * key/secret login. The login promise is memoized once it succeeds, so login only
 * happens once per process; a failed login is not memoized and is retried on the
 * next call.
 */
export class FonosterVoiceApplicationClient implements VoiceApplicationClient {
  private readonly settings: FonosterSettings;
  private appsPromise: Promise<SDK.Applications> | null = null;

  constructor(settings: FonosterSettings) {
    this.settings = settings;
  }

  private apps(): Promise<SDK.Applications> {
    if (!this.appsPromise) {
      this.appsPromise = (async () => {
        const client = new SDK.Client({
          accessKeyId: this.settings.accessKeyId,
          ...(this.settings.endpoint ? { endpoint: this.settings.endpoint } : {})
        } as ConstructorParameters<typeof SDK.Client>[0]);
        await client.loginWithApiKey(this.settings.apiKey, this.settings.apiSecret);
        return new SDK.Applications(client);
      })().catch((err) => {
        // A failed login must not be memoized — otherwise one transient auth error
        // permanently breaks every future call for the life of this process, since
        // appsPromise would stay set to a rejection.
        this.appsPromise = null;
        throw err;
      });
    }
    return this.appsPromise;
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
        config: { model: autopilot.sttModel, languageCode: input.language }
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
            // Static conversation defaults (goodbyeMessage, systemErrorMessage,
            // idleOptions, allowUserBargeIn) come from the autopilot template
            // (derived from autopilot.yaml; required by Fonoster). Per-agent
            // firstMessage + systemPrompt override on top.
            ...autopilotTemplate.conversationSettings,
            // Only override the template's default greeting when the agent has a
            // scripted first message; otherwise the autopilot default stands.
            ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
            systemPrompt: input.systemPrompt
          },
          languageModel: {
            provider: autopilot.llmProvider,
            model: autopilot.llmModel,
            maxTokens: autopilot.maxTokens,
            temperature: autopilot.temperature
          },
          ...(eventsHook ? { eventsHook } : {})
        }
      }
    };
  }

  async createApplication(input: VoiceApplicationInput): Promise<{ ref: string }> {
    const apps = await withTimeout(this.apps(), "login");
    const request = this.buildRequest(input);
    const { ref } = await withTimeout(
      apps.createApplication(request as Parameters<SDK.Applications["createApplication"]>[0]),
      "createApplication"
    );
    return { ref };
  }

  async updateApplication(ref: string, input: VoiceApplicationInput): Promise<{ ref: string }> {
    const apps = await withTimeout(this.apps(), "login");
    const request = { ref, ...this.buildRequest(input) };
    const result = await withTimeout(
      apps.updateApplication(request as Parameters<SDK.Applications["updateApplication"]>[0]),
      "updateApplication"
    );
    return { ref: result.ref };
  }

  async deleteApplication(ref: string): Promise<void> {
    const apps = await withTimeout(this.apps(), "login");
    await withTimeout(apps.deleteApplication(ref), "deleteApplication");
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
        metadata: Object.fromEntries(
          Object.entries(scenario.account).map(([key, value]) => [key, String(value)])
        )
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
    const apps = await withTimeout(this.apps(), "login");
    const request = {
      intelligence: {
        productRef: autopilot.llmProductRef,
        config: {
          conversationSettings: {
            ...autopilotTemplate.conversationSettings,
            ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
            systemPrompt: input.systemPrompt
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
    const stream = apps.evaluateIntelligence(
      request as Parameters<SDK.Applications["evaluateIntelligence"]>[0]
    );
    for await (const event of stream) {
      yield event as VoiceApplicationEvalEvent;
    }
  }
}
