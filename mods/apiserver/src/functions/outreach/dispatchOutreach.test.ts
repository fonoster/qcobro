import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DispatchDeps } from "@qcobro/common";
import { createDispatchOutreach } from "./dispatchOutreach.js";

function makeDeps(overrides: Partial<DispatchDeps> = {}) {
  const calls: { sms: unknown[]; voice: unknown[] } = { sms: [], voice: [] };
  const deps: DispatchDeps = {
    smsClient: {
      sendMessage: async (input) => {
        calls.sms.push(input);
        return { sid: "SM123" };
      }
    },
    outboundCallClient: {
      createCall: async (input) => {
        calls.voice.push(input);
        return { ref: "call-1" };
      }
    },
    fonosterNumbers: ["+50611111111"],
    twilioFromNumbers: ["+15550001111"],
    // Deterministic selection for assertions.
    pickNumber: (numbers) => numbers[0],
    ...overrides
  };
  return { deps, calls };
}

describe("dispatchOutreach", () => {
  it("sends an SMS with the rendered body from a pooled number", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "SMS",
      to: "+50670000000",
      context: { firstName: "Ana", outstandingBalance: 900 },
      body: "Hola {{firstName}}, debe {{outstandingBalance}}"
    });

    assert.deepEqual(calls.sms, [
      { from: "+15550001111", to: "+50670000000", body: "Hola Ana, debe 900" }
    ]);
    assert.equal(result.channel, "SMS");
    assert.equal(result.providerRef, "SM123");
    assert.equal(result.renderedBody, "Hola Ana, debe 900");
  });

  it("places a voice call to the app ref with rendered metadata", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "VOICE_AI",
      to: "+50670000000",
      context: { firstName: "Luis" },
      appRef: "app-9",
      firstMessage: "Hola {{firstName}}",
      systemPrompt: "Sé amable con {{firstName}}"
    });

    assert.equal(calls.voice.length, 1);
    assert.deepEqual(calls.voice[0], {
      from: "+50611111111",
      to: "+50670000000",
      appRef: "app-9",
      metadata: { firstMessage: "Hola Luis", systemPrompt: "Sé amable con Luis" }
    });
    assert.equal(result.providerRef, "call-1");
    assert.equal(result.renderedBody, "Hola Luis");
  });

  it("pre-recorded passes only the ready message as metadata (no systemPrompt)", async () => {
    const { deps, calls } = makeDeps();
    const result = await createDispatchOutreach(deps)({
      channel: "VOICE_PRERECORDED",
      to: "+50670000000",
      context: { firstName: "Eva" },
      appRef: "ext-app-1",
      firstMessage: "Hola {{firstName}}, este es un recordatorio de pago."
    });

    assert.equal(calls.voice.length, 1);
    assert.deepEqual(calls.voice[0], {
      from: "+50611111111",
      to: "+50670000000",
      appRef: "ext-app-1",
      metadata: { message: "Hola Eva, este es un recordatorio de pago." }
    });
    assert.equal(result.channel, "VOICE_PRERECORDED");
    assert.equal(result.renderedBody, "Hola Eva, este es un recordatorio de pago.");
  });

  it("rejects an SMS with no body and never calls the provider (validation)", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(() =>
      createDispatchOutreach(deps)({ channel: "SMS", to: "+50670000000", context: {} })
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails clearly when the SMS channel is not configured", async () => {
    const { deps, calls } = makeDeps({ smsClient: null });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "SMS",
          to: "+50670000000",
          context: {},
          body: "hi"
        }),
      /not configured/
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails clearly when the sending-number pool is empty", async () => {
    const { deps, calls } = makeDeps({ twilioFromNumbers: [] });
    await assert.rejects(
      () =>
        createDispatchOutreach(deps)({
          channel: "SMS",
          to: "+50670000000",
          context: {},
          body: "hi"
        }),
      /no configured sender numbers/
    );
    assert.equal(calls.sms.length, 0);
  });

  it("fails when a voice template was never synced (no appRef)", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(() =>
      createDispatchOutreach(deps)({
        channel: "VOICE_PRERECORDED",
        to: "+50670000000",
        context: {},
        firstMessage: "Hola"
      })
    );
    assert.equal(calls.voice.length, 0);
  });
});
