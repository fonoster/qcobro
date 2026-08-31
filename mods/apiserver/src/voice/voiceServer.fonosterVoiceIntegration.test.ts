import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { VoiceResponse } from "@fonoster/voice";
import { runPrerecordedCall } from "./voiceServer.js";

/**
 * Drives `runPrerecordedCall` against a REAL `@fonoster/voice` `VoiceResponse` — the
 * package this file's unit tests fake out entirely via `PrerecordedCallVerbs`. That's
 * appropriate for testing this module's own logic, but it means those tests cannot
 * catch a defect in `@fonoster/voice` itself, or in how this dependency is pinned.
 *
 * That gap is exactly what let the 2026-08-30 incident recur on a later manual test:
 * `mods/apiserver/package.json` pinned `@fonoster/voice` at 0.22.0 (2026-06-25), which
 * predates the upstream fix (Fonoster PR #880, 2026-08-31) by two months. Every unit
 * test in this file kept passing throughout, because none of them touch the real
 * package. This file drives the actual installed dependency, so a future stale pin
 * would fail here even though the rest of the suite stays green.
 *
 * `StreamEvent` values are the raw strings ("data"/"end"/"error") rather than an
 * import from `@fonoster/common`, since that package is a transitive dependency of
 * `@fonoster/voice` here, not one this project declares directly.
 */
function createFakeVoiceStream() {
  const emitter = new EventEmitter();
  return {
    stream: {
      on: (event: string, cb: (...args: unknown[]) => void) => emitter.on(event, cb),
      once: (event: string, cb: (...args: unknown[]) => void) => emitter.once(event, cb),
      removeListener: (event: string, cb: (...args: unknown[]) => void) =>
        emitter.removeListener(event, cb),
      write: (message: { content?: string }) => {
        // Only the Answer verb gets a reply; Say is left hanging until the caller
        // ends the stream, reproducing the manual-test recording exactly.
        if ("answerRequest" in message) {
          setImmediate(() => emitter.emit("data", { content: "answerResponse" }));
        }
      },
      end: () => undefined
    },
    endStream: () => emitter.emit("end")
  };
}

describe("runPrerecordedCall against the installed @fonoster/voice", () => {
  it(
    "REGRESSION: a session that ends mid-Say resolves as scriptCompleted:false, " +
      "not a hang — reproduces the 2026-08-30 recording (menu=true, answered, " +
      "TTS synthesis started, callee hung up before Say could respond)",
    async () => {
      const { stream, endStream } = createFakeVoiceStream();
      const request = {
        mediaSessionRef: "1788196440.644",
        callRef: "5be3cc98-169f-429d-a97b-6104f6e1be0b",
        appRef: "7acb5d67-c660-49c4-af34-07bcc718683c"
      } as never;
      const res = new VoiceResponse(request, stream as never);

      const runningCall = runPrerecordedCall(
        "Esto es un mensaje para, Hugo...",
        {
          repeatDigit: "1",
          repeatMessage: "Presione 1 para escuchar el mensaje de nuevo.",
          maxRepeats: 3,
          optOutDigit: "9",
          optOutMessage: "Presione 9 si no desea recibir más llamadas.",
          optOutConfirmationMessage:
            "Hemos registrado su solicitud. No recibirá más llamadas de este número."
        },
        res
      );

      // Give the Answer verb's queued response a turn, then let Say be sent and
      // hang — matching the recording, where synthesis started and the callee's
      // hangup (NORMAL_CLEARING) arrived before any Say response could.
      await new Promise((resolve) => setImmediate(resolve));
      endStream();

      const result = await runningCall;

      // The defect this guards against: before the dependency bump, this call never
      // settled at all and the assertion below would hang the test until timeout.
      assert.equal(result.scriptCompleted, false);
      assert.equal(result.camino, undefined);
      assert.equal(result.resultado, undefined);
    }
  );
});
