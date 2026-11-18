import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionAgentSchema } from "@fonoster/common";
import { DEFAULT_VOICE_IDLE_OPTIONS } from "@qcobro/common";
import { FonosterVoiceApplicationClient, type AppsApi } from "./fonosterVoiceApplicationClient.js";

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
    llmProvider: "google",
    llmModel: "gemini-2.5-flash",
    maxTokens: 300,
    temperature: 0.3,
    evalsModel: "gpt-4o-mini"
  },
  voices: [
    {
      id: "86V9x9hrQds83qf7zaGn",
      name: "Sofía",
      language: "es",
      gender: "female",
      provider: "elevenlabs"
    }
  ]
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

const bargeInOf = (req: any) => req.intelligence.config.conversationSettings.allowUserBargeIn;
/* eslint-enable @typescript-eslint/no-explicit-any */

const BASE_INPUT = {
  name: "Cobrador",
  voice: "86V9x9hrQds83qf7zaGn",
  systemPrompt: "Be polite",
  firstMessage: "Hola",
  language: "es",
  allowUserBargeIn: false
};

const IDLE = { idleMessage: "¿Sigue ahí?", idleTimeout: 5000, idleMaxTimeoutCount: 2 };

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

  it("asks Fonoster to filter the caller's audio, on create and on update", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);
    const input = {
      ...BASE_INPUT,
      idleMessage: "¿Sigue ahí?",
      idleTimeout: 5000,
      idleMaxTimeoutCount: 2
    };

    await client.createApplication(input);
    await client.updateApplication("app-xyz", input);

    const expected = [{ name: "aiCoustics", options: { enhancementLevel: 0.8 } }];
    assert.deepEqual(captured.create?.filters, expected);
    assert.deepEqual(captured.update?.filters, expected);
  });
});

describe("FonosterVoiceApplicationClient session app shape", () => {
  const input = {
    ...BASE_INPUT,
    ...IDLE,
    name: "qcobro-voz-ia-mora-8-30",
    firstMessage: "Hola, le habla Clara de Credifácil.",
    language: "es-419"
  };

  for (const op of ["create", "update"] as const) {
    it(`sends a Fonoster 0.63 session app on ${op}`, async () => {
      const client = new FonosterVoiceApplicationClient(SETTINGS);
      const captured = seedFakeApps(client);

      if (op === "create") await client.createApplication(input);
      else await client.updateApplication("app-xyz", input);

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const req = captured[op] as any;
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const config = req.intelligence.config;
      assert.doesNotThrow(() => sessionAgentSchema.parse(config));
      assert.equal(config.languageModel.model, "google/gemini-2.5-flash");
      assert.equal("provider" in config.languageModel, false);
      assert.equal("eventsHook" in config, false);
      assert.equal("audioFilters" in config, false);
      assert.deepEqual(req.speech, {
        voice: "elevenlabs/86V9x9hrQds83qf7zaGn",
        ttsModel: "elevenlabs/eleven_flash_v2_5",
        language: "es-419",
        sttModel: "deepgram/nova-3"
      });
      assert.equal(req.recording, "on");
      assert.equal(req.type, "AUTOPILOT");
      assert.equal(req.name, "qcobro-voz-ia-mora-8-30");
      assert.equal("speechToText" in req, false);
      assert.equal("textToSpeech" in req, false);
      assert.equal(config.conversationSettings.firstMessage, "Hola, le habla Clara de Credifácil.");
      assert.equal(config.conversationSettings.goodbyeMessage, "Que tenga buen día.");
      if (op === "update") assert.equal(req.ref, "app-xyz");
    });
  }
});

