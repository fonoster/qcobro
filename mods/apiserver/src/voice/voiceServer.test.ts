import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  AMD_WAIT_MS,
  handlePrerecordedCall,
  readDtmfMenu,
  runPrerecordedCall,
  startVoiceServer,
  type PrerecordedSession
} from "./voiceServer.js";

class SessionEnded extends Error {}

/**
 * A fake of the session surface the handler drives. `gather()` answers from a queue in call
 * order; `say()` resolves at once unless `holdSays` is set, in which case it waits until the
 * test ends the session (and then rejects, as the real Session does).
 */
function makeSession(
  metadata: Record<string, unknown>,
  opts: { gather?: (string | undefined)[]; holdSays?: boolean } = {}
) {
  const events = new EventEmitter();
  const calls: string[] = [];
  const sayOptions: unknown[] = [];
  const gatherOptions: unknown[] = [];
  const queue = [...(opts.gather ?? [])];
  let ended = false;
  const session: PrerecordedSession = {
    metadata,
    say: async (text, options) => {
      calls.push(`say:${text}`);
      sayOptions.push(options);
      if (ended) throw new SessionEnded("ended");
      if (opts.holdSays) {
        await new Promise((_, reject) => events.once("end", () => reject(new SessionEnded())));
      }
      return { interrupted: false };
    },
    gather: async (options) => {
      calls.push("gather");
      gatherOptions.push(options);
      return { digits: queue.shift() };
    },
    hangup: async () => {
      calls.push("hangup");
    },
    on: (event, cb) => {
      events.on(event, cb);
    },
    off: (event, cb) => {
      events.off(event, cb);
    }
  };
  return {
    session,
    calls,
    sayOptions,
    gatherOptions,
    amd: (status: string) => events.emit("amd.result", { status }),
    end: () => {
      ended = true;
      events.emit("end", { reason: "caller_hangup" });
    }
  };
}

const SCRIPT = "Su saldo es...";
const menuMetadata = {
  message: SCRIPT,
  repeatDigit: "1",
  repeatMessage: "Presione 1.",
  maxRepeats: "2",
  optOutDigit: "9",
  optOutMessage: "Presione 9.",
  optOutConfirmationMessage: "Hemos registrado su solicitud.",
  hangupOnMachineDetected: "false"
};

