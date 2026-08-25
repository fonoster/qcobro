import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVoiceCompletionTimeoutSweep } from "./voiceCompletionTimeoutSweep.js";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function makeClient(
  rows: { id: string; providerRef: string; agentType: "VOICE_AI" | "VOICE_PRERECORDED" }[]
) {
  const calls: unknown[] = [];
  const client = {
    accountContactLog: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return rows;
      }
    }
  };
  return { client, calls };
}

function makeDeps(
  rows: Parameters<typeof makeClient>[0],
  overrides: Partial<{
    recordVoiceAiCallStatus: (input: unknown) => Promise<unknown>;
    recordPrerecordedOutcome: (input: unknown) => Promise<unknown>;
  }> = {}
) {
  const { client, calls } = makeClient(rows);
  const aiCalls: unknown[] = [];
  const prerecordedCalls: unknown[] = [];
  return {
    client,
    calls,
    aiCalls,
    prerecordedCalls,
    deps: {
      client: client as never,
      recordVoiceAiCallStatus:
        overrides.recordVoiceAiCallStatus ??
        (async (input: unknown) => {
          aiCalls.push(input);
        }),
      recordPrerecordedOutcome:
        overrides.recordPrerecordedOutcome ??
        (async (input: unknown) => {
          prerecordedCalls.push(input);
        }),
      thresholdMinutes: 10,
      now: () => NOW
    }
  };
}

describe("createVoiceCompletionTimeoutSweep", () => {
  it("finalizes a stale VOICE_AI row as FAILED / PROVIDER_ERROR via recordVoiceAiCallStatus", async () => {
    const { deps, aiCalls, prerecordedCalls } = makeDeps([
      { id: "g-1", providerRef: "call-1", agentType: "VOICE_AI" }
    ]);
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    const count = await sweep();

    assert.equal(count, 1);
    assert.deepEqual(aiCalls, [
      {
        providerRef: "call-1",
        answered: false,
        deliveryReason: "PROVIDER_ERROR",
        answeredSeconds: 0,
        at: NOW.toISOString()
      }
    ]);
    assert.deepEqual(prerecordedCalls, []);
  });

  it("finalizes a stale VOICE_PRERECORDED row via recordPrerecordedOutcome", async () => {
    const { deps, aiCalls, prerecordedCalls } = makeDeps([
      { id: "g-2", providerRef: "call-2", agentType: "VOICE_PRERECORDED" }
    ]);
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    const count = await sweep();

    assert.equal(count, 1);
    assert.deepEqual(aiCalls, []);
    assert.equal(prerecordedCalls.length, 1);
    assert.equal((prerecordedCalls[0] as { providerRef: string }).providerRef, "call-2");
  });

  it("queries with the correct entrega/agentType/cutoff filter", async () => {
    const { deps, calls } = makeDeps([]);
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    await sweep();

    const args = calls[0] as { where: { entrega: string; contactedAt: { lt: Date } } };
    assert.equal(args.where.entrega, "DISPATCHED");
    assert.deepEqual(args.where.contactedAt.lt, new Date(NOW.getTime() - 10 * 60_000));
  });

  it("isolates a per-row failure without stopping the batch", async () => {
    let calls = 0;
    const { deps, prerecordedCalls } = makeDeps(
      [
        { id: "g-1", providerRef: "call-1", agentType: "VOICE_AI" },
        { id: "g-2", providerRef: "call-2", agentType: "VOICE_PRERECORDED" }
      ],
      {
        recordVoiceAiCallStatus: async () => {
          calls++;
          throw new Error("db exploded");
        }
      }
    );
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    const count = await sweep();

    assert.equal(calls, 1);
    assert.equal(count, 1); // only the successful VOICE_PRERECORDED row counted
    assert.equal(prerecordedCalls.length, 1);
  });

  it("returns 0 and does not throw when the query itself fails", async () => {
    const client = {
      accountContactLog: {
        findMany: async () => {
          throw new Error("connection lost");
        }
      }
    };
    const sweep = createVoiceCompletionTimeoutSweep({
      client: client as never,
      recordVoiceAiCallStatus: async () => undefined,
      recordPrerecordedOutcome: async () => undefined,
      thresholdMinutes: 10,
      now: () => NOW
    });

    const count = await sweep();

    assert.equal(count, 0);
  });

  it("returns 0 when nothing is stale", async () => {
    const { deps } = makeDeps([]);
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    assert.equal(await sweep(), 0);
  });
});
