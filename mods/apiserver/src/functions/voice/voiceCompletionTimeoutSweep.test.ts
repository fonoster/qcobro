import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { VoiceCallLookupResult } from "@qcobro/common";
import { createVoiceCompletionTimeoutSweep } from "./voiceCompletionTimeoutSweep.js";
import { parseEndedAt } from "../../services/fonosterOutboundCallClient.js";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const FLOOR_MINUTES = 2;
const GRACE_SECONDS = 60;
const BACKSTOP_MINUTES = 30;

function makeClient(
  rows: {
    id: string;
    providerRef: string;
    agentType: "VOICE_AI" | "VOICE_PRERECORDED";
    contactedAt: Date;
  }[]
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

function makeOutboundCallClient(cdrs: Record<string, VoiceCallLookupResult>) {
  return {
    getCall: async (ref: string): Promise<VoiceCallLookupResult> => cdrs[ref] ?? { found: false }
  };
}

function makeDeps(
  rows: Parameters<typeof makeClient>[0],
  cdrs: Record<string, VoiceCallLookupResult>,
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
      outboundCallClient: makeOutboundCallClient(cdrs),
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
      floorMinutes: FLOOR_MINUTES,
      graceSeconds: GRACE_SECONDS,
      backstopMinutes: BACKSTOP_MINUTES,
      now: () => NOW
    }
  };
}

const JUST_PAST_FLOOR = new Date(NOW.getTime() - 3 * 60_000);
const PAST_BACKSTOP = new Date(NOW.getTime() - 31 * 60_000);
// Well past GRACE_SECONDS (60s), so a terminal CDR using this as its endedAt behaves as it
// did before the grace period existed — these back the pre-existing branch tests below.
const WELL_PAST_GRACE = new Date(NOW.getTime() - 90_000);