/** Lets pending promise callbacks run between timer ticks. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

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

  it("reads a menu configured with only the opt-out digit and its confirmation", () => {
    const menu = readDtmfMenu({
      optOutDigit: "9",
      optOutMessage: "Presione 9.",
      optOutConfirmationMessage: "Hemos registrado su solicitud."
    });
    assert.equal(menu?.repeatDigit, undefined);
    assert.equal(menu?.optOutDigit, "9");
    assert.equal(menu?.optOutConfirmationMessage, "Hemos registrado su solicitud.");
  });
});

describe("handlePrerecordedCall: script and menu", () => {
  it("no menu: one non-interruptible say of the message, then hangup, scriptCompleted", async () => {
    const s = makeSession({ message: SCRIPT, hangupOnMachineDetected: "false" });

    const result = await handlePrerecordedCall(s.session);

    assert.deepEqual(s.calls, [`say:${SCRIPT}`, "hangup"]);
    assert.deepEqual(s.sayOptions, [{ interruptible: false }]);
    assert.deepEqual(result, {
      path: "ENGAGED",
      outcome: undefined,
      repeatCount: 0,
      scriptCompleted: true
    });
  });

  it("every say is non-interruptible, and the menu messages play once before a DTMF-only 5000 ms gather", async () => {
    const s = makeSession(menuMetadata, { gather: [undefined] });

    await handlePrerecordedCall(s.session);

    assert.deepEqual(s.calls, [
      `say:${SCRIPT}`,
      "say:Presione 1.",
      "say:Presione 9.",
      "gather",
      "hangup"
    ]);
    for (const o of s.sayOptions) assert.deepEqual(o, { interruptible: false });
    assert.deepEqual(s.gatherOptions, [{ source: "dtmf", maxDigits: 1, timeout: 5000 }]);
  });

  it("a gather timeout hangs up: path ENGAGED, no outcome", async () => {
    const s = makeSession(menuMetadata, { gather: [undefined] });

    const result = await handlePrerecordedCall(s.session);

    assert.equal(s.calls.at(-1), "hangup");
    assert.equal(result.path, "ENGAGED");
    assert.equal(result.outcome, undefined);
  });

  it("an unknown digit hangs up", async () => {
    const s = makeSession(menuMetadata, { gather: ["5"] });

    const result = await handlePrerecordedCall(s.session);

    assert.deepEqual(s.calls.slice(-2), ["gather", "hangup"]);
    assert.equal(result.outcome, undefined);
  });

  it("the repeat digit replays the script and gathers again, up to maxRepeats", async () => {
    const s = makeSession(menuMetadata, { gather: ["1", "1", "1"] });

    const result = await handlePrerecordedCall(s.session);

    assert.equal(s.calls.filter((c) => c === `say:${SCRIPT}`).length, 3);
    assert.equal(s.calls.filter((c) => c === "gather").length, 3);
    assert.equal(s.calls.at(-1), "hangup");
    assert.equal(result.repeatCount, 2);
    assert.equal(result.path, "ENGAGED");
  });

  it("the opt-out digit plays the confirmation, hangs up and reports the opt-out", async () => {
    const s = makeSession(menuMetadata, { gather: ["9"] });

    const result = await handlePrerecordedCall(s.session);

    assert.deepEqual(s.calls.slice(-3), ["gather", "say:Hemos registrado su solicitud.", "hangup"]);
    assert.equal(result.outcome, "OPT_OUT");
    assert.equal(result.path, "ENGAGED");
  });
});

describe("handlePrerecordedCall: answering-machine detection", () => {
  afterEach(() => mock.timers.reset());

  it("toggle on, voicemail 8000 ms after session start: hangup with no say, ANSWERED_BY_MACHINE", async () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const s = makeSession({ message: SCRIPT });
    const running = handlePrerecordedCall(s.session);

    mock.timers.tick(8000);
    s.amd("voicemail");
    const result = await running;

    assert.deepEqual(s.calls, ["hangup"]);
    assert.equal(result.path, "ANSWERED_BY_MACHINE");
    assert.equal(result.scriptCompleted, false);
  });

  for (const status of ["machine", "ivr"]) {
    it(`toggle on, ${status}: hangup with no say`, async () => {
      const s = makeSession({ message: SCRIPT });
      const running = handlePrerecordedCall(s.session);

      s.amd(status);

      assert.equal((await running).path, "ANSWERED_BY_MACHINE");
      assert.deepEqual(s.calls, ["hangup"]);
    });
  }

  it("toggle on, human: waits for the verdict, then the script plays", async () => {
    const s = makeSession({ message: SCRIPT });
    const running = handlePrerecordedCall(s.session);

    await flush();
    assert.deepEqual(s.calls, [], "waits for the verdict before speaking");
    s.amd("human");
    const result = await running;

    assert.deepEqual(s.calls, [`say:${SCRIPT}`, "hangup"]);
    assert.equal(result.scriptCompleted, true);
  });

  it(`toggle on, no verdict within ${AMD_WAIT_MS} ms: the script plays`, async () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const s = makeSession({ message: SCRIPT });
    const running = handlePrerecordedCall(s.session);

    mock.timers.tick(AMD_WAIT_MS - 1);
    await flush();
    assert.deepEqual(s.calls, []);
    mock.timers.tick(1);
    const result = await running;

    assert.equal(AMD_WAIT_MS, 9000);
    assert.deepEqual(s.calls, [`say:${SCRIPT}`, "hangup"]);
    assert.equal(result.path, "ENGAGED");
  });

  it("toggle off: the script plays at once, without waiting for a verdict", async () => {
    const s = makeSession({ message: SCRIPT, hangupOnMachineDetected: "false" });

    const result = await handlePrerecordedCall(s.session);

    assert.deepEqual(s.calls, [`say:${SCRIPT}`, "hangup"]);
    assert.equal(result.scriptCompleted, true);
  });
});

describe("runPrerecordedCall", () => {
  it("clean completion reports elapsed answeredSeconds and scriptCompleted", async () => {
    const s = makeSession({ message: SCRIPT, hangupOnMachineDetected: "false" });
    let t = 1_000_000;
    const now = () => (t += 4000);

    const result = await runPrerecordedCall(s.session, now);

    assert.equal(result.scriptCompleted, true);
    assert.equal(result.answeredSeconds, 4);
    assert.equal(result.path, "ENGAGED");
  });

  it("a detected machine is not a delivery: scriptCompleted false", async () => {
    const s = makeSession({ message: SCRIPT });
    const running = runPrerecordedCall(s.session);
    s.amd("voicemail");

    const result = await running;

    assert.equal(result.path, "ANSWERED_BY_MACHINE");
    assert.equal(result.scriptCompleted, false);
  });

  it("session.end during the script resolves with scriptCompleted false and the elapsed seconds", async () => {
    const s = makeSession(
      { message: SCRIPT, hangupOnMachineDetected: "false" },
      { holdSays: true }
    );
    let t = 0;
    const now = () => t;

    const running = runPrerecordedCall(s.session, now);
    await flush();
    t = 7000;
    s.end();
    const result = await running;

    assert.equal(result.scriptCompleted, false);
    assert.equal(result.answeredSeconds, 7);
    assert.equal(result.path, undefined);
    assert.equal(result.outcome, undefined);
  });
});

describe("startVoiceServer", () => {
  it("without a signing secret, does not start and logs that the voice server is disabled", async () => {
    const lines: string[] = [];

    const server = await startVoiceServer({
      fonoster: { prerecordedAppUrl: "wss://app.qcobro.com/voice/session" },
      port: 0,
      log: (line) => lines.push(line)
    });

    assert.equal(server, null);
    assert.deepEqual(lines, [
      "pre-recorded voice server disabled: set fonoster.prerecordedAppUrl and fonoster.prerecordedSigningSecret"
    ]);
  });

  it("without an app URL, does not start either", async () => {
    const lines: string[] = [];

    const server = await startVoiceServer({
      fonoster: { prerecordedSigningSecret: "s3cret" },
      port: 0,
      log: (line) => lines.push(line)
    });

    assert.equal(server, null);
    assert.equal(lines.length, 1);
  });
});
