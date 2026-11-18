import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createIngestVoiceEvent } from "./ingestVoiceEvent.js";

interface Captured {
  findFirstCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

/**
 * Fixtures mirror how dispatch actually stores a Voz IA gestión: the Fonoster call ref is
 * the top-level `providerRef` column, and `channelData` holds only messaging fields
 * (`from`/`to`/`messageBody`) — never `providerRef`. The stub correlates the way Prisma
 * would: by the `providerRef` column in the `where`.
 */
function makeClient(
  records: {
    id: string;
    providerRef: string | null;
    channelData: unknown;
  }[]
) {
  const cap: Captured = {};
  const client = {
    accountContactLog: {
      findFirst: async (args: { where: { agentType: string; providerRef: string } }) => {
        cap.findFirstCalled = true;
        const record = records.find((r) => r.providerRef === args.where.providerRef);
        return record ? { ...record } : null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.update = args;
        return {} as never;
      }
    }
  };
  return { client, cap };
}

const NOW = new Date("2026-11-17T14:03:22.000Z");

const TRANSCRIPT = {
  callRef: "call-abc",
  chatHistory: [{ ai: "Buenas tardes." }, { human: "Hola." }, { ai: "¿Le gustaría pagar?" }]
};

describe("ingestVoiceEvent", () => {
  it("stores the transcript on the matching gestión, keeping its channel data", async () => {
    const { client, cap } = makeClient([
      { id: "g-other", providerRef: "call-zzz", channelData: { from: "+1999" } },
      { id: "g-1", providerRef: "call-abc", channelData: { from: "+1999" } }
    ]);

    const result = await createIngestVoiceEvent(client as never, () => NOW)(TRANSCRIPT);

    assert.deepEqual(result, { matched: true, id: "g-1", stored: true });
    assert.equal(cap.update?.where.id, "g-1");
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.from, "+1999"); // existing channelData preserved
    assert.deepEqual(cd.transcript, [
      { role: "agent", text: "Buenas tardes." },
      { role: "customer", text: "Hola." },
      { role: "agent", text: "¿Le gustaría pagar?" }
    ]);
    assert.equal(cd.transcriptStoredAt, NOW.toISOString());
  });

  it("correlates on the top-level providerRef column, not channelData.providerRef (regression)", async () => {
    // The bug: ingest matched `channelData.providerRef`, which dispatch never writes — the
    // call ref lives in the top-level `providerRef` column. The decoy row carries the old
    // (wrong) JSON field with the target ref; only `g-real` has it in the column. Reading
    // the JSON field would (incorrectly) match `g-decoy`.
    const { client, cap } = makeClient([
      { id: "g-decoy", providerRef: "call-other", channelData: { providerRef: "call-abc" } },
      { id: "g-real", providerRef: "call-abc", channelData: { from: "+1999" } }
    ]);

    const result = await createIngestVoiceEvent(client as never)(TRANSCRIPT);

    assert.deepEqual(result, { matched: true, id: "g-real", stored: true });
    assert.equal(cap.update?.where.id, "g-real");
  });

  it("stores nothing for a history with no turns", async () => {
    const { client, cap } = makeClient([{ id: "g-1", providerRef: "call-abc", channelData: {} }]);

    const result = await createIngestVoiceEvent(client as never)({
      callRef: "call-abc",
      chatHistory: []
    });

    assert.deepEqual(result, { matched: true, id: "g-1", stored: false });
    assert.equal(cap.update, undefined);
  });

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient([{ id: "g-1", providerRef: "other", channelData: {} }]);

    const result = await createIngestVoiceEvent(client as never)(TRANSCRIPT);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.update, undefined);
  });

  it("rejects an invalid input with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient([{ id: "g-1", providerRef: "call-abc", channelData: {} }]);

    await assert.rejects(
      () => createIngestVoiceEvent(client as never)({ callRef: "" } as never),
      (err) => err instanceof ValidationError
    );
    assert.equal(cap.findFirstCalled, undefined);
    assert.equal(cap.update, undefined);
  });
});
