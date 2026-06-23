import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSyncAgentTemplate } from "./syncAgentTemplate.js";

function makeClient(opts: { type?: string; existingRef?: string | null } = {}) {
  const type = opts.type ?? "VOICE_AI";
  const updates: Record<string, unknown>[] = [];
  const client = {
    agentTemplate: {
      findFirstOrThrow: async () => ({ id: "tmpl-1", workspaceRef: "ws-1", type }) as never
    },
    voiceAiConfig: {
      findUnique: async () =>
        ({
          templateId: "tmpl-1",
          fonosterAppName: "Cobrador AI",
          fonosterAppRef: opts.existingRef ?? null,
          voice: "voice-x",
          systemPrompt: "Be polite",
          firstMessage: "Hola",
          language: "es"
        }) as never,
      update: async (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return {} as never;
      }
    }
  };
  return { client, updates };
}

function makeVoiceClient(opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      createApplication: async () => {
        calls.push("create");
        if (opts.fail) throw new Error("fonoster down");
        return { ref: "app-1" };
      },
      updateApplication: async () => {
        calls.push("update");
        if (opts.fail) throw new Error("fonoster down");
        return { ref: "app-2" };
      },
      deleteApplication: async () => {}
    }
  };
}

describe("syncAgentTemplate", () => {
  it("creates the Fonoster app on first sync and stores the ref", async () => {
    const { client, updates } = makeClient({ existingRef: null });
    const voice = makeVoiceClient();
    const fn = createSyncAgentTemplate(client as never, "ws-1", voice.client as never);

    await fn({ id: "tmpl-1" });

    assert.deepEqual(voice.calls, ["create"]);
    assert.deepEqual(updates, [{ fonosterAppRef: "app-1" }]);
  });

  it("updates the existing Fonoster app when already synced", async () => {
    const { client, updates } = makeClient({ existingRef: "app-1" });
    const voice = makeVoiceClient();
    const fn = createSyncAgentTemplate(client as never, "ws-1", voice.client as never);

    await fn({ id: "tmpl-1" });

    assert.deepEqual(voice.calls, ["update"]);
    assert.deepEqual(updates, [{ fonosterAppRef: "app-2" }]);
  });

  it("propagates provider failures so the operator sees the error", async () => {
    const { client } = makeClient({ existingRef: null });
    const voice = makeVoiceClient({ fail: true });
    const fn = createSyncAgentTemplate(client as never, "ws-1", voice.client as never);

    await assert.rejects(() => fn({ id: "tmpl-1" }), /fonoster down/);
  });

  it("is a no-op for non-voice templates", async () => {
    const { client, updates } = makeClient({ type: "SMS" });
    const voice = makeVoiceClient();
    const fn = createSyncAgentTemplate(client as never, "ws-1", voice.client as never);

    await fn({ id: "tmpl-1" });

    assert.equal(voice.calls.length, 0);
    assert.equal(updates.length, 0);
  });
});
