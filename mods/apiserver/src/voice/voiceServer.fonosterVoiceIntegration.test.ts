import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { sign } from "@fonoster/voice";
import { startVoiceServer, type PrerecordedCallCompletion } from "./voiceServer.js";

/**
 * Drives the pre-recorded voice server through the REAL `@fonoster/voice` 0.63 VoiceServer and
 * Session, on an ephemeral port, with a client playing AppBridge's side of the session
 * protocol. The unit tests fake the session; this file is what catches a stale pin or a
 * protocol change in the dependency itself.
 */
const SECRET = "test-signing-secret";
const PUBLIC_URL = "wss://app.qcobro.com/voice/session";

const completions: PrerecordedCallCompletion[] = [];
const server = await startVoiceServer({
  fonoster: { prerecordedAppUrl: PUBLIC_URL, prerecordedSigningSecret: SECRET },
  port: 0,
  onCompleted: (c) => completions.push(c),
  log: () => undefined
});
assert.ok(server, "the voice server starts when both keys are set");
const voiceServer = server;

after(() => voiceServer.close());

function connect(headers: Record<string, string>) {
  return new WebSocket(`ws://127.0.0.1:${voiceServer.port}/voice/session`, { headers });
}

function signedHeaders(secret = SECRET) {
  const ts = Math.floor(Date.now() / 1000);
  return {
    "x-fonoster-timestamp": String(ts),
    "x-fonoster-signature": sign(PUBLIC_URL, ts, secret)
  };
}

/** Resolves with the HTTP status the upgrade was refused with. */
function refusedStatus(ws: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    ws.on("open", () => reject(new Error("the connection was accepted")));
    ws.on("error", () => undefined);
  });
}

function sessionStart(callRef: string, metadata: Record<string, string>) {
  return JSON.stringify({
    type: "session.start",
    sessionRef: `sess-${callRef}`,
    callRef,
    appRef: "app-prerecorded",
    direction: "outbound",
    from: "+18559473625",
    to: "+18095550100",
    metadata
  });
}

const settle = () => new Promise((r) => setTimeout(r, 50));

describe("pre-recorded voice server against @fonoster/voice 0.63", () => {
  it("refuses an unsigned connection with 401, and the handler never runs", async () => {
    const before = completions.length;

    assert.equal(await refusedStatus(connect({})), 401);
    await settle();
    assert.equal(completions.length, before);
  });

  it("refuses a connection signed with another secret with 401", async () => {
    const before = completions.length;

    assert.equal(await refusedStatus(connect(signedHeaders("another-secret"))), 401);
    await settle();
    assert.equal(completions.length, before);
  });

  it("speaks the script non-interruptibly; session.end during it reports scriptCompleted false", async () => {
    const ws = connect(signedHeaders());
    const speaks: Record<string, unknown>[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (msg.type === "speak") {
        speaks.push(msg);
        // The callee hangs up while the script is playing.
        ws.send(JSON.stringify({ type: "session.end", reason: "caller_hangup" }));
      }
    });

    ws.send(
      sessionStart("call-end-during-say", {
        message: "Esto es un mensaje para Hugo.",
        hangupOnMachineDetected: "false"
      })
    );
    let completion: PrerecordedCallCompletion | undefined;
    for (let i = 0; i < 100 && !completion; i++) {
      await settle();
      completion = completions.find((c) => c.providerRef === "call-end-during-say");
    }
    ws.close();

    assert.ok(completion, "onCompleted ran");
    assert.equal(speaks.length, 1);
    assert.equal(speaks[0].text, "Esto es un mensaje para Hugo.");
    assert.equal(speaks[0].interruptible, false);
    assert.equal(completion.answered, true);
    assert.equal(completion.scriptCompleted, false);
    assert.equal(typeof completion.answeredSeconds, "number");
  });
});
