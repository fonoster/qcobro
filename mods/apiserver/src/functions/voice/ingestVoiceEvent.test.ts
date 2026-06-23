import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@qcobro/common";
import { createIngestVoiceEvent } from "./ingestVoiceEvent.js";

interface Captured {
  findManyCalled?: boolean;
  update?: { where: { id: string }; data: Record<string, unknown> };
}

function makeClient(records: { id: string; channelData: unknown }[]) {
  const cap: Captured = {};
  const client = {
    accountContactLog: {
      findMany: async () => {
        cap.findManyCalled = true;
        return records;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        cap.update = args;
        return {} as never;
      }
    }
  };
  return { client, cap };
}

const ENDED = {
  eventType: "conversation.ended" as const,
  appRef: "app-1",
  callRef: "call-abc",
  phone: "+15550001111",
  chatHistory: [{ ai: "Buenas tardes." }, { human: "Hola." }, { ai: "¿Le gustaría pagar?" }],
  recordingUrl: "https://rec.example/app-1_x.wav",
  durationSeconds: 134
};

describe("ingestVoiceEvent", () => {
  it("conversation.ended updates the matching gestión with transcript + recording", async () => {
    const { client, cap } = makeClient([
      { id: "g-other", channelData: { providerRef: "call-zzz" } },
      { id: "g-1", channelData: { providerRef: "call-abc", from: "+1999" } }
    ]);

    const result = await createIngestVoiceEvent(client as never)(ENDED);

    assert.deepEqual(result, { matched: true, id: "g-1" });
    assert.equal(cap.update?.where.id, "g-1");
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.equal(cd.from, "+1999"); // existing channelData preserved
    assert.equal(cd.recordingUrl, ENDED.recordingUrl);
    assert.deepEqual(cd.transcript, [
      { role: "agent", text: "Buenas tardes." },
      { role: "customer", text: "Hola." },
      { role: "agent", text: "¿Le gustaría pagar?" }
    ]);
    assert.equal(cap.update?.data.durationSeconds, 134);
  });

  it("conversation.started records a startedAt marker, no transcript", async () => {
    const { client, cap } = makeClient([{ id: "g-1", channelData: { providerRef: "call-abc" } }]);

    const result = await createIngestVoiceEvent(client as never)({
      eventType: "conversation.started",
      appRef: "app-1",
      callRef: "call-abc",
      phone: "+15550001111"
    });

    assert.deepEqual(result, { matched: true, id: "g-1" });
    const cd = cap.update?.data.channelData as Record<string, unknown>;
    assert.ok(typeof cd.startedAt === "string");
    assert.equal(cd.transcript, undefined);
  });

  it("returns matched:false and does not update when no gestión matches the callRef", async () => {
    const { client, cap } = makeClient([{ id: "g-1", channelData: { providerRef: "other" } }]);

    const result = await createIngestVoiceEvent(client as never)(ENDED);

    assert.deepEqual(result, { matched: false });
    assert.equal(cap.update, undefined);
  });

  it("rejects an invalid event with a ValidationError and never touches the database", async () => {
    const { client, cap } = makeClient([{ id: "g-1", channelData: { providerRef: "call-abc" } }]);

    await assert.rejects(
      () => createIngestVoiceEvent(client as never)({ eventType: "nope", appRef: "a" } as never),
      (err) => err instanceof ValidationError
    );
    assert.equal(cap.findManyCalled, undefined);
    assert.equal(cap.update, undefined);
  });
});
