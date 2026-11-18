import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveGestionRecordingPath } from "./resolveGestionRecordingPath.js";

function records(byRef: Record<string, unknown>) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      getRecord: async (callRef: string) => {
        calls.push(callRef);
        const r = byRef[callRef];
        if (r instanceof Error) throw r;
        if (!r) throw new Error("records API: 404 not_found");
        return r as never;
      }
    }
  };
}

const withRecording = { vcon: { dialog: [{ type: "recording" }], fonoster: {} } };
const withoutRecording = { vcon: { dialog: [{ type: "text", body: "Hola" }], fonoster: {} } };
const withheld = {
  vcon: { dialog: [{ type: "recording" }], fonoster: { recordingWithheld: "redaction" } }
};

describe("resolveGestionRecordingPath", () => {
  it("returns the recording endpoint path when the call record has a recording", async () => {
    const r = records({ "call-1": withRecording });
    const path = await resolveGestionRecordingPath(
      { id: "g1", agentType: "VOICE_AI", providerRef: "call-1" },
      r.client
    );
    assert.equal(path, "/api/gestiones/g1/recording");
    assert.deepEqual(r.calls, ["call-1"]);
  });

  it("returns null when the record has no recording entry or withholds it", async () => {
    const r = records({ a: withoutRecording, b: withheld });
    for (const ref of ["a", "b"]) {
      assert.equal(
        await resolveGestionRecordingPath(
          { id: "g1", agentType: "VOICE_PRERECORDED", providerRef: ref },
          r.client
        ),
        null
      );
    }
  });

  it("returns null when the record is not found or the lookup fails", async () => {
    const r = records({ boom: new Error("records API: 502 bad_gateway") });
    for (const ref of ["missing", "boom"]) {
      assert.equal(
        await resolveGestionRecordingPath(
          { id: "g1", agentType: "VOICE_AI", providerRef: ref },
          r.client
        ),
        null
      );
    }
  });

  it("does not look anything up for a non-voice gestión, one with no providerRef, or no client", async () => {
    const r = records({ "call-1": withRecording });
    assert.equal(
      await resolveGestionRecordingPath(
        { id: "g1", agentType: "SMS", providerRef: "call-1" },
        r.client
      ),
      null
    );
    assert.equal(
      await resolveGestionRecordingPath(
        { id: "g1", agentType: "VOICE_AI", providerRef: null },
        r.client
      ),
      null
    );
    assert.equal(
      await resolveGestionRecordingPath(
        { id: "g1", agentType: "VOICE_AI", providerRef: "call-1" },
        null
      ),
      null
    );
    assert.deepEqual(r.calls, []);
  });
});
