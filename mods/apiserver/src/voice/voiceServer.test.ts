import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handlePrerecordedCall, readDtmfMenu, type PrerecordedCallVerbs } from "./voiceServer.js";

/** Fakes the verb surface `handlePrerecordedCall` drives, queuing gather() responses in
 * call order and recording every verb invocation for assertions. */
function makeVerbs(gatherResponses: (string | undefined)[]) {
  const calls: string[] = [];
  const queue = [...gatherResponses];
  const verbs: PrerecordedCallVerbs = {
    answer: async () => calls.push("answer"),
    say: async (text: string) => calls.push(`say:${text}`),
    hangup: async () => calls.push("hangup"),
    gather: async () => {
      calls.push("gather");
      return { digits: queue.shift() };
    }
  };
  return { verbs, calls };
}

describe("readDtmfMenu", () => {
  it("returns null when neither digit is configured", () => {
    assert.equal(readDtmfMenu({}), null);
    assert.equal(readDtmfMenu(undefined), null);
  });

  it("defaults maxRepeats to 2 when omitted", () => {
    assert.equal(readDtmfMenu({ repeatDigit: "1" })?.maxRepeats, 2);
  });

  it("parses a configured maxRepeats", () => {
    assert.equal(readDtmfMenu({ repeatDigit: "1", maxRepeats: "3" })?.maxRepeats, 3);
  });

  it("reads a menu configured with only the opt-out digit", () => {
    const menu = readDtmfMenu({ optOutDigit: "9", optOutMessage: "Presione 9." });
    assert.equal(menu?.repeatDigit, undefined);
    assert.equal(menu?.optOutDigit, "9");
  });

  it("reads the opt-out confirmation message", () => {
    const menu = readDtmfMenu({
      optOutDigit: "9",
      optOutMessage: "Presione 9.",
      optOutConfirmationMessage: "Hemos registrado su solicitud."
    });
    assert.equal(menu?.optOutConfirmationMessage, "Hemos registrado su solicitud.");
  });
});

describe("handlePrerecordedCall", () => {
  it("no menu: plays the script once and hangs up, camino defaults to ENGAGED", async () => {
    const { verbs, calls } = makeVerbs([]);

    const result = await handlePrerecordedCall("Su saldo es...", null, verbs);

    assert.deepEqual(calls, ["answer", "say:Su saldo es...", "hangup"]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: undefined, repeatCount: 0 });
  });

  it("menu configured but the caller presses nothing (timeout): hangs up, camino still ENGAGED, no resultado", async () => {
    const { verbs, calls } = makeVerbs([undefined]);
    const menu = { repeatDigit: "1", repeatMessage: "Presione 1.", maxRepeats: 2 };

    const result = await handlePrerecordedCall("Su saldo es...", menu, verbs);

    assert.deepEqual(calls, [
      "answer",
      "say:Su saldo es...",
      "say:Presione 1.",
      "gather",
      "hangup"
    ]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: undefined, repeatCount: 0 });
  });

  it("an unrecognized digit hangs up, camino still ENGAGED, no resultado", async () => {
    const { verbs } = makeVerbs(["5"]);
    const menu = { repeatDigit: "1", optOutDigit: "9", maxRepeats: 2 };

    const result = await handlePrerecordedCall("Su saldo es...", menu, verbs);

    assert.deepEqual(result, { camino: "ENGAGED", resultado: undefined, repeatCount: 0 });
  });

  it("repeat digit replays the script and gathers again, setting camino ENGAGED", async () => {
    const { verbs, calls } = makeVerbs(["1", undefined]);
    const menu = { repeatDigit: "1", maxRepeats: 2 };

    const result = await handlePrerecordedCall("Script", menu, verbs);

    assert.deepEqual(calls, [
      "answer",
      "say:Script",
      "gather",
      "say:Script", // replay
      "gather",
      "hangup"
    ]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: undefined, repeatCount: 1 });
  });

  it("repeating past the cap hangs up without a further replay, camino still ENGAGED", async () => {
    const { verbs, calls } = makeVerbs(["1", "1", "1"]);
    const menu = { repeatDigit: "1", maxRepeats: 2 };

    const result = await handlePrerecordedCall("Script", menu, verbs);

    // answer, say(script), then 2 replays (2 gathers consumed "1","1"), then the 3rd "1"
    // hits the cap and hangs up without a 3rd replay.
    assert.deepEqual(calls, [
      "answer",
      "say:Script",
      "gather",
      "say:Script",
      "gather",
      "say:Script",
      "gather",
      "hangup"
    ]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: undefined, repeatCount: 2 });
  });

  it("opt-out digit ends the call immediately with no further gather", async () => {
    const { verbs, calls } = makeVerbs(["9"]);
    const menu = { repeatDigit: "1", optOutDigit: "9", maxRepeats: 2 };

    const result = await handlePrerecordedCall("Script", menu, verbs);

    assert.deepEqual(calls, ["answer", "say:Script", "gather", "hangup"]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: "OPT_OUT", repeatCount: 0 });
  });

  it("opt-out plays the confirmation message before hanging up, when configured", async () => {
    const { verbs, calls } = makeVerbs(["9"]);
    const menu = {
      repeatDigit: "1",
      optOutDigit: "9",
      optOutConfirmationMessage: "Hemos registrado su solicitud.",
      maxRepeats: 2
    };

    const result = await handlePrerecordedCall("Script", menu, verbs);

    assert.deepEqual(calls, [
      "answer",
      "say:Script",
      "gather",
      "say:Hemos registrado su solicitud.",
      "hangup"
    ]);
    assert.deepEqual(result, { camino: "ENGAGED", resultado: "OPT_OUT", repeatCount: 0 });
  });

  it("opt-out with no confirmation message configured hangs up straight away (unchanged)", async () => {
    const { verbs, calls } = makeVerbs(["9"]);
    const menu = { repeatDigit: "1", optOutDigit: "9", maxRepeats: 2 };

    await handlePrerecordedCall("Script", menu, verbs);

    assert.deepEqual(calls, ["answer", "say:Script", "gather", "hangup"]);
  });

  it("plays the configured menu messages once, before the first gather", async () => {
    const { calls, verbs } = makeVerbs(["9"]);
    const menu = {
      repeatDigit: "1",
      repeatMessage: "Presione 1 para repetir.",
      optOutDigit: "9",
      optOutMessage: "Presione 9 para darse de baja.",
      maxRepeats: 2
    };

    await handlePrerecordedCall("Script", menu, verbs);

    assert.deepEqual(calls, [
      "answer",
      "say:Script",
      "say:Presione 1 para repetir.",
      "say:Presione 9 para darse de baja.",
      "gather",
      "hangup"
    ]);
  });
});
