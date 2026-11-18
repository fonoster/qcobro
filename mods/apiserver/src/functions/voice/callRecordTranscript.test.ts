import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { callRecordHasRecording, chatHistoryFromCallRecord } from "./callRecordTranscript.js";

const parties = [
  { tel: "18297340812", role: "caller" },
  { tel: "18095550123", role: "callee" },
  { name: "app-1", role: "agent", meta: { appRef: "app-1" } }
];

function text(originator: number, body: string) {
  return { type: "text", parties: [originator], originator, body };
}

describe("chatHistoryFromCallRecord", () => {
  it("maps caller turns to human and agent turns to ai, in dialog order", () => {
    const record = {
      vcon: {
        parties,
        dialog: [
          { type: "recording", url: "parts/call.wav" },
          text(2, "Hola, le llamo de parte de Credifácil."),
          text(0, "Sí, dígame."),
          text(2, "¿Puede pagar la cuota?"),
          text(0, "El viernes.")
        ]
      }
    };

    assert.deepEqual(chatHistoryFromCallRecord(record), [
      { ai: "Hola, le llamo de parte de Credifácil." },
      { human: "Sí, dígame." },
      { ai: "¿Puede pagar la cuota?" },
      { human: "El viernes." }
    ]);
  });

  it("returns no turns for a record with no text entries", () => {
    assert.deepEqual(chatHistoryFromCallRecord({ vcon: { parties, dialog: [] } }), []);
    assert.deepEqual(chatHistoryFromCallRecord({ vcon: {} }), []);
  });

  it("skips empty text and turns from a party that is neither caller nor agent", () => {
    const record = {
      vcon: { parties, dialog: [text(1, "callee?"), text(0, "  "), text(0, "Sí")] }
    };
    assert.deepEqual(chatHistoryFromCallRecord(record), [{ human: "Sí" }]);
  });
});

describe("callRecordHasRecording", () => {
  it("is true when the dialog has a recording entry", () => {
    assert.equal(
      callRecordHasRecording({ vcon: { dialog: [{ type: "recording" }], fonoster: {} } }),
      true
    );
  });

  it("is false with no recording entry", () => {
    assert.equal(callRecordHasRecording({ vcon: { dialog: [text(0, "Hola")] } }), false);
  });

  it("is false when the redacted copy withholds the recording", () => {
    assert.equal(
      callRecordHasRecording({
        vcon: { dialog: [{ type: "recording" }], fonoster: { recordingWithheld: "redaction" } }
      }),
      false
    );
  });
});
