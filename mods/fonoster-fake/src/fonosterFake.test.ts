/* eslint-disable @typescript-eslint/no-explicit-any */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as SDK from "@fonoster/sdk";
import { fonosterWebhookEventSchema, type VoiceCallRecord } from "@qcobro/common";
// QCobro's own receiver code, by path: the fake must satisfy what the apiserver actually checks.
import { verifyFonosterSignature } from "../../apiserver/src/rest/voiceEvents.js";
import { chatHistoryFromCallRecord } from "../../apiserver/src/functions/voice/callRecordTranscript.js";
import { loadConfig, startFonosterFake, type RunningFonosterFake } from "./index.js";

const ACCESS_KEY_ID = "WO00000000000000000000000000000001";
const API_KEY = "AP00000000000000000000000000000001";
const API_SECRET = "test-api-secret";
const WEBHOOK_SECRET = "test-webhook-secret";
const FROM = "+18095550000";
const LLM = "google/gemini-3.1-flash-lite";

const GRPC = { INVALID_ARGUMENT: 3, NOT_FOUND: 5, PERMISSION_DENIED: 7, UNAUTHENTICATED: 16 };

/** A throwaway CA and a server certificate for `localhost` and `fonoster-fake`, made with openssl. */
function makeCerts(dir: string) {
  const ssl = (...args: string[]) => execFileSync("openssl", args, { stdio: "pipe" });
  const p = (name: string) => join(dir, name);
  ssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "2",
    "-subj",
    "/CN=fonoster-fake test CA",
    "-keyout",
    p("ca-key.pem"),
    "-out",
    p("ca.pem")
  );
  ssl(
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-subj",
    "/CN=fonoster-fake",
    "-keyout",
    p("server-key.pem"),
    "-out",
    p("server.csr")
  );
  writeFileSync(p("san.ext"), "subjectAltName=DNS:fonoster-fake,DNS:localhost\n");
  ssl(
    "x509",
    "-req",
    "-in",
    p("server.csr"),
    "-CA",
    p("ca.pem"),
    "-CAkey",
    p("ca-key.pem"),
    "-CAcreateserial",
    "-days",
    "2",
    "-extfile",
    p("san.ext"),
    "-out",
    p("server.pem")
  );
  return { ca: p("ca.pem"), cert: p("server.pem"), key: p("server-key.pem") };
}

type Received = {
  raw: Buffer;
  headers: IncomingHttpHeaders;
  event: { id: string; type: string; data: Record<string, unknown> };
};

