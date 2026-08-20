import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveVoiceCallFromCdr } from "./resolveVoiceCallFromCdr.js";

describe("resolveVoiceCallFromCdr", () => {
  it("finds the CDR on the first check — normal-clearing → finalizes DELIVERED with the real duration", async () => {
    let finalizeArgs: unknown;
    let calls = 0;
    await resolveVoiceCallFromCdr(
      {
        tracker: {
          getCallDetail: async () => {
            calls += 1;
            return { status: "NORMAL_CLEARING", durationSeconds: 33 };
          }
        },
        finalize: async (input) => {
          finalizeArgs = input;
        }
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.equal(calls, 1); // no upfront wait needed — resolves as soon as it's there
    assert.deepEqual(finalizeArgs, {
      providerRef: "call-abc",
      answered: true,
      deliveryReason: undefined,
      answeredSeconds: 33,
      at: "2026-08-18T10:00:00.000Z"
    });
  });

  it("non-normal-clearing CDR (busy) → finalizes FAILED with deliveryReason BUSY, zero duration, never a fabricated one", async () => {
    let finalizeArgs: unknown;
    await resolveVoiceCallFromCdr(
      {
        tracker: {
          getCallDetail: async () => ({ status: "USER_BUSY", durationSeconds: 12 })
        },
        finalize: async (input) => {
          finalizeArgs = input;
        }
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.deepEqual(finalizeArgs, {
      providerRef: "call-abc",
      answered: false,
      deliveryReason: "BUSY",
      answeredSeconds: 0,
      at: "2026-08-18T10:00:00.000Z"
    });
  });

  it("non-normal-clearing CDR (no answer) → deliveryReason NO_ANSWER", async () => {
    let finalizeArgs: unknown;
    await resolveVoiceCallFromCdr(
      {
        tracker: { getCallDetail: async () => ({ status: "NO_ANSWER", durationSeconds: 0 }) },
        finalize: async (input) => {
          finalizeArgs = input;
        }
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.equal((finalizeArgs as { deliveryReason: string }).deliveryReason, "NO_ANSWER");
  });

  it("an unrecognized clearing cause falls back to PROVIDER_ERROR", async () => {
    let finalizeArgs: unknown;
    await resolveVoiceCallFromCdr(
      {
        tracker: { getCallDetail: async () => ({ status: "SOMETHING_WEIRD", durationSeconds: 0 }) },
        finalize: async (input) => {
          finalizeArgs = input;
        }
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.equal((finalizeArgs as { deliveryReason: string }).deliveryReason, "PROVIDER_ERROR");
  });

  it("polls while the call is still in progress (CDR not written yet), then finalizes once it ends", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    let finalizeArgs: unknown;

    await resolveVoiceCallFromCdr(
      {
        tracker: {
          getCallDetail: async () => {
            calls += 1;
            if (calls < 4) return null; // call still ongoing
            return { status: "NORMAL_CLEARING", durationSeconds: 47 };
          }
        },
        finalize: async (input) => {
          finalizeArgs = input;
        },
        pollDelaysMs: [10, 20, 40, 80],
        sleep: async (ms) => {
          sleeps.push(ms);
        }
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.equal(calls, 4);
    assert.deepEqual(sleeps, [10, 20, 40]);
    assert.equal((finalizeArgs as { answeredSeconds: number }).answeredSeconds, 47);
  });

  it("gives up without finalizing when the call never ends within the poll budget", async () => {
    let finalizeCalled = false;

    await resolveVoiceCallFromCdr(
      {
        tracker: { getCallDetail: async () => null },
        finalize: async () => {
          finalizeCalled = true;
        },
        pollDelaysMs: [1, 1],
        sleep: async () => {}
      },
      "call-abc",
      "2026-08-18T10:00:00.000Z"
    );

    assert.equal(finalizeCalled, false);
  });
});
