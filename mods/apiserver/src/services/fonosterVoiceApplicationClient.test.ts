import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_VOICE_IDLE_OPTIONS } from "@qcobro/common";
import { FonosterVoiceApplicationClient } from "./fonosterVoiceApplicationClient.js";

/**
 * These exercise the request shape `FonosterVoiceApplicationClient` sends to Fonoster,
 * with the SDK login short-circuited: the private `appsPromise` is pre-seeded with a fake
 * `Applications` that records the request instead of making a network call.
 */

const SETTINGS = {
  accessKeyId: "ak",
  apiKey: "key",
  apiSecret: "secret",
  autopilot: {
    sttProductRef: "stt.deepgram",
    sttModel: "nova-3",
    llmProductRef: "llm.google",
    llmProvider: "google",
    llmModel: "gemini-2.0-flash",
    maxTokens: 300,
    temperature: 0,
    evalsModel: "gpt-4o-mini"
  },
  voices: []
} as unknown as ConstructorParameters<typeof FonosterVoiceApplicationClient>[0];

interface Captured {
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  evaluate?: Record<string, unknown>;
}

function seedFakeApps(client: FonosterVoiceApplicationClient): Captured {
  const captured: Captured = {};
  const fakeApps = {
    createApplication: async (req: Record<string, unknown>) => {
      captured.create = req;
      return { ref: "app-xyz" };
    },
    updateApplication: async (req: Record<string, unknown>) => {
      captured.update = req;
      return { ref: (req.ref as string) ?? "app-xyz" };
    },
    evaluateIntelligence: (req: Record<string, unknown>) => {
      captured.evaluate = req;
      return (async function* () {
        yield { type: "evalError", message: "stub-complete" };
      })();
    }
  };
  (client as unknown as { appsPromise: Promise<unknown> }).appsPromise = Promise.resolve(fakeApps);
  return captured;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const idleOf = (req: any) => req.intelligence.config.conversationSettings.idleOptions;
/* eslint-enable @typescript-eslint/no-explicit-any */

const BASE_INPUT = {
  name: "Cobrador",
  voice: "voice-x",
  systemPrompt: "Be polite",
  firstMessage: "Hola",
  language: "es"
};

describe("FonosterVoiceApplicationClient.buildRequest (via createApplication)", () => {
  it("builds conversationSettings.idleOptions from the input's idle fields", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    await client.createApplication({
      ...BASE_INPUT,
      idleMessage: "¿Sigue ahí?",
      idleTimeout: 5000,
      idleMaxTimeoutCount: 2
    });

    assert.deepEqual(idleOf(captured.create), {
      message: "¿Sigue ahí?",
      timeout: 5000,
      maxTimeoutCount: 2
    });
  });

  it("carries the input idle fields through updateApplication too", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    await client.updateApplication("app-xyz", {
      ...BASE_INPUT,
      idleMessage: "¿Me escucha?",
      idleTimeout: 9000,
      idleMaxTimeoutCount: 4
    });

    assert.deepEqual(idleOf(captured.update), {
      message: "¿Me escucha?",
      timeout: 9000,
      maxTimeoutCount: 4
    });
  });
});

describe("FonosterVoiceApplicationClient.evaluate", () => {
  it("builds idleOptions from DEFAULT_VOICE_IDLE_OPTIONS (no template row)", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    const stream = client.evaluate({
      systemPrompt: "Be polite",
      language: "es",
      scenarios: [
        {
          ref: "s1",
          account: {},
          turns: [
            {
              input: "Hola",
              expected: { text: { type: "SIMILAR", response: "Hola" } }
            }
          ]
        }
      ]
    });
    for await (const _ of stream) void _;

    assert.deepEqual(idleOf(captured.evaluate), {
      message: DEFAULT_VOICE_IDLE_OPTIONS.message,
      timeout: DEFAULT_VOICE_IDLE_OPTIONS.timeout,
      maxTimeoutCount: DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount
    });
  });
});