describe("fonoster-fake", () => {
  let fake: RunningFonosterFake;
  let receiver: Server;
  let received: Received[] = [];
  let caFile: string;

  const control = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${fake.controlUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: (await res.json()) as any };
  };

  const client = async (secret = API_SECRET) => {
    const c = new SDK.Client({
      accessKeyId: ACCESS_KEY_ID,
      endpoint: `localhost:${fake.grpcPort}`,
      caFile,
      httpUrl: `https://localhost:${fake.httpsPort}`
    } as ConstructorParameters<typeof SDK.Client>[0]);
    await c.loginWithApiKey(API_KEY, secret);
    return c;
  };

  const autopilotApp = (model = LLM) => ({
    name: "Cobranza mora 8-30",
    type: SDK.ApplicationType.AUTOPILOT,
    speech: {
      voice: "elevenlabs/clara",
      ttsModel: "elevenlabs/eleven_flash_v2_5",
      language: "es-US",
      sttModel: "deepgram/nova-3"
    },
    intelligence: {
      config: {
        conversationSettings: {
          systemPrompt: "Eres Clara.",
          firstMessage: "Hola, le habla Clara."
        },
        languageModel: { model, maxTokens: 250, temperature: 0.3 }
      }
    }
  });

  const setup = async () => {
    const c = await client();
    const apps = new SDK.Applications(c);
    const { ref: appRef } = await apps.createApplication(autopilotApp() as any);
    return { c, apps, calls: new SDK.Calls(c), records: new SDK.CallRecords(c), appRef };
  };

  const rejection = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (err) {
      return err as { code?: number; status?: number };
    }
    assert.fail("expected a rejection");
  };

  before(async () => {
    const dir = mkdtempSync(join(tmpdir(), "fonoster-fake-"));
    const certs = makeCerts(dir);
    caFile = certs.ca;
    receiver = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        received.push({ raw, headers: req.headers, event: JSON.parse(raw.toString("utf8")) });
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((r) => receiver.listen(0, "127.0.0.1", r));
    const hookPort = (receiver.address() as AddressInfo).port;
    fake = await startFonosterFake(
      loadConfig({
        FONOSTER_FAKE_GRPC_PORT: "0",
        FONOSTER_FAKE_HTTPS_PORT: "0",
        FONOSTER_FAKE_CONTROL_PORT: "0",
        FONOSTER_FAKE_TLS_CERT: certs.cert,
        FONOSTER_FAKE_TLS_KEY: certs.key,
        FONOSTER_FAKE_ACCESS_KEY_ID: ACCESS_KEY_ID,
        FONOSTER_FAKE_API_KEY: API_KEY,
        FONOSTER_FAKE_API_SECRET: API_SECRET,
        FONOSTER_FAKE_NUMBERS: FROM,
        FONOSTER_FAKE_WEBHOOK_URL: `http://127.0.0.1:${hookPort}/api/voice/events`,
        FONOSTER_FAKE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        FONOSTER_FAKE_LLM_MODELS: LLM
      })
    );
  });

  beforeEach(() => {
    received = [];
  });

  after(async () => {
    await fake?.stop();
    await new Promise<void>((r) => receiver.close(() => r()));
  });

  it("pins @fonoster/sdk and @fonoster/common at the versions the apiserver pins", () => {
    const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
    const own = read("../package.json");
    const api = read("../../apiserver/package.json");
    const apiVersion = (name: string) => api.dependencies?.[name] ?? api.devDependencies?.[name];
    for (const name of ["@fonoster/sdk", "@fonoster/common"]) {
      assert.ok(apiVersion(name), `the apiserver pins ${name}`);
      assert.equal(
        own.dependencies?.[name],
        apiVersion(name),
        `${name} differs from the apiserver's`
      );
    }
  });

  it("is private and its changes cut no release", () => {
    const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const lerna = JSON.parse(readFileSync(new URL("../../../lerna.json", import.meta.url), "utf8"));
    assert.equal(own.private, true);
    assert.ok(lerna.command.version.ignoreChanges.includes("mods/fonoster-fake/**"));
  });

  it("fails at boot naming a missing environment variable", () => {
    assert.throws(() => loadConfig({}), /FONOSTER_FAKE_GRPC_PORT/);
  });

  it("serves login, applications and calls through the real SDK and lists what was sent", async () => {
    const { apps, calls, appRef } = await setup();
    assert.match(appRef, /^[0-9a-f-]{36}$/);

    const updated = await apps.updateApplication({
      ref: appRef,
      ...autopilotApp(),
      name: "Renombrada"
    } as any);
    assert.equal(updated.ref, appRef);

    const { ref } = await calls.createCall({
      from: FROM,
      to: "+18095550101",
      appRef,
      timeout: 45,
      metadata: { gestionId: "g-1" }
    });
    assert.match(ref, /^[0-9a-f-]{36}$/);

    const listedApps = await control("GET", "/_fake/applications");
    const app = listedApps.body.find((a: any) => a.ref === appRef);
    assert.equal(app.name, "Renombrada");
    assert.equal(app.type, "AUTOPILOT");
    assert.equal(app.intelligence.config.languageModel.model, LLM);

    const listedCalls = await control(
      "GET",
      `/_fake/calls?to=${encodeURIComponent("+18095550101")}`
    );
    const call = listedCalls.body.find((c: any) => c.ref === ref);
    assert.deepEqual(
      {
        from: call.from,
        to: call.to,
        appRef: call.appRef,
        metadata: call.metadata,
        state: call.state
      },
      {
        from: FROM,
        to: "+18095550101",
        appRef,
        metadata: { gestionId: "g-1" },
        state: "in_progress"
      }
    );

    const del = await apps.deleteApplication(appRef);
    assert.equal(del.ref, appRef);
    const err = await rejection(apps.deleteApplication(appRef));
    assert.equal(err.code, GRPC.NOT_FOUND);
  });

  it("rejects an AUTOPILOT app whose language model is not in the catalog", async () => {
    const { apps, appRef } = await setup();
    const created = await rejection(
      apps.createApplication(autopilotApp("google/gemini-2.0-flash") as any)
    );
    assert.equal(created.code, GRPC.INVALID_ARGUMENT);
    const updated = await rejection(
      apps.updateApplication({ ref: appRef, ...autopilotApp("google/gemini-2.0-flash") } as any)
    );
    assert.equal(updated.code, GRPC.INVALID_ARGUMENT);
  });

  it("refuses a wrong API secret with UNAUTHENTICATED", async () => {
    const err = await rejection(client("wrong-secret"));
    assert.equal(err.code, GRPC.UNAUTHENTICATED);
  });

  it("refuses createCall from a number it doesn't own, or for an unknown app", async () => {
    const { calls, appRef } = await setup();
    const notOurs = await rejection(
      calls.createCall({ from: "+18095559999", to: "+18095550101", appRef })
    );
    assert.equal(notOurs.code, GRPC.PERMISSION_DENIED);
    const unknownApp = await rejection(
      calls.createCall({
        from: FROM,
        to: "+18095550101",
        appRef: "00000000-0000-4000-8000-000000000000"
      })
    );
    assert.equal(unknownApp.code, GRPC.NOT_FOUND);
  });

  it("completes a scripted answered call with signed call.ended then call_record.sealed", async () => {
    const { calls, records, appRef } = await setup();
    const to = "+18095550111";
    const scripted = await control("POST", "/_fake/calls/script", {
      to,
      outcome: "answered",
      durationSeconds: 60,
      transcript: [
        { role: "agent", text: "Hola, le habla Clara." },
        { role: "caller", text: "Le pago el viernes" }
      ]
    });
    assert.deepEqual(scripted, { status: 200, body: { to, queued: 1 } });
    const { ref } = await calls.createCall({ from: FROM, to, appRef });

    const done = await control("POST", `/_fake/calls/${ref}/complete`);
    assert.equal(done.status, 200);
    assert.equal(done.body.state, "completed");
    assert.deepEqual(
      done.body.deliveries.map((d: any) => [d.type, d.status]),
      [
        ["call.ended", 200],
        ["call_record.sealed", 200]
      ]
    );

    assert.deepEqual(
      received.map((r) => r.event.type),
      ["call.ended", "call_record.sealed"]
    );
    const now = Math.floor(Date.now() / 1000);
    for (const r of received) {
      assert.ok(fonosterWebhookEventSchema.safeParse(r.event).success);
      assert.ok(verifyFonosterSignature(r.raw, r.headers, WEBHOOK_SECRET, now));
      assert.equal(r.event.data.callRef, ref);
    }
    assert.equal(received[0].event.data.durationSeconds, 60);
    assert.equal(received[1].event.data.version, 1);

    const record = (await records.getRecord(ref)) as unknown as VoiceCallRecord;
    const history = chatHistoryFromCallRecord(record);
    assert.deepEqual(history, [{ ai: "Hola, le habla Clara." }, { human: "Le pago el viernes" }]);

    const cdr = await calls.getCall(ref);
    assert.equal(cdr.status as unknown as string, "NORMAL_CLEARING");
    assert.equal(cdr.duration, 60);
  });

  it("completes a scripted busy call with call.failed then call_record.sealed", async () => {
    const { calls, appRef } = await setup();
    const to = "+18095550122";
    await control("POST", "/_fake/calls/script", { to, outcome: "busy" });
    const { ref } = await calls.createCall({ from: FROM, to, appRef });

    await control("POST", `/_fake/calls/${ref}/complete`);

    assert.deepEqual(
      received.map((r) => r.event.type),
      ["call.failed", "call_record.sealed"]
    );
    assert.equal(received[0].event.data.reason, "busy");
    const cdr = await calls.getCall(ref);
    assert.equal(cdr.status as unknown as string, "USER_BUSY");
  });

  it("has no CDR and no record for a call not yet completed", async () => {
    const { calls, records, appRef } = await setup();
    const { ref } = await calls.createCall({ from: FROM, to: "+18095550133", appRef });
    const cdr = await rejection(calls.getCall(ref));
    assert.equal(cdr.code, GRPC.NOT_FOUND);
    const record = await rejection(records.getRecord(ref));
    assert.equal(record.status, 404);
  });

  it("delivers in the requested order, redelivers with a fresh signature, and completes once", async () => {
    const { calls, appRef } = await setup();
    const { ref } = await calls.createCall({ from: FROM, to: "+18095550144", appRef });

    const done = await control("POST", `/_fake/calls/${ref}/complete`, {
      order: ["call_record.sealed", "call.ended"]
    });
    assert.deepEqual(
      received.map((r) => r.event.type),
      ["call_record.sealed", "call.ended"]
    );

    const first = received[0];
    const eventId = done.body.deliveries[0].eventId;
    assert.equal(eventId, first.event.id);
    // A second apart, so the fresh timestamp (and signature) must differ.
    await new Promise((r) => setTimeout(r, 1100));
    const again = await control("POST", `/_fake/calls/${ref}/redeliver`, { eventId });
    assert.equal(again.status, 200);
    assert.equal(again.body.eventId, eventId);
    const resent = received[2];
    assert.equal(resent.raw.toString("utf8"), first.raw.toString("utf8"));
    assert.notEqual(resent.headers["x-fonoster-signature"], first.headers["x-fonoster-signature"]);
    assert.ok(
      verifyFonosterSignature(
        resent.raw,
        resent.headers,
        WEBHOOK_SECRET,
        Math.floor(Date.now() / 1000)
      )
    );

    const twice = await control("POST", `/_fake/calls/${ref}/complete`);
    assert.equal(twice.status, 409);
    assert.equal(twice.body.error.code, "conflict");
  });
});
