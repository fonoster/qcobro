import * as SDK from "@fonoster/sdk";
import {
  ttsProductRefForVoice,
  type FonosterConfig,
  type VoiceApplicationClient,
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
 * key/secret login. The login promise is memoized so it happens once per process.
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
      })();
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
        productRef: ttsProductRefForVoice(input.voice, this.settings.voices),
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
}