describe("FonosterVoiceApplicationClient speech options", () => {
  it("sends the template language as speech.language, with no barge-in by default", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    await client.createApplication({ ...BASE_INPUT, ...IDLE, language: "es-419" });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    assert.equal((captured.create as any).speech.language, "es-419");
    /* eslint-enable @typescript-eslint/no-explicit-any */
    assert.equal(bargeInOf(captured.create), false);
  });

  it("sends language multi with deepgram/nova-3 for a multilingual template", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    await client.updateApplication("app-xyz", { ...BASE_INPUT, ...IDLE, language: "multi" });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const speech = (captured.update as any).speech;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    assert.equal(speech.language, "multi");
    assert.equal(speech.sttModel, "deepgram/nova-3");
  });

  it("passes allowUserBargeIn through on create and update", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);
    const input = { ...BASE_INPUT, ...IDLE, allowUserBargeIn: true };

    await client.createApplication(input);
    await client.updateApplication("app-xyz", input);

    assert.equal(bargeInOf(captured.create), true);
    assert.equal(bargeInOf(captured.update), true);
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
    assert.equal(bargeInOf(captured.evaluate), false);
  });

  it("sends a session agent that passes sessionAgentSchema, graded by OpenAI", async () => {
    const client = new FonosterVoiceApplicationClient(SETTINGS);
    const captured = seedFakeApps(client);

    const stream = client.evaluate({
      systemPrompt: "Be polite",
      firstMessage: "Hola",
      language: "es",
      scenarios: [
        {
          ref: "s1",
          account: {},
          turns: [{ input: "Hola", expected: { text: { type: "SIMILAR", response: "Hola" } } }]
        }
      ]
    });
    for await (const _ of stream) void _;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const config = (captured.evaluate as any).intelligence.config;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    assert.doesNotThrow(() => sessionAgentSchema.parse(config));
    assert.equal(config.languageModel.model, "google/gemini-2.5-flash");
    assert.equal(config.testCases.evalsLanguageModel.provider, "openai");
  });
});

/**
 * End-to-end through the public `deleteApplication` surface, with a fake `AppsApi` injected
 * via the constructor's `createAppsApi` seam — mirrors `FonosterOutboundCallClient`'s own
 * coverage for the identical bug shape: a memoized login that has already succeeded is never
 * re-checked on its own, so only a call made through it can discover the underlying token has
 * gone bad, and only a compare-and-swap on invalidation keeps a stale failure from discarding
 * a fresh login a concurrent call already completed.
 */
describe("FonosterVoiceApplicationClient — auth-failure recovery", () => {
  const authError = { code: 16, message: "Invalid or expired token" };

  function deferredRejection<T>(): { promise: Promise<T>; reject: (err: unknown) => void } {
    let reject!: (err: unknown) => void;
    const promise = new Promise<T>((_, rej) => {
      reject = rej;
    });
    return { promise, reject };
  }

  function fakeAppsApi(deleteApplication: AppsApi["deleteApplication"]): AppsApi {
    return {
      createApplication: async () => {
        throw new Error("not exercised in this test");
      },
      updateApplication: async () => {
        throw new Error("not exercised in this test");
      },
      evaluateIntelligence: () => {
        throw new Error("not exercised in this test");
      },
      deleteApplication
    } as unknown as AppsApi;
  }

  it("re-logs in on the next call after a token-refresh failure", async () => {
    let loginCount = 0;
    const client = new FonosterVoiceApplicationClient(SETTINGS, async () => {
      loginCount++;
      const instanceNumber = loginCount;
      return fakeAppsApi(async () =>
        instanceNumber === 1 ? Promise.reject(authError) : { ref: "app-xyz" }
      );
    });

    await assert.rejects(client.deleteApplication("app-1"), (err) => err === authError);
    assert.equal(loginCount, 1, "the first call logs in once");

    await client.deleteApplication("app-2");
    assert.equal(loginCount, 2, "the failed call forced a fresh login for the next call");
  });

  it("does not discard a fresh re-login a concurrent call already completed", async () => {
    let loginCount = 0;
    const straggler = deferredRejection<{ ref: string }>();

    const client = new FonosterVoiceApplicationClient(SETTINGS, async () => {
      loginCount++;
      const instanceNumber = loginCount;
      return fakeAppsApi(async (ref: string) => {
        if (instanceNumber !== 1) return { ref }; // instance 2: the fresh relogin
        if (ref === "app-A") return straggler.promise; // the slow, stale straggler
        return Promise.reject(authError); // app-B — a concurrent failure on the same client
      });
    });

    // opA reads the current (soon-to-be-stale) client and stalls mid-call.
    const opA = client.deleteApplication("app-A");
    // opB reuses that same cached client (opA hasn't failed yet) and fails first,
    // invalidating it.
    await assert.rejects(client.deleteApplication("app-B"), (err) => err === authError);
    assert.equal(loginCount, 1);

    // opC re-logs in fresh and succeeds — the "a concurrent call already recovered" state.
    await client.deleteApplication("app-C");
    assert.equal(loginCount, 2);

    // The straggler from the OLD client finally fails. It must not discard the fresh login.
    straggler.reject(authError);
    await assert.rejects(opA, (err) => err === authError);

    // Proven by: the next call reuses the healthy client instead of logging in a third time.
    await client.deleteApplication("app-D");
    assert.equal(loginCount, 2, "the stale opA failure must not force an unnecessary third login");
  });
});