describe("createVoiceCompletionTimeoutSweep", () => {
  it("queries with the correct delivery/agentType/floor-cutoff filter", async () => {
    const { deps, calls } = makeDeps([], {});
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    await sweep();

    const args = calls[0] as { where: { delivery: string; contactedAt: { lt: Date } } };
    assert.equal(args.where.delivery, "DISPATCHED");
    assert.deepEqual(args.where.contactedAt.lt, new Date(NOW.getTime() - FLOOR_MINUTES * 60_000));
  });

  it("returns 0 when nothing is stale", async () => {
    const { deps } = makeDeps([], {});
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    assert.equal(await sweep(), 0);
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
      outboundCallClient: makeOutboundCallClient({}),
      recordVoiceAiCallStatus: async () => undefined,
      recordPrerecordedOutcome: async () => undefined,
      floorMinutes: FLOOR_MINUTES,
      graceSeconds: GRACE_SECONDS,
      backstopMinutes: BACKSTOP_MINUTES,
      now: () => NOW
    });

    const count = await sweep();

    assert.equal(count, 0);
  });

  describe("branch: a terminal CDR status (past the grace period)", () => {
    it("finalizes VOICE_AI FAILED with the mapped deliveryReason via recordVoiceAiCallStatus", async () => {
      const { deps, aiCalls, prerecordedCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "USER_BUSY",
            setupToClearSeconds: 12,
            endedAt: WELL_PAST_GRACE
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, [
        {
          providerRef: "call-1",
          answered: false,
          deliveryReason: "BUSY",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
      assert.deepEqual(prerecordedCalls, []);
    });

    it("finalizes VOICE_PRERECORDED via recordPrerecordedOutcome", async () => {
      const { deps, aiCalls, prerecordedCalls } = makeDeps(
        [
          {
            id: "g-2",
            providerRef: "call-2",
            agentType: "VOICE_PRERECORDED",
            contactedAt: JUST_PAST_FLOOR
          }
        ],
        {
          "call-2": {
            found: true,
            status: "NO_ANSWER",
            setupToClearSeconds: 30,
            endedAt: WELL_PAST_GRACE
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, []);
      assert.deepEqual(prerecordedCalls, [
        {
          providerRef: "call-2",
          answered: false,
          deliveryReason: "NO_ANSWER",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
    });

    it("maps NORMAL_CLEARING to OUTCOME_UNKNOWN — the call was fine, our signal is what's missing", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "NORMAL_CLEARING",
            setupToClearSeconds: 45,
            endedAt: WELL_PAST_GRACE
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      await sweep();

      assert.equal((aiCalls[0] as { deliveryReason: string }).deliveryReason, "OUTCOME_UNKNOWN");
    });

    it("never passes the CDR's setupToClearSeconds through as answeredSeconds", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "USER_BUSY",
            setupToClearSeconds: 999,
            endedAt: WELL_PAST_GRACE
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      await sweep();

      assert.equal((aiCalls[0] as { answeredSeconds: number }).answeredSeconds, 0);
    });
  });

  describe("branch: grace period — a terminal CDR races a live completion signal", () => {
    it("does not finalize a terminal CDR ended only 5 seconds ago", async () => {
      const { deps, aiCalls, prerecordedCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "USER_BUSY",
            setupToClearSeconds: 12,
            endedAt: new Date(NOW.getTime() - 5_000)
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 0);
      assert.deepEqual(aiCalls, []);
      assert.deepEqual(prerecordedCalls, []);
    });

    it("finalizes the same gestión on a later pass, once ended 90 seconds ago", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "USER_BUSY",
            setupToClearSeconds: 12,
            endedAt: new Date(NOW.getTime() - 90_000)
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, [
        {
          providerRef: "call-1",
          answered: false,
          deliveryReason: "BUSY",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
    });

    it("does not finalize a terminal CDR with no endedAt — never guess in the direction that discards a real outcome", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        {
          "call-1": {
            found: true,
            status: "USER_BUSY",
            setupToClearSeconds: 12,
            endedAt: null
          }
        }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 0);
      assert.deepEqual(aiCalls, []);
    });

    it("finalizes end to end when endedAt is derived from a realistic epoch-seconds wire value, not a hand-made Date", async () => {
      // `parseEndedAt` is what the real FonosterOutboundCallClient runs the CDR's raw
      // `endedAt` through — on the wire it is an epoch-seconds integer, not a Date. Driving
      // the sweep through the real parser (rather than a hand-made `new Date(...)` fixture)
      // is what would have caught parseEndedAt rejecting every real CDR.
      const endedAtEpochSeconds = Math.floor((NOW.getTime() - 90_000) / 1000);
      const endedAt = parseEndedAt(endedAtEpochSeconds);
      assert.ok(endedAt instanceof Date, "parseEndedAt must accept a raw epoch-seconds number");

      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        { "call-1": { found: true, status: "USER_BUSY", setupToClearSeconds: 12, endedAt } }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, [
        {
          providerRef: "call-1",
          answered: false,
          deliveryReason: "BUSY",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
    });
  });

  describe("branch: no status yet (call still in progress)", () => {
    it("leaves the gestión at DISPATCHED — no record call, not counted", async () => {
      const { deps, aiCalls, prerecordedCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        { "call-1": { found: true, status: "UNKNOWN", setupToClearSeconds: 0, endedAt: null } }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 0);
      assert.deepEqual(aiCalls, []);
      assert.deepEqual(prerecordedCalls, []);
    });
  });

  describe("branch: NOT_FOUND — the call never originated", () => {
    it("finalizes FAILED / NOT_ORIGINATED with no grace applied", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        { "call-1": { found: false } }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, [
        {
          providerRef: "call-1",
          answered: false,
          deliveryReason: "NOT_ORIGINATED",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
    });
  });

  describe("branch: backstop", () => {
    it("finalizes FAILED / OUTCOME_UNKNOWN once a no-status gestión passes backstopMinutes", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: PAST_BACKSTOP }],
        { "call-1": { found: true, status: "UNKNOWN", setupToClearSeconds: 0, endedAt: null } }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 1);
      assert.deepEqual(aiCalls, [
        {
          providerRef: "call-1",
          answered: false,
          deliveryReason: "OUTCOME_UNKNOWN",
          answeredSeconds: 0,
          at: NOW.toISOString()
        }
      ]);
    });

    it("does not backstop a gestión still short of backstopMinutes", async () => {
      const { deps, aiCalls } = makeDeps(
        [{ id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR }],
        { "call-1": { found: true, status: "UNKNOWN", setupToClearSeconds: 0, endedAt: null } }
      );
      const sweep = createVoiceCompletionTimeoutSweep(deps as never);

      const count = await sweep();

      assert.equal(count, 0);
      assert.deepEqual(aiCalls, []);
    });
  });

  it("isolates a per-row failure without stopping the batch", async () => {
    let attempts = 0;
    const { deps, prerecordedCalls } = makeDeps(
      [
        { id: "g-1", providerRef: "call-1", agentType: "VOICE_AI", contactedAt: JUST_PAST_FLOOR },
        {
          id: "g-2",
          providerRef: "call-2",
          agentType: "VOICE_PRERECORDED",
          contactedAt: JUST_PAST_FLOOR
        }
      ],
      {
        "call-1": {
          found: true,
          status: "USER_BUSY",
          setupToClearSeconds: 12,
          endedAt: WELL_PAST_GRACE
        },
        "call-2": {
          found: true,
          status: "NO_ANSWER",
          setupToClearSeconds: 30,
          endedAt: WELL_PAST_GRACE
        }
      },
      {
        recordVoiceAiCallStatus: async () => {
          attempts++;
          throw new Error("db exploded");
        }
      }
    );
    const sweep = createVoiceCompletionTimeoutSweep(deps as never);

    const count = await sweep();

    assert.equal(attempts, 1);
    assert.equal(count, 1); // only the successful VOICE_PRERECORDED row counted
    assert.equal(prerecordedCalls.length, 1);
  });
});
