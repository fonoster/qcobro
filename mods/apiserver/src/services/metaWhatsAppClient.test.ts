import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MetaWhatsAppClient, checkWhatsAppConnection } from "./metaWhatsAppClient.js";

const SETTINGS = {
  phoneNumberId: "pn-1",
  accessToken: "tok",
  wabaId: "waba-1",
  apiBaseUrl: "https://graph.example.com",
  apiVersion: "v18.0"
};

const TEMPLATES_OK_BODY = {
  data: [
    {
      id: "tmpl-1",
      name: "saldo_pendiente",
      language: "es_DO",
      status: "APPROVED",
      components: [{ type: "BODY", text: "Hola {{1}}" }]
    }
  ]
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const originalFetch = globalThis.fetch;

describe("MetaWhatsAppClient.fetchTemplate retry/backoff", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("succeeds on the first try with no retries", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(200, TEMPLATES_OK_BODY);
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    const found = await client.fetchTemplate("tmpl-1");

    assert.equal(calls, 1);
    assert.equal(found?.name, "saldo_pendiente");
    assert.equal(found?.body, "Hola {{1}}");
  });

  it("retries a transient 503 and succeeds once Meta recovers", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) return jsonResponse(503, { error: { message: "Service unavailable" } });
      return jsonResponse(200, TEMPLATES_OK_BODY);
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    const found = await client.fetchTemplate("tmpl-1");

    assert.equal(calls, 3, "should retry twice before succeeding on the 3rd attempt");
    assert.equal(found?.name, "saldo_pendiente");
  });

  it("retries a 429 rate limit the same as a 5xx", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 2) return jsonResponse(429, { error: { message: "Rate limited" } });
      return jsonResponse(200, TEMPLATES_OK_BODY);
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    const found = await client.fetchTemplate("tmpl-1");

    assert.equal(calls, 2);
    assert.equal(found?.name, "saldo_pendiente");
  });

  it("gives up after 3 attempts if Meta keeps returning 5xx", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(500, { error: { message: "Internal error" } });
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    await assert.rejects(() => client.fetchTemplate("tmpl-1"), /WhatsApp template fetch failed/);
    assert.equal(calls, 3, "exactly 3 attempts, no more");
  });

  it("does NOT retry a 401 — auth failures won't succeed on a second try", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(401, { error: { message: "Invalid OAuth access token" } });
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    await assert.rejects(() => client.fetchTemplate("tmpl-1"), /Invalid OAuth access token/);
    assert.equal(calls, 1, "a 401 must fail fast, not retry");
  });

  it("does NOT retry a 403 permission error", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(403, { error: { message: "Permissions error" } });
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    await assert.rejects(() => client.fetchTemplate("tmpl-1"));
    assert.equal(calls, 1);
  });

  it("returns null when the template id is not found in an otherwise-successful response", async () => {
    globalThis.fetch = (async () => jsonResponse(200, TEMPLATES_OK_BODY)) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    const found = await client.fetchTemplate("does-not-exist");
    assert.equal(found, null);
  });
});

describe("MetaWhatsAppClient send methods never retry", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sendTemplate throws immediately on a 503 (no retry — avoids double-sending)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(503, { error: { message: "Service unavailable" } });
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    await assert.rejects(() =>
      client.sendTemplate({
        to: "+18095551234",
        templateName: "saldo_pendiente",
        languageCode: "es_DO",
        params: []
      })
    );
    assert.equal(calls, 1);
  });

  it("sendText throws immediately on a 503 (no retry — avoids double-sending)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return jsonResponse(503, { error: { message: "Service unavailable" } });
    }) as typeof fetch;

    const client = new MetaWhatsAppClient(SETTINGS);
    await assert.rejects(() => client.sendText({ to: "+18095551234", body: "hola" }));
    assert.equal(calls, 1);
  });
});

describe("MetaWhatsAppClient.checkConnection / checkWhatsAppConnection", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns true when the WABA node is reachable", async () => {
    globalThis.fetch = (async () => jsonResponse(200, { id: "waba-1" })) as typeof fetch;
    const client = new MetaWhatsAppClient(SETTINGS);
    assert.equal(await client.checkConnection(), true);
  });

  it("returns false (never throws) on a 401 — a revoked token is 'not connected'", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(401, { error: { message: "Invalid OAuth access token" } })) as typeof fetch;
    const client = new MetaWhatsAppClient(SETTINGS);
    assert.equal(await client.checkConnection(), false);
  });

  it("returns false (never throws) on a network error", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const client = new MetaWhatsAppClient(SETTINGS);
    assert.equal(await client.checkConnection(), false);
  });

  it("checkWhatsAppConnection builds a client from bare settings (no phoneNumberId needed)", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: string) => {
      seenUrl = String(url);
      return jsonResponse(200, { id: "waba-1" });
    }) as typeof fetch;

    const ok = await checkWhatsAppConnection({
      wabaId: "waba-1",
      accessToken: "tok",
      apiBaseUrl: "https://graph.example.com",
      apiVersion: "v18.0"
    });

    assert.equal(ok, true);
    assert.equal(seenUrl, "https://graph.example.com/v18.0/waba-1?fields=id");
  });
});
